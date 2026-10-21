import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./firebase/auth";
import { ToastProvider, Loading } from "./components/ui";
import DatabaseActivity from "./components/DatabaseActivity";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/Auth";
import Dashboard from "./pages/admin/Dashboard";
import Members from "./pages/admin/Members";
import Plans from "./pages/admin/Plans";
import Payments from "./pages/admin/Payments";
import Attendance from "./pages/admin/Attendance";
import Trainers from "./pages/admin/Trainers";
import Reports from "./pages/admin/Reports";
import MemberDashboard from "./pages/member/MemberDashboard";

// UI guard only. Real enforcement is in firestore.rules.
function Guard({ admin, children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/member" replace />;
  if (!admin && isAdmin) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <DatabaseActivity />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<Guard admin><Layout admin /></Guard>}>
              <Route index element={<Dashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="plans" element={<Plans />} />
              <Route path="payments" element={<Payments />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="trainers" element={<Trainers />} />
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route path="/member" element={<Guard><Layout /></Guard>}>
              <Route index element={<MemberDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
