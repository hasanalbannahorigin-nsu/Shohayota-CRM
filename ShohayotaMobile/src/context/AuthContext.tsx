import React, { createContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import { loginRequest } from "../api";
import { api } from "../api";

// SecureStore only works on native platforms, not web
let SecureStore: any = null;
if (Platform.OS !== "web") {
  SecureStore = require("expo-secure-store");
}

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [token, setToken] = useState<string | null>(null);

  // Load token from secure storage (or localStorage on web)
  useEffect(() => {
    (async () => {
      let saved: string | null = null;
      if (Platform.OS === "web") {
        saved = localStorage.getItem("token");
      } else {
        saved = await SecureStore.getItemAsync("token");
      }
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

    if (Platform.OS === "web") {
      localStorage.setItem("token", t);
    } else {
      await SecureStore.setItemAsync("token", t);
    }
    setToken(t);
    globalThis.AUTH_TOKEN = t;
  };

  const signOut = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("token");
    } else {
      await SecureStore.deleteItemAsync("token");
    }
    setToken(null);
    globalThis.AUTH_TOKEN = null;
  };

  return (
    <AuthContext.Provider value={{ token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
