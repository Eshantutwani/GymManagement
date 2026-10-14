import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

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
          const token = await u.getIdTokenResult(true); // admin comes from a server-set custom claim
          admin = token.claims.admin === true;
        }
        setIsAdmin(admin);
        setUser(u);
        setLoading(false);
      }),
    []
  );

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  // Registration always creates a "member". Rules reject any other role.
  const register = async ({ fullName, email, phone, password, dateOfBirth }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: fullName });
    await setDoc(doc(db, "users", uid), { uid, fullName, email, phone, role: "member", createdAt: serverTimestamp() });
    await setDoc(doc(db, "members", uid), {
      memberId: uid, uid, fullName, email, phone, dateOfBirth: dateOfBirth || "", gender: "", address: "",
      joinedAt: serverTimestamp(), membershipId: null, membershipStartDate: null, membershipEndDate: null, status: "pending",
    });
  };

  return <AuthContext.Provider value={{ user, isAdmin, loading, login, logout, register }}>{children}</AuthContext.Provider>;
}
