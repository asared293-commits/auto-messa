import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/base/card";
import { Button } from "@/components/base/button";
import { Input } from "@/components/base/input";
import { Label } from "@/components/base/label";
import { Textarea } from "@/components/base/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/base/dialog";
import { 
  Search, Plus, FileText, Copy, Trash2, Edit, Sparkles, Send, Eye, Tag, 
  Calendar, Clock, Check, X, Info, Star, Image as ImageIcon, Video, File, 
  Upload, Paperclip, LayoutGrid, List, Bookmark, ArrowRight, Zap, RefreshCw, Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { Template, TemplateCategory, WhatsAppChat } from "../types";
import { PRE_DESIGNED_TEMPLATES } from "../data/predesignedTemplates";
import { format } from "date-fns";

const ALL_CATEGORIES: TemplateCategory[] = [
  'Business', 'Marketing', 'Sales', 'Customer Support', 'Announcements',
  'Events', 'Birthday', 'Invitations', 'Reminders', 'Education', 'News',
  'Social Media', 'Personal', 'Motivational', 'Greetings', 'Promotions',
  'Follow-ups', 'Tech', 'Other'
];

const QUICK_VARIABLES = [
  "{{name}}", "{{business_name}}", "{{price}}", "{{link}}", 
  "{{date}}", "{{time}}", "{{location}}", "{{discount_code}}"
];

const TONE_OPTIONS = [
  "Professional", "Friendly", "Urgent / Promotional", "Persuasive", 
  "Warm & Welcoming", "Formal", "Casual & Fun"
];

const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "German", "Indonesian", "Hindi", "Portuguese", "Arabic"
];

export default function Templates() {
  const navigate = useNavigate();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"my" | "predesigned">("my");
  
  // Data states
  const [myTemplates, setMyTemplates] = useState<Template[]>([]);
  const [predesignedTemplates, setPredesignedTemplates] = useState<Template[]>(PRE_DESIGNED_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<"all" | "with_media" | "text_only">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [selectedTemplateForUse, setSelectedTemplateForUse] = useState<Template | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Create/Edit Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<TemplateCategory>("Marketing");
  const [formContent, setFormContent] = useState("");
  const [formMediaUrl, setFormMediaUrl] = useState("");
  const [formMediaType, setFormMediaType] = useState<'image' | 'video' | 'document' | 'audio'>("image");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI Generator Form State
  const [aiPurpose, setAiPurpose] = useState("");
  const [aiCategory, setAiCategory] = useState<TemplateCategory>("Marketing");
  const [aiTargetAudience, setAiTargetAudience] = useState("General Customers");
  const [aiTone, setAiTone] = useState("Professional");
  const [aiLanguage, setAiLanguage] = useState("English");
  const [aiInstructions, setAiInstructions] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedTemplate, setAiGeneratedTemplate] = useState<{
    name: string; category: TemplateCategory; description: string; content: string; variables: string[];
  } | null>(null);

  // Use & Send Form State
  const [varValues, setVarValues] = useState<{ [key: string]: string }>({});
  const [recipientJid, setRecipientJid] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [sendMediaUrl, setSendMediaUrl] = useState("");
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  useEffect(() => {
    fetchMyTemplates();
    fetchPredesigned();
    fetchChats();
  }, []);

  const fetchMyTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.templates) {
        setMyTemplates(data.templates);
      }
    } catch (err: any) {
      toast.error("Failed to load user templates");
    } finally {
      setLoading(false);
    }
  };

  const fetchPredesigned = async () => {
    try {
      const res = await fetch("/api/templates/predesigned");
      const data = await res.json();
      if (data.templates && data.templates.length > 0) {
        setPredesignedTemplates(data.templates);
      }
    } catch (err) {
      // fallback already set to PRE_DESIGNED_TEMPLATES
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/whatsapp/chats");
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch (e) {
      // optional
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches));
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormDescription("");
    setFormCategory("Marketing");
    setFormContent("");
    setFormMediaUrl("");
    setFormMediaType("image");
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (tpl: Template) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormDescription(tpl.description || "");
    setFormCategory(tpl.category || "Marketing");
    setFormContent(tpl.content);
    setFormMediaUrl(tpl.mediaUrl || "");
    setFormMediaType(tpl.mediaType || "image");
    setIsCreateOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large. Please select a file under 15MB.");
      return;
    }

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
          setFormMediaUrl(data.url);
          if (data.mediaType) setFormMediaType(data.mediaType);
          toast.success("Media uploaded successfully!");
        } else {
          toast.error("Failed to upload media: " + (data.error || "Unknown error"));
        }
      } catch (err: any) {
        toast.error("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!formContent.trim()) {
      toast.error("Please enter message content");
      return;
    }

    setIsSaving(true);
    const variables = extractVariables(formContent);

    try {
      if (editingTemplate) {
        const res = await fetch(`/api/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            category: formCategory,
            content: formContent,
            variables,
            mediaUrl: formMediaUrl,
            mediaType: formMediaType
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Template updated successfully");
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            category: formCategory,
            content: formContent,
            variables,
            mediaUrl: formMediaUrl,
            mediaType: formMediaType
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Template saved to My Templates!");
      }

      setIsCreateOpen(false);
      fetchMyTemplates();
    } catch (err: any) {
      toast.error("Failed to save template: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async (tpl: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/templates/${tpl.id}/favorite`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMyTemplates((prev) =>
          prev.map((t) => (t.id === tpl.id ? { ...t, isFavorite: data.isFavorite } : t))
        );
        toast.success(data.isFavorite ? "Added to Favorites" : "Removed from Favorites");
      }
    } catch (err: any) {
      toast.error("Failed to update favorite status");
    }
  };

  const handleDuplicate = async (tpl: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${tpl.name} (Copy)`,
          description: tpl.description,
          category: tpl.category,
          content: tpl.content,
          variables: tpl.variables,
          mediaUrl: tpl.mediaUrl,
          mediaType: tpl.mediaType
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Template duplicated successfully!");
      fetchMyTemplates();
    } catch (err: any) {
      toast.error("Failed to duplicate template: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Template deleted successfully");
      setDeletingTemplateId(null);
      fetchMyTemplates();
    } catch (err: any) {
      toast.error("Failed to delete template: " + err.message);
    }
  };

  const handleSavePredesignedToMy = async (predesigned: Template, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: predesigned.name,
          description: predesigned.description,
          category: predesigned.category,
          content: predesigned.content,
          variables: predesigned.variables,
          mediaUrl: predesigned.mediaUrl,
          mediaType: predesigned.mediaType
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Saved "${predesigned.name}" to My Templates!`);
      fetchMyTemplates();
      setActiveTab("my");
    } catch (err: any) {
      toast.error("Failed to save template: " + err.message);
    }
  };

  const handleOpenUseModal = (tpl: Template) => {
    setSelectedTemplateForUse(tpl);
    setSendMediaUrl(tpl.mediaUrl || "");
    const vars = extractVariables(tpl.content);
    const initialVars: { [key: string]: string } = {};
    vars.forEach((v) => {
      initialVars[v] = "";
    });
    setVarValues(initialVars);
    setRecipientJid("");
    setCustomPhone("");
    setIsUseModalOpen(true);
  };

  const getInterpolatedMessage = () => {
    if (!selectedTemplateForUse) return "";
    let msg = selectedTemplateForUse.content;
    Object.entries(varValues).forEach(([key, val]) => {
      if (typeof val === "string" && val.trim()) {
        msg = msg.replaceAll(key, val);
      }
    });
    return msg;
  };

  const handleSendDirectNow = async () => {
    const finalJid = recipientJid || (customPhone ? `${customPhone.replace(/[^0-9]/g, "")}@s.whatsapp.net` : "");
    if (!finalJid) {
      toast.error("Please select a WhatsApp contact/group or enter a phone number");
      return;
    }

    const message = getInterpolatedMessage();
    if (!message.trim()) {
      toast.error("Message content cannot be empty");
      return;
    }

    setIsSendingDirect(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jid: finalJid,
          text: message,
          mediaUrl: sendMediaUrl,
          mediaType: selectedTemplateForUse?.mediaType
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Update template usage count
      if (selectedTemplateForUse?.id) {
        fetch(`/api/templates/${selectedTemplateForUse.id}/use`, { method: "POST" });
      }

      toast.success("WhatsApp message sent successfully!");
      setIsUseModalOpen(false);
      fetchMyTemplates();
    } catch (err: any) {
      toast.error("Failed to send message: " + err.message);
    } finally {
      setIsSendingDirect(false);
    }
  };

  const handleScheduleFromTemplate = () => {
    const message = getInterpolatedMessage();
    navigate("/scheduled", {
      state: {
        prefilledMessage: message,
        prefilledMediaUrl: sendMediaUrl,
        prefilledMediaType: selectedTemplateForUse?.mediaType,
        templateId: selectedTemplateForUse?.id,
        templateName: selectedTemplateForUse?.name,
        recipientJid: recipientJid || (customPhone ? `${customPhone.replace(/[^0-9]/g, "")}@s.whatsapp.net` : "")
      }
    });
  };

  const handleGenerateAiTemplate = async () => {
    if (!aiPurpose.trim()) {
      toast.error("Please describe the purpose or goal of the message");
      return;
    }

    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: aiPurpose,
          category: aiCategory,
          targetAudience: aiTargetAudience,
          tone: aiTone,
          language: aiLanguage,
          additionalInstructions: aiInstructions
        })
      });
      const data = await res.json();
      if (data.template) {
        setAiGeneratedTemplate(data.template);
        toast.success("AI template generated successfully!");
      } else {
        toast.error("Failed to generate template");
      }
    } catch (err: any) {
      toast.error("AI Generation error: " + err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveAiGeneratedToMy = async () => {
    if (!aiGeneratedTemplate) return;
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiGeneratedTemplate.name,
          description: aiGeneratedTemplate.description,
          category: aiGeneratedTemplate.category,
          content: aiGeneratedTemplate.content,
          variables: aiGeneratedTemplate.variables,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Saved AI template to My Templates!");
      setIsAiOpen(false);
      setAiGeneratedTemplate(null);
      fetchMyTemplates();
      setActiveTab("my");
    } catch (err: any) {
      toast.error("Failed to save AI template: " + err.message);
    }
  };

  // Filter templates list
  const activeList = activeTab === "my" ? myTemplates : predesignedTemplates;

  const filteredTemplates = activeList.filter((tpl) => {
    const matchesSearch = 
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.description && tpl.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "All" || tpl.category === selectedCategory;
    const matchesFavorite = !favoritesOnly || tpl.isFavorite;
    
    let matchesMedia = true;
    if (mediaFilter === "with_media") matchesMedia = Boolean(tpl.mediaUrl);
    if (mediaFilter === "text_only") matchesMedia = !tpl.mediaUrl;

    return matchesSearch && matchesCategory && matchesFavorite && matchesMedia;
  });

  const renderContentWithVariableHighlights = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, index) => {
      if (part.match(/^\{\{[^}]+\}\}$/)) {
        return (
          <span 
            key={index} 
            className="inline-flex items-center px-2 py-0.5 my-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 md:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-medium backdrop-blur-md">
            <Bookmark className="w-3.5 h-3.5" /> Professional Template Library
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">WhatsApp Templates</h1>
          <p className="text-emerald-100 text-sm max-w-xl">
            Design, save, and reuse automated WhatsApp messages with variable placeholders and rich media attachments.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => setIsAiOpen(true)} 
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md shadow-sm font-medium"
          >
            <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
            Generate with AI
          </Button>

          <Button 
            onClick={handleOpenCreate} 
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Primary Category Tabs: My Templates vs Pre-designed Templates */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("my")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "my"
                ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            My Templates
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "my" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600"}`}>
              {myTemplates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("predesigned")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "predesigned"
                ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Pre-designed Templates
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "predesigned" ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600"}`}>
              {predesignedTemplates.length}
            </span>
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-9 px-3"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-9 px-3"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search templates by title, content, or description..." 
              className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-56">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="All">All Categories</SelectItem>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Media Filter */}
          <div className="w-full md:w-44">
            <Select value={mediaFilter} onValueChange={(val: any) => setMediaFilter(val)}>
              <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Media Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Media Types</SelectItem>
                <SelectItem value="with_media">With Media Only</SelectItem>
                <SelectItem value="text_only">Text Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Favorites Filter Toggle */}
          {activeTab === "my" && (
            <Button
              variant={favoritesOnly ? "default" : "outline"}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`w-full md:w-auto h-10 ${favoritesOnly ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-white dark:bg-slate-950"}`}
            >
              <Star className={`w-4 h-4 mr-2 ${favoritesOnly ? "fill-white" : "text-amber-500"}`} />
              Favorites
            </Button>
          )}
        </div>
      </div>

      {/* Templates List Rendering */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
          <p className="text-sm text-slate-500">Loading template library...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Templates Found</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
                {searchQuery || selectedCategory !== "All"
                  ? "No templates match your search filters. Try adjusting your search query or categories."
                  : activeTab === "my"
                  ? "You haven't saved any templates yet. Click 'Create Template' or browse 'Pre-designed Templates'."
                  : "No pre-designed templates available."}
              </p>
            </div>
            {activeTab === "my" && (
              <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Create First Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" : "space-y-4"}>
          {filteredTemplates.map((tpl) => (
            <Card 
              key={tpl.id} 
              className="hover:shadow-md transition-all border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden group"
            >
              <div>
                <CardHeader className="pb-3 space-y-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {tpl.category}
                        </span>
                        {tpl.mediaUrl && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> Media
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold mt-1.5 text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {tpl.name}
                      </CardTitle>
                    </div>

                    {activeTab === "my" && (
                      <button
                        onClick={(e) => handleToggleFavorite(tpl, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={tpl.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star className={`w-4 h-4 ${tpl.isFavorite ? "fill-amber-400 text-amber-500" : ""}`} />
                      </button>
                    )}
                  </div>

                  {tpl.description && (
                    <CardDescription className="text-xs line-clamp-1">
                      {tpl.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-4 space-y-3">
                  {/* Media Thumbnail Preview if present */}
                  {tpl.mediaUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 h-32 bg-slate-900">
                      <img 
                        src={tpl.mediaUrl} 
                        alt={tpl.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Template Content Text */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-normal leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {renderContentWithVariableHighlights(tpl.content)}
                  </div>

                  {/* Extracted Variables chips */}
                  {tpl.variables && tpl.variables.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vars:</span>
                      {tpl.variables.map((v) => (
                        <span key={v} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/30 dark:bg-slate-900/20">
                <Button 
                  onClick={() => handleOpenUseModal(tpl)}
                  size="sm" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Use Template
                </Button>

                {activeTab === "my" ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDuplicate(tpl, e)}
                      title="Duplicate"
                      className="px-2 h-8"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(tpl)}
                      title="Edit"
                      className="px-2 h-8"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingTemplateId(tpl.id)}
                      title="Delete"
                      className="px-2 h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleSavePredesignedToMy(tpl, e)}
                      className="h-8 text-xs font-medium"
                      title="Save copy to My Templates"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create New WhatsApp Template"}</DialogTitle>
            <DialogDescription>
              Define your standardized WhatsApp message with dynamic variables (e.g. &#123;&#123;name&#125;&#125;) and media attachments.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4">
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name" className="text-xs font-semibold">Template Name *</Label>
                <Input 
                  id="tpl-name"
                  placeholder="e.g. Welcome Message, Order Confirmation" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cat" className="text-xs font-semibold">Category</Label>
                  <Select value={formCategory} onValueChange={(val: TemplateCategory) => setFormCategory(val)}>
                    <SelectTrigger id="tpl-cat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {ALL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-media-type" className="text-xs font-semibold">Media Type</Label>
                  <Select value={formMediaType} onValueChange={(val: any) => setFormMediaType(val)}>
                    <SelectTrigger id="tpl-media-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tpl-desc" className="text-xs font-semibold">Short Description (Optional)</Label>
                <Input 
                  id="tpl-desc"
                  placeholder="e.g. Sent automatically after registration" 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Message Content & Quick Insert Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-content" className="text-xs font-semibold">Message Content *</Label>
                  <span className="text-[11px] text-slate-400">Use &#123;&#123;var&#125;&#125; for placeholders</span>
                </div>

                <Textarea 
                  id="tpl-content"
                  rows={6}
                  placeholder="Write your WhatsApp message here... e.g. Hello {{name}}, welcome to {{business_name}}!"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="font-sans text-sm"
                />

                {/* Quick Variable Insert Chips */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Quick Insert Variable:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QUICK_VARIABLES.map((varName) => (
                      <button
                        key={varName}
                        type="button"
                        onClick={() => setFormContent((prev) => prev + ` ${varName}`)}
                        className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-700 transition-colors border border-slate-200 dark:border-slate-700"
                      >
                        + {varName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Media Attachment Upload / URL */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Label className="text-xs font-semibold">Media Attachment (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="Enter Media URL (https://...)" 
                    value={formMediaUrl}
                    onChange={(e) => setFormMediaUrl(e.target.value)}
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
              </div>
            </div>

            {/* Right Column: Live WhatsApp Mobile Preview */}
            <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-4 text-white flex flex-col justify-between border border-slate-800 shadow-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">WhatsApp Live Preview</span>
                  </div>
                  <span className="text-[10px] text-slate-400">12:00 PM</span>
                </div>

                {/* WhatsApp Chat Bubble Mockup */}
                <div className="bg-[#0b141a] p-3 rounded-xl min-h-[220px] space-y-2 border border-slate-800">
                  <div className="bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none space-y-2 shadow-md max-w-[95%] ml-auto text-xs">
                    {/* Media Header Preview */}
                    {formMediaUrl && (
                      <div className="rounded-lg overflow-hidden max-h-40 bg-black/40">
                        {formMediaType === "video" ? (
                          <video src={formMediaUrl} controls className="w-full h-full object-cover" />
                        ) : (
                          <img src={formMediaUrl} alt="Preview" className="w-full h-full object-cover" />
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed font-sans">
                      {formContent ? renderContentWithVariableHighlights(formContent) : (
                        <span className="italic text-emerald-200">Your message preview will appear here...</span>
                      )}
                    </p>

                    <div className="text-[9px] text-emerald-200 text-right font-mono">
                      12:00 PM ✓✓
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center pt-3 border-t border-slate-800">
                Variables like <span className="text-emerald-400 font-mono">&#123;&#123;name&#125;&#125;</span> will be dynamically replaced when sending messages.
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {editingTemplate ? "Update Template" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI TEMPLATE GENERATOR MODAL */}
      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              AI WhatsApp Template Generator
            </DialogTitle>
            <DialogDescription>
              Describe your objective and let Gemini AI compose a high-converting WhatsApp message template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Goal / Purpose of the Message *</Label>
              <Input 
                placeholder="e.g. Announce a weekend flash sale with 20% discount on cybersecurity courses" 
                value={aiPurpose}
                onChange={(e) => setAiPurpose(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={aiCategory} onValueChange={(val: TemplateCategory) => setAiCategory(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ALL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tone</Label>
                <Select value={aiTone} onValueChange={setAiTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <Input 
                  placeholder="e.g. Premium Subscribers, VIP Leads" 
                  value={aiTargetAudience}
                  onChange={(e) => setAiTargetAudience(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Language</Label>
                <Select value={aiLanguage} onValueChange={setAiLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Additional Requirements (Optional)</Label>
              <Textarea 
                placeholder="e.g. Include a call to action link placeholder {{link}} and expiration time" 
                rows={2}
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleGenerateAiTemplate} 
              disabled={isGeneratingAi}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Composing Template with Gemini AI...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" /> Generate Template
                </>
              )}
            </Button>

            {/* Generated Output Card */}
            {aiGeneratedTemplate && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    {aiGeneratedTemplate.name}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-medium">
                    {aiGeneratedTemplate.category}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg text-xs font-sans whitespace-pre-wrap leading-relaxed border border-emerald-100 dark:border-emerald-900 text-slate-900 dark:text-slate-100">
                  {renderContentWithVariableHighlights(aiGeneratedTemplate.content)}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button 
                    onClick={handleSaveAiGeneratedToMy}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Save to My Templates
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* USE & SEND TEMPLATE MODAL */}
      <Dialog open={isUseModalOpen} onOpenChange={setIsUseModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Use Template: {selectedTemplateForUse?.name}</DialogTitle>
            <DialogDescription>
              Fill variable values, select a recipient contact or group, and send or schedule this message.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplateForUse && (
            <div className="space-y-4 my-3">
              {/* Variable Fill Inputs */}
              {selectedTemplateForUse.variables && selectedTemplateForUse.variables.length > 0 && (
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Fill Template Variables:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTemplateForUse.variables.map((v) => (
                      <div key={v} className="space-y-1">
                        <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                          {v}
                        </Label>
                        <Input 
                          placeholder={`Enter value for ${v}`} 
                          value={varValues[v] || ""}
                          onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipient Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Recipient Group or Contact</Label>
                <Select value={recipientJid} onValueChange={setRecipientJid}>
                  <SelectTrigger><SelectValue placeholder="Choose WhatsApp Group or Contact..." /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {chats.map((chat) => (
                      <SelectItem key={chat.id} value={chat.id}>
                        {chat.isGroup ? "👥 " : "👤 "} {chat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-center text-xs text-slate-400 my-1">— OR Enter Phone Number —</div>

                <Input 
                  placeholder="e.g. +1234567890" 
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                />
              </div>

              {/* Live Interpolated Message Preview */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Final Message Preview</Label>
                <div className="p-3 bg-[#0b141a] text-emerald-100 rounded-xl text-xs font-sans whitespace-pre-wrap border border-slate-800 leading-relaxed">
                  {getInterpolatedMessage()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Button 
                  onClick={handleSendDirectNow}
                  disabled={isSendingDirect}
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isSendingDirect ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Immediately
                </Button>

                <Button 
                  onClick={handleScheduleFromTemplate}
                  variant="outline"
                  className="w-full sm:flex-1 font-semibold"
                >
                  <Clock className="w-4 h-4 mr-2 text-emerald-600" />
                  Schedule Message
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={Boolean(deletingTemplateId)} onOpenChange={() => setDeletingTemplateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTemplateId(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingTemplateId && handleDelete(deletingTemplateId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
