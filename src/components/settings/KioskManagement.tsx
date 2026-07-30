"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Monitor, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createKioskDevice, deleteKioskDevice, toggleKioskDevice } from "@/lib/actions/kiosk";

interface KioskRow {
  id: string;
  device_name: string;
  location: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export function KioskManagement({ initialKiosks }: { initialKiosks: KioskRow[] }) {
  const router = useRouter();
  const [kiosks, setKiosks] = useState(initialKiosks);
  const [deviceName, setDeviceName] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KioskRow | null>(null);

  const activeKiosks = useMemo(() => kiosks.filter((k) => k.is_active), [kiosks]);
  const inactiveKiosks = useMemo(() => kiosks.filter((k) => !k.is_active), [kiosks]);

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
    router.refresh();
  };

  const handleToggle = async (kiosk: KioskRow) => {
    setBusyId(kiosk.id);
    const result = await toggleKioskDevice(kiosk.id, !kiosk.is_active);
    setBusyId(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setKiosks((prev) =>
      prev.map((k) => (k.id === kiosk.id ? { ...k, is_active: !k.is_active } : k))
    );
    toast.success(kiosk.is_active ? "Kiosk deactivated" : "Kiosk activated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const result = await deleteKioskDevice(deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setKiosks((prev) => prev.filter((k) => k.id !== deleteTarget.id));
    toast.success("Kiosk removed");
    router.refresh();
  };

  const renderKioskRow = (kiosk: KioskRow) => (
    <div key={kiosk.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{kiosk.device_name}</p>
          <Badge variant={kiosk.is_active ? "success" : "secondary"}>
            {kiosk.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {kiosk.location || "No location"}
          {kiosk.last_seen_at
            ? ` · Last seen ${new Date(kiosk.last_seen_at).toLocaleString()}`
            : " · Never connected"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busyId === kiosk.id}
          onClick={() => void handleToggle(kiosk)}
        >
          {busyId === kiosk.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {kiosk.is_active ? "Deactivate" : "Activate"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busyId === kiosk.id}
          onClick={() => setDeleteTarget(kiosk)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );

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
          the reception tablet and paste the key once. Deactivate a kiosk to block new sign-ins; delete removes
          it permanently (attendance history is kept).
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

        <div className="space-y-3">
          <p className="text-sm font-medium">Active kiosks</p>
          {activeKiosks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active kiosks.</p>
          ) : (
            activeKiosks.map(renderKioskRow)
          )}
        </div>

        {inactiveKiosks.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Inactive kiosks</p>
            {inactiveKiosks.map(renderKioskRow)}
          </div>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete kiosk?</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {deleteTarget?.device_name} permanently. The tablet will need a new API key if you create
                a replacement. Past attendance records are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busyId === deleteTarget?.id}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDelete()} disabled={busyId === deleteTarget?.id}>
                {busyId === deleteTarget?.id ? "Deleting…" : "Delete kiosk"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
