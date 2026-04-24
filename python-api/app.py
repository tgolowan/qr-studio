"""
Tracking API (Flask) — same contract as the Node server in ../server/
Use with the QR Studio UI: VITE_TRACKING_API_URL=https://your-python-host
"""

from __future__ import annotations

import html
import json
import os
import re
import secrets
import smtplib
import string
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, Response

load_dotenv()

app = Flask(__name__)

# CORS: browser on localhost and production Vite may POST from file:// or any origin
from flask_cors import CORS

CORS(app, resources={r"/*": {"origins": "*"}})

_DATA_DIR = Path(__file__).resolve().parent / "data"
_STORE_PATH = _DATA_DIR / "tracks.json"
_LOCK = __import__("threading").Lock()

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_CHAT_ID_RE = re.compile(r"^-?\d{4,20}$")
_NANO_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-"


def _new_id() -> str:
    return "".join(secrets.choice(_NANO_ALPHABET) for _ in range(12))


def _load_store() -> dict:
    with _LOCK:
        if not _STORE_PATH.is_file():
            return {}
        try:
            return json.loads(_STORE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}


def _save_store(data: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _STORE_PATH.with_suffix(".tmp")
    with _LOCK:
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(_STORE_PATH)


def _is_valid_http_url(s: str) -> bool:
    try:
        from urllib.parse import urlparse

        u = urlparse(s)
        return u.scheme in ("http", "https") and bool(u.netloc)
    except Exception:
        return False


def is_mail_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))


def is_telegram_configured() -> bool:
    t = os.getenv("TELEGRAM_BOT_TOKEN") or ""
    return len(t) > 10


def send_mail(to: str, subject: str, text: str, html_body: str) -> dict:
    if not is_mail_configured():
        print("[qr-studio-py] email skipped: SMTP not set")
        return {"ok": False, "skipped": True}
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    port = int(os.getenv("SMTP_PORT") or "587")
    smtp_from = os.getenv("SMTP_FROM") or f"QR Studio <{user}>"
    secure = os.getenv("SMTP_SECURE", "").lower() == "true" or port == 465

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if secure and port == 465:
        with smtplib.SMTP_SSL(host, port) as smtp:  # type: ignore
            smtp.login(user, password)  # type: ignore
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as smtp:  # type: ignore
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(user, password)  # type: ignore
            smtp.send_message(msg)
    return {"ok": True}


def to_telegram_chat_id(s: str) -> int | str:
    t = s.strip()
    if re.match(r"^-?\d+$", t):
        n = int(t)
        if -(2**63) < n < 2**63:
            return n
    return t


def send_telegram(chat_id: str, text: str) -> dict:
    if not is_telegram_configured():
        print("[qr-studio-py] Telegram skipped: TELEGRAM_BOT_TOKEN not set")
        return {"ok": False, "skipped": True}
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    ch = to_telegram_chat_id(chat_id)
    r = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={
            "chat_id": ch,
            "text": text,
            "disable_web_page_preview": True,
        },
        timeout=20,
    )
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:500]}
    if not r.ok or body.get("ok") is False:
        err = body.get("description", body)
        raise RuntimeError(f"Telegram API {r.status}: {err}")
    print("[qr-studio-py] Telegram ok", body.get("result", {}).get("message_id"))
    return {"ok": True}


@app.get("/api/health")
def health():
    return jsonify(
        ok=True,
        mail=is_mail_configured(),
        telegram=is_telegram_configured(),
        engine="python",
    )


@app.post("/api/tracks")
def post_track():
    body = request.get_json(silent=True) or {}
    target_url = body.get("targetUrl")
    notify_email = (body.get("notifyEmail") or "").strip() if isinstance(body.get("notifyEmail"), str) else ""
    notify_chat = (body.get("notifyTelegramChatId") or "").strip() if isinstance(body.get("notifyTelegramChatId"), str) else ""

    if not isinstance(target_url, str) or not _is_valid_http_url(target_url):
        return jsonify(error="targetUrl must be a valid http(s) URL"), 400
    if notify_email and not _EMAIL_RE.match(notify_email):
        return jsonify(error="notifyEmail must be a valid address"), 400
    if notify_chat and not _CHAT_ID_RE.match(notify_chat):
        return jsonify(error="notifyTelegramChatId must be numeric (your Telegram user or group id)"), 400
    if not notify_email and not notify_chat:
        return jsonify(error="Set notifyEmail and/or notifyTelegramChatId"), 400

    tid = _new_id()
    store = _load_store()
    store[tid] = {
        "targetUrl": target_url,
        "notifyEmail": notify_email,
        "notifyTelegramChatId": notify_chat,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    _save_store(store)
    return jsonify(id=tid, mail=is_mail_configured(), telegram=is_telegram_configured())


@app.get("/t/<track_id>")
def track_open(track_id: str):
    store = _load_store()
    row = store.get(track_id)
    if not row:
        return Response(
            "<!DOCTYPE html><html><body><p>Unknown link.</p></body></html>",
            mimetype="text/html",
            status=404,
        )
    min_gap_ms = int(os.getenv("SCAN_EMAIL_THROTTLE_MS") or "60000")
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    last = int(row.get("lastNotifiedAt") or 0)
    can_notify = now - last >= min_gap_ms

    target = row.get("targetUrl", "")
    ua = request.headers.get("User-Agent", "unknown")
    xff = request.headers.get("X-Forwarded-For", "")
    ip = (xff.split(",")[0].strip() if xff else None) or (request.remote_addr or "")

    if can_notify:
        t_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        body_text = f"""Your tracked QR was opened.

Destination: {target}
Time (server): {t_iso}
IP: {ip}
User-Agent: {ua}
"""
        subj = "QR code opened"
        html_page = f"""<p>Your tracked QR was opened.</p>
<ul>
<li><strong>Destination:</strong> {html.escape(str(target))}</li>
<li><strong>Time:</strong> {html.escape(t_iso)}</li>
<li><strong>IP:</strong> {html.escape(str(ip))}</li>
</ul>
<p><a href="{html.escape(str(target), quote=True)}">Continue to destination</a></p>"""

        throttled = False
        ne = (row.get("notifyEmail") or "").strip()
        if ne:
            try:
                r = send_mail(ne, subj, body_text, html_page)
                if r.get("ok") or r.get("skipped"):
                    throttled = True
            except Exception as e:
                print("[qr-studio-py] email failed", e)

        ntg = (row.get("notifyTelegramChatId") or "").strip()
        if ntg:
            if not is_telegram_configured():
                print("[qr-studio-py] track has TG chat but TELEGRAM_BOT_TOKEN missing")
            try:
                tr = send_telegram(ntg, body_text.strip())
                if tr.get("ok") or tr.get("skipped"):
                    throttled = True
            except Exception as e:
                print("[qr-studio-py] telegram failed", e)

        if throttled:
            store = _load_store()
            if track_id in store:
                store[track_id]["lastNotifiedAt"] = now
                _save_store(store)

    return redirect(target, code=302)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    # flask dev server; production: use gunicorn
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
