import { useState } from "react";
import { ShoppingCart, Check, DollarSign, Lightbulb, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GroceryItem {
  name: string;
  quantity: string;
  notes?: string;
}

interface GroceryCategory {
  name: string;
  icon: string;
  items: GroceryItem[];
}

interface GroceryListData {
  categories: GroceryCategory[];
  estimatedCost: string;
  shoppingTips: string[];
}

interface GroceryListProps {
  groceryList: GroceryListData;
  onClose: () => void;
}

export const GroceryList = ({ groceryList, onClose }: GroceryListProps) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (categoryName: string, itemName: string) => {
    const key = `${categoryName}-${itemName}`;
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const totalItems = groceryList.categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedCount = checkedItems.size;

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Grocery List
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {checkedCount} of {totalItems} items checked
          </span>
          <Badge variant="secondary" className="gap-1">
            <DollarSign className="w-3 h-3" />
            {groceryList.estimatedCost}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {groceryList.categories.map((category) => (
              <div key={category.name}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{category.icon}</span>
                  <h4 className="font-semibold text-foreground">{category.name}</h4>
                  <span className="text-xs text-muted-foreground">
                    ({category.items.length})
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  {category.items.map((item) => {
                    const key = `${category.name}-${item.name}`;
                    const isChecked = checkedItems.has(key);
                    
                    return (
                      <div
                        key={item.name}
                        className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                          isChecked ? 'bg-muted/50' : 'hover:bg-muted/30'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(category.name, item.name)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}
                            {item.notes && ` • ${item.notes}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Shopping Tips */}
        {groceryList.shoppingTips && groceryList.shoppingTips.length > 0 && (
          <div className="mt-4 bg-primary/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Shopping Tips</p>
            </div>
            <ul className="space-y-1">
              {groceryList.shoppingTips.map((tip, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-primary">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clear all button */}
        {checkedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCheckedItems(new Set())}
            className="w-full mt-4"
          >
            Clear all checked items
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
