"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2, ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearFaceEnrollment, enrollFace, getFaceEnrollmentStatus } from "@/lib/actions/face";
import { createClient } from "@/lib/supabase/client";
import {
  extractFaceDescriptorFromFile,
  extractFaceDescriptorFromVideo,
  loadFaceModels,
} from "@/lib/face/client";

export function FaceEnrollmentCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await getFaceEnrollmentStatus();
      setLoading(false);
      if ("error" in status) return;
      setEnrolled(status.enrolled);
      setEnrolledAt(status.enrolledAt);
    })();
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    try {
      await loadFaceModels();
      setModelsReady(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      toast.error("Camera access is required for face enrollment");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const enrollFromVideo = async () => {
    if (!videoRef.current) return;
    setProcessing(true);
    try {
      const descriptor = await extractFaceDescriptorFromVideo(videoRef.current);
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture image");
      ctx.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("Could not capture image");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/face-reference-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("check-in-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const result = await enrollFace({ descriptor, referencePhotoPath: path });
      if (result.error) throw new Error(result.error);
      setEnrolled(true);
      setEnrolledAt(new Date().toISOString());
      setPreview(canvas.toDataURL("image/jpeg"));
      stopCamera();
      toast.success("Face enrolled successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face enrollment failed");
    } finally {
      setProcessing(false);
    }
  };

  const enrollFromFile = async (file: File) => {
    setProcessing(true);
    try {
      await loadFaceModels();
      setModelsReady(true);
      const descriptor = await extractFaceDescriptorFromFile(file);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.type.split("/")[1] || "jpg";
      const path = `${user.id}/face-reference-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("check-in-photos")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const result = await enrollFace({ descriptor, referencePhotoPath: path });
      if (result.error) throw new Error(result.error);
      setEnrolled(true);
      setEnrolledAt(new Date().toISOString());
      setPreview(URL.createObjectURL(file));
      toast.success("Face enrolled successfully");
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
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEnrolled(false);
    setEnrolledAt(null);
    setPreview(null);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          Face Check-In Enrollment
        </CardTitle>
        <CardDescription>
          Register your face once so check-in can verify it is really you — not a colleague on a shared phone.
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
              Standard and Strict attendance modes require face verification.{" "}
              <Link href="/my-attendance" className="text-primary underline">
                Check-in
              </Link>{" "}
              is blocked until you enroll here.
            </AlertDescription>
          </Alert>
        )}

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Face reference" className="h-32 w-32 rounded-lg border object-cover" />
        )}

        {cameraOn ? (
          <div className="space-y-3">
            <video ref={videoRef} className="w-full max-w-sm rounded-lg border" playsInline muted />
            <div className="flex flex-wrap gap-2">
              <Button onClick={enrollFromVideo} disabled={processing || !modelsReady}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
                Capture &amp; enroll face
              </Button>
              <Button variant="outline" onClick={stopCamera} disabled={processing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Button onClick={startCamera} disabled={processing}>
              <Camera className="mr-2 h-4 w-4" />
              Use camera
            </Button>
            <div className="space-y-2">
              <Label htmlFor="face-file">Or upload a clear front-facing photo</Label>
              <Input
                id="face-file"
                type="file"
                accept="image/*"
                capture="user"
                disabled={processing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) enrollFromFile(file);
                }}
              />
            </div>
          </div>
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
