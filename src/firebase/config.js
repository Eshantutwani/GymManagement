import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Values come from .env (see .env.example). When the local emulator is enabled, we provide safe defaults
// so the app can boot without a real Firebase project during development.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-gym.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-gym",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-gym.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:demo-gym",
};

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

if (!useEmulators && !import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn("Firebase config is missing; using demo defaults. Add values to .env for a real project.");
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
