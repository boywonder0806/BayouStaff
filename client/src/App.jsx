import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Schedule from './pages/Schedule.jsx';
import Messages from './pages/Messages.jsx';
import Announcements from './pages/Announcements.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import SchedulerLayout from './pages/admin/SchedulerLayout.jsx';
import CurrentSchedule from './pages/admin/scheduler/CurrentSchedule.jsx';
import PlanSchedule from './pages/admin/scheduler/PlanSchedule.jsx';
import ShiftAssignments from './pages/admin/scheduler/ShiftAssignments.jsx';
import SystemAdminLayout from './pages/admin/SystemAdminLayout.jsx';
import SysAdminUsers from './pages/admin/sysadmin/Users.jsx';
import SysAdminDepartments from './pages/admin/sysadmin/Departments.jsx';
import SysAdminLogs from './pages/admin/sysadmin/Logs.jsx';
import SysAdminAPI from './pages/admin/sysadmin/API.jsx';
import SysAdminCertifications from './pages/admin/sysadmin/Certifications.jsx';
import StaffLayout from './pages/admin/StaffLayout.jsx';
import TimeOffAdmin from './pages/admin/staff/TimeOffAdmin.jsx';
import OpenShiftsAdmin from './pages/admin/staff/OpenShiftsAdmin.jsx';
import TimeOff from './pages/TimeOff.jsx';
import ShiftBoard from './pages/ShiftBoard.jsx';

function ProtectedRoute({ children, adminOnly = false, sysadminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-bb-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (sysadminOnly && user.role !== 'sysadmin') return <Navigate to="/home" replace />;
  if (adminOnly && user.role !== 'manager' && user.role !== 'sysadmin') return <Navigate to="/home" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home"          element={<Home />} />
        <Route path="schedule"      element={<Schedule />} />
        <Route path="messages"      element={<Messages />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="timeoff"       element={<TimeOff />} />
        <Route path="shiftboard"    element={<ShiftBoard />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="scheduler"
          element={
            <ProtectedRoute adminOnly>
              <SchedulerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="current" replace />} />
          <Route path="current"     element={<CurrentSchedule />} />
          <Route path="plan"        element={<PlanSchedule />} />
          <Route path="assignments" element={<ShiftAssignments />} />
        </Route>
        <Route
          path="sysadmin"
          element={
            <ProtectedRoute sysadminOnly>
              <SystemAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users"          element={<SysAdminUsers />} />
          <Route path="departments"    element={<SysAdminDepartments />} />
          <Route path="certifications" element={<SysAdminCertifications />} />
          <Route path="logs"           element={<SysAdminLogs />} />
          <Route path="api"            element={<SysAdminAPI />} />
        </Route>
        <Route
          path="staff"
          element={
            <ProtectedRoute adminOnly>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="timeoff" replace />} />
          <Route path="timeoff"    element={<TimeOffAdmin />} />
          <Route path="openShifts" element={<OpenShiftsAdmin />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
