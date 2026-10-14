// Seeds plans, members, trainers, payments and attendance (emulator or a dev project).
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='choose-one' npm run seed
// Admin credentials come from the environment; nothing is hardcoded.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const { SEED_ADMIN_EMAIL: adminEmail, SEED_ADMIN_PASSWORD: adminPass } = process.env;
if (!adminEmail || !adminPass) { console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD."); process.exit(1); }

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(usingEmulator
  ? { projectId: process.env.GCLOUD_PROJECT || "demo-gym" }
  : { credential: applicationDefault() });
const db = getFirestore();
const auth = getAuth();

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const key = d => d.toISOString().slice(0, 10);
const now = new Date();

let admin;
try { admin = await auth.getUserByEmail(adminEmail); }
catch { admin = await auth.createUser({ email: adminEmail, password: adminPass, displayName: "Gym Owner" }); }
await auth.setCustomUserClaims(admin.uid, { admin: true });
await db.doc(`users/${admin.uid}`).set({ uid: admin.uid, fullName: "Gym Owner", email: adminEmail, phone: "", role: "admin", createdAt: FieldValue.serverTimestamp() });

const planDefs = [
  ["Monthly", 30, 1200, "Month-to-month access to the floor and classes."],
  ["Quarterly", 90, 3200, "Three months, one payment."],
  ["Half-Yearly", 180, 5800, "Six months with a trainer orientation."],
  ["Annual", 365, 10500, "Best rate. Includes two personal-training sessions."],
];
const plans = [];
for (const [planName, durationInDays, price, description] of planDefs) {
  const ref = db.collection("membershipPlans").doc();
  const plan = { planId: ref.id, planName, durationInDays, price, description, isActive: true };
  await ref.set(plan); plans.push(plan);
}

const trainerDefs = [["Arjun Mehta", "Strength and conditioning"], ["Priya Nair", "Yoga and mobility"], ["Rohan Desai", "Weight loss and HIIT"]];
const trainers = [];
for (const [fullName, specialization] of trainerDefs) {
  const ref = db.collection("trainers").doc();
  const t = { trainerId: ref.id, fullName, email: `${fullName.split(" ")[0].toLowerCase()}@forge.example`, phone: "9800000000", specialization, assignedMembers: [] };
  await ref.set(t); trainers.push({ ref, t });
}

const names = ["Aarav Shah", "Diya Patel", "Kabir Singh", "Meera Iyer", "Vikram Rao", "Anaya Gupta", "Ishaan Joshi", "Sara Khan", "Neil Fernandes", "Tara Menon", "Yash Kulkarni", "Riya Malhotra"];
const ago = [5, 20, 40, 95, 130, 200, 10, 70, 25, 150, 60, 15];
const methods = ["cash", "upi", "card", "bank_transfer"];
for (let i = 0; i < names.length; i++) {
  const plan = plans[i % plans.length];
  const start = addDays(now, -ago[i]);
  const end = addDays(start, plan.durationInDays);
  const status = end < now ? "expired" : "active";
  const ref = db.collection("members").doc();
  const first = names[i].split(" ")[0].toLowerCase();
  await ref.set({
    memberId: ref.id, uid: "", fullName: names[i], email: `${first}@example.com`, phone: String(9800000000 + i * 1111),
    dateOfBirth: `199${i % 10}-0${(i % 9) + 1}-1${i % 9}`, gender: i % 2 ? "female" : "male", address: "Mumbai",
    joinedAt: Timestamp.fromDate(start), membershipId: plan.planId,
    membershipStartDate: Timestamp.fromDate(start), membershipEndDate: Timestamp.fromDate(end), status,
  });
  const pay = db.collection("payments").doc();
  await pay.set({ paymentId: pay.id, memberId: ref.id, amount: plan.price, paymentDate: Timestamp.fromDate(start), paymentMethod: methods[i % 4], status: "paid", recordedBy: admin.uid, createdAt: FieldValue.serverTimestamp() });
  if (status === "active") {
    for (let d = 0; d < 14; d++) {
      if ((d + i) % 3 === 0) continue;
      const day = addDays(now, -d);
      const aid = `${ref.id}_${key(day)}`;
      const t0 = new Date(day); t0.setHours(6 + (i % 10), 15, 0, 0);
      const t1 = new Date(t0); t1.setHours(t0.getHours() + 1, 20, 0, 0);
      await db.doc(`attendance/${aid}`).set({ attendanceId: aid, memberId: ref.id, date: key(day), checkInTime: Timestamp.fromDate(t0), checkOutTime: Timestamp.fromDate(t1) });
    }
  }
  trainers[i % trainers.length].t.assignedMembers.push(ref.id);
}
for (const { ref, t } of trainers) await ref.update({ assignedMembers: t.assignedMembers });
console.log(`Seeded ${plans.length} plans, ${names.length} members, ${trainers.length} trainers. Admin: ${adminEmail}`);
