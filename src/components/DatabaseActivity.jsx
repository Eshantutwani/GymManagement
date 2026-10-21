import { useEffect, useState } from "react";
import { clearActivity, getActivity, subscribeToActivity } from "../firebase/activity";

const STATUS_LABELS = {
  running: "Running",
  listening: "Live",
  success: "Complete",
  failed: "Failed",
};

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(timestamp);
}

export default function DatabaseActivity() {
  const [activities, setActivities] = useState(getActivity);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setActivities(getActivity());
    const unsubscribe = subscribeToActivity(update);
    update();
    return unsubscribe;
  }, []);

  const running = activities.filter((item) => item.status === "running").length;

  return (
    <div className="db-activity">
      {open && (
        <section className="db-activity-panel" role="dialog" aria-label="Database activity">
          <header className="db-activity-head">
            <div>
              <h3>Database activity</h3>
              <span className="muted small">Firebase requests in this app session</span>
            </div>
            <div className="db-activity-actions">
              <button className="btn ghost sm" onClick={clearActivity} disabled={!activities.length}>Clear</button>
              <button className="btn ghost sm" onClick={() => setOpen(false)} aria-label="Close database activity">✕</button>
            </div>
          </header>
          {activities.length ? (
            <ol className="db-activity-list">
              {activities.map((item) => (
                <li className={`db-activity-item ${item.status}`} key={item.id}>
                  <div className="db-activity-meta">
                    <time dateTime={new Date(item.startedAt).toISOString()}>{formatTime(item.startedAt)}</time>
                    <span className={`db-activity-status ${item.status}`}>{STATUS_LABELS[item.status]}</span>
                  </div>
                  <strong className="db-activity-description">{item.description}</strong>
                  <pre className="db-activity-query"><code>{item.queryText}</code></pre>
                  <div className="db-activity-meta muted">
                    {item.duration !== null && <span>{item.duration} ms</span>}
                    {item.errorCode && <span>{item.errorCode}</span>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="db-activity-empty muted">Requests will appear here as you use the app.</p>
          )}
          <p className="db-activity-note muted">Filter values appear in query text. Credentials and document contents are redacted.</p>
        </section>
      )}
      <button
        className="db-activity-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Database activity${activities.length ? `, ${activities.length} requests` : ""}`}
      >
        <span className={`db-activity-indicator ${running ? "active" : ""}`} />
        DB activity <span className="db-activity-count">{activities.length}</span>
      </button>
    </div>
  );
}
