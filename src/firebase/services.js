// Firestore data-access layer. Every page talks to Firestore only through these functions.
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, writeBatch, runTransaction, arrayRemove, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db, auth } from "./config";
import { addDays, dateKey } from "../utils";
import { beginActivity, finishActivity, trackActivity } from "./activity";

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/* ---------------- Membership plans ---------------- */
export const listPlans = async () => rows(await trackActivity(
  "Firestore · READ membershipPlans (order by durationInDays)",
  () => getDocs(query(collection(db, "membershipPlans"), orderBy("durationInDays"))),
  'getDocs(query(collection(db, "membershipPlans"), orderBy("durationInDays")))'
));

export async function savePlan({ id, planName, durationInDays, price, description, isActive }) {
  const data = { planName: planName.trim(), durationInDays: Number(durationInDays), price: Number(price), description: description?.trim() || "", isActive: !!isActive };
  if (id) return trackActivity(
    "Firestore · UPDATE membershipPlans/{id}",
    () => updateDoc(doc(db, "membershipPlans", id), data),
    `updateDoc(doc(db, "membershipPlans", ${JSON.stringify(id)}), { planName, durationInDays, price, description, isActive })`
  );
  const ref = doc(collection(db, "membershipPlans"));
  return trackActivity(
    "Firestore · CREATE membershipPlans/{id}",
    () => setDoc(ref, { ...data, planId: ref.id }),
    'setDoc(ref, { planId: ref.id, planName, durationInDays, price, description, isActive })'
  );
}
export const deletePlan = (id) => trackActivity(
  "Firestore · DELETE membershipPlans/{id}",
  () => deleteDoc(doc(db, "membershipPlans", id)),
  `deleteDoc(doc(db, "membershipPlans", ${JSON.stringify(id)}))`
);

export async function addDefaultPlans() {
  const defaults = [
    ["Monthly", 30, 1200, "Month-to-month access."],
    ["Quarterly", 90, 3200, "Three months, one payment."],
    ["Half-Yearly", 180, 5800, "Six months with a trainer orientation."],
    ["Annual", 365, 10500, "Best rate for regulars."],
  ];
  const batch = writeBatch(db);
  defaults.forEach(([planName, durationInDays, price, description]) => {
    const ref = doc(collection(db, "membershipPlans"));
    batch.set(ref, { planId: ref.id, planName, durationInDays, price, description, isActive: true });
  });
  return trackActivity(
    "Firestore · BATCH CREATE membershipPlans (4 documents)",
    () => batch.commit(),
    'writeBatch(db); batch.set(ref, { planId, planName, durationInDays, price, description, isActive: true }) × 4; batch.commit()'
  );
}

/* ---------------- Members ---------------- */
export const listMembers = async () => rows(await trackActivity(
  "Firestore · READ members",
  () => getDocs(collection(db, "members")),
  'getDocs(collection(db, "members"))'
));
export const subscribeMember = (id, cb, onError) => {
  const activityId = beginActivity(
    "Firestore · LISTEN members/{id}",
    "listening",
    `onSnapshot(doc(db, "members", ${JSON.stringify(id)}), callback, onError)`
  );
  try {
    const unsubscribe = onSnapshot(
      doc(db, "members", id),
      (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
      (error) => {
        finishActivity(activityId, error);
        onError?.(error);
      }
    );
    return () => {
      unsubscribe();
      finishActivity(activityId);
    };
  } catch (error) {
    finishActivity(activityId, error);
    throw error;
  }
};

export async function addMember(data) {
  const ref = doc(collection(db, "members"));
  return trackActivity(
    "Firestore · CREATE members/{id}",
    () => setDoc(ref, {
      memberId: ref.id, uid: "", ...data, joinedAt: serverTimestamp(),
      membershipId: null, membershipStartDate: null, membershipEndDate: null, status: "pending",
    }),
    'setDoc(ref, { memberId: ref.id, uid: "", ...memberData, joinedAt: serverTimestamp(), membershipId: null, membershipStartDate: null, membershipEndDate: null, status: "pending" })'
  );
}
export const updateMember = (id, data) => trackActivity(
  "Firestore · UPDATE members/{id}",
  () => updateDoc(doc(db, "members", id), data),
  `updateDoc(doc(db, "members", ${JSON.stringify(id)}), { ...updatedMemberFields })`
);

// Cascade: removes the member's attendance and payments, and unlinks them from trainers.
export async function deleteMember(id) {
  const [att, pay, trainers] = await Promise.all([
    trackActivity("Firestore · READ attendance (where memberId matches)", () =>
      getDocs(query(collection(db, "attendance"), where("memberId", "==", id))),
      `getDocs(query(collection(db, "attendance"), where("memberId", "==", ${JSON.stringify(id)})))`),
    trackActivity("Firestore · READ payments (where memberId matches)", () =>
      getDocs(query(collection(db, "payments"), where("memberId", "==", id))),
      `getDocs(query(collection(db, "payments"), where("memberId", "==", ${JSON.stringify(id)})))`),
    trackActivity("Firestore · READ trainers (where assignedMembers contains member)", () =>
      getDocs(query(collection(db, "trainers"), where("assignedMembers", "array-contains", id))),
      `getDocs(query(collection(db, "trainers"), where("assignedMembers", "array-contains", ${JSON.stringify(id)})))`),
  ]);
  const batch = writeBatch(db);
  att.docs.forEach((d) => batch.delete(d.ref));
  pay.docs.forEach((d) => batch.delete(d.ref));
  trainers.docs.forEach((d) => batch.update(d.ref, { assignedMembers: arrayRemove(id) }));
  batch.delete(doc(db, "members", id));
  return trackActivity(
    `Firestore · BATCH DELETE member and related records (${att.size + pay.size + trainers.size + 1} writes)`,
    () => batch.commit(),
    `writeBatch(db); batch.delete() × ${att.size + pay.size}; batch.update(trainerRef, { assignedMembers: arrayRemove(memberId) }) × ${trainers.size}; batch.delete(doc(db, "members", ${JSON.stringify(id)})); batch.commit()`
  );
}

// Atomic: updates the member's plan/dates and (optionally) records the payment in one batch.
export async function assignPlan({ member, plan, startDate, payment }) {
  const start = new Date(startDate);
  const end = addDays(start, plan.durationInDays);
  const batch = writeBatch(db);
  batch.update(doc(db, "members", member.id), {
    membershipId: plan.id, membershipStartDate: Timestamp.fromDate(start), membershipEndDate: Timestamp.fromDate(end), status: "active",
  });
  if (payment) {
    const ref = doc(collection(db, "payments"));
    batch.set(ref, {
      paymentId: ref.id, memberId: member.id, amount: Number(payment.amount), paymentDate: Timestamp.fromDate(start),
      paymentMethod: payment.paymentMethod, status: "paid", recordedBy: auth.currentUser.uid, createdAt: serverTimestamp(),
    });
  }
  return trackActivity(
    `Firestore · BATCH UPDATE member plan${payment ? " and CREATE payment" : ""}`,
    () => batch.commit(),
    `writeBatch(db); batch.update(doc(db, "members", ${JSON.stringify(member.id)}), { membershipId: ${JSON.stringify(plan.id)}, membershipStartDate, membershipEndDate, status: "active" })${payment ? '; batch.set(paymentRef, { paymentId, memberId, amount, paymentDate, paymentMethod, status: "paid", recordedBy, createdAt })' : ""}; batch.commit()`
  );
}

/* ---------------- Payments ---------------- */
export const listPayments = async () => rows(await trackActivity(
  "Firestore · READ payments (order by paymentDate descending)",
  () => getDocs(query(collection(db, "payments"), orderBy("paymentDate", "desc"))),
  'getDocs(query(collection(db, "payments"), orderBy("paymentDate", "desc")))'
));
export const listMemberPayments = async (memberId) => {
  const list = rows(await trackActivity("Firestore · READ payments (where memberId matches)", () =>
    getDocs(query(collection(db, "payments"), where("memberId", "==", memberId))),
    `getDocs(query(collection(db, "payments"), where("memberId", "==", ${JSON.stringify(memberId)})))`));
  return list.sort((a, b) => b.paymentDate?.toMillis() - a.paymentDate?.toMillis());
};
export async function recordPayment({ memberId, amount, paymentDate, paymentMethod, status }) {
  const ref = doc(collection(db, "payments"));
  return trackActivity(
    "Firestore · CREATE payments/{id}",
    () => setDoc(ref, {
      paymentId: ref.id, memberId, amount: Number(amount), paymentDate: Timestamp.fromDate(new Date(paymentDate)),
      paymentMethod, status, recordedBy: auth.currentUser.uid, createdAt: serverTimestamp(),
    }),
    'setDoc(ref, { paymentId: ref.id, memberId, amount, paymentDate, paymentMethod, status, recordedBy, createdAt: serverTimestamp() })'
  );
}
export const deletePayment = (id) => trackActivity(
  "Firestore · DELETE payments/{id}",
  () => deleteDoc(doc(db, "payments", id)),
  `deleteDoc(doc(db, "payments", ${JSON.stringify(id)}))`
);

/* ---------------- Attendance ---------------- */

export async function listAttendance(days = 30) {
  const since = dateKey(addDays(new Date(), -days));
  const list = rows(await trackActivity("Firestore · READ attendance (date at or after value, order by date descending)", () =>
    getDocs(query(collection(db, "attendance"), where("date", ">=", since), orderBy("date", "desc"))),
    `getDocs(query(collection(db, "attendance"), where("date", ">=", ${JSON.stringify(since)}), orderBy("date", "desc")))`));
  return list.sort((a, b) => b.date.localeCompare(a.date) || (b.checkInTime?.toMillis?.() || 0) - (a.checkInTime?.toMillis?.() || 0));
}
export async function listMemberAttendance(memberId) {
  const list = rows(await trackActivity("Firestore · READ attendance (where memberId matches)", () =>
    getDocs(query(collection(db, "attendance"), where("memberId", "==", memberId))),
    `getDocs(query(collection(db, "attendance"), where("memberId", "==", ${JSON.stringify(memberId)})))`));
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

// Document ID = memberId_YYYY-MM-DD, so the transaction below can reject a second check-in on the same day.
export async function checkIn(memberId) {
  const id = `${memberId}_${dateKey()}`;
  const ref = doc(db, "attendance", id);
  await trackActivity(
    "Firestore · TRANSACTION attendance/{memberId_date} (check then create)",
    () => runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) throw new Error("This member has already checked in today.");
      tx.set(ref, { attendanceId: id, memberId, date: dateKey(), checkInTime: serverTimestamp(), checkOutTime: null });
    }),
    `runTransaction(db, async (tx) => { tx.get(doc(db, "attendance", ${JSON.stringify(id)})); if missing, tx.set(ref, { attendanceId, memberId, date, checkInTime: serverTimestamp(), checkOutTime: null }); })`
  );
}
export async function checkOut(memberId) {
  const attendanceId = `${memberId}_${dateKey()}`;
  const ref = doc(db, "attendance", attendanceId);
  const snap = await trackActivity(
    "Firestore · READ attendance/{memberId_date}",
    () => getDoc(ref),
    `getDoc(doc(db, "attendance", ${JSON.stringify(attendanceId)}))`
  );
  if (!snap.exists()) throw new Error("No check-in found for today.");
  if (snap.data().checkOutTime) throw new Error("This member has already checked out.");
  return trackActivity(
    "Firestore · UPDATE attendance/{memberId_date}",
    () => updateDoc(ref, { checkOutTime: serverTimestamp() }),
    `updateDoc(doc(db, "attendance", ${JSON.stringify(attendanceId)}), { checkOutTime: serverTimestamp() })`
  );
}

/* ---------------- Trainers ---------------- */
export const listTrainers = async () => rows(await trackActivity(
  "Firestore · READ trainers",
  () => getDocs(collection(db, "trainers")),
  'getDocs(collection(db, "trainers"))'
));
export async function saveTrainer({ id, fullName, email, phone, specialization, assignedMembers }) {
  const data = { fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), specialization: specialization.trim(), assignedMembers: assignedMembers || [] };
  if (id) return trackActivity(
    "Firestore · UPDATE trainers/{id}",
    () => updateDoc(doc(db, "trainers", id), data),
    `updateDoc(doc(db, "trainers", ${JSON.stringify(id)}), { fullName, email, phone, specialization, assignedMembers })`
  );
  const ref = doc(collection(db, "trainers"));
  return trackActivity(
    "Firestore · CREATE trainers/{id}",
    () => setDoc(ref, { ...data, trainerId: ref.id }),
    'setDoc(ref, { trainerId: ref.id, fullName, email, phone, specialization, assignedMembers })'
  );
}
export const deleteTrainer = (id) => trackActivity(
  "Firestore · DELETE trainers/{id}",
  () => deleteDoc(doc(db, "trainers", id)),
  `deleteDoc(doc(db, "trainers", ${JSON.stringify(id)}))`
);

/* ---------------- Aggregates ---------------- */
export const loadAll = async (attendanceDays = 30) => {
  const [members, plans, payments, trainers, attendance] = await Promise.all([
    listMembers(), listPlans(), listPayments(), listTrainers(), listAttendance(attendanceDays),
  ]);
  return { members, plans, payments, trainers, attendance };
};
