import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";

export function ProtectedRoute() {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
