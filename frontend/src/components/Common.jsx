export function Spinner({ label = "Loading..." }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="state-block">
      <p>{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-block error">
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

import { useEffect, useState } from "react";

// Debounce a fast-changing value (e.g. a search box) before firing requests.
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        className="input has-lead"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange("")} aria-label="Clear">
          &times;
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="pagination-controls">
        <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Prev
        </button>
        <span className="pagination-page">Page {page} of {Math.max(pages, 1)}</span>
        <button className="btn btn-sm btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

const STATUS_CLASS = {
  // order statuses
  pending: "badge-warn",
  confirmed: "badge-info",
  shipped: "badge-info",
  delivered: "badge-ok",
  cancelled: "badge-danger",
  // purchase-order statuses
  ordered: "badge-warn",
  received: "badge-ok",
};

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLASS[status] || "badge-ok"}`}>{status}</span>;
}

export function ConfirmDelete({ what, onConfirm, onCancel, busy }) {
  return (
    <div>
      <p>
        Are you sure you want to delete <strong>{what}</strong>? This action cannot be undone.
      </p>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
