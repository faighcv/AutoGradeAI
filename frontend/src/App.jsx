import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import { AuthProvider, useAuth } from "./auth";
import NavBar from "./components/NavBar";

function PrivateOutlet() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<PrivateOutlet />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
