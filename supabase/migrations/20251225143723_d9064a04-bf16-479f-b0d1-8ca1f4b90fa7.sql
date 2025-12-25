-- Create table to store generated meal plans
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_data JSONB NOT NULL,
  week_start DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own meal plans
CREATE POLICY "Users can view their own meal plans" 
ON public.meal_plans 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own meal plans
CREATE POLICY "Users can create their own meal plans" 
ON public.meal_plans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own meal plans
CREATE POLICY "Users can update their own meal plans" 
ON public.meal_plans 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own meal plans
CREATE POLICY "Users can delete their own meal plans" 
ON public.meal_plans 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meal_plans_updated_at
BEFORE UPDATE ON public.meal_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_meal_plans_user_week ON public.meal_plans (user_id, week_start DESC);