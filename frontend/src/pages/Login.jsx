import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { extractError } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Field } from "../components/Common.jsx";
import CinematicBackground from "../components/CinematicBackground.jsx";
import TiltCard from "../components/TiltCard.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <CinematicBackground />

      <TiltCard className="auth-card glass">
        <form onSubmit={submit} className="auth-form-inner">
          <div className="auth-head">
            <span className="brand-mark lg float">IO</span>
            <h2>Welcome back</h2>
            <p className="muted">Sign in to your Inventory &amp; Order dashboard</p>
          </div>

          {serverError && <div className="form-error-banner">{serverError}</div>}

          <Field label="Email" error={errors.email}>
            <div className="input-wrap">
              <span className="lead-icon">✉️</span>
              <input
                className="input has-lead"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
          </Field>
          <Field label="Password" error={errors.password}>
            <div className="input-wrap">
              <span className="lead-icon">🔒</span>
              <input
                className="input has-lead has-trail"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Your password"
              />
              <button type="button" className="toggle-btn" onClick={() => setShowPw((s) => !s)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/signup">Create one</Link>
          </p>
        </form>
      </TiltCard>
    </div>
  );
}
