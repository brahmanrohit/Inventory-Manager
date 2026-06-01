import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { Spinner } from "../components/Common.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthed, ready } = useAuth();
  const location = useLocation();

  // Wait until we've checked the stored token before deciding.
  if (!ready) return <Spinner label="Loading..." />;

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
