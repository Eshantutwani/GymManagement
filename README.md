# Forge Fitness Club: Gym Management System (Firebase)

React + Vite front end on Cloud Firestore and Firebase Authentication. Admin and member roles, real CRUD, security rules, charts, CSV export, and full DBMS documentation in [`docs/DBMS.md`](docs/DBMS.md).

## 1. Install
```bash
npm install
npm install -g firebase-tools   # once
firebase login
```

## 2. Create the Firebase project
1. Firebase Console > Add project.
2. Build > Authentication > Get started > enable **Email/Password**.
3. Build > Firestore Database > Create database (production mode).
4. Project settings > Your apps > add a **Web app**; copy the config.
5. `cp .env.example .env` and paste the values. Put your project ID in `.firebaserc`.
6. Deploy the rules: `firebase deploy --only firestore:rules`

## 3. Run
```bash
npm run dev      # http://localhost:5173
```

## 4. Create the first admin
Admin status is a server-set custom claim; the website can never grant it.
1. Open the site and **register** an account with your admin email.
2. Console > Project settings > Service accounts > Generate new private key. Save it outside the repo (it is git-ignored as `serviceAccountKey.json` if you keep it here).
3. From the project folder, set the credential path and run the command. In Git Bash:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/serviceAccountKey.json"
npm run make-admin -- you@example.com
```
   In PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="$PWD\serviceAccountKey.json"
npm run make-admin -- you@example.com
```
   The script reads the project ID from `.env` (`VITE_FIREBASE_PROJECT_ID`). Keep the service-account key private; never put it in GitHub or Netlify environment variables.
4. Log out and log in again. You land on the admin dashboard. If the script reports that the key is missing, check that the path points to the downloaded JSON key.

## 5. Local development with the Emulator Suite (no cloud needed)
```bash
# terminal 1
npm run emulators
# terminal 2: seed data (admin credentials come from your environment)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='pick-a-password' npm run seed
# terminal 3: set VITE_USE_EMULATORS=true and VITE_FIREBASE_PROJECT_ID=demo-gym in .env, then
npm run dev
```
Seeding creates 4 plans, 12 members, 3 trainers, payments and 14 days of attendance.

## 6. Deploy to Netlify
Netlify hosts the website; Firebase still provides the database and login. `netlify.toml` already sets the build command, publish folder and the redirect that makes routes like `/admin/members` work on refresh.

1. Push the project to GitHub (`.env` and `serviceAccountKey.json` are git-ignored, so they are not uploaded).
2. Deploy the security rules once from your machine: `firebase deploy --only firestore:rules`
3. Netlify > Add new site > Import an existing project > pick the GitHub repo. The build command (`npm run build`), publish directory (`dist`), and SPA route redirect are configured in `netlify.toml`.
4. In Netlify site configuration > Environment variables, add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` with the values from your local `.env`. Set `VITE_USE_EMULATORS` to `false` or leave it unset. Do not add a service-account key to Netlify; these `VITE_FIREBASE_*` values are the web app's client configuration, while Firestore security rules protect data access.
5. Deploy. Then copy your site address (for example `your-site.netlify.app`).
6. Firebase Console > Authentication > Settings > **Authorized domains** > Add domain > paste the Netlify address. Without this step, login fails on the live site.
7. Re-deploy on Netlify any time you change an environment variable (Deploys > Trigger deploy).

Prefer drag-and-drop? Run `npm run build` locally (with `.env` filled in) and drag the `dist` folder onto Netlify Drop. You still need step 6.

## 7. Demo checklist
1. Log in as admin: dashboard stats and charts come from Firestore.
2. Members: add, edit, search, filter, delete (with confirmation), assign a plan with payment.
3. Payments, Attendance (try a second check-in the same day), Trainers, Reports > Export CSV.
4. Register a second account in a private window. Its profile appears under Members as "No plan". Assign a plan and watch the member page update live.
5. As that member, try reading another member's data from the browser console: the rules deny it.

## Structure
```
src/firebase/   config, auth context, Firestore services
src/components/ Layout, UI kit (modal, toast, table), charts
src/pages/      Landing, Auth, admin/*, member/*
firestore.rules least-privilege security rules
scripts/        seed.js, set-admin.js
docs/DBMS.md    problem statement, ER diagram, schema, queries
```

## Notes
- Payments are manual records; no online payment is processed.
- The landing hero loads a photo from Unsplash; swap the URL in `styles.css` (`.hero`) for your own image in `public/`.
- Contact details on the landing page are placeholders. Edit `src/pages/Landing.jsx`.
- Not yet tested against a live Firebase project or the emulator; run the demo checklist after setup.
