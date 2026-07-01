"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
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
}

export function ProfilePhotoCard({
  profile,
  avatarDisplayUrl,
  staffProfileId,
  editable = true,
}: ProfilePhotoCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(avatarDisplayUrl || profile.avatar_url);

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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile photo</CardTitle>
        <CardDescription>
          Used on your portal and for admin comparison when you clock in at the kiosk.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24">
          <AvatarImage src={previewUrl} alt={profile.full_name} />
          <AvatarFallback className="text-xl">{getInitials(profile.full_name)}</AvatarFallback>
        </Avatar>
        {editable && (
          <div className="space-y-2 text-center sm:text-left">
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
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <Camera className="h-3 w-3" />
              JPEG, PNG, or WebP · max 5MB
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
