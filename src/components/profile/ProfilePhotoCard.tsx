"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadProfilePhoto } from "@/lib/actions/profile-photo";
import { getInitials } from "@/lib/utils/formatDate";
import type { Profile } from "@/lib/types";

interface ProfilePhotoCardProps {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url">;
  avatarDisplayUrl?: string;
  staffProfileId?: string;
  editable?: boolean;
  /** Highlight and open camera when staff lands from signup enroll flow */
  promptCapture?: boolean;
  onUploaded?: () => void;
}

export function ProfilePhotoCard({
  profile,
  avatarDisplayUrl,
  staffProfileId,
  editable = true,
  promptCapture = false,
  onUploaded,
}: ProfilePhotoCardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(avatarDisplayUrl || profile.avatar_url);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);

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
      setCameraError("Could not access camera. Allow permission or upload a file instead.");
      setCameraOpen(false);
    } finally {
      setCameraStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!promptCapture || !editable || profile.avatar_url) return;
    void startCamera();
    return () => stopCamera();
    // Auto-open once for enroll flow; avoid restarting on callback identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptCapture, editable, profile.avatar_url]);

  const handleFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadProfilePhoto(formData, staffProfileId);
    setUploading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.signedUrl) setPreviewUrl(result.signedUrl);
    toast.success("Profile photo updated");
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
        void handleFile(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
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
        <CardTitle>Profile photo</CardTitle>
        <CardDescription>
          Upload a file or take a photo with your camera. This face is used for kiosk matching.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24">
            <AvatarImage src={previewUrl} alt={profile.full_name} />
            <AvatarFallback className="text-xl">{getInitials(profile.full_name)}</AvatarFallback>
          </Avatar>
          {editable && (
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload photo
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={uploading || cameraStarting}
                onClick={() => void startCamera()}
              >
                {cameraStarting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Take photo
              </Button>
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
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                Use this photo
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
