import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardAPI, extractError } from "../api/client.js";
import { ErrorState, Spinner } from "../components/Common.jsx";

const cards = [
  { key: "total_products", label: "Total Products", icon: "📦", to: "/products", accent: "blue" },
  { key: "total_customers", label: "Total Customers", icon: "👥", to: "/customers", accent: "green" },
  { key: "total_orders", label: "Total Orders", icon: "🧾", to: "/orders", accent: "purple" },
  { key: "low_stock_count", label: "Low Stock Items", icon: "⚠️", to: "/products", accent: "amber" },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    DashboardAPI.stats()
      .then(setStats)
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p className="muted">Overview of your inventory and orders</p>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <Link key={c.key} to={c.to} className={`stat-card accent-${c.accent}`}>
            <div className="stat-icon">{c.icon}</div>
            <div>
              <div className="stat-value">{stats[c.key]}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Low Stock Products</h3>
          <span className="muted">Threshold based — restock soon</span>
        </div>
        {stats.low_stock_products.length === 0 ? (
          <p className="muted pad">All products are well stocked. 🎉</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="num">Price</th>
                  <th className="num">In Stock</th>
                </tr>
              </thead>
              <tbody>
                {stats.low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><code>{p.sku}</code></td>
                    <td className="num">${Number(p.price).toFixed(2)}</td>
                    <td className="num">
                      <span className={`badge ${p.quantity === 0 ? "badge-danger" : "badge-warn"}`}>
                        {p.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
