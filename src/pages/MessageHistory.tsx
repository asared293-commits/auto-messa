import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/base/card";
import { Button } from "@/components/base/button";
import { Input } from "@/components/base/input";
import { 
  History, CheckCircle2, AlertCircle, RotateCcw, Search, Users, Phone, FileText, Calendar 
} from "lucide-react";
import { toast } from "sonner";
import { MessageLog } from "../types";
import { format } from "date-fns";
import { useAppStore } from "../store/useAppStore";

export default function MessageHistory() {
  const { wsStatus } = useAppStore();
  const [history, setHistory] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (err: any) {
      toast.error("Failed to load message history: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    if (wsStatus !== "connected") {
      toast.error("WhatsApp is disconnected. Please reconnect WhatsApp before retrying.");
      return;
    }

    setRetryingId(id);
    try {
      const res = await fetch("/api/history/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Message retried and sent successfully!");
      fetchHistory();
    } catch (err: any) {
      toast.error("Retry failed: " + err.message);
      fetchHistory();
    } finally {
      setRetryingId(null);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.recipientJid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.recipientName && item.recipientName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Message Log & History</h1>
        <p className="text-slate-500 mt-1">
          Complete audit history of sent and failed WhatsApp messages.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Search log by recipient or content..." 
            className="pl-9 bg-white dark:bg-slate-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
          {[
            { id: "all", label: "All Logs" },
            { id: "sent", label: "Sent" },
            { id: "failed", label: "Failed" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No message logs</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Sent or failed messages will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredHistory.map((item) => {
            const isGroup = item.recipientJid.includes("@g.us");
            return (
              <Card key={item.id} className="border border-slate-200 dark:border-slate-800 hover:shadow-xs">
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.status === "sent" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Delivered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <AlertCircle className="w-3 h-3 mr-1" /> Failed
                        </span>
                      )}

                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center">
                        {isGroup ? <Users className="w-3 h-3 mr-1 text-indigo-500" /> : <Phone className="w-3 h-3 mr-1 text-emerald-500" />}
                        {item.recipientName || item.recipientJid}
                      </span>

                      {item.templateName && (
                        <span className="text-xs text-slate-400 flex items-center">
                          <FileText className="w-3 h-3 mr-1" /> {item.templateName}
                        </span>
                      )}

                      <span className="text-xs text-slate-400 ml-auto flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(new Date(item.sentAt), "MMM d, yyyy 'at' p")}
                      </span>
                    </div>

                    <p className="text-xs font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border text-slate-800 dark:text-slate-200">
                      {item.message}
                    </p>

                    {item.errorMessage && (
                      <p className="text-xs text-rose-600 font-medium">
                        Error: {item.errorMessage}
                      </p>
                    )}
                  </div>

                  {item.status === "failed" && (
                    <Button 
                      onClick={() => handleRetry(item.id)}
                      disabled={retryingId === item.id}
                      size="sm"
                      variant="outline"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 self-end md:self-center"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      {retryingId === item.id ? "Retrying..." : "Retry"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
