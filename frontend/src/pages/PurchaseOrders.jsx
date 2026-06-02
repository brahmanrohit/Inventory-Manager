import { useEffect, useMemo, useState } from "react";
import { ProductsAPI, PurchaseOrdersAPI, SuppliersAPI, extractError } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  ConfirmDelete, EmptyState, ErrorState, Field, Pagination, Spinner, StatusBadge,
} from "../components/Common.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";

const PAGE_SIZE = 10;
const STATUSES = ["ordered", "received", "cancelled"];

function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function PurchaseOrders() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: 1, unit_cost: "" }]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // detail / actions
  const [detail, setDetail] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    PurchaseOrdersAPI.list({ status: statusFilter || undefined, page, page_size: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => setPage(1), [statusFilter]);
  useEffect(load, [statusFilter, page]);

  const openCreate = async () => {
    setSupplierId("");
    setLines([{ product_id: "", quantity: 1, unit_cost: "" }]);
    setFormError("");
    setCreateOpen(true);
    setRefsLoading(true);
    try {
      const [p, s] = await Promise.all([
        ProductsAPI.list({ page_size: 100 }),
        SuppliersAPI.list({ page_size: 100 }),
      ]);
      setProducts(p.items);
      setSuppliers(s.items);
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

  const totalCost = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.unit_cost || 0) * Number(l.quantity || 0), 0),
    [lines]
  );

  const updateLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { product_id: "", quantity: 1, unit_cost: "" }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  // Prefill the unit cost with the product's price as a sensible default.
  const onPickProduct = (i, productId) => {
    const p = productById[Number(productId)];
    updateLine(i, { product_id: productId, unit_cost: p ? String(p.price) : "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!supplierId) return setFormError("Please select a supplier");
    const cleaned = lines
      .filter((l) => l.product_id)
      .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) }));
    if (cleaned.length === 0) return setFormError("Add at least one product");
    if (cleaned.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0)) return setFormError("Quantities must be whole numbers > 0");
    if (cleaned.some((l) => !(l.unit_cost >= 0))) return setFormError("Unit cost must be 0 or more");

    setSaving(true);
    try {
      await PurchaseOrdersAPI.create({ supplier_id: Number(supplierId), items: cleaned });
      toast.success("Purchase order created");
      setCreateOpen(false);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    try { setDetail(await PurchaseOrdersAPI.get(id)); }
    catch (err) { toast.error(extractError(err)); }
  };

  const receive = async () => {
    setActionBusy(true);
    try {
      const updated = await PurchaseOrdersAPI.receive(detail.id);
      setDetail(updated);
      toast.success(`PO #${updated.id} received — stock updated`);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setActionBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await PurchaseOrdersAPI.remove(deleteTarget.id);
      toast.success("Purchase order deleted");
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
          <h2>Purchase Orders</h2>
          <p className="muted">Restock products from your suppliers</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Create PO</button>}
      </div>

      <div className="toolbar">
        <select className="input toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading purchase orders..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.items.length === 0 ? (
        <EmptyState
          message={statusFilter ? "No purchase orders match." : "No purchase orders yet."}
          action={isAdmin && !statusFilter ? <button className="btn btn-primary" onClick={openCreate}>Create your first PO</button> : null}
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Supplier</th>
                  <th className="num">Items</th>
                  <th className="num">Total Cost</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((po) => (
                  <tr key={po.id}>
                    <td>#{po.id}</td>
                    <td>{po.supplier_name || `Supplier ${po.supplier_id}`}</td>
                    <td className="num">{po.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="num">${Number(po.total_cost).toFixed(2)}</td>
                    <td><StatusBadge status={po.status} /></td>
                    <td>{formatDate(po.created_at)}</td>
                    <td className="actions-col">
                      <button className="btn btn-sm btn-ghost" onClick={() => openDetail(po.id)}>View</button>
                      {isAdmin && po.status !== "received" && (
                        <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleteTarget(po)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {/* Create PO modal */}
      {createOpen && (
        <Modal title="Create Purchase Order" onClose={() => setCreateOpen(false)}>
          {refsLoading ? (
            <Spinner label="Loading suppliers & products..." />
          ) : (
            <form onSubmit={submit} className="form">
              <Field label="Supplier">
                <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>

              <div className="lines">
                <div className="lines-header">
                  <span>Products to restock</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={addLine}>+ Add line</button>
                </div>
                {lines.map((line, i) => (
                  <div className="line-row po-line" key={i}>
                    <select className="input" value={line.product_id} onChange={(e) => onPickProduct(i, e.target.value)}>
                      <option value="">Select product…</option>
                      {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} ({pr.quantity} in stock)</option>)}
                    </select>
                    <input className="input qty" type="number" min="1" step="1" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} title="Quantity" />
                    <input className="input qty" type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(i, { unit_cost: e.target.value })} placeholder="cost" title="Unit cost" />
                    {lines.length > 1 && (
                      <button type="button" className="icon-btn" onClick={() => removeLine(i)} aria-label="Remove line">&times;</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="total-preview">
                <span>Total Cost</span>
                <strong>${totalCost.toFixed(2)}</strong>
              </div>

              {formError && <div className="form-error-banner">{formError}</div>}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating..." : "Create PO"}</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal title={`Purchase Order #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="detail">
            <div className="detail-grid">
              <div><span className="muted">Supplier</span><div>{detail.supplier_name || `Supplier ${detail.supplier_id}`}</div></div>
              <div><span className="muted">Status</span><div><StatusBadge status={detail.status} /></div></div>
              <div><span className="muted">Created</span><div>{formatDate(detail.created_at)}</div></div>
              <div><span className="muted">Received</span><div>{formatDate(detail.received_at)}</div></div>
              <div><span className="muted">Total Cost</span><div><strong>${Number(detail.total_cost).toFixed(2)}</strong></div></div>
            </div>

            {isAdmin && detail.status === "ordered" && (
              <div className="status-actions">
                <span className="muted">Awaiting delivery:</span>
                <button className="btn btn-sm btn-primary" disabled={actionBusy} onClick={receive}>
                  {actionBusy ? "Receiving..." : "Mark Received (adds stock)"}
                </button>
              </div>
            )}

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit Cost</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.product_name || `Product ${it.product_id}`}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">${Number(it.unit_cost).toFixed(2)}</td>
                      <td className="num">${(Number(it.unit_cost) * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Purchase Order" onClose={() => setDeleteTarget(null)}>
          <ConfirmDelete what={`PO #${deleteTarget.id}`} busy={deleting} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
        </Modal>
      )}
    </div>
  );
}
