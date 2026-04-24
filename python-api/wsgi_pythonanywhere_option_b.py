# =============================================================================
# PythonAnywhere — Option B: set secrets here, then paste this entire file
# into your site's WSGI config (Web → your app → "WSGI configuration file").
#
# 1) Replace YOUR_USERNAME with your PythonAnywhere username (three places).
# 2) Fill in SMTP and/or Telegram. Leave strings empty ("") if unused.
# 3) Save, then click the green "Reload" button for the web app.
# =============================================================================

import os
import sys

# --- Project path (edit YOUR_USERNAME) ---
PROJECT_HOME = "/home/YOUR_USERNAME/qr-studio/python-api"
if PROJECT_HOME not in sys.path:
    sys.path.insert(0, PROJECT_HOME)
os.chdir(PROJECT_HOME)

# --- Option B: environment variables (edit values; keep quotes) ---

# Email (Gmail: use an App password, not your normal Google password)
os.environ["SMTP_HOST"] = "smtp.gmail.com"
os.environ["SMTP_PORT"] = "587"
os.environ["SMTP_USER"] = "you@gmail.com"
os.environ["SMTP_PASS"] = "your-16-char-app-password"
os.environ["SMTP_SECURE"] = "false"
os.environ["SMTP_FROM"] = "QR Studio <you@gmail.com>"

# Optional: for port 465 with SSL use for example:
# os.environ["SMTP_PORT"] = "465"
# os.environ["SMTP_SECURE"] = "true"

# Telegram — token from @BotFather
os.environ["TELEGRAM_BOT_TOKEN"] = "123456789:ABCdefGHI..."

# Min milliseconds between scan notifications per link (default 60000)
os.environ["SCAN_EMAIL_THROTTLE_MS"] = "60000"

# Import the Flask app (must define `application` for PythonAnywhere)
from app import app as application
