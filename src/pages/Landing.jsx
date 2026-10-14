import { Link } from "react-router-dom";
import { listPlans } from "../firebase/services";
import { useLoad } from "../hooks";
import { fmtMoney } from "../utils";
import { Loading, Empty } from "../components/ui";

const FEATURES = [
  ["Free-weight floor", "Racks, platforms and dumbbells up to 50 kg, open from 5 am."],
  ["Coached sessions", "Strength, HIIT and mobility classes led by certified trainers."],
  ["Progress you can see", "Check-ins and payment history are on your member page."],
  ["Clean, uncrowded", "Capped class sizes and a locker room cleaned every two hours."],
];

export default function Landing() {
  const { data: plans, loading } = useLoad(listPlans);
  const active = (plans || []).filter((p) => p.isActive);
  return (
    <div>
      <header className="land-nav">
        <div className="brand">Forge<span>Fitness Club</span></div>
        <div><Link className="btn ghost sm" to="/login">Log in</Link><Link className="btn sm" to="/register">Join now</Link></div>
      </header>
      <section className="hero">
        <div>
          <h2>Lift heavier. Show up more.</h2>
          <p>A neighbourhood strength gym with real coaching, fair pricing and no contracts you can't read.</p>
          <Link className="btn" to="/register">Create your account</Link>
        </div>
      </section>
      <section className="section">
        <h2>What you get</h2>
        <div className="features">{FEATURES.map(([t, d]) => <div key={t}><h4>{t}</h4><p>{d}</p></div>)}</div>
      </section>
      <section className="section" style={{ background: "var(--panel)" }}>
        <h2>Membership plans</h2>
        {loading ? <Loading /> : !active.length ? <Empty title="Plans will appear here" hint="The gym owner can add plans from the admin panel." /> : (
          <div className="plan-cards">
            {active.map((p) => (
              <div className="plan-card" key={p.id}>
                <h3>{p.planName}</h3><div className="price">{fmtMoney(p.price)}</div>
                <p className="muted">{p.durationInDays} days</p><p>{p.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="section">
        <h2>Visit or call</h2>
        <div className="contact">
          <div><h4>Address</h4><p className="muted">12 Station Road, Chembur, Mumbai 400071</p></div>
          <div><h4>Hours</h4><p className="muted">Mon–Sat 5:00 am – 10:30 pm<br />Sun 7:00 am – 1:00 pm</p></div>
          <div><h4>Contact</h4><p className="muted">+91 98000 00000<br />hello@forgefitness.example</p></div>
        </div>
      </section>
      <footer className="land-foot">© Forge Fitness Club. College DBMS project.</footer>
    </div>
  );
}
