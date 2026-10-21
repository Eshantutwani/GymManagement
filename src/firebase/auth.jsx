import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";
import { trackActivity } from "./activity";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        let admin = false;
        if (u) {
          const token = await trackActivity(
            "Firebase Auth · Refresh ID token claims",
            () => u.getIdTokenResult(true),
            "user.getIdTokenResult(true)"
          ); // admin comes from a server-set custom claim
          admin = token.claims.admin === true;
        }
        setIsAdmin(admin);
        setUser(u);
        setLoading(false);
      }),
    []
  );

  const login = (email, password) =>
    trackActivity(
      "Firebase Auth · Sign in",
      () => signInWithEmailAndPassword(auth, email, password),
      'signInWithEmailAndPassword(auth, "<redacted email>", "<redacted password>")'
    );
  const logout = () => trackActivity("Firebase Auth · Sign out", () => signOut(auth), "signOut(auth)");

  // Registration always creates a "member". Rules reject any other role.
  const register = async ({ fullName, email, phone, password, dateOfBirth }) => {
    const cred = await trackActivity(
      "Firebase Auth · Create account",
      () => createUserWithEmailAndPassword(auth, email, password),
      'createUserWithEmailAndPassword(auth, "<redacted email>", "<redacted password>")'
    );
    const uid = cred.user.uid;
    await trackActivity(
      "Firebase Auth · Update account profile",
      () => updateProfile(cred.user, { displayName: fullName }),
      'updateProfile(user, { displayName: "<redacted>" })'
    );
    await trackActivity("Firestore · CREATE users/{uid}", () =>
      setDoc(doc(db, "users", uid), { uid, fullName, email, phone, role: "member", createdAt: serverTimestamp() }),
    `setDoc(doc(db, "users", ${JSON.stringify(uid)}), { uid, fullName, email, phone, role, createdAt })`);
    await trackActivity("Firestore · CREATE members/{uid}", () => setDoc(doc(db, "members", uid), {
      memberId: uid, uid, fullName, email, phone, dateOfBirth: dateOfBirth || "", gender: "", address: "",
      joinedAt: serverTimestamp(), membershipId: null, membershipStartDate: null, membershipEndDate: null, status: "pending",
    }), `setDoc(doc(db, "members", ${JSON.stringify(uid)}), { memberId, uid, fullName, email, phone, dateOfBirth, ... })`);
  };

  return <AuthContext.Provider value={{ user, isAdmin, loading, login, logout, register }}>{children}</AuthContext.Provider>;
}
