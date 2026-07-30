"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, RotateCcw, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetStaffDiditVerification } from "@/lib/actions/staff";

interface StaffDiditVerificationCardProps {
  staffId: string;
  staffName: string;
  faceEnrolledAt?: string | null;
}

export function StaffDiditVerificationCard({
  staffId,
  staffName,
  faceEnrolledAt,
}: StaffDiditVerificationCardProps) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [open, setOpen] = useState(false);
  const verified = Boolean(faceEnrolledAt);

  const handleReset = async () => {
    setResetting(true);
    const result = await resetStaffDiditVerification(staffId);
    setResetting(false);
    setOpen(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`${staffName} must complete Didit KYC again in the portal.`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanFace className="h-5 w-5" />
          Didit identity verification
        </CardTitle>
        <CardDescription>
          Portal KYC status for kiosk clock-in. Reset if the wrong person verified this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={verified ? "success" : "secondary"}>
            {verified ? "Verified" : "Not verified"}
          </Badge>
          {verified && faceEnrolledAt && (
            <span className="text-sm text-muted-foreground">
              Since {format(new Date(faceEnrolledAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
        </div>

        {!verified && (
          <p className="text-sm text-muted-foreground">
            This staff member has not completed Didit KYC in the portal yet. They must verify in
            Profile before using the reception kiosk.
          </p>
        )}

        {verified && (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={resetting}>
                {resetting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reset Didit verification
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Didit verification?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears {staffName}&apos;s portal identity verification and frees their Didit
                  identity for use on another account if needed. They will be blocked from the kiosk
                  until they complete Didit KYC again in Profile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} disabled={resetting}>
                  {resetting ? "Resetting…" : "Reset verification"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
