import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as QRCode from "qrcode";
import pino from "pino";
import fs from "fs";
import { readJson, writeJson } from "./src/server/db";
import { PRE_DESIGNED_TEMPLATES } from "./src/data/predesignedTemplates";

// Basic global state for the WhatsApp socket
let sock: ReturnType<typeof makeWASocket> | null = null;
let qrCodeDataUrl: string | null = null;
let currentPairingCode: string | null = null;
let isConnected = false;
let reconnectAttempts = 0;

function deleteCreds() {
  if (fs.existsSync("wa_auth_state")) {
    try {
      fs.rmSync("wa_auth_state", { recursive: true, force: true });
    } catch (e) {
      console.error("Error deleting creds directory:", e);
    }
  }
}

async function connectToWhatsApp(phoneNumber?: string) {
  if (sock) {
    try {
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("creds.update");
      sock.end(undefined);
    } catch (e) {
      console.error("Error ending previous socket:", e);
    }
    sock = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState("wa_auth_state");
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  try {
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS("Desktop"),
      logger: pino({ level: "silent" }) as any,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });
  } catch (err) {
    console.error("Error initializing WhatsApp socket:", err);
    deleteCreds();
    isConnected = false;
    qrCodeDataUrl = null;
    currentPairingCode = null;
    return;
  }

  sock.ev.on("creds.update", saveCreds);

  if (phoneNumber && !sock.authState.creds.me) {
    setTimeout(async () => {
      try {
        if (sock) {
          const code = await sock.requestPairingCode(phoneNumber);
          currentPairingCode = code;
          console.log(`Pairing code generated for ${phoneNumber}: ${code}`);
        }
      } catch (e) {
        console.error("Error requesting pairing code:", e);
      }
    }, 1500);
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !phoneNumber) {
      console.log("New QR Code received from Baileys");
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error("Error converting QR string to Data URL:", err);
      }
    }

    if (connection === "close") {
      isConnected = false;
      qrCodeDataUrl = null;
      currentPairingCode = null;

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.toString() || "";
      console.log(`WhatsApp connection closed. Status code: ${statusCode}, Error: ${errorMsg}`);

      const isUnauthenticated = !sock?.authState?.creds?.me;
      let shouldReconnect = true;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Logged out from WhatsApp. Wiping auth state.");
        shouldReconnect = false;
        deleteCreds();
      } else if (statusCode === DisconnectReason.badSession) {
        console.log("Bad session state. Wiping auth state.");
        shouldReconnect = false;
        deleteCreds();
      } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515 || errorMsg.includes("restart required") || errorMsg.includes("Stream Errored")) {
        console.log("WhatsApp stream restart required (515). Reconnecting immediately...");
        reconnectAttempts = 0;
        setTimeout(() => connectToWhatsApp(phoneNumber), 1000);
        return;
      } else if (statusCode === 405) {
        console.log("Connection failure (405).");
        if (isUnauthenticated) {
          console.log("Unauthenticated 405 connection failure. Wiping auth state.");
          deleteCreds();
          shouldReconnect = false;
        }
      } else if (errorMsg.includes("QR refs attempts ended") || statusCode === 408 || statusCode === DisconnectReason.timedOut) {
        console.log("QR code scanning timed out (408 / QR refs ended). Session reset.");
        deleteCreds();
        shouldReconnect = false;
      }

      if (shouldReconnect) {
        reconnectAttempts++;
        if (reconnectAttempts > 3) {
          console.log("Max reconnect attempts (3) reached. Stopping auto-reconnect.");
          shouldReconnect = false;
          reconnectAttempts = 0;
          if (isUnauthenticated) deleteCreds();
        } else {
          console.log(`Reconnecting to WhatsApp in 3s (attempt ${reconnectAttempts}/3)...`);
          setTimeout(() => connectToWhatsApp(phoneNumber), 3000);
        }
      } else {
        reconnectAttempts = 0;
      }
    } else if (connection === "open") {
      console.log("Opened connection to WhatsApp successfully!");
      isConnected = true;
      reconnectAttempts = 0;
      qrCodeDataUrl = null;
      currentPairingCode = null;
    }
  });
}

// Background Scheduler Helper functions
function calculateNextRunDate(currentDateStr: string, repeatType: string, repeatDays?: string[]): string {
  const current = new Date(currentDateStr);
  if (isNaN(current.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString();
  }

  const next = new Date(current.getTime());

  if (repeatType === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (repeatType === "weekly") {
    if (repeatDays && repeatDays.length > 0) {
      const dayMap: Record<string, number> = {
        "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6
      };
      const targetDayIndexes = repeatDays.map(d => dayMap[d]).filter(d => d !== undefined).sort((a, b) => a - b);
      if (targetDayIndexes.length > 0) {
        let addedDays = 1;
        while (addedDays <= 14) {
          const checkDate = new Date(current.getTime());
          checkDate.setDate(checkDate.getDate() + addedDays);
          if (targetDayIndexes.includes(checkDate.getDay())) {
            return checkDate.toISOString();
          }
          addedDays++;
        }
      }
    }
    next.setDate(next.getDate() + 7);
  } else if (repeatType === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (repeatType === "custom") {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

async function sendBaileysMessage(
  jid: string, 
  text: string, 
  mediaUrl?: string, 
  mediaType?: string
) {
  if (!sock) throw new Error("WhatsApp socket not connected.");
  let formattedJid = jid;
  if (!formattedJid.includes("@")) {
    const cleanNumber = formattedJid.replace(/[^0-9]/g, "");
    formattedJid = `${cleanNumber}@s.whatsapp.net`;
  }

  if (mediaUrl && mediaUrl.trim()) {
    let targetUrl = mediaUrl.trim();
    if (targetUrl.startsWith("/uploads/")) {
      targetUrl = path.join(process.cwd(), targetUrl);
    }

    const isImg = mediaType === "image" || targetUrl.match(/\.(jpeg|jpg|png|gif|webp)($|\?)/i) || targetUrl.startsWith("data:image/");
    const isVid = mediaType === "video" || targetUrl.match(/\.(mp4|mov|avi)($|\?)/i) || targetUrl.startsWith("data:video/");
    const isAud = mediaType === "audio" || targetUrl.match(/\.(mp3|wav|ogg)($|\?)/i) || targetUrl.startsWith("data:audio/");

    if (isImg) {
      return await sock.sendMessage(formattedJid, { image: { url: targetUrl }, caption: text || "" });
    } else if (isVid) {
      return await sock.sendMessage(formattedJid, { video: { url: targetUrl }, caption: text || "" });
    } else if (isAud) {
      return await sock.sendMessage(formattedJid, { audio: { url: targetUrl }, mimetype: "audio/mp4", ptt: true });
    } else {
      return await sock.sendMessage(formattedJid, { document: { url: targetUrl }, mimetype: "application/pdf", fileName: "attachment", caption: text || "" });
    }
  } else {
    return await sock.sendMessage(formattedJid, { text: text || "" });
  }
}

async function runSchedulerCheck() {
  try {
    const schedules = readJson<any[]>("schedules.json", []);
    const history = readJson<any[]>("history.json", []);
    const now = new Date();
    let updated = false;

    for (const schedule of schedules) {
      if (schedule.status === "scheduled") {
        const schedTime = new Date(schedule.scheduledAt);
        if (!isNaN(schedTime.getTime()) && schedTime <= now) {
          schedule.status = "sending";
          updated = true;

          const recipientJid = schedule.recipientJid || schedule.phoneNumber;
          if (!recipientJid) {
            schedule.status = "failed";
            schedule.errorMessage = "Missing recipient JID or phone number.";
            history.unshift({
              id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
              userId: schedule.userId || "default",
              message: schedule.message,
              mediaUrl: schedule.mediaUrl,
              mediaType: schedule.mediaType,
              recipientJid: "Unknown",
              recipientName: schedule.recipientName || "Unknown",
              templateName: schedule.templateName,
              sentAt: new Date().toISOString(),
              status: "failed",
              errorMessage: schedule.errorMessage,
              scheduleId: schedule.id
            });
            continue;
          }

          if (!isConnected || !sock) {
            schedule.status = "failed";
            schedule.errorMessage = "WhatsApp is disconnected. Please reconnect WhatsApp before sending.";
            history.unshift({
              id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
              userId: schedule.userId || "default",
              message: schedule.message,
              mediaUrl: schedule.mediaUrl,
              mediaType: schedule.mediaType,
              recipientJid: recipientJid,
              recipientName: schedule.recipientName || recipientJid,
              templateName: schedule.templateName,
              sentAt: new Date().toISOString(),
              status: "failed",
              errorMessage: schedule.errorMessage,
              scheduleId: schedule.id
            });
            continue;
          }

          try {
            await sendBaileysMessage(recipientJid, schedule.message, schedule.mediaUrl, schedule.mediaType);

            schedule.sentAt = new Date().toISOString();
            schedule.errorMessage = undefined;

            history.unshift({
              id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
              userId: schedule.userId || "default",
              message: schedule.message,
              mediaUrl: schedule.mediaUrl,
              mediaType: schedule.mediaType,
              recipientJid: recipientJid,
              recipientName: schedule.recipientName || recipientJid,
              templateName: schedule.templateName,
              sentAt: schedule.sentAt,
              status: "sent",
              scheduleId: schedule.id
            });

            if (schedule.repeatType && schedule.repeatType !== "none") {
              const nextDateStr = calculateNextRunDate(schedule.scheduledAt, schedule.repeatType, schedule.repeatDays);
              const nextDate = new Date(nextDateStr);

              if (schedule.endDate && new Date(schedule.endDate) < nextDate) {
                schedule.status = "completed";
              } else {
                schedule.scheduledAt = nextDateStr;
                schedule.status = "scheduled";
              }
            } else {
              schedule.status = "sent";
            }
          } catch (err: any) {
            console.error("Scheduler failed to send message:", err);
            schedule.status = "failed";
            schedule.errorMessage = err.message || "Failed to send message via WhatsApp";
            history.unshift({
              id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
              userId: schedule.userId || "default",
              message: schedule.message,
              recipientJid: recipientJid,
              recipientName: schedule.recipientName || recipientJid,
              templateName: schedule.templateName,
              sentAt: new Date().toISOString(),
              status: "failed",
              errorMessage: schedule.errorMessage,
              scheduleId: schedule.id
            });
          }
        }
      }
    }

    if (updated) {
      writeJson("schedules.json", schedules);
      writeJson("history.json", history.slice(0, 500));
    }
  } catch (e) {
    console.error("Scheduler check error:", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // Connect WhatsApp automatically if creds exist
  connectToWhatsApp();

  // Start background scheduler timer (runs every 10s)
  setInterval(runSchedulerCheck, 10000);

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/upload", (req, res) => {
    try {
      const { fileData, fileName, mimeType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "No file data provided." });
      }

      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = "png";

      if (matches && matches.length === 3) {
        ext = matches[1].split("/")[1] || "png";
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(fileData, "base64");
      }

      const safeName = (fileName || `upload_${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, "_");
      const targetPath = path.join(uploadsDir, safeName);
      fs.writeFileSync(targetPath, buffer);

      let mediaType: 'image' | 'video' | 'document' | 'audio' = 'image';
      if (mimeType?.startsWith('video/') || ext.match(/(mp4|mov|avi)/i)) mediaType = 'video';
      else if (mimeType?.startsWith('audio/') || ext.match(/(mp3|wav|ogg)/i)) mediaType = 'audio';
      else if (!mimeType?.startsWith('image/') && !ext.match(/(png|jpg|jpeg|gif|webp)/i)) mediaType = 'document';

      res.json({ success: true, url: `/uploads/${safeName}`, mediaType });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/whatsapp/status", (req, res) => {
    res.json({ isConnected, qrCode: qrCodeDataUrl, pairingCode: currentPairingCode });
  });

  app.post("/api/whatsapp/connect", (req, res) => {
    const { phoneNumber } = req.body || {};
    
    reconnectAttempts = 0;

    if (phoneNumber) {
      if (sock && !isConnected) {
        try {
          sock.ev.removeAllListeners("connection.update");
          sock.ev.removeAllListeners("creds.update");
          sock.end(undefined);
        } catch (e) {}
      }
      sock = null;
      isConnected = false;
      qrCodeDataUrl = null;
      currentPairingCode = null;
      deleteCreds();
      connectToWhatsApp(phoneNumber);
      return res.json({ message: "Connecting via phone number..." });
    }

    if (!isConnected) {
      if (sock) {
        try {
          sock.ev.removeAllListeners("connection.update");
          sock.ev.removeAllListeners("creds.update");
          sock.end(undefined);
        } catch (e) {}
      }
      sock = null;
      qrCodeDataUrl = null;
      currentPairingCode = null;
      deleteCreds();
      connectToWhatsApp();
    }
    res.json({ message: "Connecting via QR..." });
  });

  app.post("/api/whatsapp/logout", async (req, res) => {
    if (sock) {
      await sock.logout();
      sock = null;
      isConnected = false;
      qrCodeDataUrl = null;
      currentPairingCode = null;
    }
    deleteCreds();
    res.json({ message: "Logged out" });
  });

  app.get("/api/whatsapp/chats", async (req, res) => {
    if (!isConnected || !sock) {
      return res.status(401).json({ error: "Not connected to WhatsApp" });
    }
    try {
      const groups = await sock.groupFetchAllParticipating();
      const chats = Object.values(groups).map((g) => ({
        id: g.id,
        name: g.subject,
        isGroup: true,
      }));
      res.json({ chats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    const { jid, text, mediaUrl, mediaType } = req.body;
    if (!isConnected || !sock) {
      return res.status(401).json({ error: "WhatsApp is disconnected. Please reconnect WhatsApp before sending." });
    }
    try {
      await sendBaileysMessage(jid, text, mediaUrl, mediaType);
      
      // Save to history log
      const history = readJson<any[]>("history.json", []);
      history.unshift({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        userId: "default",
        message: text,
        mediaUrl: mediaUrl || "",
        mediaType: mediaType || undefined,
        recipientJid: jid,
        recipientName: jid,
        sentAt: new Date().toISOString(),
        status: "sent"
      });
      writeJson("history.json", history.slice(0, 500));

      res.json({ success: true });
    } catch (error: any) {
      const history = readJson<any[]>("history.json", []);
      history.unshift({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        userId: "default",
        message: text,
        mediaUrl: mediaUrl || "",
        mediaType: mediaType || undefined,
        recipientJid: jid,
        recipientName: jid,
        sentAt: new Date().toISOString(),
        status: "failed",
        errorMessage: error.message
      });
      writeJson("history.json", history.slice(0, 500));

      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate", async (req, res) => {
    const { topic, tone, length, keywords, purpose, targetAudience, language, additionalInstructions, imageData } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const promptText = `You are an expert WhatsApp message copywriter.
Generate a WhatsApp message based on these parameters:
- Topic / Goal: ${topic || purpose || "General message"}
- Target Audience: ${targetAudience || "General"}
- Tone: ${tone || "Professional"}
- Language: ${language || "English"}
- Length: ${length || "medium"}
- Key Words / Features: ${keywords || "None"}
- Additional Instructions: ${additionalInstructions || "None"}

Requirements:
1. Include appropriate emojis and clean spacing.
2. If reusable placeholders fit (like {{name}}, {{price}}, {{link}}, {{date}}), use standard double brace notation.
3. Return raw JSON ONLY in this format:
{
  "name": "Suggested Title",
  "category": "Marketing",
  "content": "The generated message text...",
  "description": "Short explanation",
  "variables": ["{{name}}", "{{link}}"]
}`;

      let contents: any = promptText;
      if (imageData) {
        let base64Data = "";
        let mime = "image/png";
        if (imageData.startsWith("/uploads/")) {
          const filePath = path.join(process.cwd(), imageData);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
            else if (ext === ".webp") mime = "image/webp";
            base64Data = fs.readFileSync(filePath).toString("base64");
          } else {
            throw new Error("Attached media file not found on server.");
          }
        } else {
          base64Data = imageData.replace(/^data:image\/\\w+;base64,/, "");
        }
        contents = [
          promptText,
          {
            inlineData: {
              mimeType: mime,
              data: base64Data
            }
          }
        ];
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
      });

      const textRes = response.text || "";
      try {
        const jsonMatch = textRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.json({
            message: parsed.content,
            name: parsed.name,
            category: parsed.category,
            variables: parsed.variables || [],
            description: parsed.description
          });
        }
      } catch (e) {}

      res.json({ message: textRes.trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/generate-template", async (req, res) => {
    const { purpose, category, targetAudience, tone, language, additionalInstructions } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Create a professional reusable WhatsApp Message Template.
Purpose: ${purpose}
Category: ${category || "Marketing"}
Target Audience: ${targetAudience || "General"}
Tone: ${tone || "Professional"}
Language: ${language || "English"}
Additional Details: ${additionalInstructions || "None"}

Respond strictly with valid JSON only:
{
  "name": "Short Template Name",
  "category": "Marketing",
  "description": "Short description",
  "content": "The template message text using {{variables}}...",
  "variables": ["{{name}}", "{{link}}"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const textRes = response.text || "";
      const jsonMatch = textRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({ success: true, template: parsed });
      }

      res.json({
        success: true,
        template: {
          name: purpose || "AI Template",
          category: category || "Marketing",
          description: "Generated by AI",
          content: textRes,
          variables: ["{{name}}"]
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/parse-schedule", async (req, res) => {
    const { prompt, chats } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const availableChats = Array.isArray(chats) ? chats.map((c: any) => ({ jid: c.id, name: c.name })) : [];
      
      const systemPrompt = `Extract WhatsApp scheduling information and generate the message text from the user instruction.
User Instruction: "${prompt}"

Available Contacts/Groups:
${JSON.stringify(availableChats, null, 2)}

Current server time: ${new Date().toISOString()} (User Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}).

Respond strictly in valid JSON format:
{
  "message": "Generated WhatsApp message content with formatting and emojis",
  "recipientName": "Target recipient or group name",
  "recipientJid": "Matched JID if available from list, or empty string",
  "repeatType": "none | daily | weekly | monthly | custom",
  "repeatDays": ["Monday"],
  "scheduledDate": "YYYY-MM-DD",
  "scheduledTime": "HH:MM",
  "timezone": "${Intl.DateTimeFormat().resolvedOptions().timeZone}"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
      });

      const textRes = response.text || "";
      const jsonMatch = textRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({ success: true, parsed });
      }

      res.status(500).json({ error: "Could not parse schedule instruction." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TEMPLATE ENDPOINTS ---
  app.get("/api/templates/predesigned", (req, res) => {
    res.json({ templates: PRE_DESIGNED_TEMPLATES });
  });

  app.get("/api/templates", (req, res) => {
    const templates = readJson<any[]>("templates.json", []);
    res.json({ templates });
  });

  app.post("/api/templates/:id/favorite", (req, res) => {
    const { id } = req.params;
    const templates = readJson<any[]>("templates.json", []);
    const index = templates.findIndex(t => t.id === id);
    if (index !== -1) {
      templates[index].isFavorite = !templates[index].isFavorite;
      writeJson("templates.json", templates);
      return res.json({ success: true, isFavorite: templates[index].isFavorite });
    }
    res.status(404).json({ error: "Template not found" });
  });

  app.post("/api/templates", (req, res) => {
    const { name, description, category, content, variables, mediaUrl, buttons, userId } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: "Template Name and Content are required." });
    }

    const templates = readJson<any[]>("templates.json", []);
    const newTemplate = {
      id: "tpl_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      userId: userId || "default",
      name,
      description: description || "",
      category: category || "Other",
      content,
      variables: variables || [],
      mediaUrl: mediaUrl || "",
      buttons: buttons || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    templates.unshift(newTemplate);
    writeJson("templates.json", templates);
    res.json({ success: true, template: newTemplate });
  });

  app.put("/api/templates/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, category, content, variables, mediaUrl, buttons } = req.body;
    
    const templates = readJson<any[]>("templates.json", []);
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Template not found" });
    }

    templates[index] = {
      ...templates[index],
      name: name ?? templates[index].name,
      description: description ?? templates[index].description,
      category: category ?? templates[index].category,
      content: content ?? templates[index].content,
      variables: variables ?? templates[index].variables,
      mediaUrl: mediaUrl ?? templates[index].mediaUrl,
      buttons: buttons ?? templates[index].buttons,
      updatedAt: new Date().toISOString()
    };

    writeJson("templates.json", templates);
    res.json({ success: true, template: templates[index] });
  });

  app.delete("/api/templates/:id", (req, res) => {
    const { id } = req.params;
    let templates = readJson<any[]>("templates.json", []);
    templates = templates.filter(t => t.id !== id);
    writeJson("templates.json", templates);
    res.json({ success: true });
  });

  app.post("/api/templates/:id/use", (req, res) => {
    const { id } = req.params;
    const templates = readJson<any[]>("templates.json", []);
    const index = templates.findIndex(t => t.id === id);
    if (index !== -1) {
      templates[index].usageCount = (templates[index].usageCount || 0) + 1;
      templates[index].lastUsedAt = new Date().toISOString();
      writeJson("templates.json", templates);
    }
    res.json({ success: true });
  });

  // --- SCHEDULE ENDPOINTS ---
  app.get("/api/schedules", (req, res) => {
    const schedules = readJson<any[]>("schedules.json", []);
    res.json({ schedules });
  });

  app.post("/api/schedules", (req, res) => {
    const { 
      recipientJid, recipientName, phoneNumber, message, 
      mediaUrl, mediaType,
      templateId, templateName, scheduledAt, timezone, 
      repeatType, repeatDays, startDate, endDate, userId 
    } = req.body;

    if (!recipientJid && !phoneNumber) {
      return res.status(400).json({ error: "Please select a WhatsApp recipient or enter a phone number." });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }
    if (!scheduledAt) {
      return res.status(400).json({ error: "Schedule Date and Time are required." });
    }

    const schedTime = new Date(scheduledAt);
    if (isNaN(schedTime.getTime())) {
      return res.status(400).json({ error: "Invalid date format." });
    }

    if (schedTime <= new Date()) {
      return res.status(400).json({ error: "Scheduled time must be in the future." });
    }

    const schedules = readJson<any[]>("schedules.json", []);
    const newSchedule = {
      id: "sched_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      userId: userId || "default",
      recipientJid: recipientJid || phoneNumber,
      recipientName: recipientName || phoneNumber || "Contact",
      phoneNumber: phoneNumber || "",
      message,
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || undefined,
      templateId: templateId || "",
      templateName: templateName || "",
      scheduledAt,
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      repeatType: repeatType || "none",
      repeatDays: repeatDays || [],
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || "",
      status: "scheduled",
      createdAt: new Date().toISOString()
    };

    schedules.unshift(newSchedule);
    writeJson("schedules.json", schedules);
    res.json({ success: true, schedule: newSchedule });
  });

  app.put("/api/schedules/:id", (req, res) => {
    const { id } = req.params;
    const { message, mediaUrl, mediaType, recipientJid, recipientName, phoneNumber, scheduledAt, repeatType, repeatDays, endDate } = req.body;

    const schedules = readJson<any[]>("schedules.json", []);
    const index = schedules.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Scheduled message not found" });
    }

    if (scheduledAt) {
      const schedTime = new Date(scheduledAt);
      if (isNaN(schedTime.getTime())) {
        return res.status(400).json({ error: "Invalid date format." });
      }
      if (schedTime <= new Date()) {
        return res.status(400).json({ error: "Scheduled time must be in the future." });
      }
    }

    schedules[index] = {
      ...schedules[index],
      message: message ?? schedules[index].message,
      mediaUrl: mediaUrl ?? schedules[index].mediaUrl,
      mediaType: mediaType ?? schedules[index].mediaType,
      recipientJid: recipientJid ?? schedules[index].recipientJid,
      recipientName: recipientName ?? schedules[index].recipientName,
      phoneNumber: phoneNumber ?? schedules[index].phoneNumber,
      scheduledAt: scheduledAt ?? schedules[index].scheduledAt,
      repeatType: repeatType ?? schedules[index].repeatType,
      repeatDays: repeatDays ?? schedules[index].repeatDays,
      endDate: endDate ?? schedules[index].endDate,
      status: "scheduled",
      errorMessage: undefined
    };

    writeJson("schedules.json", schedules);
    res.json({ success: true, schedule: schedules[index] });
  });

  app.post("/api/schedules/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const schedules = readJson<any[]>("schedules.json", []);
    const index = schedules.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Scheduled message not found" });
    }

    schedules[index].status = status;
    writeJson("schedules.json", schedules);
    res.json({ success: true, schedule: schedules[index] });
  });

  app.post("/api/schedules/:id/send-now", async (req, res) => {
    const { id } = req.params;
    const schedules = readJson<any[]>("schedules.json", []);
    const index = schedules.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Scheduled message not found" });
    }

    if (!isConnected || !sock) {
      return res.status(401).json({ error: "WhatsApp is disconnected. Please reconnect WhatsApp before sending." });
    }

    const schedule = schedules[index];
    try {
      const recipient = schedule.recipientJid || schedule.phoneNumber;
      await sendBaileysMessage(recipient, schedule.message, schedule.mediaUrl, schedule.mediaType);

      schedule.status = "sent";
      schedule.sentAt = new Date().toISOString();
      schedule.errorMessage = undefined;
      writeJson("schedules.json", schedules);

      const history = readJson<any[]>("history.json", []);
      history.unshift({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        userId: schedule.userId || "default",
        message: schedule.message,
        mediaUrl: schedule.mediaUrl,
        mediaType: schedule.mediaType,
        recipientJid: recipient,
        recipientName: schedule.recipientName || recipient,
        templateName: schedule.templateName,
        sentAt: schedule.sentAt,
        status: "sent",
        scheduleId: schedule.id
      });
      writeJson("history.json", history.slice(0, 500));

      res.json({ success: true });
    } catch (err: any) {
      schedule.status = "failed";
      schedule.errorMessage = err.message;
      writeJson("schedules.json", schedules);

      const history = readJson<any[]>("history.json", []);
      history.unshift({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        userId: schedule.userId || "default",
        message: schedule.message,
        mediaUrl: schedule.mediaUrl,
        mediaType: schedule.mediaType,
        recipientJid: schedule.recipientJid,
        recipientName: schedule.recipientName || schedule.recipientJid,
        templateName: schedule.templateName,
        sentAt: new Date().toISOString(),
        status: "failed",
        errorMessage: err.message,
        scheduleId: schedule.id
      });
      writeJson("history.json", history.slice(0, 500));

      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/schedules/:id", (req, res) => {
    const { id } = req.params;
    let schedules = readJson<any[]>("schedules.json", []);
    schedules = schedules.filter(s => s.id !== id);
    writeJson("schedules.json", schedules);
    res.json({ success: true });
  });

  // --- CAMPAIGN ENDPOINTS ---
  app.get("/api/campaigns", (req, res) => {
    const campaigns = readJson<any[]>("campaigns.json", []);
    res.json({ campaigns });
  });

  app.post("/api/campaigns", (req, res) => {
    const { name, description, templateId, templateName, recipientJid, recipientName, phoneNumber, scheduleTime, repeatType, repeatDays, userId } = req.body;
    if (!name || !recipientJid && !phoneNumber) {
      return res.status(400).json({ error: "Campaign Name and Recipient are required." });
    }

    const campaigns = readJson<any[]>("campaigns.json", []);
    const newCampaign = {
      id: "camp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      userId: userId || "default",
      name,
      description: description || "",
      templateId: templateId || "",
      templateName: templateName || "",
      recipientJid: recipientJid || phoneNumber,
      recipientName: recipientName || phoneNumber || "Contact",
      phoneNumber: phoneNumber || "",
      scheduleTime: scheduleTime || "08:00",
      repeatType: repeatType || "none",
      repeatDays: repeatDays || [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    campaigns.unshift(newCampaign);
    writeJson("campaigns.json", campaigns);
    res.json({ success: true, campaign: newCampaign });
  });

  app.put("/api/campaigns/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, status, templateId, templateName, recipientJid, recipientName, scheduleTime, repeatType, repeatDays } = req.body;

    const campaigns = readJson<any[]>("campaigns.json", []);
    const index = campaigns.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    campaigns[index] = {
      ...campaigns[index],
      name: name ?? campaigns[index].name,
      description: description ?? campaigns[index].description,
      status: status ?? campaigns[index].status,
      templateId: templateId ?? campaigns[index].templateId,
      templateName: templateName ?? campaigns[index].templateName,
      recipientJid: recipientJid ?? campaigns[index].recipientJid,
      recipientName: recipientName ?? campaigns[index].recipientName,
      scheduleTime: scheduleTime ?? campaigns[index].scheduleTime,
      repeatType: repeatType ?? campaigns[index].repeatType,
      repeatDays: repeatDays ?? campaigns[index].repeatDays,
      updatedAt: new Date().toISOString()
    };

    writeJson("campaigns.json", campaigns);
    res.json({ success: true, campaign: campaigns[index] });
  });

  app.delete("/api/campaigns/:id", (req, res) => {
    const { id } = req.params;
    let campaigns = readJson<any[]>("campaigns.json", []);
    campaigns = campaigns.filter(c => c.id !== id);
    writeJson("campaigns.json", campaigns);
    res.json({ success: true });
  });

  // --- HISTORY LOG ENDPOINTS ---
  app.get("/api/history", (req, res) => {
    const history = readJson<any[]>("history.json", []);
    res.json({ history });
  });

  app.post("/api/history/retry", async (req, res) => {
    const { id } = req.body;
    const history = readJson<any[]>("history.json", []);
    const item = history.find(h => h.id === id);
    if (!item) {
      return res.status(404).json({ error: "History record not found" });
    }

    if (!isConnected || !sock) {
      return res.status(401).json({ error: "WhatsApp is disconnected. Please reconnect WhatsApp before sending." });
    }

    try {
      let jid = item.recipientJid;
      if (!jid.includes("@")) {
        const cleanNumber = jid.replace(/[^0-9]/g, "");
        jid = `${cleanNumber}@s.whatsapp.net`;
      }

      await sock.sendMessage(jid, { text: item.message });

      item.status = "sent";
      item.sentAt = new Date().toISOString();
      item.errorMessage = undefined;
      writeJson("history.json", history);

      res.json({ success: true });
    } catch (err: any) {
      item.errorMessage = err.message;
      writeJson("history.json", history);
      res.status(500).json({ error: err.message });
    }
  });


  // --- Vite Middleware (Development) ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares as any);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
