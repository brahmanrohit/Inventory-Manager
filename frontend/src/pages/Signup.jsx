import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { extractError } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Field } from "../components/Common.jsx";
import CinematicBackground from "../components/CinematicBackground.jsx";
import TiltCard from "../components/TiltCard.jsx";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
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
      await register(form.full_name.trim(), form.email.trim(), form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <CinematicBackground />

      <TiltCard className="auth-card glass wide">
        <form onSubmit={submit} className="auth-form-inner">
          <div className="auth-head">
            <span className="brand-mark lg float">IO</span>
            <h2>Create your account</h2>
            <p className="muted">Start managing your inventory in minutes</p>
          </div>

          {serverError && <div className="form-error-banner">{serverError}</div>}

          <Field label="Full Name" error={errors.full_name}>
            <div className="input-wrap">
              <span className="lead-icon">👤</span>
              <input
                className="input has-lead"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
          </Field>
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
          <div className="form-row">
            <Field label="Password" error={errors.password}>
              <div className="input-wrap">
                <input
                  className="input has-trail"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 chars"
                />
                <button type="button" className="toggle-btn" onClick={() => setShowPw((s) => !s)}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <Field label="Confirm Password" error={errors.confirm}>
              <div className="input-wrap">
                <input
                  className="input"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="Re-enter"
                />
              </div>
            </Field>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </TiltCard>
    </div>
  );
}
