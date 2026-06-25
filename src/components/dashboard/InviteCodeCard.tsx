"use client";

import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InviteCodeCardProps {
  inviteCode: string;
  organizationName: string;
}

export function InviteCodeCard({ inviteCode, organizationName }: InviteCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success("Invite code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Invite Staff to {organizationName}
        </CardTitle>
        <CardDescription>
          Share this code so team members can register at{" "}
          <span className="font-medium">/auth</span> → Sign Up → Join as Staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3">
        <code className="flex-1 rounded-lg border bg-background px-4 py-3 text-lg font-mono font-semibold tracking-widest">
          {inviteCode}
        </code>
        <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied" : "Copy Code"}
        </Button>
      </CardContent>
    </Card>
  );
}
