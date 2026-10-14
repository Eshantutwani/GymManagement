// Firestore data-access layer. Every page talks to Firestore only through these functions.
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, writeBatch, runTransaction, arrayRemove, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db, auth } from "./config";
import { addDays, dateKey } from "../utils";

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/* ---------------- Membership plans ---------------- */
export const listPlans = async () => rows(await getDocs(query(collection(db, "membershipPlans"), orderBy("durationInDays"))));

export async function savePlan({ id, planName, durationInDays, price, description, isActive }) {
  const data = { planName: planName.trim(), durationInDays: Number(durationInDays), price: Number(price), description: description?.trim() || "", isActive: !!isActive };
  if (id) return updateDoc(doc(db, "membershipPlans", id), data);
  const ref = doc(collection(db, "membershipPlans"));
  return setDoc(ref, { ...data, planId: ref.id });
}
export const deletePlan = (id) => deleteDoc(doc(db, "membershipPlans", id));

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
  return batch.commit();
}

/* ---------------- Members ---------------- */
export const listMembers = async () => rows(await getDocs(collection(db, "members")));
export const subscribeMember = (id, cb, onError) =>
  onSnapshot(doc(db, "members", id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);

export async function addMember(data) {
  const ref = doc(collection(db, "members"));
  return setDoc(ref, {
    memberId: ref.id, uid: "", ...data, joinedAt: serverTimestamp(),
    membershipId: null, membershipStartDate: null, membershipEndDate: null, status: "pending",
  });
}
export const updateMember = (id, data) => updateDoc(doc(db, "members", id), data);

// Cascade: removes the member's attendance and payments, and unlinks them from trainers.
export async function deleteMember(id) {
  const [att, pay, trainers] = await Promise.all([
    getDocs(query(collection(db, "attendance"), where("memberId", "==", id))),
    getDocs(query(collection(db, "payments"), where("memberId", "==", id))),
    getDocs(query(collection(db, "trainers"), where("assignedMembers", "array-contains", id))),
  ]);
  const batch = writeBatch(db);
  att.docs.forEach((d) => batch.delete(d.ref));
  pay.docs.forEach((d) => batch.delete(d.ref));
  trainers.docs.forEach((d) => batch.update(d.ref, { assignedMembers: arrayRemove(id) }));
  batch.delete(doc(db, "members", id));
  return batch.commit();
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
  return batch.commit();
}

/* ---------------- Payments ---------------- */
export const listPayments = async () => rows(await getDocs(query(collection(db, "payments"), orderBy("paymentDate", "desc"))));
export const listMemberPayments = async (memberId) => {
  const list = rows(await getDocs(query(collection(db, "payments"), where("memberId", "==", memberId))));
  return list.sort((a, b) => b.paymentDate?.toMillis() - a.paymentDate?.toMillis());
};
export async function recordPayment({ memberId, amount, paymentDate, paymentMethod, status }) {
  const ref = doc(collection(db, "payments"));
  return setDoc(ref, {
    paymentId: ref.id, memberId, amount: Number(amount), paymentDate: Timestamp.fromDate(new Date(paymentDate)),
    paymentMethod, status, recordedBy: auth.currentUser.uid, createdAt: serverTimestamp(),
  });
}
export const deletePayment = (id) => deleteDoc(doc(db, "payments", id));

/* ---------------- Attendance ---------------- */

export async function listAttendance(days = 30) {
  const since = dateKey(addDays(new Date(), -days));
  const list = rows(await getDocs(query(collection(db, "attendance"), where("date", ">=", since), orderBy("date", "desc"))));
  return list.sort((a, b) => b.date.localeCompare(a.date) || (b.checkInTime?.toMillis?.() || 0) - (a.checkInTime?.toMillis?.() || 0));
}
export async function listMemberAttendance(memberId) {
  const list = rows(await getDocs(query(collection(db, "attendance"), where("memberId", "==", memberId))));
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

// Document ID = memberId_YYYY-MM-DD, so the transaction below can reject a second check-in on the same day.
export async function checkIn(memberId) {
  const id = `${memberId}_${dateKey()}`;
  const ref = doc(db, "attendance", id);
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) throw new Error("This member has already checked in today.");
    tx.set(ref, { attendanceId: id, memberId, date: dateKey(), checkInTime: serverTimestamp(), checkOutTime: null });
  });
}
export async function checkOut(memberId) {
  const ref = doc(db, "attendance", `${memberId}_${dateKey()}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("No check-in found for today.");
  if (snap.data().checkOutTime) throw new Error("This member has already checked out.");
  return updateDoc(ref, { checkOutTime: serverTimestamp() });
}

/* ---------------- Trainers ---------------- */
export const listTrainers = async () => rows(await getDocs(collection(db, "trainers")));
export async function saveTrainer({ id, fullName, email, phone, specialization, assignedMembers }) {
  const data = { fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), specialization: specialization.trim(), assignedMembers: assignedMembers || [] };
  if (id) return updateDoc(doc(db, "trainers", id), data);
  const ref = doc(collection(db, "trainers"));
  return setDoc(ref, { ...data, trainerId: ref.id });
}
export const deleteTrainer = (id) => deleteDoc(doc(db, "trainers", id));

/* ---------------- Aggregates ---------------- */
export const loadAll = async (attendanceDays = 30) => {
  const [members, plans, payments, trainers, attendance] = await Promise.all([
    listMembers(), listPlans(), listPayments(), listTrainers(), listAttendance(attendanceDays),
  ]);
  return { members, plans, payments, trainers, attendance };
};
