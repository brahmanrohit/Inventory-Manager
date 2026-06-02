import { useEffect, useState } from "react";
import { SuppliersAPI, extractError } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  ConfirmDelete, EmptyState, ErrorState, Field, Pagination, SearchBar, Spinner, useDebouncedValue,
} from "../components/Common.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";

const blank = { name: "", email: "", phone: "" };
const PAGE_SIZE = 10;

export default function Suppliers() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    SuppliersAPI.list({ q: debouncedSearch || undefined, page, page_size: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => setPage(1), [debouncedSearch]);
  useEffect(load, [debouncedSearch, page]);

  const openAdd = () => {
    setForm(blank);
    setFormErrors({});
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await SuppliersAPI.create({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      });
      toast.success("Supplier created");
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
      await SuppliersAPI.remove(deleteTarget.id);
      toast.success("Supplier deleted");
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
          <h2>Suppliers</h2>
          <p className="muted">Vendors you restock products from</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>}
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search suppliers…" />
      </div>

      {loading ? (
        <Spinner label="Loading suppliers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.items.length === 0 ? (
        <EmptyState
          message={debouncedSearch ? "No suppliers match your search." : "No suppliers yet."}
          action={isAdmin && !debouncedSearch ? <button className="btn btn-primary" onClick={openAdd}>Add your first supplier</button> : null}
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  {isAdmin && <th className="actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.email || <span className="muted">—</span>}</td>
                    <td>{s.phone || <span className="muted">—</span>}</td>
                    {isAdmin && (
                      <td className="actions-col">
                        <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleteTarget(s)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {modalOpen && (
        <Modal title="Add Supplier" onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="form">
            <Field label="Supplier Name" error={formErrors.name}>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tech Distributors Inc." />
            </Field>
            <Field label="Email (optional)" error={formErrors.email}>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. sales@vendor.com" />
            </Field>
            <Field label="Phone (optional)">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +1-800-555-0199" />
            </Field>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Create Supplier"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Supplier" onClose={() => setDeleteTarget(null)}>
          <ConfirmDelete what={deleteTarget.name} busy={deleting} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
        </Modal>
      )}
    </div>
  );
}
