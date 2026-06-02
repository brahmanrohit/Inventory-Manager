import { useEffect, useRef, useState } from "react";
import { CategoriesAPI, DataAPI, ProductsAPI, extractError } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  ConfirmDelete, EmptyState, ErrorState, Field, Pagination, SearchBar, Spinner, useDebouncedValue,
} from "../components/Common.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";

const blank = { name: "", sku: "", price: "", quantity: "", category_id: "" };
const PAGE_SIZE = 10;

const REASON_LABEL = {
  initial: "Opening stock",
  sale: "Sale",
  order_cancel: "Order cancelled",
  purchase: "Purchase received",
  adjustment: "Manual adjustment",
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required";
  if (!form.sku.trim()) errors.sku = "SKU is required";
  if (form.price === "" || Number(form.price) < 0) errors.price = "Price must be 0 or more";
  if (form.quantity === "" || !Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0)
    errors.quantity = "Quantity must be a whole number ≥ 0";
  return errors;
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function Products() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [lowStock, setLowStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // category manager
  const [manageOpen, setManageOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  // stock history
  const [historyProduct, setHistoryProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // stock adjust
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustChange, setAdjustChange] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  // CSV export/import
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const loadCategories = () => CategoriesAPI.list().then(setCategories).catch(() => {});

  const load = () => {
    setLoading(true);
    setError("");
    ProductsAPI.list({
      q: debouncedSearch || undefined,
      low_stock: lowStock || undefined,
      category_id: categoryFilter || undefined,
      page,
      page_size: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => setPage(1), [debouncedSearch, lowStock, categoryFilter]);
  useEffect(load, [debouncedSearch, lowStock, categoryFilter, page]);

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku, price: String(p.price), quantity: String(p.quantity), category_id: p.category_id ? String(p.category_id) : "" });
    setFormErrors({});
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
      category_id: form.category_id ? Number(form.category_id) : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await ProductsAPI.update(editing.id, payload);
        toast.success("Product updated");
      } else {
        await ProductsAPI.create(payload);
        toast.success("Product created");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await ProductsAPI.remove(deleteTarget.id);
      toast.success("Product deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeleting(false);
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setCatBusy(true);
    try {
      await CategoriesAPI.create({ name: newCategory.trim() });
      setNewCategory("");
      toast.success("Category added");
      loadCategories();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setCatBusy(false);
    }
  };

  const removeCategory = async (id) => {
    try {
      await CategoriesAPI.remove(id);
      toast.success("Category removed");
      loadCategories();
      load();
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const openHistory = async (p) => {
    setHistoryProduct(p);
    setHistoryLoading(true);
    try {
      setMovements(await ProductsAPI.movements(p.id));
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const openAdjust = (p) => {
    setAdjustTarget(p);
    setAdjustChange("");
    setAdjustNote("");
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    const change = Number(adjustChange);
    if (!Number.isInteger(change) || change === 0) {
      toast.error("Enter a non-zero whole number (use - to remove)");
      return;
    }
    setAdjustBusy(true);
    try {
      await ProductsAPI.adjust(adjustTarget.id, { change, note: adjustNote.trim() || null });
      toast.success("Stock adjusted");
      setAdjustTarget(null);
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setAdjustBusy(false);
    }
  };

  const exportCsv = () => DataAPI.download("/data/products.csv", "products.csv").catch((err) => toast.error(extractError(err)));

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImporting(true);
    try {
      const res = await DataAPI.importProducts(file);
      const msg = `Imported: ${res.created} created, ${res.updated} updated` +
        (res.errors?.length ? `, ${res.errors.length} skipped` : "");
      res.errors?.length ? toast.error(msg) : toast.success(msg);
      loadCategories();
      load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setImporting(false);
    }
  };

  const filtered = debouncedSearch || lowStock || categoryFilter;

  return (
    <div className="page">
      <div className="page-header row">
        <div>
          <h2>Products</h2>
          <p className="muted">Manage your product catalog and stock levels</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={exportCsv}>⬇ Export CSV</button>
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={onImportFile} />
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? "Importing…" : "⬆ Import CSV"}
              </button>
              <button className="btn btn-ghost" onClick={() => setManageOpen(true)}>Categories</button>
              <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
            </>
          )}
        </div>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or SKU…" />
        <select className="input toolbar-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {loading ? (
        <Spinner label="Loading products..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.items.length === 0 ? (
        <EmptyState
          message={filtered ? "No products match your filters." : "No products yet."}
          action={isAdmin && !filtered ? <button className="btn btn-primary" onClick={openAdd}>Add your first product</button> : null}
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><code>{p.sku}</code></td>
                    <td>{p.category_name || <span className="muted">—</span>}</td>
                    <td className="num">${Number(p.price).toFixed(2)}</td>
                    <td className="num">
                      <span className={`badge ${p.quantity === 0 ? "badge-danger" : p.quantity <= 10 ? "badge-warn" : "badge-ok"}`}>{p.quantity}</span>
                    </td>
                    <td className="actions-col">
                      <button className="btn btn-sm btn-ghost" onClick={() => openHistory(p)}>History</button>
                      {isAdmin && <button className="btn btn-sm btn-ghost" onClick={() => openAdjust(p)}>Adjust</button>}
                      {isAdmin && <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}>Edit</button>}
                      {isAdmin && <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleteTarget(p)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {/* Add / edit product */}
      {modalOpen && (
        <Modal title={editing ? "Edit Product" : "Add Product"} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="form">
            <Field label="Product Name" error={formErrors.name}>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless Mouse" />
            </Field>
            <div className="form-row">
              <Field label="SKU / Code" error={formErrors.sku}>
                <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. WM-001" />
              </Field>
              <Field label="Category">
                <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">— None —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Price (USD)" error={formErrors.price}>
                <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              </Field>
              <Field label="Quantity in Stock" error={formErrors.quantity}>
                <input className="input" type="number" step="1" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
              </Field>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Product"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Category manager */}
      {manageOpen && (
        <Modal title="Manage Categories" onClose={() => setManageOpen(false)}>
          <form onSubmit={addCategory} className="inline-form">
            <input className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" />
            <button type="submit" className="btn btn-primary" disabled={catBusy}>Add</button>
          </form>
          <div className="chip-list">
            {categories.length === 0 && <p className="muted">No categories yet.</p>}
            {categories.map((c) => (
              <div className="chip" key={c.id}>
                <span>{c.name} <span className="chip-count">{c.product_count}</span></span>
                <button className="chip-x" onClick={() => removeCategory(c.id)} aria-label="Delete">&times;</button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Stock history */}
      {historyProduct && (
        <Modal title={`Stock History — ${historyProduct.name}`} onClose={() => setHistoryProduct(null)}>
          {historyLoading ? (
            <Spinner label="Loading movements..." />
          ) : movements.length === 0 ? (
            <p className="muted">No stock movements recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Reason</th><th className="num">Change</th><th className="num">Resulting</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDate(m.created_at)}</td>
                      <td>{REASON_LABEL[m.reason] || m.reason}</td>
                      <td className="num"><span className={m.change >= 0 ? "delta-up" : "delta-down"}>{m.change >= 0 ? `+${m.change}` : m.change}</span></td>
                      <td className="num">{m.resulting_qty}</td>
                      <td>{m.note || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* Stock adjust */}
      {adjustTarget && (
        <Modal title={`Adjust Stock — ${adjustTarget.name}`} onClose={() => setAdjustTarget(null)}>
          <form onSubmit={submitAdjust} className="form">
            <p className="muted">Current stock: <strong>{adjustTarget.quantity}</strong>. Use a positive number to add, negative to remove.</p>
            <Field label="Change (+/-)">
              <input className="input" type="number" step="1" value={adjustChange} onChange={(e) => setAdjustChange(e.target.value)} placeholder="e.g. 10 or -3" />
            </Field>
            <Field label="Reason / Note (optional)">
              <input className="input" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. damaged units, stock count correction" />
            </Field>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setAdjustTarget(null)} disabled={adjustBusy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={adjustBusy}>{adjustBusy ? "Adjusting..." : "Apply Adjustment"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Product" onClose={() => setDeleteTarget(null)}>
          <ConfirmDelete what={deleteTarget.name} busy={deleting} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
        </Modal>
      )}
    </div>
  );
}
