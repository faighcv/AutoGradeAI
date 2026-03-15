import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import { AuthProvider, useAuth } from "./auth";
import NavBar from "./components/NavBar";

// Show NavBar only on authenticated pages
function AppShell() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/app" element={<Dashboard />} />
        <Route path="*"    element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
