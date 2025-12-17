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
          activity_level: string | null
          age: number | null
          allergies: string[] | null
          carbs_grams: number | null
          coaching_tone: string | null
          conditions: string[] | null
          created_at: string
          current_phase: string | null
          cycle_regularity: string | null
          cycle_symptoms: string[] | null
          diet_type: string | null
          fats_grams: number | null
          focus_points: string[] | null
          food_dislikes: string | null
          height_cm: number | null
          height_feet: number | null
          height_inches: number | null
          id: string
          magnesium_mg: number | null
          meals_per_day: string | null
          occupation: string | null
          potassium_mg: number | null
          primary_goal: string | null
          protein_grams: number | null
          secondary_goals: string[] | null
          sex: string | null
          sleep_hours: string | null
          sodium_mg: number | null
          stress_level: string | null
          target_calories: number | null
          tdee: number | null
          training_days: string | null
          training_intensity: string | null
          unit_system: string | null
          updated_at: string
          user_id: string
          water_liters: number | null
          weight: number | null
          work_hours: string | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          carbs_grams?: number | null
          coaching_tone?: string | null
          conditions?: string[] | null
          created_at?: string
          current_phase?: string | null
          cycle_regularity?: string | null
          cycle_symptoms?: string[] | null
          diet_type?: string | null
          fats_grams?: number | null
          focus_points?: string[] | null
          food_dislikes?: string | null
          height_cm?: number | null
          height_feet?: number | null
          height_inches?: number | null
          id?: string
          magnesium_mg?: number | null
          meals_per_day?: string | null
          occupation?: string | null
          potassium_mg?: number | null
          primary_goal?: string | null
          protein_grams?: number | null
          secondary_goals?: string[] | null
          sex?: string | null
          sleep_hours?: string | null
          sodium_mg?: number | null
          stress_level?: string | null
          target_calories?: number | null
          tdee?: number | null
          training_days?: string | null
          training_intensity?: string | null
          unit_system?: string | null
          updated_at?: string
          user_id: string
          water_liters?: number | null
          weight?: number | null
          work_hours?: string | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          carbs_grams?: number | null
          coaching_tone?: string | null
          conditions?: string[] | null
          created_at?: string
          current_phase?: string | null
          cycle_regularity?: string | null
          cycle_symptoms?: string[] | null
          diet_type?: string | null
          fats_grams?: number | null
          focus_points?: string[] | null
          food_dislikes?: string | null
          height_cm?: number | null
          height_feet?: number | null
          height_inches?: number | null
          id?: string
          magnesium_mg?: number | null
          meals_per_day?: string | null
          occupation?: string | null
          potassium_mg?: number | null
          primary_goal?: string | null
          protein_grams?: number | null
          secondary_goals?: string[] | null
          sex?: string | null
          sleep_hours?: string | null
          sodium_mg?: number | null
          stress_level?: string | null
          target_calories?: number | null
          tdee?: number | null
          training_days?: string | null
          training_intensity?: string | null
          unit_system?: string | null
          updated_at?: string
          user_id?: string
          water_liters?: number | null
          weight?: number | null
          work_hours?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
