"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { CheckCircle2, Loader2, ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearFaceEnrollment, enrollFace, getFaceEnrollmentStatus } from "@/lib/actions/face";
import { createClient } from "@/lib/supabase/client";
import {
  VideoVerificationCapture,
  type VideoVerificationResult,
} from "@/components/attendance/VideoVerificationCapture";

export function FaceEnrollmentCard({ promptEnrollment = false }: { promptEnrollment?: boolean }) {
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [verification, setVerification] = useState<VideoVerificationResult | null>(null);

  useEffect(() => {
    (async () => {
      const status = await getFaceEnrollmentStatus();
      setLoading(false);
      if ("error" in status) return;
      setEnrolled(status.enrolled);
      setEnrolledAt(status.enrolledAt);
    })();
  }, []);

  const handleEnroll = async () => {
    if (!verification) {
      toast.error("Complete the video verification first");
      return;
    }
    setProcessing(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const videoPath = `${user.id}/face-enrollment-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("check-in-videos")
        .upload(videoPath, verification.videoBlob, {
          contentType: verification.videoBlob.type || "video/webm",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const result = await enrollFace({
        descriptor: verification.faceDescriptor,
        referenceVideoPath: videoPath,
        motionScore: verification.motionScore,
        frameDescriptors: verification.frameDescriptors,
      });
      if ("error" in result) throw new Error(result.error);

      setEnrolled(true);
      setEnrolledAt(new Date().toISOString());
      toast.success("Face enrolled with video liveness verification");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face enrollment failed");
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
    setVerification(null);
    toast.success("Face enrollment removed");
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
          Video Face Enrollment
        </CardTitle>
        <CardDescription>
          {promptEnrollment && !enrolled
            ? "Welcome — complete this step first so video check-in can verify your identity."
            : "Record a short live video so check-in can verify it is really you."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrolled ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Face enrolled</AlertTitle>
            <AlertDescription>
              {enrolledAt
                ? `Registered on ${format(new Date(enrolledAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Your face is registered for secure check-in."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Enrollment required for secure check-in</AlertTitle>
            <AlertDescription>
              Standard and Strict modes require live video verification. Enroll here before{" "}
              <Link href="/my-attendance" className="text-primary underline">
                checking in
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

        {!enrolled && (
          <>
            <VideoVerificationCapture
              label="Enrollment video"
              disabled={processing}
              onVerified={setVerification}
            />
            {verification?.previewUrl && (
              <video
                src={verification.previewUrl}
                controls
                className="h-32 w-full max-w-sm rounded-lg border"
              />
            )}
            <Button onClick={handleEnroll} disabled={processing || !verification}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save enrollment
            </Button>
          </>
        )}

        {enrolled && (
          <Button variant="outline" size="sm" onClick={handleClear} disabled={processing}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove face enrollment
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
