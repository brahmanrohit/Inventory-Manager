import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import CinematicBackground from "./CinematicBackground.jsx";
import Calculator from "./Calculator.jsx";
import NotificationBell from "./NotificationBell.jsx";

const links = [
  { to: "/", label: "Dashboard", end: true, icon: "📊" },
  { to: "/products", label: "Products", icon: "📦" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/orders", label: "Orders", icon: "🧾" },
  { to: "/suppliers", label: "Suppliers", icon: "🏭" },
  { to: "/purchase-orders", label: "Purchase Orders", icon: "📥" },
];

// Map the current path to a human-readable section name.
const PAGE_TITLES = {
  "/": "Dashboard",
  "/products": "Products",
  "/customers": "Customers",
  "/orders": "Orders",
  "/suppliers": "Suppliers",
  "/purchase-orders": "Purchase Orders",
};

function initials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTitle = PAGE_TITLES[location.pathname] || "Dashboard";
  const isHome = location.pathname === "/";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <div className="app-cinema">
        <CinematicBackground variant="app" />
      </div>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">IO</span>
          <span className="brand-text">Inventory<br />Manager</span>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">Inventory &amp; Order Mgmt v1.0</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>

          {!isHome && (
            <button
              className="btn btn-sm btn-ghost back-btn"
              onClick={() => navigate("/")}
              title="Back to Dashboard"
            >
              ← Back
            </button>
          )}

          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button className="crumb-root" onClick={() => navigate("/")} disabled={isHome}>
              Dashboard
            </button>
            {!isHome && (
              <>
                <span className="crumb-sep">/</span>
                <span className="crumb-current">{currentTitle}</span>
              </>
            )}
          </nav>

          <div className="topbar-user">
            <NotificationBell />
            <div className="user-chip">
              <span className="user-avatar">{initials(user?.full_name || user?.email)}</span>
              <div className="user-meta">
                <span className="user-name">
                  {user?.full_name}
                  {user?.role && <span className={`role-badge role-${user.role}`}>{user.role}</span>}
                </span>
                <span className="user-email">{user?.email}</span>
              </div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <Calculator />
    </div>
  );
}
