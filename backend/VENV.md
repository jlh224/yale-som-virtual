# Backend environment

The virtual environment lives outside OneDrive at `C:\venvs\lecture07`.

Recreate it:

    python -m venv C:\venvs\lecture07
    C:\venvs\lecture07\Scripts\python.exe -m pip install -r backend\requirements.txt

Run the backend from the repo root (the frontend's Vite dev server proxies `/api` to port 8007):

    C:\venvs\lecture07\Scripts\python.exe -m uvicorn main:app --app-dir backend --port 8007

It needs `PORTKEY_API_KEY` in a `.env` file in this repo or any folder above it.
