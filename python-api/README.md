# Python tracking API (Flask)

Same HTTP contract as the Node server in `../server/`: `POST /api/tracks`, `GET /t/<id>`, `GET /api/health`. Use the React app with:

```env
VITE_TRACKING_API_URL=https://your-python-host
```

## Local run

```bash
cd python-api
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env     # or create .env; same SMTP / Telegram / throttle vars
python app.py
```

**PythonAnywhere (missing modules):** the **Web** → *Virtualenv* path must be the venv where you ran `pip install -r requirements.txt` (e.g. `/home/you/qr-studio/python-api/venv`). In Bash: `source /path/to/venv/bin/activate` then `pip install -r .../python-api/requirements.txt`, then **Reload** the site. You need at least: `flask`, `requests`, `python-dotenv` (CORS is built into `app.py`).

## CORS: step-by-step (local QR app → PythonAnywhere API)

Do these in order:

1. **Use `https` for the API** in your PC’s project `.env` (repo root, next to the React app), no trailing slash:
   ```env
   VITE_TRACKING_API_URL=https://YOURUSERNAME.pythonanywhere.com
   ```
2. **Restart the Vite dev server** after changing `.env` (`Ctrl+C`, then `npm run dev` again) so Vite picks up the variable.
3. **Confirm the API is up:** open in a normal browser tab:
   `https://YOURUSERNAME.pythonanywhere.com/api/health`  
   You should see JSON. If you get an error page, fix the WSGI / reload first; CORS cannot work until the app runs.
4. On PythonAnywhere: **Web** → set **Virtualenv** to the venv where you ran `pip install -r requirements.txt` → **Reload**.
5. **Pull latest** `app.py` (we send `Access-Control-Allow-Origin: *` on all responses) and `git pull` on the server if you deploy from git.
6. In the app, **Public origin** should match that same `https://YOURUSERNAME.pythonanywhere.com` (it prefills from `VITE_TRACKING_API_URL`).

If the browser still reports CORS, open **DevTools → Network** → click the failed `tracks` (or preflight `OPTIONS`) request and read the **Response headers**. If `Access-Control-Allow-Origin` is missing, the response is not from this Flask app (cache or wrong URL). If the request is **blocked** before a response, check the request URL is exactly the HTTPS site above (no `http://`, no typo).

Default port **5000**; override with `PORT=5000`.

## Production (Gunicorn)

```bash
gunicorn -b 0.0.0.0:${PORT:-5000} app:app
```

## PythonAnywhere

- Clone the repo, create a venv in `python-api`, `pip install -r requirements.txt`, and set the **virtualenv path** on the Web tab.
- **WSGI:** open *Web → WSGI configuration file* and replace its contents with **`wsgi_pythonanywhere_option_b.py`** from this folder (edit `YOUR_USERNAME` and secrets), or use a minimal import only:

```python
import os, sys
project = "/home/YOUR_USERNAME/qr-studio/python-api"
os.chdir(project)
sys.path.insert(0, project)
from app import app as application
```

  …and set env in the [PythonAnywhere “Environment variables”](https://help.pythonanywhere.com/pages/EnvironmentVariables/) Web UI, **or** use Option B (all vars in WSGI) in `wsgi_pythonanywhere_option_b.py`.

- This API does not serve the React UI; only `/api` and `/t` are needed.
- Free accounts may need **outbound** access whitelisted for `api.telegram.org` and your SMTP host.

## Data

`data/tracks.json` is created next to `app.py`. For persistence, use a paid mount or a managed DB in production if the host wipes disk.
