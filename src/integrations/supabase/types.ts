export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      coach_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          check_in_date: string
          created_at: string
          energy_level: number | null
          hunger_level: number | null
          hydration_feeling: number | null
          id: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          stress_level: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_date?: string
          created_at?: string
          energy_level?: number | null
          hunger_level?: number | null
          hydration_feeling?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_date?: string
          created_at?: string
          energy_level?: number | null
          hunger_level?: number | null
          hydration_feeling?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_confirmations: {
        Row: {
          confirmed_at: string
          created_at: string
          email: string
          email_id: string
          event_type: string
          id: string
          raw_event: Json | null
        }
        Insert: {
          confirmed_at?: string
          created_at?: string
          email: string
          email_id: string
          event_type: string
          id?: string
          raw_event?: Json | null
        }
        Update: {
          confirmed_at?: string
          created_at?: string
          email?: string
          email_id?: string
          event_type?: string
          id?: string
          raw_event?: Json | null
        }
        Relationships: []
      }
      favorite_meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          fats: number
          id: string
          ingredients: string | null
          name: string
          protein: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          fats?: number
          id?: string
          ingredients?: string | null
          name: string
          protein?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          fats?: number
          id?: string
          ingredients?: string | null
          name?: string
          protein?: number
          user_id?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          plan_data: Json
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_data: Json
          updated_at?: string
          user_id: string
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_data?: Json
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          fats: number
          id: string
          image_url: string | null
          logged_at: string
          name: string
          protein: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          fats?: number
          id?: string
          image_url?: string | null
          logged_at?: string
          name: string
          protein?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          fats?: number
          id?: string
          image_url?: string | null
          logged_at?: string
          name?: string
          protein?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_baselines: {
        Row: {
          accountability_preference: string | null
          activity_level: string | null
          age: number | null
          allergies: string[] | null
          arm_cm: number | null
          biggest_challenge: string | null
          body_fat_percentage: number | null
          carbs_grams: number | null
          chest_cm: number | null
          coaching_tone: string | null
          conditions: string[] | null
          cooking_skill: string | null
          cravings_triggers: string[] | null
          created_at: string
          current_phase: string | null
          cycle_regularity: string | null
          cycle_symptoms: string[] | null
          dashboard_layout: Json | null
          diet_type: string | null
          eating_out_frequency: string | null
          eating_speed: string | null
          emotional_eating: string | null
          energy_patterns: string | null
          fats_grams: number | null
          focus_points: string[] | null
          food_dislikes: string | null
          height_cm: number | null
          height_feet: number | null
          height_inches: number | null
          hip_cm: number | null
          hunger_patterns: string | null
          hydration_habits: string | null
          id: string
          job_activity_level: string | null
          magnesium_mg: number | null
          meal_prep_time: string | null
          meals_per_day: string | null
          measurements_updated_at: string | null
          motivation_style: string | null
          name: string | null
          neck_cm: number | null
          occupation: string | null
          past_diets: string[] | null
          potassium_mg: number | null
          preferred_currency: string | null
          preferred_language: string | null
          primary_goal: string | null
          progress_photo_url: string | null
          protein_grams: number | null
          protein_shakes_preference: string | null
          secondary_goals: string[] | null
          sex: string | null
          sleep_hours: string | null
          snacking_habits: string | null
          sodium_mg: number | null
          stress_level: string | null
          target_calories: number | null
          tdee: number | null
          thigh_cm: number | null
          training_days: string | null
          training_intensity: string | null
          unit_system: string | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          water_liters: number | null
          weekend_habits: string | null
          weight: number | null
          work_hours: string | null
          workout_types: string[] | null
        }
        Insert: {
          accountability_preference?: string | null
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          arm_cm?: number | null
          biggest_challenge?: string | null
          body_fat_percentage?: number | null
          carbs_grams?: number | null
          chest_cm?: number | null
          coaching_tone?: string | null
          conditions?: string[] | null
          cooking_skill?: string | null
          cravings_triggers?: string[] | null
          created_at?: string
          current_phase?: string | null
          cycle_regularity?: string | null
          cycle_symptoms?: string[] | null
          dashboard_layout?: Json | null
          diet_type?: string | null
          eating_out_frequency?: string | null
          eating_speed?: string | null
          emotional_eating?: string | null
          energy_patterns?: string | null
          fats_grams?: number | null
          focus_points?: string[] | null
          food_dislikes?: string | null
          height_cm?: number | null
          height_feet?: number | null
          height_inches?: number | null
          hip_cm?: number | null
          hunger_patterns?: string | null
          hydration_habits?: string | null
          id?: string
          job_activity_level?: string | null
          magnesium_mg?: number | null
          meal_prep_time?: string | null
          meals_per_day?: string | null
          measurements_updated_at?: string | null
          motivation_style?: string | null
          name?: string | null
          neck_cm?: number | null
          occupation?: string | null
          past_diets?: string[] | null
          potassium_mg?: number | null
          preferred_currency?: string | null
          preferred_language?: string | null
          primary_goal?: string | null
          progress_photo_url?: string | null
          protein_grams?: number | null
          protein_shakes_preference?: string | null
          secondary_goals?: string[] | null
          sex?: string | null
          sleep_hours?: string | null
          snacking_habits?: string | null
          sodium_mg?: number | null
          stress_level?: string | null
          target_calories?: number | null
          tdee?: number | null
          thigh_cm?: number | null
          training_days?: string | null
          training_intensity?: string | null
          unit_system?: string | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          water_liters?: number | null
          weekend_habits?: string | null
          weight?: number | null
          work_hours?: string | null
          workout_types?: string[] | null
        }
        Update: {
          accountability_preference?: string | null
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          arm_cm?: number | null
          biggest_challenge?: string | null
          body_fat_percentage?: number | null
          carbs_grams?: number | null
          chest_cm?: number | null
          coaching_tone?: string | null
          conditions?: string[] | null
          cooking_skill?: string | null
          cravings_triggers?: string[] | null
          created_at?: string
          current_phase?: string | null
          cycle_regularity?: string | null
          cycle_symptoms?: string[] | null
          dashboard_layout?: Json | null
          diet_type?: string | null
          eating_out_frequency?: string | null
          eating_speed?: string | null
          emotional_eating?: string | null
          energy_patterns?: string | null
          fats_grams?: number | null
          focus_points?: string[] | null
          food_dislikes?: string | null
          height_cm?: number | null
          height_feet?: number | null
          height_inches?: number | null
          hip_cm?: number | null
          hunger_patterns?: string | null
          hydration_habits?: string | null
          id?: string
          job_activity_level?: string | null
          magnesium_mg?: number | null
          meal_prep_time?: string | null
          meals_per_day?: string | null
          measurements_updated_at?: string | null
          motivation_style?: string | null
          name?: string | null
          neck_cm?: number | null
          occupation?: string | null
          past_diets?: string[] | null
          potassium_mg?: number | null
          preferred_currency?: string | null
          preferred_language?: string | null
          primary_goal?: string | null
          progress_photo_url?: string | null
          protein_grams?: number | null
          protein_shakes_preference?: string | null
          secondary_goals?: string[] | null
          sex?: string | null
          sleep_hours?: string | null
          snacking_habits?: string | null
          sodium_mg?: number | null
          stress_level?: string | null
          target_calories?: number | null
          tdee?: number | null
          thigh_cm?: number | null
          training_days?: string | null
          training_intensity?: string | null
          unit_system?: string | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          water_liters?: number | null
          weekend_habits?: string | null
          weight?: number | null
          work_hours?: string | null
          workout_types?: string[] | null
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string
          longest_streak: number
          streak_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string
          longest_streak?: number
          streak_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string
          longest_streak?: number
          streak_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      water_intake: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          logged_at: string
          user_id: string
        }
        Insert: {
          amount_ml?: number
          created_at?: string
          id?: string
          logged_at?: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          logged_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_connections: {
        Row: {
          created_at: string
          external_user_id: string | null
          id: string
          is_connected: boolean
          last_sync_at: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_user_id?: string | null
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_user_id?: string | null
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_data: {
        Row: {
          active_calories: number | null
          active_minutes: number | null
          awake_minutes: number | null
          body_battery: number | null
          created_at: string
          data_date: string
          deep_sleep_minutes: number | null
          hrv_average: number | null
          hrv_rmssd: number | null
          id: string
          light_sleep_minutes: number | null
          provider: string
          raw_data: Json | null
          recovery_score: number | null
          rem_sleep_minutes: number | null
          resting_heart_rate: number | null
          sleep_duration_minutes: number | null
          sleep_quality_score: number | null
          steps: number | null
          strain_score: number | null
          stress_score: number | null
          total_calories: number | null
          user_id: string
        }
        Insert: {
          active_calories?: number | null
          active_minutes?: number | null
          awake_minutes?: number | null
          body_battery?: number | null
          created_at?: string
          data_date: string
          deep_sleep_minutes?: number | null
          hrv_average?: number | null
          hrv_rmssd?: number | null
          id?: string
          light_sleep_minutes?: number | null
          provider: string
          raw_data?: Json | null
          recovery_score?: number | null
          rem_sleep_minutes?: number | null
          resting_heart_rate?: number | null
          sleep_duration_minutes?: number | null
          sleep_quality_score?: number | null
          steps?: number | null
          strain_score?: number | null
          stress_score?: number | null
          total_calories?: number | null
          user_id: string
        }
        Update: {
          active_calories?: number | null
          active_minutes?: number | null
          awake_minutes?: number | null
          body_battery?: number | null
          created_at?: string
          data_date?: string
          deep_sleep_minutes?: number | null
          hrv_average?: number | null
          hrv_rmssd?: number | null
          id?: string
          light_sleep_minutes?: number | null
          provider?: string
          raw_data?: Json | null
          recovery_score?: number | null
          rem_sleep_minutes?: number | null
          resting_heart_rate?: number | null
          sleep_duration_minutes?: number | null
          sleep_quality_score?: number | null
          steps?: number | null
          strain_score?: number | null
          stress_score?: number | null
          total_calories?: number | null
          user_id?: string
        }
        Relationships: []
      }
      wearable_tokens: {
        Row: {
          access_token: string | null
          connection_id: string
          created_at: string
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connection_id: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_wearable_token: {
        Args: { p_connection_id: string }
        Returns: {
          access_token: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
      update_wearable_token: {
        Args: {
          p_access_token: string
          p_connection_id: string
          p_refresh_token: string
          p_token_expires_at: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
