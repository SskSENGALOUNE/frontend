"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ApiError, errorText, get, post, getToken, setToken, setUnauthorizedHandler, type User } from "./api";

interface AuthState {
  user: User | null;
  /** true until the stored token has been checked */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** replace the cached user after a profile update */
  setUser: (u: User) => void;
  /** a token is stored; pages may start loading before /me confirms it (a 401 still logs out) */
  hasToken: boolean;
  /** set when the stored session could not be checked (server down); the token is kept */
  bootError: string | null;
  retryBoot: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootTick, setBootTick] = useState(0);
  // read after hydration only; the server render has no localStorage
  const hasToken = useSyncExternalStore(noopSubscribe, () => !!getToken(), () => false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    // localStorage is only readable in the browser, so the stored token is checked after mount.
    // Only a 401 ends the session; a network or server error keeps the token so the user can retry.
    Promise.resolve(getToken() ? get<User>("/me") : null)
      .then((u) => {
        setUser(u);
        setBootError(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setToken(null);
        else setBootError(errorText(e));
      })
      .finally(() => setLoading(false));
  }, [bootTick]);

  const retryBoot = useCallback(() => {
    setLoading(true);
    setBootTick((t) => t + 1);
  }, []);

  const finish = (d: { token: string; user: User }) => {
    setToken(d.token);
    setUser(d.user);
    router.replace("/");
  };

  const login = async (email: string, password: string) => {
    finish(await post("/auth/login", { email, password }));
  };

  const register = async (name: string, email: string, password: string) => {
    finish(await post("/auth/register", { name, email, password }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, hasToken, bootError, retryBoot }}>
      {children}
    </AuthContext.Provider>
  );
}

const noopSubscribe = () => () => {};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
