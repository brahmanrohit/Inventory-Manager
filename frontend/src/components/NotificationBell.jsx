import { useEffect, useRef, useState } from "react";
import { NotificationsAPI } from "../api/client.js";

const SEV_ICON = { danger: "⛔", warn: "⚠️", info: "ℹ️" };

export default function NotificationBell() {
  const [data, setData] = useState({ count: 0, alerts: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => NotificationsAPI.list().then(setData).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // refresh every minute
    return () => clearInterval(t);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="notif" ref={ref}>
      <button className="notif-btn" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        🔔
        {data.count > 0 && <span className="notif-badge">{data.count > 9 ? "9+" : data.count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">Notifications {data.count > 0 && `(${data.count})`}</div>
          {data.alerts.length === 0 ? (
            <div className="notif-empty">All clear — nothing needs attention. ✅</div>
          ) : (
            <div className="notif-list">
              {data.alerts.map((a, i) => (
                <div className={`notif-item sev-${a.severity}`} key={i}>
                  <span className="notif-icon">{SEV_ICON[a.severity] || "•"}</span>
                  <div>
                    <div className="notif-title">{a.title}</div>
                    <div className="notif-detail">{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
