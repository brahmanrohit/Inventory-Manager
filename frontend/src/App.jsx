import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Customers from "./pages/Customers.jsx";
import Orders from "./pages/Orders.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import PurchaseOrders from "./pages/PurchaseOrders.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected app */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="customers" element={<Customers />} />
            <Route path="orders" element={<Orders />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
