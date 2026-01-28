import { useState } from "react";
import { ChevronDown, ChevronUp, Camera, Sparkles, MoreVertical, Pencil, Trash2, X, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface MealData {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  imageUrl?: string;
}

interface CollapsibleMealCardProps {
  meal: MealData;
  onEdit?: (meal: MealData) => void;
  onDelete?: (mealId: string) => void;
}

export const CollapsibleMealCard = ({ meal, onEdit, onDelete }: CollapsibleMealCardProps) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedMeal, setEditedMeal] = useState(meal);

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit(editedMeal);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedMeal(meal);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(meal.id);
    }
    setShowDeleteDialog(false);
  };

  const handleToggle = () => {
    if (!isEditing) {
      setIsExpanded(!isExpanded);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-card rounded-2xl shadow-soft p-4 animate-scale-in">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-foreground">{t('edit_meal')}</h4>
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleSaveEdit}
              className="p-1.5 bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          <Input
            value={editedMeal.name}
            onChange={(e) => setEditedMeal({ ...editedMeal, name: e.target.value })}
            placeholder={t('meal_name')}
            className="bg-muted"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">{t('calories')}</label>
              <Input
                type="number"
                value={editedMeal.calories || ''}
                onChange={(e) => setEditedMeal({ ...editedMeal, calories: parseInt(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                className="bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('protein')} (g)</label>
              <Input
                type="number"
                value={editedMeal.protein || ''}
                onChange={(e) => setEditedMeal({ ...editedMeal, protein: parseInt(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                className="bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('carbs')} (g)</label>
              <Input
                type="number"
                value={editedMeal.carbs || ''}
                onChange={(e) => setEditedMeal({ ...editedMeal, carbs: parseInt(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                className="bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('fats')} (g)</label>
              <Input
                type="number"
                value={editedMeal.fats || ''}
                onChange={(e) => setEditedMeal({ ...editedMeal, fats: parseInt(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                className="bg-muted"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl shadow-soft overflow-hidden animate-scale-in hover:shadow-medium transition-shadow duration-300">
        {/* Collapsed Header - Always visible */}
        <button
          onClick={handleToggle}
          className="w-full p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-foreground truncate">{meal.name}</h4>
            <p className="text-xs text-muted-foreground">{meal.time}</p>
          </div>
          
          {/* Compact Macro Summary */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-semibold text-calories">
              {meal.calories} cal
            </span>
            <span className="text-xs text-muted-foreground">
              P:{meal.protein}g C:{meal.carbs}g F:{meal.fats}g
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded Details */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-300",
            isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="px-4 pb-4 pt-0 border-t border-border/50">
            <div className="flex gap-4 pt-4">
              {/* Meal Image */}
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                {meal.imageUrl ? (
                  <img 
                    src={meal.imageUrl} 
                    alt={meal.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-1 right-1 bg-primary/90 rounded-full p-1">
                  <Sparkles className="w-3 h-3 text-primary-foreground" />
                </div>
              </div>

              {/* Macro Details */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-calories">
                    {meal.calories} cal
                  </span>
                  {(onEdit || onDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="p-1 hover:bg-muted rounded-lg transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => setIsEditing(true)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            {t('edit')}
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem 
                            onClick={() => setShowDeleteDialog(true)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                
                {/* Macro Pills */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs font-medium text-protein bg-protein/10 px-2 py-1 rounded-full">
                    {t('protein')}: {meal.protein}g
                  </span>
                  <span className="text-xs font-medium text-carbs bg-carbs/10 px-2 py-1 rounded-full">
                    {t('carbs')}: {meal.carbs}g
                  </span>
                  <span className="text-xs font-medium text-fats bg-fats/10 px-2 py-1 rounded-full">
                    {t('fats')}: {meal.fats}g
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_meal_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_meal_desc').replace('{meal}', meal.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
