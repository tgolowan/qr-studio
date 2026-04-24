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
