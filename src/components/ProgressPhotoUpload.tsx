import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2, Trash2, Image } from "lucide-react";
import { toast } from "sonner";

interface ProgressPhotoUploadProps {
  currentPhotoUrl: string | null;
  onPhotoChange: (url: string | null) => void;
  disabled?: boolean;
}

export const ProgressPhotoUpload = ({
  currentPhotoUrl,
  onPhotoChange,
  disabled = false,
}: ProgressPhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to upload photos");
        return;
      }

      // Create file path: userId/timestamp-filename
      const timestamp = Date.now();
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${timestamp}.${fileExt}`;

      // Delete old photo if exists
      if (currentPhotoUrl) {
        const oldPath = currentPhotoUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("progress-photos").remove([oldPath]);
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from("progress-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Failed to upload photo");
        return;
      }

      // Get signed URL for viewing (valid for 1 year)
      const { data: signedData } = await supabase.storage
        .from("progress-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (signedData?.signedUrl) {
        onPhotoChange(signedData.signedUrl);
        setPreviewUrl(signedData.signedUrl);
        toast.success("Progress photo uploaded!");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!currentPhotoUrl) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Extract path from URL
      const urlParts = currentPhotoUrl.split("/progress-photos/");
      if (urlParts.length > 1) {
        const pathWithQuery = urlParts[1];
        const path = pathWithQuery.split("?")[0];
        await supabase.storage.from("progress-photos").remove([path]);
      }

      onPhotoChange(null);
      setPreviewUrl(null);
      toast.success("Photo deleted");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    } finally {
      setIsUploading(false);
    }
  };

  const displayUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {displayUrl ? (
        <div className="relative">
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
            <img
              src={displayUrl}
              alt="Progress photo"
              className="w-full h-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={disabled || isUploading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-border bg-muted/50 hover:bg-muted transition-colors flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Upload progress photo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, or WebP (max 10MB)
                </p>
              </div>
            </>
          )}
        </button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Your photos are stored privately and only visible to you.
      </p>
    </div>
  );
};
