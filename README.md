# Water Can Tracker

Mobile-first water can inventory app with a centralized SQLite database.

## Run

```powershell
cd C:\Users\Moham\Documents\Codex\2026-06-03\files-mentioned-by-the-user-water\outputs\water-can-mobile-app
python server.py
```

Open on this computer:

```text
http://localhost:8787
```

Open on phones on the same Wi-Fi while running locally:

```text
http://YOUR_COMPUTER_WIFI_IP:8787
```

The database is created automatically at:

```text
data\water_can_inventory.db
```

## Notes

- Every phone reads and writes through the same `/api/people` backend.
- The app auto-refreshes every 15 seconds and refreshes when a phone browser returns to the app.
- Use "Add to Home Screen" from a mobile browser to install it like a lightweight app.

## Deploy For Mobile Networks

To make it work from any mobile network, deploy this folder to a cloud host and use the public HTTPS URL.

### Vercel

Vercel deployment uses the included `api` serverless functions and a Marketplace Postgres database.

1. Upload this folder to a GitHub repo.
2. In Vercel, create a new project from the repo.
3. Add a Postgres database from Vercel Marketplace, such as Neon, Supabase, Prisma Postgres, or another Postgres provider.
4. Connect the database to this Vercel project so Vercel injects `POSTGRES_URL` or `DATABASE_URL`.
5. Deploy the project.
6. Open the generated `.vercel.app` URL from any phone.

Do not use the local SQLite file on Vercel. Vercel Functions need an external database for persistent shared data.

This app is deployment-ready as a single Python web service:

```text
Start command: python server.py
Port: use the platform-provided PORT environment variable
Persistent storage path: set DATA_DIR=/app/data, or mount persistent storage to the data folder
```

Important: use a host with persistent disk/volume storage. Without persistent storage, the SQLite database can reset after a redeploy or server restart.

Suggested simple deployment flow:

1. Upload this `water-can-mobile-app` folder to GitHub.
2. Create a new web service on Render, Railway, Fly.io, or another host that supports persistent volumes.
3. Use the included `Dockerfile`.
4. Add a persistent disk/volume mounted to `/app/data`.
5. Set environment variable `DATA_DIR=/app/data`.
6. Open the public HTTPS URL from any phone using mobile data.

### Railway

1. Go to Railway and create a new project from your GitHub repo.
2. Railway should detect the included `Dockerfile` and `railway.json`.
3. In the service settings, add a Volume.
4. Mount the volume to:

```text
/app/data
```

5. Add this environment variable:

```text
DATA_DIR=/app/data
```

6. Deploy and open the generated Railway domain.

### Render

1. Go to Render and create a new Blueprint from your GitHub repo, or create a Web Service manually.
2. Render should detect the included `render.yaml` if using Blueprint.
3. The config creates a Docker web service and mounts a disk at:

```text
/app/data
```

4. Deploy and open the generated `onrender.com` URL.

Note: Render persistent disks are available for paid services. Railway volumes also require configuring a volume for persistence.
