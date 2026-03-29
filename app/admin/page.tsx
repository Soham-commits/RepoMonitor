"use client";

import React, { useState, useEffect } from "react";
import { AdminLogin } from "../../src/components/AdminLogin";
import { AdminDashboard } from "../../src/components/AdminDashboard";

const ADMIN_SESSION_KEY = "admin-auth";
const ADMIN_USERNAME = "ignisia-admin";
const ADMIN_PASSWORD = "ignisia@2026";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem(ADMIN_SESSION_KEY);
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (username: string, password: string) => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
