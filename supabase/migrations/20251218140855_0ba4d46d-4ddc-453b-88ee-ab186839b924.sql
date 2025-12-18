-- Create wearable connections table
CREATE TABLE public.wearable_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('garmin', 'whoop', 'apple_health', 'fitbit')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  external_user_id TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Create wearable data table for synced metrics
CREATE TABLE public.wearable_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  data_date DATE NOT NULL,
  -- Sleep metrics
  sleep_duration_minutes INTEGER,
  sleep_quality_score INTEGER, -- 1-100 scale
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  light_sleep_minutes INTEGER,
  awake_minutes INTEGER,
  -- HRV metrics
  hrv_average DECIMAL(5,1),
  hrv_rmssd DECIMAL(5,1),
  resting_heart_rate INTEGER,
  -- Activity metrics
  steps INTEGER,
  active_calories INTEGER,
  total_calories INTEGER,
  active_minutes INTEGER,
  -- Recovery/Strain
  recovery_score INTEGER, -- 1-100 (Whoop style)
  strain_score DECIMAL(3,1), -- 0-21 (Whoop style)
  stress_score INTEGER, -- 1-100
  body_battery INTEGER, -- Garmin
  -- Raw JSON for additional data
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, data_date)
);

-- Enable RLS
ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wearable_connections
CREATE POLICY "Users can view their own wearable connections"
ON public.wearable_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wearable connections"
ON public.wearable_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wearable connections"
ON public.wearable_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wearable connections"
ON public.wearable_connections FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for wearable_data
CREATE POLICY "Users can view their own wearable data"
ON public.wearable_data FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wearable data"
ON public.wearable_data FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_wearable_data_user_date ON public.wearable_data(user_id, data_date DESC);
CREATE INDEX idx_wearable_connections_user ON public.wearable_connections(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_wearable_connections_updated_at
BEFORE UPDATE ON public.wearable_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();