"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2, ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearFaceEnrollment, getFaceEnrollmentStatus } from "@/lib/actions/face";
import { createClient } from "@/lib/supabase/client";
import {
  FaceRegistrationCapture,
  type FaceRegistrationCaptureResult,
} from "@/components/face/FaceRegistrationCapture";

export function FaceEnrollmentCard({ promptEnrollment = false }: { promptEnrollment?: boolean }) {
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await getFaceEnrollmentStatus();
      setLoading(false);
      if ("error" in status) {
        setLoadError(status.error || "Failed to load face enrollment");
        return;
      }
      setEnrolled(status.enrolled);
      setEnrolledAt(status.enrolledAt);
    })();
  }, []);

  useEffect(() => {
    if (promptEnrollment && !loading && !enrolled) {
      setShowCapture(true);
    }
  }, [promptEnrollment, loading, enrolled]);

  const handleComplete = async (capture: FaceRegistrationCaptureResult) => {
    setProcessing(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      let referenceClipUrl: string | undefined;
      if (capture.referenceClipBlob) {
        const path = `${user.id}/registration-${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("face-reference-clips")
          .upload(path, capture.referenceClipBlob, {
            contentType: capture.referenceClipBlob.type || "video/webm",
            upsert: true,
          });
        if (uploadError) throw new Error(uploadError.message);
        referenceClipUrl = path;
      }

      const res = await fetch("/api/staff/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeddings: capture.angles.map((angle) => ({
            angle: angle.angle,
            descriptor: angle.descriptor,
            referenceClipUrl: referenceClipUrl,
          })),
          referenceClipUrl,
          motionScore: capture.motionScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setEnrolled(true);
      setEnrolledAt(new Date().toISOString());
      setShowCapture(false);
      toast.success("Face registered for kiosk check-in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face registration failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = async () => {
    setProcessing(true);
    const result = await clearFaceEnrollment();
    setProcessing(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setEnrolled(false);
    setEnrolledAt(null);
    setShowCapture(false);
    toast.success("Face registration removed");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={promptEnrollment && !enrolled ? "border-primary ring-1 ring-primary/30" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          Face registration
        </CardTitle>
        <CardDescription>
          Register five head angles for the reception kiosk. Clock in/out happens at the kiosk only — not from
          this portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load face registration</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        {enrolled ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Face registered</AlertTitle>
            <AlertDescription>
              {enrolledAt
                ? `Registered on ${format(new Date(enrolledAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Your face is ready for kiosk matching."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Registration required</AlertTitle>
            <AlertDescription>
              Complete the guided capture below before using the reception kiosk.
            </AlertDescription>
          </Alert>
        )}

        {!enrolled && !showCapture && (
          <Button onClick={() => setShowCapture(true)} disabled={processing}>
            Start face registration
          </Button>
        )}

        {!enrolled && showCapture && (
          <FaceRegistrationCapture
            disabled={processing}
            onComplete={(result) => void handleComplete(result)}
          />
        )}

        {enrolled && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCapture(true)} disabled={processing}>
              Re-register face
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleClear()} disabled={processing}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove registration
            </Button>
          </div>
        )}

        {enrolled && showCapture && (
          <FaceRegistrationCapture
            disabled={processing}
            onComplete={(result) => void handleComplete(result)}
          />
        )}
      </CardContent>
    </Card>
  );
}
