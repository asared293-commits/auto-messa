import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/base/card";
import { Button } from "@/components/base/button";
import { Input } from "@/components/base/input";
import { Label } from "@/components/base/label";
import { Textarea } from "@/components/base/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/base/dialog";
import { Plus, Play, Pause, Trash2, Calendar, Users, Phone, FileText, Clock, Edit, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Campaign, Template, RepeatType, WhatsAppChat } from "../types";
import { format } from "date-fns";
import { useAppStore } from "../store/useAppStore";

export default function Campaigns() {
  const { wsStatus } = useAppStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [selectedRecipientType, setSelectedRecipientType] = useState<"chat" | "manual">("chat");
  const [targetJid, setTargetJid] = useState("");
  const [targetName, setTargetName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [repeatType, setRepeatType] = useState<RepeatType>("weekly");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
    if (wsStatus === "connected") {
      fetchChats();
    }
  }, [wsStatus]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch (err: any) {
      toast.error("Failed to load campaigns: " + err.message);
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

  const handleOpenCreate = () => {
    setEditingCampaign(null);
    setName("");
    setDescription("");
    setTemplateId("");
    setSelectedRecipientType("chat");
    setTargetJid("");
    setTargetName("");
    setManualPhone("");
    setScheduleTime("09:00");
    setRepeatType("weekly");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (camp: Campaign) => {
    setEditingCampaign(camp);
    setName(camp.name);
    setDescription(camp.description || "");
    setTemplateId(camp.templateId || "");
    if (camp.phoneNumber && !camp.recipientJid.includes("@g.us")) {
      setSelectedRecipientType("manual");
      setManualPhone(camp.phoneNumber);
    } else {
      setSelectedRecipientType("chat");
      setTargetJid(camp.recipientJid);
      setTargetName(camp.recipientName);
    }
    setScheduleTime(camp.scheduleTime || "09:00");
    setRepeatType(camp.repeatType || "weekly");
    setIsModalOpen(true);
  };

  const handleSaveCampaign = async () => {
    if (!name.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }

    let finalJid = targetJid;
    let finalName = targetName;
    let phoneNum = manualPhone;

    if (selectedRecipientType === "manual") {
      if (!manualPhone.trim()) {
        toast.error("Please enter a phone number.");
        return;
      }
      const cleanPhone = manualPhone.replace(/[^0-9]/g, "");
      finalJid = `${cleanPhone}@s.whatsapp.net`;
      finalName = `+${cleanPhone}`;
      phoneNum = cleanPhone;
    } else {
      if (!targetJid) {
        toast.error("Please select a target WhatsApp group or contact.");
        return;
      }
      const chat = chats.find(c => c.id === targetJid);
      if (chat) finalName = chat.name;
    }

    setIsSubmitting(true);
    try {
      const selectedTpl = templates.find(t => t.id === templateId);
      const payload = {
        name,
        description,
        templateId,
        templateName: selectedTpl ? selectedTpl.name : "",
        recipientJid: finalJid,
        recipientName: finalName,
        phoneNumber: phoneNum,
        scheduleTime,
        repeatType
      };

      if (editingCampaign) {
        const res = await fetch(`/api/campaigns/${editingCampaign.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Campaign updated successfully.");
      } else {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Campaign created successfully.");
      }

      setIsModalOpen(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Failed to save campaign: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (camp: Campaign) => {
    const newStatus = camp.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/campaigns/${camp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Campaign status changed to ${newStatus}.`);
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Campaign deleted successfully.");
      setDeletingId(null);
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Failed to delete campaign: " + err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-slate-500 mt-1">
            Manage structured automated messaging campaigns across your WhatsApp groups and audience.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-52 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No campaigns created yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Set up structured messaging campaigns with templates and recurring dispatch times.
          </p>
          <Button onClick={handleOpenCreate} variant="outline" className="mt-6">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const isGroup = camp.recipientJid.includes("@g.us");
            return (
              <Card key={camp.id} className="flex flex-col hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    {camp.status === "active" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border">
                        <Pause className="w-3 h-3 mr-1" /> Paused
                      </span>
                    )}

                    <span className="text-xs text-slate-400">
                      Created {format(new Date(camp.createdAt), "MMM d")}
                    </span>
                  </div>

                  <CardTitle className="text-lg font-bold mt-2">{camp.name}</CardTitle>
                  {camp.description && (
                    <CardDescription className="line-clamp-2 text-xs mt-0.5">{camp.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col space-y-4">
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Recipient:</span>
                      <span className="font-semibold flex items-center">
                        {isGroup ? <Users className="w-3 h-3 mr-1 text-indigo-500" /> : <Phone className="w-3 h-3 mr-1 text-emerald-500" />}
                        {camp.recipientName || camp.recipientJid}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Template:</span>
                      <span className="font-medium flex items-center">
                        <FileText className="w-3 h-3 mr-1 text-slate-400" />
                        {camp.templateName || "None selected"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Dispatch Time:</span>
                      <span className="font-mono flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        {camp.scheduleTime} ({camp.repeatType})
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 grid grid-cols-2 gap-2 mt-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleToggleStatus(camp)}
                      className={camp.status === "active" ? "text-amber-600 border-amber-200 text-xs" : "text-emerald-600 border-emerald-200 text-xs"}
                    >
                      {camp.status === "active" ? (
                        <>
                          <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 mr-1" /> Activate
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-1 justify-end">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-slate-600" 
                        onClick={() => handleOpenEdit(camp)}
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950" 
                        onClick={() => setDeletingId(camp.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT CAMPAIGN DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Edit Campaign" : "Create New Campaign"}</DialogTitle>
            <DialogDescription>
              Configure campaign targeting, template, and automated send schedules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cName">Campaign Name *</Label>
              <Input 
                id="cName" 
                placeholder="E.g. Monday Morning Tech News Broadcast" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cDesc">Description (Optional)</Label>
              <Textarea 
                id="cDesc" 
                placeholder="Brief summary of campaign objective..." 
                rows={2} 
                className="resize-none"
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select from Template Library..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Target */}
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Target Recipient</Label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecipientType("chat")}
                  className={`py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${
                    selectedRecipientType === "chat"
                      ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 font-bold shadow-xs"
                      : "bg-transparent text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Group / Contact
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecipientType("manual")}
                  className={`py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${
                    selectedRecipientType === "manual"
                      ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 font-bold shadow-xs"
                      : "bg-transparent text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Manual Phone
                </button>
              </div>

              {selectedRecipientType === "chat" ? (
                <Select value={targetJid} onValueChange={(val) => {
                  setTargetJid(val);
                  const chat = chats.find(c => c.id === val);
                  if (chat) setTargetName(chat.name);
                }}>
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Select WhatsApp Group or Contact..." />
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
              ) : (
                <Input 
                  placeholder="Phone number with country code (e.g. 14155552671)" 
                  className="bg-white dark:bg-slate-900"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cTime">Dispatch Time</Label>
                <Input 
                  id="cTime" 
                  type="time" 
                  value={scheduleTime} 
                  onChange={(e) => setScheduleTime(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label>Recurrence Interval</Label>
                <Select value={repeatType} onValueChange={(val) => setRepeatType(val as RepeatType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCampaign} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? "Saving..." : editingCampaign ? "Update Campaign" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Campaign?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this campaign?
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
