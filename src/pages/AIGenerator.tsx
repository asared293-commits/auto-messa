import { useState, useEffect, ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/base/card";
import { Button } from "@/components/base/button";
import { Textarea } from "@/components/base/textarea";
import { Input } from "@/components/base/input";
import { Label } from "@/components/base/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/base/dialog";
import { Sparkles, Save, Send, Users, CalendarClock, Phone, FileText, Check, Plus, Upload, X, File, FileAudio, FileVideo, RefreshCw, Image as ImageIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "../store/useAppStore";
import { Template, TemplateCategory, RepeatType } from "../types";

export default function AIGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  const { wsStatus } = useAppStore();

  // Generator states
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [keywords, setKeywords] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Media attachment states
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "document" | "audio" | "">("");
  const [mediaName, setMediaName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Recipient selection
  const [chats, setChats] = useState<{ id: string; name: string; isGroup: boolean }[]>([]);
  const [selectedRecipientType, setSelectedRecipientType] = useState<"chat" | "manual">("chat");
  const [targetJid, setTargetJid] = useState("");
  const [manualNumber, setManualNumber] = useState("");

  // Templates list
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Modals
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Save Template Form
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState<TemplateCategory>("Marketing");
  const [tplDescription, setTplDescription] = useState("");
  const [isSavingTpl, setIsSavingTpl] = useState(false);

  // Schedule Form
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [isScheduling, setIsScheduling] = useState(false);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
    if (wsStatus === "connected") {
      fetchChats();
    }

    // Check if navigated with state template
    if (location.state?.template) {
      const tpl = location.state.template as Template;
      setGeneratedMessage(tpl.content);
      setSelectedTemplateId(tpl.id);
      setMediaUrl(tpl.mediaUrl || "");
      setMediaType((tpl.mediaType as any) || "");
      if (tpl.mediaUrl) setMediaName(tpl.mediaUrl.split('/').pop() || "Attachment");
      toast.info(`Loaded template "${tpl.name}".`);
    }
  }, [wsStatus, location.state]);

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/whatsapp/chats");
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch (err) {
      console.error(err);
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

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or subject.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, length, keywords, imageData: mediaType === "image" && mediaUrl ? mediaUrl : undefined })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedMessage(data.message);
      toast.success("AI message generated successfully!");
    } catch (error: any) {
      toast.error("Failed to generate message: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) {
      setGeneratedMessage(tpl.content);
      setMediaUrl(tpl.mediaUrl || "");
      setMediaType((tpl.mediaType as any) || "");
      if (tpl.mediaUrl) setMediaName(tpl.mediaUrl.split('/').pop() || "Attachment");
      toast.success(`Loaded template: "${tpl.name}"`);
    }
  };

  const handleSendNow = async () => {
    if (wsStatus !== "connected") {
      toast.error("WhatsApp is disconnected. Please connect WhatsApp first!");
      return;
    }

    if (!generatedMessage.trim()) {
      toast.error("Please generate or write a message first.");
      return;
    }

    let jid = targetJid;
    if (selectedRecipientType === "manual") {
      if (!manualNumber.trim()) {
        toast.error("Please enter a phone number.");
        return;
      }
      const cleanNumber = manualNumber.replace(/[^0-9]/g, "");
      jid = `${cleanNumber}@s.whatsapp.net`;
    } else {
      if (!targetJid) {
        toast.error("Please select a WhatsApp group or contact.");
        return;
      }
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid, text: generatedMessage, mediaUrl, mediaType })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Message sent successfully!");
    } catch (err: any) {
      toast.error("Error sending message: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenSaveTemplate = () => {
    if (!generatedMessage.trim()) {
      toast.error("Please write or generate a message before saving as a template.");
      return;
    }
    setTplName(topic ? `Template - ${topic.slice(0, 20)}` : "New Template");
    setTplDescription("");
    setTplCategory("Marketing");
    setIsSaveTemplateOpen(true);
  };

  const handleSaveTemplateSubmit = async () => {
    if (!tplName.trim()) {
      toast.error("Please enter a template name.");
      return;
    }

    setIsSavingTpl(true);
    try {
      const variables = Array.from(new Set(generatedMessage.match(/\{\{([^}]+)\}\}/g) || []));
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tplName,
          description: tplDescription,
          category: tplCategory,
          content: generatedMessage,
          variables,
          mediaUrl,
          mediaType
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Template saved successfully!");
      setIsSaveTemplateOpen(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error("Failed to save template: " + err.message);
    } finally {
      setIsSavingTpl(false);
    }
  };

  const handleOpenScheduleModal = () => {
    if (!generatedMessage.trim()) {
      toast.error("Please write or generate a message before scheduling.");
      return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split("T")[0]);
    setScheduleTime("09:00");
    setRepeatType("none");
    setIsScheduleOpen(true);
  };

  const handleScheduleSubmit = async () => {
    let finalJid = targetJid;
    let finalName = "";
    let phoneNum = manualNumber;

    if (selectedRecipientType === "manual") {
      if (!manualNumber.trim()) {
        toast.error("Please enter a phone number.");
        return;
      }
      const cleanNumber = manualNumber.replace(/[^0-9]/g, "");
      finalJid = `${cleanNumber}@s.whatsapp.net`;
      finalName = `+${cleanNumber}`;
      phoneNum = cleanNumber;
    } else {
      if (!targetJid) {
        toast.error("Please select a WhatsApp recipient.");
        return;
      }
      const chat = chats.find(c => c.id === targetJid);
      finalName = chat ? chat.name : targetJid;
    }

    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select date and time.");
      return;
    }

    const scheduledIso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    if (new Date(scheduledIso) <= new Date()) {
      toast.error("Scheduled time must be in the future.");
      return;
    }

    setIsScheduling(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientJid: finalJid,
          recipientName: finalName,
          phoneNumber: phoneNum,
          message: generatedMessage,
          templateId: selectedTemplateId,
          scheduledAt: scheduledIso,
          repeatType,
          mediaUrl,
          mediaType
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Message scheduled successfully!");
      setIsScheduleOpen(false);
      navigate("/scheduled");
    } catch (err: any) {
      toast.error("Failed to schedule message: " + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const maxSizeBytes = 16 * 1024 * 1024; // 16MB max limit roughly for this app
    if (file.size > maxSizeBytes) {
      toast.error("File is too large. Maximum size is 16MB.");
      return;
    }

    setIsUploading(true);

    const readFileAsBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(f);
      });
    };

    try {
      const base64Data = await readFileAsBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileData: base64Data
        })
      });
      
      if (!res.ok) {
        throw new Error(res.status === 413 ? "File is too large for the server." : `Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setMediaUrl(data.url);
      setMediaType(data.mediaType);
      setMediaName(file.name);
      toast.success("Media uploaded successfully");
    } catch (err: any) {
      toast.error(err.message === "Failed to fetch" 
        ? "Upload failed: File might be too large or network error." 
        : "Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeMedia = () => {
    setMediaUrl("");
    setMediaType("");
    setMediaName("");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: AI Parameters & Templates */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Message Generator</h1>
          <p className="text-slate-500 mt-1">Craft personalized WhatsApp messages with Gemini AI.</p>
        </div>

        {/* Load Template Option */}
        {templates.length > 0 && (
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Use Saved Template</p>
                <p className="text-xs text-slate-500">Pick from your template library</p>
              </div>
            </div>
            <Select value={selectedTemplateId} onValueChange={handleLoadTemplate}>
              <SelectTrigger className="w-[200px] bg-white dark:bg-slate-900 text-xs">
                <SelectValue placeholder="Select Template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Prompt Instructions</CardTitle>
            <CardDescription>Configure parameters for AI text generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic / Goal *</Label>
              <Textarea 
                id="topic" 
                placeholder="E.g., Special weekend 30% discount announcement for loyal customers..." 
                className="resize-none"
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly & Warm</SelectItem>
                    <SelectItem value="urgent">Urgent / Time-Sensitive</SelectItem>
                    <SelectItem value="persuasive">Persuasive / Sales</SelectItem>
                    <SelectItem value="informative">Informative / News</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Length</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                    <SelectItem value="medium">Medium (Concise paragraph)</SelectItem>
                    <SelectItem value="long">Long & Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords / Placeholders (Optional)</Label>
              <Input 
                id="keywords" 
                placeholder="E.g. {{name}}, discount code 'SAVE30', expires Sunday" 
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating Message..." : "Generate AI Message"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Output & Sending Options */}
      <div className="space-y-6 pt-0 lg:pt-14">
        <Card className="h-full flex flex-col border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Message Composition</CardTitle>
              <div className="flex gap-2">
                {generatedMessage && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsPreviewOpen(true)} 
                    className="text-xs h-8 text-slate-600 border-slate-200 hover:bg-slate-50"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Preview
                  </Button>
                )}
                {generatedMessage && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleOpenSaveTemplate} 
                    className="text-xs h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Save as Template
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col space-y-4">
            <Textarea 
              className="flex-1 min-h-[160px] font-mono text-sm resize-none bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-dashed"
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              placeholder="Your generated message will appear here. You can edit the text directly before sending or scheduling."
            />

            {/* Media Attachment Section */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Media Attachment (Optional)
                </Label>
              </div>

              {!mediaUrl ? (
                <label className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer overflow-hidden">
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                  />
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 pointer-events-none">
                    {isUploading ? <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" /> : <Upload className="w-5 h-5 text-slate-500" />}
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 pointer-events-none">
                    {isUploading ? "Uploading media..." : "Add images, videos or documents"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 pointer-events-none">Drag & drop files here or click to upload</p>
                </label>
              ) : (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {mediaType === "image" ? (
                      <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0 overflow-hidden">
                        <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : mediaType === "video" ? (
                      <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0 flex items-center justify-center text-indigo-500">
                        <FileVideo className="w-5 h-5" />
                      </div>
                    ) : mediaType === "audio" ? (
                      <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0 flex items-center justify-center text-amber-500">
                        <FileAudio className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0 flex items-center justify-center text-emerald-500">
                        <File className="w-5 h-5" />
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-sm font-medium truncate">{mediaName}</p>
                      <p className="text-xs text-slate-500 uppercase">{mediaType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="cursor-pointer text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1">
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                      Replace
                    </label>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={removeMedia}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Selection */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border space-y-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Select Recipient
              </Label>

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
                  Phone Number
                </button>
              </div>

              {selectedRecipientType === "chat" ? (
                wsStatus === "connected" ? (
                  <Select value={targetJid} onValueChange={setTargetJid}>
                    <SelectTrigger className="bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Select WhatsApp Group or Contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.isGroup ? <Users className="w-3.5 h-3.5 inline mr-2 text-indigo-500" /> : <Phone className="w-3.5 h-3.5 inline mr-2 text-emerald-500" />}
                          {c.name || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-rose-500 font-medium p-2 bg-rose-50 dark:bg-rose-950 rounded border border-rose-200">
                    WhatsApp is disconnected. Please connect WhatsApp to view chats.
                  </div>
                )
              ) : (
                <Input 
                  placeholder="Enter phone number with country code (e.g. 14155552671)" 
                  className="bg-white dark:bg-slate-900"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                />
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  onClick={handleSendNow} 
                  disabled={isSending || !generatedMessage}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? "Sending..." : "Send Immediately"}
                </Button>

                <Button 
                  onClick={handleOpenScheduleModal} 
                  disabled={!generatedMessage}
                  variant="outline"
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Schedule Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SAVE TEMPLATE DIALOG */}
      <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save Message as Reusable Template</DialogTitle>
            <DialogDescription>
              Store this generated content in your template library for future reuse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tplNameInput">Template Name *</Label>
              <Input 
                id="tplNameInput" 
                value={tplName} 
                onChange={(e) => setTplName(e.target.value)}
                placeholder="E.g. Discount Offer Announcement" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tplCatInput">Category</Label>
              <Select value={tplCategory} onValueChange={(v) => setTplCategory(v as TemplateCategory)}>
                <SelectTrigger id="tplCatInput">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Marketing", "Personal", "Business", "Tech", "News", "Announcements", "Customer Support", "Events", "Other"].map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tplDescInput">Description (Optional)</Label>
              <Input 
                id="tplDescInput" 
                value={tplDescription} 
                onChange={(e) => setTplDescription(e.target.value)}
                placeholder="Short description" 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveTemplateOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplateSubmit} disabled={isSavingTpl} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSavingTpl ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK SCHEDULE DIALOG */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Message</DialogTitle>
            <DialogDescription>
              Specify when this message should be sent automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qDate">Schedule Date *</Label>
              <Input 
                id="qDate" 
                type="date" 
                value={scheduleDate} 
                onChange={(e) => setScheduleDate(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qTime">Schedule Time *</Label>
              <Input 
                id="qTime" 
                type="time" 
                value={scheduleTime} 
                onChange={(e) => setScheduleTime(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Select value={repeatType} onValueChange={(val) => setRepeatType(val as RepeatType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleSubmit} disabled={isScheduling} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isScheduling ? "Scheduling..." : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW DIALOG */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-sm sm:max-w-md bg-[#efeae2] p-0 overflow-hidden border-0">
          <DialogHeader className="bg-[#00a884] text-white p-4 shadow-sm z-10">
            <DialogTitle className="text-white text-base font-semibold flex items-center gap-3">
              WhatsApp Preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-[url('https://static.whatsapp.net/rsrc.php/v3/yO/r/FsWUqRoZgO_.png')] bg-repeat min-h-[300px] flex flex-col justify-end">
            <div className="bg-white rounded-lg p-1.5 shadow-sm max-w-[85%] self-end relative pb-5">
              {mediaUrl && mediaType === "image" && (
                <div className="rounded-md overflow-hidden mb-1 border border-slate-100">
                  <img src={mediaUrl} alt="Preview" className="w-full h-auto object-cover max-h-[250px]" />
                </div>
              )}
              {mediaUrl && mediaType === "video" && (
                <div className="rounded-md overflow-hidden mb-1 border border-slate-100 bg-slate-900 flex items-center justify-center h-[200px]">
                  <FileVideo className="w-12 h-12 text-slate-400" />
                </div>
              )}
              {mediaUrl && mediaType === "audio" && (
                <div className="rounded-md p-3 mb-1 border border-slate-100 bg-amber-50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="h-1 bg-amber-200 rounded-full w-full relative">
                      <div className="absolute left-0 top-0 h-full w-1/3 bg-amber-500 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              {mediaUrl && mediaType === "document" && (
                <div className="rounded-md p-3 mb-1 border border-slate-100 bg-slate-50 flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500 rounded flex items-center justify-center text-white font-bold text-xs">
                    PDF
                  </div>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{mediaName}</p>
                </div>
              )}
              
              <div className="text-[14.2px] leading-relaxed text-slate-800 whitespace-pre-wrap px-1.5 pt-1 pb-1">
                {generatedMessage || "Your message will appear here..."}
              </div>
              <div className="absolute right-2 bottom-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                8:00 PM <Check className="w-3.5 h-3.5 text-[#53bdeb] ml-0.5" />
              </div>
            </div>
          </div>
          <div className="p-3 bg-white border-t flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(false)}>Close</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
              setIsPreviewOpen(false);
              handleSendNow();
            }}>
              Send Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
