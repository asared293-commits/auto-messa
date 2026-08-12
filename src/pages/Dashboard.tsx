import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/base/card";
import { Button } from "@/components/base/button";
import { useAppStore } from "../store/useAppStore";
import { 
  MessageSquare, CalendarClock, Zap, CheckCircle2, AlertCircle, Plus, Sparkles, FileText, Send, Phone, Users, History, ArrowRight 
} from "lucide-react";
import { auth } from "../firebase";
import { ScheduledMessage, MessageLog, Template, Campaign } from "../types";
import { format } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const { wsStatus, checkConnection } = useAppStore();

  const [stats, setStats] = useState({
    sentCount: 0,
    scheduledCount: 0,
    templatesCount: 0,
    campaignsCount: 0
  });

  const [recentLogs, setRecentLogs] = useState<MessageLog[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [histRes, schedRes, tplRes, campRes] = await Promise.all([
        fetch("/api/history").then(r => r.json()).catch(() => ({ history: [] })),
        fetch("/api/schedules").then(r => r.json()).catch(() => ({ schedules: [] })),
        fetch("/api/templates").then(r => r.json()).catch(() => ({ templates: [] })),
        fetch("/api/campaigns").then(r => r.json()).catch(() => ({ campaigns: [] }))
      ]);

      const logs: MessageLog[] = histRes.history || [];
      const schedules: ScheduledMessage[] = schedRes.schedules || [];
      const templates: Template[] = tplRes.templates || [];
      const campaigns: Campaign[] = campRes.campaigns || [];

      const sentCount = logs.filter(l => l.status === "sent").length;
      const scheduledPending = schedules.filter(s => s.status === "scheduled").length;
      const activeCampaigns = campaigns.filter(c => c.status === "active").length;

      setStats({
        sentCount,
        scheduledCount: scheduledPending,
        templatesCount: templates.length,
        campaignsCount: activeCampaigns
      });

      setRecentLogs(logs.slice(0, 5));
      setUpcomingSchedules(schedules.filter(s => s.status === "scheduled").slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {auth.currentUser?.displayName || "WhatsApp Specialist"} 👋
          </h1>
          <p className="text-slate-500 mt-1">
            Automated WhatsApp Message Sender dashboard overview and quick actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => navigate("/generate")} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Generator
          </Button>
          <Button onClick={() => navigate("/scheduled")} variant="outline">
            <CalendarClock className="w-4 h-4 mr-2" />
            Schedule Message
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">WhatsApp Status</CardTitle>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center mt-1">
              {wsStatus === "connected" ? (
                <span className="flex items-center text-emerald-600 text-xl font-bold">
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Connected
                </span>
              ) : (
                <span className="flex items-center text-rose-600 text-xl font-bold">
                  <AlertCircle className="w-5 h-5 mr-2" /> Disconnected
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
              <span className="text-slate-500">
                {wsStatus === "connected" ? "Ready to dispatch messages" : "Action required"}
              </span>
              <Link to="/connect" className="text-emerald-600 font-medium hover:underline">
                Manage
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Messages Delivered</CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {stats.sentCount}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
              <span className="text-slate-500">Total sent successfully</span>
              <Link to="/history" className="text-emerald-600 font-medium hover:underline">
                View Logs
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming Schedules</CardTitle>
            <CalendarClock className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {stats.scheduledCount}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
              <span className="text-slate-500">Pending automated sends</span>
              <Link to="/scheduled" className="text-indigo-600 font-medium hover:underline">
                Manage
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Template Library</CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {stats.templatesCount}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
              <span className="text-slate-500">Saved reusable templates</span>
              <Link to="/templates" className="text-purple-600 font-medium hover:underline">
                Library
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Activity and Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Schedules Card */}
        <Card className="flex flex-col border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">Upcoming Schedules</CardTitle>
              <CardDescription>Messages set to send automatically</CardDescription>
            </div>
            <Button onClick={() => navigate("/scheduled")} variant="ghost" size="sm" className="text-xs text-indigo-600">
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col space-y-3">
            {upcomingSchedules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900">
                <CalendarClock className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No pending schedules</p>
                <p className="text-xs text-slate-500 mt-1">Schedule messages to automatically dispatch later.</p>
                <Button onClick={() => navigate("/scheduled")} size="sm" variant="outline" className="mt-4 text-xs">
                  Schedule Now
                </Button>
              </div>
            ) : (
              upcomingSchedules.map((sched) => (
                <div key={sched.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                      {sched.recipientName || sched.recipientJid}
                    </span>
                    <span className="text-slate-500 font-mono">
                      {format(new Date(sched.scheduledAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-mono line-clamp-1">{sched.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Log */}
        <Card className="flex flex-col border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">Recent Message Logs</CardTitle>
              <CardDescription>Latest sent and attempted messages</CardDescription>
            </div>
            <Button onClick={() => navigate("/history")} variant="ghost" size="sm" className="text-xs text-emerald-600">
              View Logs <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col space-y-3">
            {recentLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900">
                <History className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No recent message logs</p>
                <p className="text-xs text-slate-500 mt-1">Dispatched messages will show up here.</p>
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                      {log.status === "sent" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                      )}
                      {log.recipientName || log.recipientJid}
                    </span>
                    <span className="text-slate-400">
                      {format(new Date(log.sentAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-mono line-clamp-1">{log.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
