import { useEffect, useMemo, useState } from "react";
import { CustomersAPI, OrdersAPI, ProductsAPI, extractError } from "../api/client.js";
import { ConfirmDelete, EmptyState, ErrorState, Field, Spinner } from "../components/Common.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Orders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create-order modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: 1 }]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail + delete
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    OrdersAPI.list()
      .then(setOrders)
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = async () => {
    setCustomerId("");
    setLines([{ product_id: "", quantity: 1 }]);
    setFormError("");
    setCreateOpen(true);
    setRefsLoading(true);
    try {
      const [p, c] = await Promise.all([ProductsAPI.list(), CustomersAPI.list()]);
      setProducts(p);
      setCustomers(c);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setRefsLoading(false);
    }
  };

  const productById = useMemo(() => {
    const m = {};
    products.forEach((p) => (m[p.id] = p));
    return m;
  }, [products]);

  const estimatedTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = productById[Number(l.product_id)];
      if (!p) return sum;
      return sum + Number(p.price) * Number(l.quantity || 0);
    }, 0);
  }, [lines, productById]);

  const updateLine = (i, patch) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { product_id: "", quantity: 1 }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!customerId) {
      setFormError("Please select a customer");
      return;
    }
    const cleaned = lines
      .filter((l) => l.product_id)
      .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));
    if (cleaned.length === 0) {
      setFormError("Add at least one product");
      return;
    }
    if (cleaned.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0)) {
      setFormError("Quantities must be whole numbers greater than 0");
      return;
    }

    setSaving(true);
    try {
      await OrdersAPI.create({ customer_id: Number(customerId), items: cleaned });
      toast.success("Order created — stock updated");
      setCreateOpen(false);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const data = await OrdersAPI.get(id);
      setDetail(data);
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await OrdersAPI.remove(deleteTarget.id);
      toast.success("Order deleted — stock restored");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header row">
        <div>
          <h2>Orders</h2>
          <p className="muted">Create and track customer orders</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Create Order
        </button>
      </div>

      {loading ? (
        <Spinner label="Loading orders..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyState
          message="No orders yet."
          action={
            <button className="btn btn-primary" onClick={openCreate}>
              Create your first order
            </button>
          }
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.customer_name || `Customer ${o.customer_id}`}</td>
                    <td className="num">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="num">${Number(o.total_amount).toFixed(2)}</td>
                    <td>
                      <span className="badge badge-ok">{o.status}</span>
                    </td>
                    <td>{formatDate(o.created_at)}</td>
                    <td className="actions-col">
                      <button className="btn btn-sm btn-ghost" onClick={() => openDetail(o.id)}>
                        View
                      </button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleteTarget(o)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create order modal */}
      {createOpen && (
        <Modal title="Create Order" onClose={() => setCreateOpen(false)}>
          {refsLoading ? (
            <Spinner label="Loading customers & products..." />
          ) : (
            <form onSubmit={submit} className="form">
              <Field label="Customer">
                <select
                  className="input"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="lines">
                <div className="lines-header">
                  <span>Products</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={addLine}>
                    + Add line
                  </button>
                </div>
                {lines.map((line, i) => {
                  const p = productById[Number(line.product_id)];
                  return (
                    <div className="line-row" key={i}>
                      <select
                        className="input"
                        value={line.product_id}
                        onChange={(e) => updateLine(i, { product_id: e.target.value })}
                      >
                        <option value="">Select product…</option>
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id} disabled={pr.quantity === 0}>
                            {pr.name} — ${Number(pr.price).toFixed(2)} ({pr.quantity} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        className="input qty"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      />
                      <span className="line-sub">
                        {p ? `$${(Number(p.price) * Number(line.quantity || 0)).toFixed(2)}` : "—"}
                      </span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeLine(i)}
                          aria-label="Remove line"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="total-preview">
                <span>Estimated Total</span>
                <strong>${estimatedTotal.toFixed(2)}</strong>
              </div>

              {formError && <div className="form-error-banner">{formError}</div>}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Placing order..." : "Place Order"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal title={`Order #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="detail">
            <div className="detail-grid">
              <div>
                <span className="muted">Customer</span>
                <div>{detail.customer_name || `Customer ${detail.customer_id}`}</div>
              </div>
              <div>
                <span className="muted">Status</span>
                <div><span className="badge badge-ok">{detail.status}</span></div>
              </div>
              <div>
                <span className="muted">Date</span>
                <div>{formatDate(detail.created_at)}</div>
              </div>
              <div>
                <span className="muted">Total</span>
                <div><strong>${Number(detail.total_amount).toFixed(2)}</strong></div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit Price</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.product_name || `Product ${it.product_id}`}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">${Number(it.unit_price).toFixed(2)}</td>
                      <td className="num">${(Number(it.unit_price) * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Order" onClose={() => setDeleteTarget(null)}>
          <ConfirmDelete
            what={`Order #${deleteTarget.id}`}
            busy={deleting}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
