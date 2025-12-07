import React, { createContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { loginRequest } from "../api";
import { api } from "../api";

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [token, setToken] = useState<string | null>(null);

  // Load token from secure storage
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync("token");
      if (saved) {
        setToken(saved);
        globalThis.AUTH_TOKEN = saved;
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await loginRequest(email, password);

    const t = res.data?.token;
    if (!t) throw new Error("Invalid token");

    await SecureStore.setItemAsync("token", t);
    setToken(t);
    globalThis.AUTH_TOKEN = t;
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync("token");
    setToken(null);
    globalThis.AUTH_TOKEN = null;
  };

  return (
    <AuthContext.Provider value={{ token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
