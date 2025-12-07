import { useEffect, useState, useMemo, useCallback } from "react";
import { getUser, getToken, logout as authLogout, type AuthUser } from "@/lib/auth";
import { useLocation } from "wouter";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [, setLocation] = useLocation();

  // Memoize user to prevent unnecessary re-renders
  const userMemo = useMemo(() => user, [user?.id, user?.email, user?.tenantId, user?.role]);

  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      const currentUser = getUser();
      
      // Only update if values actually changed
      setIsAuthenticated(prev => {
        const newValue = !!token;
        return prev !== newValue ? newValue : prev;
      });
      
      setUser(prev => {
        if (!currentUser && !prev) return prev;
        if (!currentUser && prev) return null;
        if (currentUser && !prev) return currentUser;
        if (currentUser?.id !== prev?.id) return currentUser;
        return prev;
      });
      
      // Redirect to login if not authenticated
      if (!token && window.location.pathname !== "/login") {
        setLocation("/login");
      }
    };

    checkAuth();
    
    // Check auth periodically (every 30 seconds) to catch token expiration
    const interval = setInterval(checkAuth, 30000);
    
    return () => clearInterval(interval);
  }, [setLocation]);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    setIsAuthenticated(false);
    setLocation("/login");
  }, [setLocation]);

  return {
    user: userMemo,
    isAuthenticated,
    logout,
  };
}
