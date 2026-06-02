import axios from "axios";

// API base URL is injected at build time. Defaults to the Vite dev proxy.
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({ baseURL });

export const TOKEN_KEY = "inv_token";

// Attach the bearer token (if any) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 (expired/invalid token), clear it and bounce to the login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

// Normalize backend errors into a single readable message string.
export function extractError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const loc = Array.isArray(d.loc) ? d.loc.slice(1).join(".") : "";
        return loc ? `${loc}: ${d.msg}` : d.msg;
      })
      .join("; ");
  }
  return JSON.stringify(detail);
}

// ---- Products ----
export const ProductsAPI = {
  list: (params) => api.get("/products", { params }).then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data),
  create: (data) => api.post("/products", data).then((r) => r.data),
  update: (id, data) => api.put(`/products/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/products/${id}`),
  movements: (id) => api.get(`/products/${id}/movements`).then((r) => r.data),
  adjust: (id, data) => api.post(`/products/${id}/adjust`, data).then((r) => r.data),
};

// ---- Categories ----
export const CategoriesAPI = {
  list: () => api.get("/categories").then((r) => r.data),
  create: (data) => api.post("/categories", data).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`),
};

// ---- Suppliers ----
export const SuppliersAPI = {
  list: (params) => api.get("/suppliers", { params }).then((r) => r.data),
  get: (id) => api.get(`/suppliers/${id}`).then((r) => r.data),
  create: (data) => api.post("/suppliers", data).then((r) => r.data),
  remove: (id) => api.delete(`/suppliers/${id}`),
};

// ---- Purchase Orders ----
export const PurchaseOrdersAPI = {
  list: (params) => api.get("/purchase-orders", { params }).then((r) => r.data),
  get: (id) => api.get(`/purchase-orders/${id}`).then((r) => r.data),
  create: (data) => api.post("/purchase-orders", data).then((r) => r.data),
  receive: (id) => api.post(`/purchase-orders/${id}/receive`).then((r) => r.data),
  remove: (id) => api.delete(`/purchase-orders/${id}`),
};

// ---- Customers ----
export const CustomersAPI = {
  list: (params) => api.get("/customers", { params }).then((r) => r.data),
  get: (id) => api.get(`/customers/${id}`).then((r) => r.data),
  create: (data) => api.post("/customers", data).then((r) => r.data),
  remove: (id) => api.delete(`/customers/${id}`),
};

// ---- Orders ----
export const OrdersAPI = {
  list: (params) => api.get("/orders", { params }).then((r) => r.data),
  get: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  create: (data) => api.post("/orders", data).then((r) => r.data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
  remove: (id) => api.delete(`/orders/${id}`),
};

// ---- Dashboard ----
export const DashboardAPI = {
  stats: () => api.get("/dashboard/stats").then((r) => r.data),
};

// ---- Auth ----
export const AuthAPI = {
  register: (data) => api.post("/auth/register", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

// ---- Analytics ----
export const AnalyticsAPI = {
  salesTrend: (days = 14) => api.get("/analytics/sales-trend", { params: { days } }).then((r) => r.data),
  topProducts: (limit = 5) => api.get("/analytics/top-products", { params: { limit } }).then((r) => r.data),
  inventoryValue: () => api.get("/analytics/inventory-value").then((r) => r.data),
  categoryDistribution: () => api.get("/analytics/category-distribution").then((r) => r.data),
};

// ---- Notifications ----
export const NotificationsAPI = {
  list: () => api.get("/notifications").then((r) => r.data),
};

// ---- Data import/export & invoices (binary/file helpers) ----
export const DataAPI = {
  // Trigger a browser download of a CSV/PDF blob from a protected endpoint.
  download: async (path, filename) => {
    const res = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  openInvoice: async (orderId) => {
    const res = await api.get(`/orders/${orderId}/invoice`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  importProducts: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/data/products/import", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
};

export default api;
