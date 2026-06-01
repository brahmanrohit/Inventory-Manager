import { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI, TOKEN_KEY } from "../api/client.js";

const AuthContext = createContext(null);

const USER_KEY = "inv_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [ready, setReady] = useState(false);

  // On mount, if we have a token, confirm it's still valid.
  useEffect(() => {
    let active = true;
    if (token) {
      AuthAPI.me()
        .then((u) => {
          if (!active) return;
          setUser(u);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        })
        .catch(() => active && logout())
        .finally(() => active && setReady(true));
    } else {
      setReady(true);
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (data) => {
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const login = async (email, password) => {
    const data = await AuthAPI.login({ email, password });
    persist(data);
    return data;
  };

  const register = async (full_name, email, password) => {
    const data = await AuthAPI.register({ full_name, email, password });
    persist(data);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, ready, isAuthed: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
