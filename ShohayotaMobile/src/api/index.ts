import axios from "axios";
import { Platform } from "react-native";

// --- IMPORTANT ---
// Platform-aware API base URL
let BASE = "http://localhost:5000";

if (Platform.OS === "android") {
  // Android emulator -> Backend on Windows host:
  BASE = "http://10.0.2.2:5000";
  // If real device, use your PC's IP address:
  // BASE = "http://YOUR_PC_IP:5000";
} else if (Platform.OS === "ios") {
  // iOS simulator -> Backend on localhost:
  BASE = "http://localhost:5000";
  // If real device, use your PC's IP address:
  // BASE = "http://YOUR_PC_IP:5000";
} else if (Platform.OS === "web") {
  // Web -> Backend on localhost:
  BASE = "http://localhost:5000";
}

// If using ngrok:
// BASE = "https://xxxxx.ngrok.io";

export const api = axios.create({
  baseURL: BASE + "/api",
  timeout: 15000,
});

// Attach JWT token automatically
api.interceptors.request.use(async (config) => {
  const token = (globalThis as any).AUTH_TOKEN;
  if (token) (config.headers as any).Authorization = "Bearer " + token;
  return config;
});

// AUTH
export const loginRequest = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

// USERS
export const fetchMe = () => api.get("/users/me");

// CUSTOMERS
export const fetchCustomers = () => api.get("/customers");
export const fetchCustomer = (id: string | number) =>
  api.get(`/customers/${id}`);

// TENANT
export const fetchCurrentTenant = () => api.get("/tenants/current");

// TICKETS
export const fetchTickets = () => api.get("/tickets");


