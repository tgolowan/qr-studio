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

- Add these files; install dependencies in a virtualenv.
- **WSGI** file: import `app` from `app` and use `application = app` (or point the WSGI config at `app:app` per their docs).
- **Static files:** this service does not serve the React UI; only API routes are needed.
- **Environment** variables: set `TELEGRAM_BOT_TOKEN`, SMTP, etc. in the web app config.

## Data

`data/tracks.json` is created next to `app.py`. For persistence, use a paid mount or a managed DB in production if the host wipes disk.
