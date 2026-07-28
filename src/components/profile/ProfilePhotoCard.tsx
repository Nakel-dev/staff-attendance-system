"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadProfilePhoto } from "@/lib/actions/profile-photo";
import { extractDescriptorFromJpegBlob, preloadRegistrationModels } from "@/lib/face/client";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getInitials } from "@/lib/utils/formatDate";
import type { Profile } from "@/lib/types";

interface ProfilePhotoCardProps {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url">;
  avatarDisplayUrl?: string;
  staffProfileId?: string;
  editable?: boolean;
  /** Staff self-service: camera only (no file upload). */
  cameraOnly?: boolean;
  /** Highlight and open camera when staff lands from signup enroll flow */
  promptCapture?: boolean;
  onUploaded?: () => void;
}

export function ProfilePhotoCard({
  profile,
  avatarDisplayUrl,
  staffProfileId,
  editable = true,
  cameraOnly = true,
  promptCapture = false,
  onUploaded,
}: ProfilePhotoCardProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(avatarDisplayUrl || profile.avatar_url);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraStarting(true);
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Could not access camera. Allow camera permission and try again.");
      setCameraOpen(false);
    } finally {
      setCameraStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!editable) return;
    if (cameraOpen || promptCapture) preloadRegistrationModels();
    if (promptCapture && !profile.avatar_url) {
      void startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptCapture, editable, profile.avatar_url]);

  const savePhoto = async (file: File) => {
    setUploading(true);
    setSaveStatus("Uploading photo…");
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadProfilePhoto(formData, staffProfileId);

    if (result.error) {
      setUploading(false);
      setSaveStatus(null);
      toast.error(result.error);
      return;
    }

    if (result.signedUrl) setPreviewUrl(result.signedUrl);

    try {
      setSaveStatus("Preparing face matching… (first time may take a minute)");
      const descriptor = await extractDescriptorFromJpegBlob(file);
      await fetchWithTimeout("/api/staff/profile-face-descriptor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
        timeoutMs: 30000,
      });
    } catch {
      toast.message(
        "Photo saved. If face registration fails below, tap Retake with camera and wait for face matching to finish."
      );
    }

    setUploading(false);
    setSaveStatus(null);
    toast.success("Reference photo saved. Continue with face verification below.");
    stopCamera();
    setCameraOpen(false);
    onUploaded?.();
    router.refresh();
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        void savePhoto(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  return (
    <Card
      className={
        promptCapture && !profile.avatar_url ? "border-primary ring-1 ring-primary/30" : undefined
      }
      id="profile-photo"
    >
      <CardHeader>
        <CardTitle>Reference face photo</CardTitle>
        <CardDescription>
          {cameraOnly
            ? "Use your camera to capture a clear face photo. Clock-in later matches against this photo."
            : "Capture or set a clear face photo used for attendance matching."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24">
            <AvatarImage src={previewUrl} alt={profile.full_name} />
            <AvatarFallback className="text-xl">{getInitials(profile.full_name)}</AvatarFallback>
          </Avatar>
          {editable && (
            <div className="space-y-2 text-center sm:text-left">
              <Button
                type="button"
                disabled={uploading || cameraStarting}
                onClick={() => void startCamera()}
              >
                {cameraStarting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {profile.avatar_url ? "Retake with camera" : "Open camera"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Look straight at the camera with good lighting. No file upload.
              </p>
              {saveStatus && (
                <p className="text-muted-foreground text-xs">{saveStatus}</p>
              )}
            </div>
          )}
        </div>

        {cameraError && <p className="text-destructive text-center text-sm">{cameraError}</p>}

        {cameraOpen && (
          <div className="space-y-3">
            <div className="relative mx-auto aspect-[4/3] max-w-md overflow-hidden rounded-lg border bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
                playsInline
                muted
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={captureFromCamera} disabled={uploading} size="lg">
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Capture photo
              </Button>
              <Button type="button" variant="outline" onClick={closeCamera} disabled={uploading}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
