"use client";

import Link from "next/link";
import { Users, ClipboardCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AUTH_PATH } from "@/constants";

interface GettingStartedCardProps {
  inviteCode?: string;
}

export function GettingStartedCard({ inviteCode }: GettingStartedCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          Your organization is set up. Complete these steps to start tracking attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4 space-y-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <p className="font-medium text-sm">Invite staff</p>
          <p className="text-xs text-muted-foreground">
            Share invite code {inviteCode ? <strong>{inviteCode}</strong> : "from above"} at{" "}
            {AUTH_PATH}
          </p>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <Users className="h-5 w-5 text-primary" />
          <p className="font-medium text-sm">Add team members</p>
          <p className="text-xs text-muted-foreground">
            Or create staff accounts directly from Staff Management.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff">Manage staff</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <p className="font-medium text-sm">Mark attendance</p>
          <p className="text-xs text-muted-foreground">
            Record daily attendance once your team has joined.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/attendance">Mark attendance</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
