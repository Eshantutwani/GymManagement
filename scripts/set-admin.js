// Promote an existing account to admin.  Usage: npm run make-admin -- someone@example.com
// Requires GOOGLE_APPLICATION_CREDENTIALS (service account key) or the emulator env vars.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) { console.error("Usage: npm run make-admin -- <email>"); process.exit(1); }

const usingEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
function projectIdFromEnvFile() {
  try {
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    return env.match(/^VITE_FIREBASE_PROJECT_ID=["']?([^"'#\r\n]+)["']?\s*$/m)?.[1]?.trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

const projectId = process.env.GCLOUD_PROJECT
  || process.env.GOOGLE_CLOUD_PROJECT
  || process.env.FIREBASE_PROJECT_ID
  || process.env.VITE_FIREBASE_PROJECT_ID
  || projectIdFromEnvFile();

if (!usingEmulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to the path of your Firebase service-account JSON key, then run this command again."
  );
  process.exit(1);
}

if (!usingEmulator && !existsSync(resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
  console.error(`Service-account key not found: ${resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)}`);
  process.exit(1);
}

if (!projectId) {
  console.error("Firebase project ID not found. Set GCLOUD_PROJECT or VITE_FIREBASE_PROJECT_ID in .env.");
  process.exit(1);
}

initializeApp(usingEmulator
  ? { projectId: process.env.GCLOUD_PROJECT || projectId || "demo-gym" }
  : { credential: applicationDefault(), projectId });

const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { admin: true });
const db = getFirestore();
await db.doc(`users/${user.uid}`).set({ role: "admin", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
await db.doc(`members/${user.uid}`).delete(); // admins are staff, not gym members
console.log(`${email} is now an admin. Sign out and sign in again to refresh the token.`);
