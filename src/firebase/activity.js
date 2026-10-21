let activities = [];
let nextId = 1;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToActivity(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActivity() {
  return activities;
}

export function clearActivity() {
  activities = [];
  notify();
}

export function beginActivity(description, status = "running", queryText = description) {
  const id = nextId++;
  activities = [{
    id,
    description,
    queryText,
    status,
    startedAt: Date.now(),
    duration: null,
    errorCode: null,
  }, ...activities];
  notify();
  return id;
}

export function finishActivity(id, error) {
  const activity = activities.find((item) => item.id === id);
  if (!activity || (activity.status !== "running" && activity.status !== "listening")) return;
  const finishedAt = Date.now();
  activities = activities.map((item) => item.id === id ? {
    ...item,
    status: error ? "failed" : "success",
    duration: finishedAt - item.startedAt,
    errorCode: error ? error.code || "Request failed" : null,
  } : item);
  notify();
}

export async function trackActivity(description, operation, queryText = description) {
  const id = beginActivity(description, "running", queryText);
  try {
    const result = await operation();
    finishActivity(id);
    return result;
  } catch (error) {
    finishActivity(id, error);
    throw error;
  }
}
