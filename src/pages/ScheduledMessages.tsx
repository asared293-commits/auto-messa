import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/base/card";
import { Button } from "@/components/base/button";
import { Input } from "@/components/base/input";
import { Label } from "@/components/base/label";
import { Textarea } from "@/components/base/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/base/dialog";
import { 
  CalendarClock, Calendar, Clock, Plus, Users, Phone, Send, Trash2, 
  Edit, Play, Pause, AlertCircle, CheckCircle2, RotateCcw, Copy, Filter, Globe, FileText, Info, X,
  Sparkles, Image as ImageIcon, Upload, RefreshCw, Zap
} from "lucide-react";
import { toast } from "sonner";
import { ScheduledMessage, RepeatType, ScheduledStatus, Template, WhatsAppChat } from "../types";
import { format } from "date-fns";
import { useAppStore } from "../store/useAppStore";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ScheduledMessages() {
  const { wsStatus } = useAppStore();
  const location = useLocation();
  const [schedules, setSchedules] = useState<ScheduledMessage[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAiScheduleModalOpen, setIsAiScheduleModalOpen] = useState(false);
  const [aiSchedulePrompt, setAiSchedulePrompt] = useState("");
  const [isParsingAiSchedule, setIsParsingAiSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [selectedRecipientType, setSelectedRecipientType] = useState<"chat" | "manual">("chat");
  const [targetJid, setTargetJid] = useState("");
  const [targetName, setTargetName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | 'audio'>("image");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [endDate, setEndDate] = useState("");
  const [variablesMap, setVariablesMap] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchTemplates();
    if (wsStatus === "connected") {
      fetchChats();
    }
  }, [wsStatus]);

  useEffect(() => {
    if (location.state) {
      const s = location.state as any;
      if (s.prefilledMessage) {
        handleOpenScheduleModal();
        setMessage(s.prefilledMessage);
        if (s.prefilledMediaUrl) setMediaUrl(s.prefilledMediaUrl);
        if (s.prefilledMediaType) setMediaType(s.prefilledMediaType);
        if (s.templateId) setSelectedTemplateId(s.templateId);
        if (s.recipientJid) setTargetJid(s.recipientJid);
      }
    }
  }, [location.state]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileData: base64, fileName: file.name, mimeType: file.type })
        });
        const data = await res.json();
        if (data.url) {
          setMediaUrl(data.url);
          if (data.mediaType) setMediaType(data.mediaType);
          toast.success("Media attached successfully!");
        } else {
          toast.error("Upload error: " + (data.error || "Failed to save file"));
        }
      } catch (err: any) {
        toast.error("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleParseAiSchedule = async () => {
    if (!aiSchedulePrompt.trim()) {
      toast.error("Please enter a scheduling prompt.");
      return;
    }

    setIsParsingAiSchedule(true);
    try {
      const res = await fetch("/api/ai/parse-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiSchedulePrompt, chats })
      });
      const data = await res.json();
      if (data.parsed) {
        const p = data.parsed;
        handleOpenScheduleModal();
        if (p.message) setMessage(p.message);
        if (p.recipientJid) setTargetJid(p.recipientJid);
        if (p.repeatType) setRepeatType(p.repeatType);
        if (p.repeatDays) setRepeatDays(p.repeatDays);
        if (p.scheduledDate) setScheduleDate(p.scheduledDate);
        if (p.scheduledTime) setScheduleTime(p.scheduledTime);
        toast.success("AI parsed and populated schedule form!");
        setIsAiScheduleModalOpen(false);
        setAiSchedulePrompt("");
      } else {
        toast.error("Could not parse schedule instruction.");
      }
    } catch (err: any) {
      toast.error("AI schedule parser error: " + err.message);
    } finally {
      setIsParsingAiSchedule(false);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedules");
      const data = await res.json();
      if (data.schedules) setSchedules(data.schedules);
    } catch (err: any) {
      toast.error("Failed to load schedules: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/whatsapp/chats");
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenScheduleModal = () => {
    setEditingSchedule(null);
    setSelectedRecipientType("chat");
    setTargetJid("");
    setTargetName("");
    setManualPhone("");
    setMessage("");
    setMediaUrl("");
    setMediaType("image");
    setSelectedTemplateId("");
    
    // Default date: tomorrow at 09:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split("T")[0]);
    setScheduleTime("09:00");
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setRepeatType("none");
    setRepeatDays([]);
    setEndDate("");
    setVariablesMap({});
    setIsScheduleModalOpen(true);
  };

  const handleOpenEditModal = (sched: ScheduledMessage) => {
    setEditingSchedule(sched);
    if (sched.phoneNumber && !sched.recipientJid.includes("@g.us")) {
      setSelectedRecipientType("manual");
      setManualPhone(sched.phoneNumber);
    } else {
      setSelectedRecipientType("chat");
      setTargetJid(sched.recipientJid);
      setTargetName(sched.recipientName);
    }

    setMessage(sched.message);
    setMediaUrl(sched.mediaUrl || "");
    setMediaType(sched.mediaType || "image");
    setSelectedTemplateId(sched.templateId || "");

    const schedDateObj = new Date(sched.scheduledAt);
    if (!isNaN(schedDateObj.getTime())) {
      setScheduleDate(schedDateObj.toISOString().split("T")[0]);
      const hours = String(schedDateObj.getHours()).padStart(2, "0");
      const minutes = String(schedDateObj.getMinutes()).padStart(2, "0");
      setScheduleTime(`${hours}:${minutes}`);
    }

    setTimezone(sched.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    setRepeatType(sched.repeatType || "none");
    setRepeatDays(sched.repeatDays || []);
    setEndDate(sched.endDate ? new Date(sched.endDate).toISOString().split("T")[0] : "");
    setIsScheduleModalOpen(true);
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) {
      setMessage(tpl.content);
      const vars = tpl.variables || [];
      const initMap: Record<string, string> = {};
      vars.forEach(v => {
        initMap[v] = "";
      });
      setVariablesMap(initMap);
    }
  };

  const handleApplyVariables = () => {
    let result = message;
    Object.entries(variablesMap).forEach(([key, val]) => {
      if (typeof val === "string" && val.trim()) {
        result = result.replaceAll(key, val);
      }
    });
    setMessage(result);
    toast.success("Variables replaced in message text.");
  };

  const handleSaveSchedule = async () => {
    let finalJid = targetJid;
    let finalName = targetName;
    let phoneNum = manualPhone;

    if (selectedRecipientType === "manual") {
      if (!manualPhone.trim()) {
        toast.error("Please enter a phone number.");
        return;
      }
      const cleanPhone = manualPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.length < 10) {
        toast.error("Invalid phone number. Include country code (e.g. 14155552671).");
        return;
      }
      finalJid = `${cleanPhone}@s.whatsapp.net`;
      finalName = `+${cleanPhone}`;
      phoneNum = cleanPhone;
    } else {
      if (!targetJid) {
        toast.error("Please select a WhatsApp group or contact.");
        return;
      }
      const chat = chats.find(c => c.id === targetJid);
      if (chat) finalName = chat.name;
    }

    if (!message.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select both Schedule Date and Schedule Time.");
      return;
    }

    const scheduledIso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    const scheduledObj = new Date(scheduledIso);

    if (isNaN(scheduledObj.getTime())) {
      toast.error("Invalid date/time specified.");
      return;
    }

    if (scheduledObj <= new Date()) {
      toast.error("Scheduled time must be in the future.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        recipientJid: finalJid,
        recipientName: finalName,
        phoneNumber: phoneNum,
        message,
        mediaUrl,
        mediaType,
        templateId: selectedTemplateId,
        templateName: templates.find(t => t.id === selectedTemplateId)?.name || "",
        scheduledAt: scheduledIso,
        timezone,
        repeatType,
        repeatDays,
        endDate: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : ""
      };

      if (editingSchedule) {
        const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Scheduled message updated.");
      } else {
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Message scheduled successfully.");
      }

      setIsScheduleModalOpen(false);
      fetchSchedules();
    } catch (err: any) {
      toast.error("Failed to save schedule: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ScheduledStatus) => {
    try {
      const res = await fetch(`/api/schedules/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Schedule status changed to ${newStatus}.`);
      fetchSchedules();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleSendNow = async (id: string) => {
    if (wsStatus !== "connected") {
      toast.error("WhatsApp is disconnected. Please reconnect WhatsApp before sending.");
      return;
    }

    try {
      toast.info("Sending message now...");
      const res = await fetch(`/api/schedules/${id}/send-now`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Message sent successfully!");
      fetchSchedules();
    } catch (err: any) {
      toast.error("Failed to send: " + err.message);
      fetchSchedules();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Scheduled message deleted.");
      setDeletingId(null);
      fetchSchedules();
    } catch (err: any) {
      toast.error("Failed to delete schedule: " + err.message);
    }
  };

  const toggleRepeatDay = (day: string) => {
    if (repeatDays.includes(day)) {
      setRepeatDays(repeatDays.filter(d => d !== day));
    } else {
      setRepeatDays([...repeatDays, day]);
    }
  };

  // Filtered List
  const filteredSchedules = schedules.filter((s) => {
    if (statusFilter === "all") return true;
    return s.status === statusFilter;
  });

  const getStatusBadge = (status: ScheduledStatus) => {
    switch (status) {
      case "scheduled":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><Clock className="w-3 h-3 mr-1" /> Scheduled</span>;
      case "sending":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse"><Clock className="w-3 h-3 mr-1" /> Sending...</span>;
      case "sent":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Sent</span>;
      case "failed":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><AlertCircle className="w-3 h-3 mr-1" /> Failed</span>;
      case "paused":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><Pause className="w-3 h-3 mr-1" /> Paused</span>;
      case "cancelled":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border"><X className="w-3 h-3 mr-1" /> Cancelled</span>;
      default:
        return <span className="text-xs">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Messages</h1>
          <p className="text-slate-500 mt-1">
            Automate sending WhatsApp messages to groups or contacts at specific dates, times, and recurring intervals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsAiScheduleModalOpen(true)}
            variant="outline"
            className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-medium"
          >
            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
            Schedule with AI
          </Button>

          <Button onClick={handleOpenScheduleModal} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Message
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {[
          { id: "all", label: "All Schedules" },
          { id: "scheduled", label: "Scheduled" },
          { id: "sent", label: "Sent" },
          { id: "failed", label: "Failed" },
          { id: "paused", label: "Paused" },
          { id: "cancelled", label: "Cancelled" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
              statusFilter === tab.id
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Schedule Table / List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No scheduled messages found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {statusFilter !== "all"
              ? `No messages with status '${statusFilter}'.`
              : "Schedule automated messages to your WhatsApp groups or individual contacts."}
          </p>
          <Button onClick={handleOpenScheduleModal} variant="outline" className="mt-6">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Schedule
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSchedules.map((sched) => {
            const isGroup = sched.recipientJid.includes("@g.us");
            return (
              <Card key={sched.id} className="hover:shadow-sm transition-shadow border border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(sched.status)}
                      
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center">
                        {isGroup ? <Users className="w-3 h-3 mr-1 text-indigo-500" /> : <Phone className="w-3 h-3 mr-1 text-emerald-500" />}
                        {sched.recipientName || sched.recipientJid}
                      </span>

                      {sched.repeatType && sched.repeatType !== "none" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          Repeat: {sched.repeatType} {sched.repeatDays?.length ? `(${sched.repeatDays.join(", ")})` : ""}
                        </span>
                      )}

                      {sched.templateName && (
                        <span className="text-xs text-slate-400 flex items-center">
                          <FileText className="w-3 h-3 mr-1" /> Template: {sched.templateName}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-mono bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border text-slate-800 dark:text-slate-200 line-clamp-2">
                      {sched.message}
                    </p>

                    {sched.errorMessage && (
                      <p className="text-xs text-rose-600 font-medium flex items-center bg-rose-50 dark:bg-rose-950/50 p-2 rounded border border-rose-200 dark:border-rose-900">
                        <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                        {sched.errorMessage}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Target: {format(new Date(sched.scheduledAt), "PPP 'at' p")}
                      </span>
                      <span className="flex items-center">
                        <Globe className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {sched.timezone}
                      </span>
                      {sched.sentAt && (
                        <span className="text-emerald-600 font-medium">
                          Sent on: {format(new Date(sched.sentAt), "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {sched.status === "scheduled" && (
                      <>
                        <Button 
                          onClick={() => handleSendNow(sched.id)} 
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Send Now
                        </Button>

                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 text-amber-600" 
                          onClick={() => handleStatusChange(sched.id, "paused")}
                          title="Pause Schedule"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}

                    {sched.status === "paused" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-emerald-600 border-emerald-200 h-8 text-xs" 
                        onClick={() => handleStatusChange(sched.id, "scheduled")}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Resume
                      </Button>
                    )}

                    {sched.status === "failed" && (
                      <Button 
                        onClick={() => handleSendNow(sched.id)} 
                        size="sm" 
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 text-slate-600" 
                      onClick={() => handleOpenEditModal(sched)}
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>

                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950" 
                      onClick={() => setDeletingId(sched.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* SCHEDULE MODAL */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Edit Scheduled Message" : "Schedule WhatsApp Message"}</DialogTitle>
            <DialogDescription>
              Set the message content, recipient, date, time, and recurrence settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Recipient Selection */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
              <Label className="text-sm font-semibold">Recipient Target</Label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecipientType("chat")}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${
                    selectedRecipientType === "chat"
                      ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 font-bold shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  WhatsApp Group / Contact
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecipientType("manual")}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${
                    selectedRecipientType === "manual"
                      ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 font-bold shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Manual Phone Number
                </button>
              </div>

              {selectedRecipientType === "chat" ? (
                <div className="space-y-2">
                  <Select value={targetJid} onValueChange={(val) => {
                    setTargetJid(val);
                    const chat = chats.find(c => c.id === val);
                    if (chat) setTargetName(chat.name);
                  }}>
                    <SelectTrigger className="bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Select a WhatsApp Group or Contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chats.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.isGroup ? <Users className="w-3.5 h-3.5 inline mr-2 text-indigo-500" /> : <Phone className="w-3.5 h-3.5 inline mr-2 text-emerald-500" />}
                          {c.name || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {wsStatus !== "connected" && (
                    <p className="text-xs text-rose-500 font-medium">
                      WhatsApp is disconnected. Connect WhatsApp in "WhatsApp Status" to fetch groups.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input 
                    placeholder="Enter phone number with country code (e.g. 14155552671)" 
                    className="bg-white dark:bg-slate-900"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">Include country code without + or spaces.</p>
                </div>
              )}
            </div>

            {/* Template Selector & Message */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="schedMsg">Message Content *</Label>
                {templates.length > 0 && (
                  <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                    <SelectTrigger className="w-[200px] h-8 text-xs bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Use Saved Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Textarea 
                id="schedMsg" 
                rows={5}
                placeholder="Write your WhatsApp message here..." 
                className="font-mono text-sm resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              {/* Variable Replacement Form */}
              {Object.keys(variablesMap).length > 0 && (
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-lg border border-indigo-100 dark:border-indigo-900 space-y-2">
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                    Template Variable Inputs:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(variablesMap).map((vKey) => (
                      <div key={vKey} className="space-y-1">
                        <Label className="text-[11px] font-mono text-slate-600">{vKey}</Label>
                        <Input 
                          placeholder={`Value for ${vKey}`} 
                          className="h-8 text-xs bg-white dark:bg-slate-900"
                          value={variablesMap[vKey]}
                          onChange={(e) => setVariablesMap({ ...variablesMap, [vKey]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleApplyVariables}
                    className="text-xs h-7 w-full mt-1"
                  >
                    Replace Variables in Text
                  </Button>
                </div>
              )}

              {/* Media Attachment */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Label className="text-xs font-semibold">Media Attachment (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="Enter Media URL (https://...)" 
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="flex-1"
                  />
                  <label className="cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*,video/*,application/pdf" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                    <Button type="button" variant="outline" disabled={isUploading} className="pointer-events-none">
                      {isUploading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      Upload
                    </Button>
                  </label>
                </div>
                {mediaUrl && (
                  <div className="relative rounded-lg overflow-hidden border h-28 bg-black/80 max-w-xs mt-2">
                    <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
            </div>

            {/* Date, Time & Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedDate">Schedule Date *</Label>
                <Input 
                  id="schedDate" 
                  type="date" 
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedTime">Schedule Time *</Label>
                <Input 
                  id="schedTime" 
                  type="time" 
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input 
                  value={timezone} 
                  disabled 
                  className="bg-slate-100 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>

            {/* Recurrence Settings */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
              <Label className="text-sm font-semibold">Recurrence / Repeat Schedule</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "none", label: "Does not repeat" },
                  { id: "daily", label: "Daily" },
                  { id: "weekly", label: "Weekly" },
                  { id: "monthly", label: "Monthly" }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRepeatType(item.id as RepeatType)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                      repeatType === item.id
                        ? "bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 font-bold shadow-sm"
                        : "bg-transparent text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {repeatType === "weekly" && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-slate-600">Select Repeat Days:</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = repeatDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleRepeatDay(day)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white dark:bg-slate-800 text-slate-600 border-slate-200"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {repeatType !== "none" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input 
                    id="endDate" 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSchedule} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? "Saving..." : editingSchedule ? "Update Schedule" : "Schedule Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI NATURAL LANGUAGE SCHEDULING MODAL */}
      <Dialog open={isAiScheduleModalOpen} onOpenChange={setIsAiScheduleModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              AI Natural Language Schedule Assistant
            </DialogTitle>
            <DialogDescription>
              Describe your scheduling plan in plain language (e.g. "Send 'Weekly Team Sync: Please update your task board' to the Engineering group every Monday at 9:00 AM").
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <Textarea 
              placeholder="e.g. Schedule a reminder to John (+14155552671) tomorrow at 10 AM saying 'Hi John, your invoice is ready for review'." 
              rows={4}
              value={aiSchedulePrompt}
              onChange={(e) => setAiSchedulePrompt(e.target.value)}
            />

            <Button 
              onClick={handleParseAiSchedule} 
              disabled={isParsingAiSchedule}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isParsingAiSchedule ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Parsing Schedule Request with AI...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" /> Auto-Fill Schedule Form
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Schedule?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this scheduled message?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingId && handleDelete(deletingId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
