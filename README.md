# E-Students' Information Storage System using QR Code

A web-based system that stores student records in PostgreSQL and issues each
student an **encrypted** QR code. Administrators manage records, approve
registrations, generate and verify QR codes, and view scan logs. Students log in
to view their profile and personal QR code.

The QR does **not** contain personal data. It holds an AES-256-GCM encrypted
token of the student id, so a generic phone camera sees only ciphertext. Only the
authenticated admin scanner can decrypt it (via `POST /api/students/verify`),
which then reads the live record from the database.

**Stack:** React (Vite) · Node.js/Express · PostgreSQL · JWT auth · `qrcode`

## Project structure
```
qr-students/
├── server/            Node.js + Express REST API
│   ├── index.js       app entry (helmet, CORS, rate-limit, error handler)
│   ├── middleware.js  JWT auth/role guard + asyncHandler
│   ├── routes/        auth.js, students.js
│   └── db/            pool.js, schema.sql, init.js
└── client/            React front-end (Vite)
    └── src/           pages/, components/, api.js, styles.css
```

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+

## Setup

### 1. Database
```bash
createdb qr_students          # or use psql / pgAdmin
```

### 2. Server
```bash
cd server
npm install
cp ../.env.example .env        # then edit the values (see below)
```
Edit `server/.env`:
- `DATABASE_URL` — your PostgreSQL connection string.
- `JWT_SECRET`, `QR_ENC_KEY`, `CARD_TOKEN_SECRET` — three **different** random
  strings. Generate each with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  The server refuses to start if any is missing, too short, or left as the
  example value.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the seeded admin. If `ADMIN_PASSWORD` is
  blank, `init.js` generates a random one and prints it once.
- `CORS_ORIGIN` — front-end origin(s), enforced when `NODE_ENV=production`.

Then:
```bash
node db/init.js                # creates tables + default admin (prints creds)
npm start                      # or: node index.js   (port 5000)
```

### 3. Client
```bash
cd client
npm install
npm run dev                    # http://localhost:5173
```
The Vite dev server proxies `/api` to the server on port 5000.

## Usage

### Student self-registration
1. From the login page, students click **Register here**.
2. They fill in their details and upload a **passport photograph** (JPEG/PNG,
   max 2 MB). The photo is validated in the browser (type, size, dimensions) and
   re-checked on the server (type, size).
3. The account is created with status **pending** — the student cannot log in yet.

### Admin approval
1. Sign in as administrator.
2. **Pending Approvals** — review each registration with its photo, then
   **Approve** (account becomes active, login enabled, QR generated) or **Reject**.
3. **Students** — view active students, see QR status, view/download a QR, edit,
   or delete a student.
4. **Verify QR** — open the camera scanner or paste an encrypted payload. The
   result shows the live student record and a link to the printable ID card.
   Outcomes: verified, inactive, not_found, invalid.
5. **Scan Logs** — review recent verification events.

### Student portal (after approval)
1. The student logs in and sees their profile, photo, and QR code.
2. They can edit basic details (name, department, level). Because the QR encodes
   only the student id, **editing does not invalidate the QR** — verification
   always reflects the current record.
3. **Regenerate QR Code** is available if a code was never generated or needs
   re-issuing.

## Account & QR lifecycle
- Registration → status `pending`, no QR.
- Admin approves → status `active`, QR generated and marked valid.
- Student edits details → QR stays valid (id-based).
- Verification reads the live record, so data is always current.

## QR payload format
The QR encodes an opaque, encrypted string:
```
enc:<base64url( iv | gcm_tag | ciphertext )>
```
The plaintext inside is `{ "id": <student_id>, "issued": "YYYY-MM-DD" }`,
encrypted with AES-256-GCM under a key derived from `QR_ENC_KEY`. Generic
scanners cannot read it; only `POST /api/students/verify` (admin-only) can.

## Security
- Passwords hashed with bcrypt; sessions use signed JWTs (8h expiry).
- API routes are role-protected (admin vs student) on every endpoint.
- QR codes are AES-256-GCM encrypted (authenticated — tampering is rejected).
- Three separated secrets (JWT / QR encryption / card-link token); the server
  refuses to boot on weak or placeholder values.
- `helmet` security headers; `express-rate-limit` on the auth endpoints.
- All database access uses parameterised queries (no SQL injection).
- Central error handler returns JSON 500s instead of leaking stack traces.

## Deployment notes
- Build the client with `npm run build` (output in `client/dist`) and serve it
  from any static host or via Express.
- Set `NODE_ENV=production` and a real `CORS_ORIGIN`.
- Run the API behind HTTPS.
