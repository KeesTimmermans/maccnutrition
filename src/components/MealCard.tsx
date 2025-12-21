import { useState } from "react";
import { Camera, Plus, Sparkles, MoreVertical, Pencil, Trash2, X, Check } from "lucide-react";
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

interface MealCardProps {
  meal: MealData;
  onEdit?: (meal: MealData) => void;
  onDelete?: (mealId: string) => void;
}

export const MealCard = ({ meal, onEdit, onDelete }: MealCardProps) => {
  const { t } = useLanguage();
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
                value={editedMeal.calories}
                onChange={(e) => setEditedMeal({ ...editedMeal, calories: parseInt(e.target.value) || 0 })}
                className="bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('protein')} (g)</label>
              <Input
                type="number"
                value={editedMeal.protein}
                onChange={(e) => setEditedMeal({ ...editedMeal, protein: parseInt(e.target.value) || 0 })}
                className="bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('carbs')} (g)</label>
              <Input
                type="number"
                value={editedMeal.carbs}
                onChange={(e) => setEditedMeal({ ...editedMeal, carbs: parseInt(e.target.value) || 0 })}
                className="bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('fats')} (g)</label>
              <Input
                type="number"
                value={editedMeal.fats}
                onChange={(e) => setEditedMeal({ ...editedMeal, fats: parseInt(e.target.value) || 0 })}
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
      <div className="bg-card rounded-2xl shadow-soft p-4 flex gap-4 animate-scale-in hover:shadow-medium transition-shadow duration-300">
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

        {/* Meal Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-foreground truncate">{meal.name}</h4>
              <p className="text-sm text-muted-foreground">{meal.time}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-calories bg-accent px-2 py-1 rounded-lg">
                {meal.calories} cal
              </span>
              {(onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 hover:bg-muted rounded-lg transition-colors">
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
          </div>
          
          {/* Macro Pills */}
          <div className="flex gap-2 mt-2">
            <span className="text-xs font-medium text-protein bg-protein/10 px-2 py-0.5 rounded-full">
              P: {meal.protein}g
            </span>
            <span className="text-xs font-medium text-carbs bg-carbs/10 px-2 py-0.5 rounded-full">
              C: {meal.carbs}g
            </span>
            <span className="text-xs font-medium text-fats bg-fats/10 px-2 py-0.5 rounded-full">
              F: {meal.fats}g
            </span>
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

export const AddMealCard = ({ onClick }: { onClick: () => void }) => {
  const { t } = useLanguage();
  
  return (
    <button
      onClick={onClick}
      className="w-full bg-card/50 border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-accent/50 transition-all duration-300 group"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Plus className="w-6 h-6 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">{t('log_a_meal')}</p>
        <p className="text-sm text-muted-foreground">{t('snap_or_search')}</p>
      </div>
    </button>
  );
};
