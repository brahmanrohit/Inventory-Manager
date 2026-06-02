import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AnalyticsAPI, DashboardAPI, extractError } from "../api/client.js";
import { ErrorState, Spinner, StatusBadge } from "../components/Common.jsx";

const cards = [
  { key: "total_products", label: "Total Products", icon: "📦", to: "/products", accent: "blue" },
  { key: "total_customers", label: "Total Customers", icon: "👥", to: "/customers", accent: "green" },
  { key: "total_orders", label: "Total Orders", icon: "🧾", to: "/orders", accent: "purple" },
  { key: "low_stock_count", label: "Low Stock Items", icon: "⚠️", to: "/products", accent: "amber" },
];

const STATUS_ORDER = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const PIE_COLORS = ["#6f7dff", "#34d399", "#fbbf24", "#fb7185", "#a855f7", "#22d3ee", "#f472b6"];

const tooltipStyle = {
  background: "rgba(22,26,44,0.95)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10, color: "#eef1fb", fontSize: 13,
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [top, setTop] = useState([]);
  const [catDist, setCatDist] = useState([]);
  const [invValue, setInvValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      DashboardAPI.stats(),
      AnalyticsAPI.salesTrend(14),
      AnalyticsAPI.topProducts(5),
      AnalyticsAPI.categoryDistribution(),
      AnalyticsAPI.inventoryValue(),
    ])
      .then(([s, t, tp, cd, iv]) => {
        setStats(s); setTrend(t); setTop(tp); setCatDist(cd); setInvValue(iv);
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

      <div className="dash-row">
        <div className="panel revenue-panel accent-revenue">
          <div className="stat-icon">💰</div>
          <div>
            <div className="stat-value">{fmtMoney(stats.total_revenue)}</div>
            <div className="stat-label">Total Revenue (excludes cancelled)</div>
          </div>
        </div>
        <div className="panel revenue-panel accent-stock">
          <div className="stat-icon">🏷️</div>
          <div>
            <div className="stat-value">{fmtMoney(invValue?.total_value)}</div>
            <div className="stat-label">Inventory Value ({invValue?.total_units ?? 0} units in stock)</div>
          </div>
        </div>
      </div>

      {/* Sales trend */}
      <div className="panel chart-panel">
        <div className="panel-header"><h3>Revenue — last 14 days</h3></div>
        <div className="chart-body">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6f7dff" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#6f7dff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={{ fill: "#99a2bd", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: "#99a2bd", fontSize: 11 }} width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, k) => (k === "revenue" ? fmtMoney(v) : v)} />
              <Area type="monotone" dataKey="revenue" stroke="#6f7dff" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-2col">
        {/* Top products */}
        <div className="panel chart-panel">
          <div className="panel-header"><h3>Top Products (units sold)</h3></div>
          <div className="chart-body">
            {top.length === 0 ? (
              <p className="muted pad">No sales yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={top} layout="vertical" margin={{ top: 6, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#99a2bd", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#99a2bd", fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Bar dataKey="units" fill="#34d399" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category distribution */}
        <div className="panel chart-panel">
          <div className="panel-header"><h3>Products by Category</h3></div>
          <div className="chart-body">
            {catDist.length === 0 ? (
              <p className="muted pad">No products yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={catDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                    {catDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="legend">
              {catDist.map((cd, i) => (
                <span className="legend-item" key={cd.name}>
                  <span className="legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {cd.name} ({cd.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Orders by status */}
      <div className="panel">
        <div className="panel-header"><h3>Orders by Status</h3></div>
        <div className="status-breakdown">
          {STATUS_ORDER.map((s) => (
            <div className="status-row" key={s}>
              <StatusBadge status={s} />
              <span className="status-count">{stats.orders_by_status?.[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Low stock */}
      <div className="panel">
        <div className="panel-header">
          <h3>Low Stock Products</h3>
          <span className="muted">Restock soon</span>
        </div>
        {stats.low_stock_products.length === 0 ? (
          <p className="muted pad">All products are well stocked. 🎉</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Product</th><th>SKU</th><th className="num">Price</th><th className="num">In Stock</th></tr>
              </thead>
              <tbody>
                {stats.low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><code>{p.sku}</code></td>
                    <td className="num">${Number(p.price).toFixed(2)}</td>
                    <td className="num">
                      <span className={`badge ${p.quantity === 0 ? "badge-danger" : "badge-warn"}`}>{p.quantity}</span>
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
