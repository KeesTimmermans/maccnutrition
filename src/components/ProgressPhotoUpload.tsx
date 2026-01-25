import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, Trash2, User, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export interface ProgressPhotos {
  front: string | null;
  back: string | null;
  left: string | null;
  right: string | null;
}

interface PhotoSlotProps {
  label: string;
  icon: React.ReactNode;
  photoUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
}

const PhotoSlot = ({
  label,
  icon,
  photoUrl,
  onUpload,
  onDelete,
  isUploading,
  disabled = false,
}: PhotoSlotProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    await onUpload(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {photoUrl ? (
        <div className="relative group">
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted aspect-[3/4]">
            <img
              src={photoUrl}
              alt={`${label} view`}
              className="w-full h-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent rounded-b-xl">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="flex-1 h-7 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={disabled || isUploading}
              className="h-7 px-2"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-border bg-muted/50 hover:bg-muted hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Tap to upload</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

interface ProgressPhotoUploadProps {
  photos: ProgressPhotos;
  onPhotosChange: (photos: ProgressPhotos) => void;
  disabled?: boolean;
}

export const ProgressPhotoUpload = ({
  photos,
  onPhotosChange,
  disabled = false,
}: ProgressPhotoUploadProps) => {
  const [uploadingSlot, setUploadingSlot] = useState<keyof ProgressPhotos | null>(null);

  const uploadPhoto = async (slot: keyof ProgressPhotos, file: File) => {
    setUploadingSlot(slot);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to upload photos");
        return;
      }

      const timestamp = Date.now();
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${slot}-${timestamp}.${fileExt}`;

      // Delete old photo if exists
      if (photos[slot]) {
        const urlParts = photos[slot]!.split("/progress-photos/");
        if (urlParts.length > 1) {
          const pathWithQuery = urlParts[1];
          const path = pathWithQuery.split("?")[0];
          await supabase.storage.from("progress-photos").remove([path]);
        }
      }

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

      const { data: signedData } = await supabase.storage
        .from("progress-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (signedData?.signedUrl) {
        onPhotosChange({ ...photos, [slot]: signedData.signedUrl });
        toast.success(`${slot.charAt(0).toUpperCase() + slot.slice(1)} photo uploaded!`);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingSlot(null);
    }
  };

  const deletePhoto = async (slot: keyof ProgressPhotos) => {
    if (!photos[slot]) return;

    setUploadingSlot(slot);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const urlParts = photos[slot]!.split("/progress-photos/");
      if (urlParts.length > 1) {
        const pathWithQuery = urlParts[1];
        const path = pathWithQuery.split("?")[0];
        await supabase.storage.from("progress-photos").remove([path]);
      }

      onPhotosChange({ ...photos, [slot]: null });
      toast.success("Photo deleted");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    } finally {
      setUploadingSlot(null);
    }
  };

  const slots: { key: keyof ProgressPhotos; label: string; icon: React.ReactNode }[] = [
    { key: "front", label: "Front", icon: <User className="w-3.5 h-3.5" /> },
    { key: "back", label: "Back", icon: <User className="w-3.5 h-3.5 rotate-180" /> },
    { key: "left", label: "Left Side", icon: <User className="w-3.5 h-3.5 -rotate-90" /> },
    { key: "right", label: "Right Side", icon: <User className="w-3.5 h-3.5 rotate-90" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {slots.map(({ key, label, icon }) => (
          <PhotoSlot
            key={key}
            label={label}
            icon={icon}
            photoUrl={photos[key]}
            onUpload={(file) => uploadPhoto(key, file)}
            onDelete={() => deletePhoto(key)}
            isUploading={uploadingSlot === key}
            disabled={disabled}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Your photos are stored privately and only visible to you.
      </p>
    </div>
  );
};
