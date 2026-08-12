import { useAppStore } from "../store/useAppStore";
import { Button } from "@/components/base/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/base/card";
import { Input } from "@/components/base/input";
import { Label } from "@/components/base/label";
import { Phone, CheckCircle2, AlertCircle, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ConnectWA() {
  const { wsStatus, qrCodeUrl, pairingCode, checkConnection, disconnect } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activeTab, setActiveTab] = useState<"qr" | "phone">("qr");

  useEffect(() => {
    checkConnection();
    const i = setInterval(() => checkConnection(), 2500);
    return () => clearInterval(i);
  }, []);

  // When qrCodeUrl or pairingCode changes, automatically show the relevant view
  useEffect(() => {
    if (qrCodeUrl) {
      setActiveTab("qr");
    } else if (pairingCode) {
      setActiveTab("phone");
    }
  }, [qrCodeUrl, pairingCode]);

  const handleConnectByQR = async () => {
    setLoading(true);
    setActiveTab("qr");
    try {
      await fetch("/api/whatsapp/connect", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({}) 
      });
      toast.info("Generating QR code...");
    } catch {
      toast.error("Failed to start QR connection");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectByPhone = async () => {
    if (!phoneNumber) {
      toast.error("Please enter your phone number with country code.");
      return;
    }
    
    const cleaned = phoneNumber.replace(/[^0-9]/g, "");
    if (cleaned.length < 10) {
      toast.error("Invalid phone number format. Include country code (e.g. 14155552671).");
      return;
    }

    setLoading(true);
    setActiveTab("phone");
    try {
      await fetch("/api/whatsapp/connect", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleaned })
      });
      toast.info("Requesting pairing code...");
    } catch {
      toast.error("Failed to request pairing code");
    } finally {
      setLoading(false);
    }
  };

  const formattedPairingCode = pairingCode ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}` : "";

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Connection</h1>
        <p className="text-slate-500 mt-2">Connect your WhatsApp account to enable automated messaging and AI replies.</p>
      </div>

      <Card className="max-w-md mx-auto shadow-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Phone className="w-8 h-8 text-emerald-600" />
          </div>
          <CardTitle>Device Link</CardTitle>
          <CardDescription>
            {wsStatus === "connected" 
              ? "Your WhatsApp account is active and connected." 
              : "Scan the QR code or enter your phone number to link your device."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center">
          {wsStatus === "connected" ? (
            <div className="flex flex-col items-center space-y-6 w-full py-4">
              <div className="flex items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 rounded-full">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                <span className="font-medium">Connected successfully</span>
              </div>
              <Button variant="destructive" className="w-full" onClick={disconnect}>
                Disconnect Session
              </Button>
            </div>
          ) : (
            <div className="w-full space-y-6">
              {/* Method Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("qr")}
                  className={`py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                    activeTab === "qr"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("phone")}
                  className={`py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                    activeTab === "phone"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Phone Number
                </button>
              </div>

              {/* QR Code Tab View */}
              {activeTab === "qr" && (
                <div className="flex flex-col items-center space-y-5">
                  {qrCodeUrl ? (
                    <>
                      <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-200">
                        <img src={qrCodeUrl} alt="WhatsApp QR Code" className="w-60 h-60 object-contain" />
                      </div>
                      <div className="text-xs text-slate-500 text-center space-y-1">
                        <p className="font-medium text-slate-700 dark:text-slate-300">Scan with WhatsApp:</p>
                        <p>Open WhatsApp → Linked Devices → Link a Device</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleConnectByQR} disabled={loading} className="w-full mt-2">
                        {loading ? "Refreshing..." : "Refresh QR Code"}
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center space-y-4 w-full">
                      <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-dashed border-slate-300 w-full flex flex-col items-center">
                        <QrCode className="w-12 h-12 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500 mb-4">Click below to generate a new QR code for device pairing.</p>
                        <Button onClick={handleConnectByQR} disabled={loading} className="w-full">
                          {loading ? "Generating QR Code..." : "Generate QR Code"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Phone Pairing Tab View */}
              {activeTab === "phone" && (
                <div className="flex flex-col space-y-5 w-full">
                  {pairingCode ? (
                    <div className="flex flex-col items-center space-y-5 py-2">
                      <div className="text-center space-y-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Pairing Code</span>
                        <div className="text-3xl font-mono font-bold tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          {formattedPairingCode}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg w-full">
                        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">How to enter on phone:</p>
                        <p>1. Open WhatsApp on your mobile phone</p>
                        <p>2. Go to <strong>Linked Devices → Link a Device</strong></p>
                        <p>3. Tap <strong>Link with phone number instead</strong></p>
                        <p>4. Type the 8-character code shown above</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleConnectByPhone} disabled={loading} className="text-xs text-slate-500">
                        Request New Code
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone" 
                          placeholder="e.g. +14155552671" 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">Must include country code without spaces (e.g., +1 for USA, +44 for UK)</p>
                      </div>
                      <Button onClick={handleConnectByPhone} disabled={loading} className="w-full">
                        {loading ? "Requesting Code..." : "Get Pairing Code"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
