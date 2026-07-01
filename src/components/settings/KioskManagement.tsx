"use client";

import { useState } from "react";
import { Copy, Loader2, Monitor, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createKioskDevice, toggleKioskDevice } from "@/lib/actions/kiosk";

interface KioskRow {
  id: string;
  device_name: string;
  location: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export function KioskManagement({ initialKiosks }: { initialKiosks: KioskRow[] }) {
  const [kiosks, setKiosks] = useState(initialKiosks);
  const [deviceName, setDeviceName] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!deviceName.trim()) return;
    setCreating(true);
    const result = await createKioskDevice({ deviceName, location });
    setCreating(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setKiosks((prev) => [result.kiosk as KioskRow, ...prev]);
    setNewApiKey(result.apiKey || null);
    setDeviceName("");
    setLocation("");
    toast.success("Kiosk device created. Copy the API key now — it won't be shown again.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Reception kiosks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Create a device, copy the API key, then open <code className="rounded bg-muted px-1">/kiosk</code> on
          the reception tablet and paste the key once.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kiosk-name">Device name</Label>
            <Input
              id="kiosk-name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Front desk tablet"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kiosk-location">Location</Label>
            <Input
              id="kiosk-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Main reception"
            />
          </div>
        </div>

        <Button type="button" onClick={() => void handleCreate()} disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Create kiosk
        </Button>

        {newApiKey && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium">New API key (copy now)</p>
            <code className="mt-2 block break-all">{newApiKey}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                void navigator.clipboard.writeText(newApiKey);
                toast.success("Copied");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy key
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {kiosks.map((kiosk) => (
            <div key={kiosk.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{kiosk.device_name}</p>
                <p className="text-muted-foreground text-sm">
                  {kiosk.location || "No location"} · {kiosk.is_active ? "Active" : "Disabled"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void toggleKioskDevice(kiosk.id, !kiosk.is_active).then((res) => {
                    if ("error" in res) toast.error(res.error);
                    else
                      setKiosks((prev) =>
                        prev.map((k) => (k.id === kiosk.id ? { ...k, is_active: !k.is_active } : k))
                      );
                  })
                }
              >
                {kiosk.is_active ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
