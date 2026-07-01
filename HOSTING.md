# Hosting the E-Students QR System for free

This app deploys as **one Render web service** (Express serves the API *and* the
built React app) plus a **Neon PostgreSQL** database. Both have free tiers with
no credit card required. Total cost: ₦0.

- **Render (free web service):** runs the Node server. Note: free services sleep
  after ~15 minutes idle, so the first request after a quiet period takes
  ~30–60 seconds to wake. Fine for a project demo.
- **Neon (free Postgres):** stores the data. Unlike Render's own free database
  (which is deleted after 30 days), Neon's free tier does not expire.

---

## Step 0 — Accounts you'll need
Create free accounts (sign in with GitHub for all three):
- https://github.com
- https://neon.tech
- https://render.com

## Step 1 — Put the code on GitHub
From the project folder:
```bash
git init
git add .
git commit -m "E-Students QR System"
```
Create a new empty repo on GitHub, then:
```bash
git remote add origin https://github.com/<you>/qr-students.git
git branch -M main
git push -u origin main
```
`server/.env` is git-ignored, so your local secrets are **not** pushed. You'll
set the real values on Render instead.

## Step 2 — Create the database on Neon
1. In the Neon console, create a new project (any name; pick the region closest
   to you).
2. Open **Connection Details** and copy the connection string. It looks like:
   ```
   postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
   ```
3. Keep this handy — it becomes `DATABASE_URL` on Render.

## Step 3 — Generate your secrets
Run this locally three times (or once and split the output) to get three
different random strings:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Use them for `JWT_SECRET`, `QR_ENC_KEY`, and `CARD_TOKEN_SECRET`.

## Step 4 — Deploy on Render
The repo already contains `render.yaml`, so:
1. In Render, click **New → Blueprint** and select your GitHub repo.
2. Render reads `render.yaml` and proposes one web service. Approve it.
3. When prompted, fill in the environment variables:

   | Key                 | Value                                              |
   |---------------------|----------------------------------------------------|
   | `DATABASE_URL`      | the Neon connection string from Step 2             |
   | `JWT_SECRET`        | random string 1                                    |
   | `QR_ENC_KEY`        | random string 2                                    |
   | `CARD_TOKEN_SECRET` | random string 3                                    |
   | `ADMIN_EMAIL`       | the admin login email, e.g. `admin@oduduwa.edu.ng` |
   | `ADMIN_PASSWORD`    | a strong admin password you choose                 |

   (`NODE_ENV=production` is already set by the blueprint.)
4. Click **Apply / Create**. Render runs:
   - **Build:** `npm install && npm run build` (installs the server, then builds
     the React app).
   - **Start:** `npm start`, which runs `server/db/init.js` (creates the tables
     and seeds the admin account) and then starts the server.

If you'd rather not use the blueprint, create a **Web Service** manually with:
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- the same environment variables as above.

## Step 5 — Log in
When the deploy finishes, Render gives you a URL like
`https://e-students-qr.onrender.com`. Open it and sign in with the
`ADMIN_EMAIL` / `ADMIN_PASSWORD` you set. Register a student from the public
page, approve it from the admin dashboard, and verify its QR — all live.

---

## Notes & tips
- **Cold start:** after the service sleeps, the first load takes ~30–60s. Open
  the URL a couple of minutes before a demo so it's already awake.
- **Data persistence:** your data lives in Neon and persists across restarts and
  redeploys. Neon may suspend the database compute after inactivity; it resumes
  automatically on the next connection.
- **`init` on start:** the start command re-runs `init.js` on each boot. It is
  idempotent (`CREATE TABLE IF NOT EXISTS`; the admin is only seeded if absent),
  so this is safe.
- **Changing the admin password:** set `ADMIN_PASSWORD` before the first deploy.
  To change it later, update the value in the Neon database directly, or delete
  the admin row and redeploy to reseed.
- **Never commit `server/.env`.** It stays local; production secrets live only in
  Render's dashboard.
- **Custom domain / separate frontend:** not needed here (one service serves
  both). If you ever split them, set `CORS_ORIGIN` to the front-end URL.
