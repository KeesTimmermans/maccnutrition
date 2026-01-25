import { useState, useEffect, useRef } from "react";
import { GripVertical, Eye, EyeOff, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateUserSettings } from "@/lib/userService";
import { useLanguage } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DashboardSection {
  id: string;
  label: string;
  icon: string;
  canHide: boolean;
}

export const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: "progress", label: "Today's Progress", icon: "📊", canHide: false },
  { id: "meals", label: "Today's Meals", icon: "🍽️", canHide: false },
  { id: "coach", label: "Coach Mac", icon: "🤖", canHide: true },
  { id: "planner", label: "Meal Planner", icon: "📅", canHide: true },
  { id: "water", label: "Water Intake", icon: "💧", canHide: true },
  { id: "wearables", label: "Wearables", icon: "⌚", canHide: true },
];

export const DEFAULT_LAYOUT = {
  sections: ["progress", "meals", "coach", "planner", "water", "wearables"],
  hidden: [] as string[],
};

interface DashboardLayoutSettingsProps {
  currentLayout: { sections: string[]; hidden: string[] } | null;
  onLayoutChange?: () => void;
}

export const DashboardLayoutSettings = ({
  currentLayout,
  onLayoutChange,
}: DashboardLayoutSettingsProps) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [layout, setLayout] = useState(currentLayout || DEFAULT_LAYOUT);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    if (currentLayout) {
      setLayout(currentLayout);
    }
  }, [currentLayout]);

  const getSectionInfo = (id: string): DashboardSection => {
    return DEFAULT_SECTIONS.find(s => s.id === id) || { id, label: id, icon: "📦", canHide: true };
  };

  // Desktop drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    await moveItem(draggedItem, targetId);
    setDraggedItem(null);
  };

  // Mobile-friendly move function using buttons
  const moveItem = async (itemId: string, targetId: string) => {
    const currentSections = [...layout.sections];
    const draggedIndex = currentSections.indexOf(itemId);
    const targetIndex = currentSections.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    currentSections.splice(draggedIndex, 1);
    currentSections.splice(targetIndex, 0, itemId);

    const newLayout = { ...layout, sections: currentSections };
    setLayout(newLayout);
    await saveLayout(newLayout);
  };

  // Move item up or down for mobile
  const handleMoveUp = async (sectionId: string) => {
    const currentIndex = layout.sections.indexOf(sectionId);
    if (currentIndex <= 0) return;
    
    const targetId = layout.sections[currentIndex - 1];
    await moveItem(sectionId, targetId);
  };

  const handleMoveDown = async (sectionId: string) => {
    const currentIndex = layout.sections.indexOf(sectionId);
    if (currentIndex >= layout.sections.length - 1) return;
    
    const newSections = [...layout.sections];
    // Swap with next item
    [newSections[currentIndex], newSections[currentIndex + 1]] = 
    [newSections[currentIndex + 1], newSections[currentIndex]];
    
    const newLayout = { ...layout, sections: newSections };
    setLayout(newLayout);
    await saveLayout(newLayout);
  };

  const handleToggleVisibility = async (sectionId: string) => {
    const section = getSectionInfo(sectionId);
    if (!section.canHide) return;

    const isCurrentlyHidden = layout.hidden.includes(sectionId);
    const newHidden = isCurrentlyHidden
      ? layout.hidden.filter(id => id !== sectionId)
      : [...layout.hidden, sectionId];

    const newLayout = { ...layout, hidden: newHidden };
    setLayout(newLayout);
    await saveLayout(newLayout);
  };

  const handleReset = async () => {
    setLayout(DEFAULT_LAYOUT);
    await saveLayout(DEFAULT_LAYOUT);
    toast.success("Layout reset to default");
  };

  const saveLayout = async (newLayout: { sections: string[]; hidden: string[] }) => {
    setIsSaving(true);
    try {
      await updateUserSettings({ dashboard_layout: newLayout });
      onLayoutChange?.();
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("Failed to save layout");
    } finally {
      setIsSaving(false);
    }
  };

  // Get ordered sections (visible ones first in order, then hidden ones)
  const orderedSections = layout.sections.map((id, index) => ({
    ...getSectionInfo(id),
    isHidden: layout.hidden.includes(id),
    index,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isMobile ? "Use arrows to reorder, tap eye to show/hide" : "Drag to reorder, toggle to show/hide sections"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 text-xs"
          disabled={isSaving}
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      <div className="space-y-2">
        {orderedSections.map((section, idx) => (
          <div
            key={section.id}
            draggable={!isMobile}
            onDragStart={!isMobile ? (e) => handleDragStart(e, section.id) : undefined}
            onDragOver={!isMobile ? handleDragOver : undefined}
            onDrop={!isMobile ? (e) => handleDrop(e, section.id) : undefined}
            className={`
              flex items-center gap-2 p-3 rounded-xl border transition-all
              ${draggedItem === section.id ? "opacity-50 border-primary" : "border-border"}
              ${section.isHidden ? "bg-muted/50 opacity-60" : "bg-card"}
              ${!isMobile ? "cursor-move" : ""}
            `}
          >
            {/* Mobile: Up/Down buttons */}
            {isMobile ? (
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMoveUp(section.id)}
                  disabled={idx === 0 || isSaving}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleMoveDown(section.id)}
                  disabled={idx === orderedSections.length - 1 || isSaving}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            
            <span className="text-lg">{section.icon}</span>
            <span className={`flex-1 text-sm font-medium ${section.isHidden ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {section.label}
            </span>
            {section.canHide ? (
              <button
                onClick={() => handleToggleVisibility(section.id)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                disabled={isSaving}
              >
                {section.isHidden ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-primary" />
                )}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground px-2">Required</span>
            )}
          </div>
        ))}
      </div>

      {isSaving && (
        <p className="text-xs text-muted-foreground text-center">Saving...</p>
      )}
    </div>
  );
};
