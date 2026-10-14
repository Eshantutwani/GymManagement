import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler } from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);
ChartJS.defaults.color = "#9a9fa8";
ChartJS.defaults.borderColor = "#33373e";
ChartJS.defaults.font.family = "Barlow, system-ui, sans-serif";

export const COLORS = { active: "#3fb97b", expiring: "#e3a53b", expired: "#e2402c", pending: "#6b7280", accent: "#e2402c" };
const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

export const BarChart = ({ labels, data, label, money }) => (
  <Bar data={{ labels, datasets: [{ label, data, backgroundColor: COLORS.accent, borderRadius: 4 }] }}
    options={{ ...base, scales: { y: { beginAtZero: true, ticks: { precision: 0, callback: (v) => (money ? "₹" + v : v) } } } }} />
);
export const LineChart = ({ labels, data, label }) => (
  <Line data={{ labels, datasets: [{ label, data, borderColor: COLORS.accent, backgroundColor: "#e2402c22", fill: true, tension: 0.3, pointRadius: 3 }] }}
    options={{ ...base, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
);
export const DonutChart = ({ labels, data, colors }) => (
  <Doughnut data={{ labels, datasets: [{ data, backgroundColor: colors, borderColor: "#1e2024", borderWidth: 3 }] }}
    options={{ ...base, cutout: "62%", plugins: { legend: { display: true, position: "bottom" } } }} />
);
