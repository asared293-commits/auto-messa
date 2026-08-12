/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, LayoutDashboard, CalendarClock, Settings, Phone, Zap, LogOut, FileText, History, Calendar } from "lucide-react";
import { Toaster, toast } from "sonner";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, loginWithGoogle, logout } from "./firebase";
import { useAppStore } from "./store/useAppStore";
import { clsx } from "clsx";

// Pages
import Dashboard from "./pages/Dashboard";
import ConnectWA from "./pages/ConnectWA";
import AIGenerator from "./pages/AIGenerator";
import Templates from "./pages/Templates";
import ScheduledMessages from "./pages/ScheduledMessages";
import Campaigns from "./pages/Campaigns";
import MessageHistory from "./pages/MessageHistory";

// Components
import { Button } from "@/components/base/button";

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-pulse">Loading...</div></div>;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="p-8 max-w-md w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg text-center space-y-6">
          <div className="flex justify-center text-emerald-500 mb-4">
            <MessageSquare size={48} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Auto Messenger</h1>
          <p className="text-sm text-slate-500">Sign in to manage your AI-powered WhatsApp campaigns.</p>
          <Button onClick={loginWithGoogle} className="w-full bg-emerald-600 hover:bg-emerald-700">
            Continue with Google
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Sidebar() {
  const location = useLocation();
  const { wsStatus, checkConnection } = useAppStore();

  useEffect(() => {
    const i = setInterval(() => checkConnection(), 10000);
    checkConnection();
    return () => clearInterval(i);
  }, []);

  const links = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/connect", icon: Phone, label: "WhatsApp Status" },
    { to: "/generate", icon: Zap, label: "AI Generator" },
    { to: "/templates", icon: FileText, label: "Templates" },
    { to: "/scheduled", icon: CalendarClock, label: "Scheduled" },
    { to: "/campaigns", icon: Calendar, label: "Campaigns" },
    { to: "/history", icon: History, label: "Message Logs" },
  ];

  return (
    <aside className="w-64 border-r bg-slate-50 dark:bg-slate-900 dark:border-slate-800 flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b dark:border-slate-800">
        <MessageSquare className="w-6 h-6 text-emerald-600 mr-2" />
        <span className="font-bold text-lg">Auto Messenger</span>
      </div>

      <nav className="flex-1 p-4 flex flex-col gap-2">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-emerald-400" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {link.label}
              {link.to === "/connect" && (
                <span className={clsx(
                  "ml-auto w-2 h-2 rounded-full",
                  wsStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t dark:border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex-1 truncate">{auth.currentUser?.email}</div>
          <button onClick={() => logout()} title="Logout" className="hover:text-rose-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex h-screen w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
          <Sidebar />
          <main className="flex-1 flex flex-col h-full overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/connect" element={<ConnectWA />} />
              <Route path="/generate" element={<AIGenerator />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/scheduled" element={<ScheduledMessages />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/history" element={<MessageHistory />} />
            </Routes>
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </Router>
    </AuthProvider>
  );
}
