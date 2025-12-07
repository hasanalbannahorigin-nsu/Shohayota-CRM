import axios from "axios";

// --- IMPORTANT ---
// Emulator -> Backend on Windows host:
const BASE = "http://10.0.2.2:5000";

// If real device:
// const BASE = "http://YOUR_PC_IP:5000";

// If using ngrok:
// const BASE = "https://xxxxx.ngrok.io";

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


