export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_kind: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          gym_id: string | null
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_kind: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          gym_id?: string | null
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          gym_id?: string | null
          id?: never
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_counters: {
        Row: {
          gym_id: string
          kind: string
          next_value: number
          year: number
        }
        Insert: {
          gym_id: string
          kind: string
          next_value?: number
          year?: number
        }
        Update: {
          gym_id?: string
          kind?: string
          next_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_counters_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          gym_id: string
          id: string
          plan_id: string | null
          price_paisa: number | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gym_id: string
          id?: string
          plan_id?: string | null
          price_paisa?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gym_id?: string
          id?: string
          plan_id?: string | null
          price_paisa?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_users: {
        Row: {
          branch_ids: string[] | null
          created_at: string
          display_name: string
          gym_id: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["gym_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_ids?: string[] | null
          created_at?: string
          display_name?: string
          gym_id: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["gym_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_ids?: string[] | null
          created_at?: string
          display_name?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["gym_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_users_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string
          city: string
          code_prefix: string
          created_at: string
          id: string
          logo_path: string | null
          name: string
          onboarding_completed_at: string | null
          owner_user_id: string
          phone: string | null
          plan_id: string | null
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["gym_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          code_prefix: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          onboarding_completed_at?: string | null
          owner_user_id: string
          phone?: string | null
          plan_id?: string | null
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["gym_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          code_prefix?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          onboarding_completed_at?: string | null
          owner_user_id?: string
          phone?: string | null
          plan_id?: string | null
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["gym_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gyms_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          admission_fee_paisa: number
          created_at: string
          deleted_at: string | null
          duration_days: number
          gym_id: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          price_paisa: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          admission_fee_paisa?: number
          created_at?: string
          deleted_at?: string | null
          duration_days: number
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          price_paisa: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          admission_fee_paisa?: number
          created_at?: string
          deleted_at?: string | null
          duration_days?: number
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          price_paisa?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_branches: number | null
          max_devices: number | null
          max_members: number | null
          name: string
          name_en: string
          price_paisa: number | null
          sms_quota: number | null
          sort_order: number
          updated_at: string
          whatsapp_quota: number | null
        }
        Insert: {
          billing_period?: string
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_devices?: number | null
          max_members?: number | null
          name: string
          name_en: string
          price_paisa?: number | null
          sms_quota?: number | null
          sort_order?: number
          updated_at?: string
          whatsapp_quota?: number | null
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_devices?: number | null
          max_members?: number | null
          name?: string
          name_en?: string
          price_paisa?: number | null
          sms_quota?: number | null
          sort_order?: number
          updated_at?: string
          whatsapp_quota?: number | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          last_gym_id: string | null
          locale: string
          must_change_password: boolean
          phone: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          last_gym_id?: string | null
          locale?: string
          must_change_password?: boolean
          phone?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          last_gym_id?: string | null
          locale?: string
          must_change_password?: boolean
          phone?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount_paisa: number
          created_at: string
          due_date: string
          gym_id: string
          id: string
          invoice_no: string
          method: Database["public"]["Enums"]["billing_method"] | null
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paisa: number
          created_at?: string
          due_date: string
          gym_id: string
          id?: string
          invoice_no: string
          method?: Database["public"]["Enums"]["billing_method"] | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paisa?: number
          created_at?: string
          due_date?: string
          gym_id?: string
          id?: string
          invoice_no?: string
          method?: Database["public"]["Enums"]["billing_method"] | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "gym_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          expires_at: string
          gym_id: string
          id: string
          reason: string
          started_at: string
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          expires_at: string
          gym_id: string
          id?: string
          reason: string
          started_at?: string
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          expires_at?: string
          gym_id?: string
          id?: string
          reason?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_gym_user: {
        Args: {
          p_branch_ids?: string[]
          p_display_name: string
          p_gym_id: string
          p_phone: string
          p_role: Database["public"]["Enums"]["gym_role"]
          p_user_id: string
        }
        Returns: string
      }
      can_manage_staff_role: {
        Args: {
          p_gym_id: string
          p_role: Database["public"]["Enums"]["gym_role"]
        }
        Returns: boolean
      }
      clear_password_change_flag: { Args: never; Returns: undefined }
      create_gym_with_owner: {
        Args: {
          p_address: string
          p_branch_address?: string
          p_branch_name: string
          p_city: string
          p_code_prefix: string
          p_name: string
          p_phone: string
        }
        Returns: string
      }
      dhaka_today: { Args: never; Returns: string }
      gym_access_state: {
        Args: { p_gym_id: string }
        Returns: Database["public"]["Enums"]["gym_status"]
      }
      mark_staff_password_reset: {
        Args: { p_gym_user_id: string }
        Returns: undefined
      }
      set_gym_user_active: {
        Args: { p_active: boolean; p_gym_user_id: string }
        Returns: undefined
      }
      staff_user_for_reset: { Args: { p_gym_user_id: string }; Returns: string }
    }
    Enums: {
      billing_method: "cash" | "bkash" | "nagad" | "rocket" | "card" | "bank"
      gym_role: "owner" | "manager" | "reception" | "trainer"
      gym_status: "trial" | "active" | "past_due" | "suspended" | "cancelled"
      invoice_status: "unpaid" | "paid" | "void"
      platform_role: "super_admin" | "support"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      billing_method: ["cash", "bkash", "nagad", "rocket", "card", "bank"],
      gym_role: ["owner", "manager", "reception", "trainer"],
      gym_status: ["trial", "active", "past_due", "suspended", "cancelled"],
      invoice_status: ["unpaid", "paid", "void"],
      platform_role: ["super_admin", "support"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
    },
  },
} as const

