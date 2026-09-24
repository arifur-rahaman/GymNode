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
      biometric_enrollments: {
        Row: {
          device_user_id: string | null
          enrolled_at: string
          gym_id: string
          id: string
          member_id: string
          method: Database["public"]["Enums"]["biometric_method"]
        }
        Insert: {
          device_user_id?: string | null
          enrolled_at?: string
          gym_id: string
          id?: string
          member_id: string
          method: Database["public"]["Enums"]["biometric_method"]
        }
        Update: {
          device_user_id?: string | null
          enrolled_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          method?: Database["public"]["Enums"]["biometric_method"]
        }
        Relationships: [
          {
            foreignKeyName: "biometric_enrollments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
      lockers: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockers_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string
          assigned_trainer_id: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dob: string | null
          emergency_contact_name: string
          emergency_contact_phone: string | null
          full_name: string
          gender: Database["public"]["Enums"]["member_gender"] | null
          gym_id: string
          id: string
          joined_at: string
          locker_id: string | null
          member_code: string | null
          notes: string
          phone: string
          photo_path: string | null
          source: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
        }
        Insert: {
          address?: string
          assigned_trainer_id?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dob?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["member_gender"] | null
          gym_id: string
          id?: string
          joined_at?: string
          locker_id?: string | null
          member_code?: string | null
          notes?: string
          phone: string
          photo_path?: string | null
          source?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Update: {
          address?: string
          assigned_trainer_id?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dob?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["member_gender"] | null
          gym_id?: string
          id?: string
          joined_at?: string
          locker_id?: string | null
          member_code?: string | null
          notes?: string
          phone?: string
          photo_path?: string | null
          source?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "gym_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_freezes: {
        Row: {
          created_at: string
          created_by: string | null
          days: number
          ended_early_on: string | null
          from_date: string
          gym_id: string
          id: string
          membership_id: string
          reason: string
          to_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days: number
          ended_early_on?: string | null
          from_date: string
          gym_id: string
          id?: string
          membership_id: string
          reason?: string
          to_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: number
          ended_early_on?: string | null
          from_date?: string
          gym_id?: string
          id?: string
          membership_id?: string
          reason?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_freezes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_freezes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "membership_freezes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          admission_fee_paisa: number
          created_at: string
          created_by: string | null
          discount_paisa: number
          end_date: string
          frozen_from: string | null
          frozen_until: string | null
          gym_id: string
          id: string
          member_id: string
          package_id: string
          previous_membership_id: string | null
          price_paisa: number
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          admission_fee_paisa?: number
          created_at?: string
          created_by?: string | null
          discount_paisa?: number
          end_date: string
          frozen_from?: string | null
          frozen_until?: string | null
          gym_id: string
          id?: string
          member_id: string
          package_id: string
          previous_membership_id?: string | null
          price_paisa: number
          start_date: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          admission_fee_paisa?: number
          created_at?: string
          created_by?: string | null
          discount_paisa?: number
          end_date?: string
          frozen_from?: string | null
          frozen_until?: string | null
          gym_id?: string
          id?: string
          member_id?: string
          package_id?: string
          previous_membership_id?: string | null
          price_paisa?: number
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_previous_membership_id_fkey"
            columns: ["previous_membership_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "memberships_previous_membership_id_fkey"
            columns: ["previous_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
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
      payments: {
        Row: {
          amount_paisa: number
          branch_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          gym_id: string
          id: string
          invoice_no: string
          kind: Database["public"]["Enums"]["payment_kind"]
          member_id: string | null
          membership_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          receipt_sent_at: string | null
          receipt_token: string
          received_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_paisa: number
          branch_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          gym_id: string
          id?: string
          invoice_no: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          member_id?: string | null
          membership_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          receipt_sent_at?: string | null
          receipt_token?: string
          received_by?: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_paisa?: number
          branch_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          invoice_no?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          member_id?: string | null
          membership_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          receipt_sent_at?: string | null
          receipt_token?: string
          received_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
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
      member_overview: {
        Row: {
          assigned_trainer_id: string | null
          branch_id: string | null
          created_at: string | null
          days_left: number | null
          display_status: string | null
          due_paisa: number | null
          end_date: string | null
          expiry_sort: number | null
          face_enrolled: boolean | null
          fingerprint_enrolled: boolean | null
          frozen_until: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["member_gender"] | null
          gym_id: string | null
          has_pending_payment: boolean | null
          id: string | null
          is_frozen: boolean | null
          joined_at: string | null
          member_code: string | null
          membership_id: string | null
          package_id: string | null
          package_name: string | null
          phone: string | null
          photo_path: string | null
          source: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["member_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "members_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "gym_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cancel_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
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
      freeze_membership: {
        Args: {
          p_from: string
          p_membership_id: string
          p_reason?: string
          p_until: string
        }
        Returns: undefined
      }
      get_join_gym: {
        Args: { p_slug: string }
        Returns: {
          city: string
          logo_path: string
          name: string
        }[]
      }
      get_receipt: { Args: { p_token: string }; Returns: Json }
      gym_access_state: {
        Args: { p_gym_id: string }
        Returns: Database["public"]["Enums"]["gym_status"]
      }
      gym_money_snapshot: { Args: { p_gym_id: string }; Returns: Json }
      mark_staff_password_reset: {
        Args: { p_gym_user_id: string }
        Returns: undefined
      }
      member_status_counts: {
        Args: { p_gym_id: string }
        Returns: {
          status: string
          total: number
        }[]
      }
      pay_due: {
        Args: {
          p_amount_paisa: number
          p_member_id: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_transaction_id?: string
        }
        Returns: Json
      }
      payment_stats: {
        Args: { p_from: string; p_gym_id: string; p_to: string }
        Returns: Json
      }
      record_payment_and_renew: {
        Args: {
          p_amount_paisa: number
          p_charge_admission?: boolean
          p_discount_paisa?: number
          p_member_id: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_package_id: string
          p_start_date?: string
          p_transaction_id?: string
        }
        Returns: Json
      }
      register_member: {
        Args: {
          p_address?: string
          p_amount_paisa?: number
          p_branch_id: string
          p_discount_paisa?: number
          p_dob?: string
          p_emergency_name?: string
          p_emergency_phone?: string
          p_full_name: string
          p_gender?: Database["public"]["Enums"]["member_gender"]
          p_gym_id: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_package_id?: string
          p_phone: string
          p_trainer_id?: string
          p_transaction_id?: string
        }
        Returns: Json
      }
      set_gym_user_active: {
        Args: { p_active: boolean; p_gym_user_id: string }
        Returns: undefined
      }
      staff_user_for_reset: { Args: { p_gym_user_id: string }; Returns: string }
      submit_self_registration: {
        Args: {
          p_address?: string
          p_dob?: string
          p_emergency_name?: string
          p_emergency_phone?: string
          p_full_name: string
          p_gender?: Database["public"]["Enums"]["member_gender"]
          p_phone: string
          p_slug: string
        }
        Returns: undefined
      }
      unfreeze_membership: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      verify_payment: { Args: { p_payment_id: string }; Returns: undefined }
    }
    Enums: {
      billing_method: "cash" | "bkash" | "nagad" | "rocket" | "card" | "bank"
      biometric_method: "face" | "fingerprint" | "rfid"
      gym_role: "owner" | "manager" | "reception" | "trainer"
      gym_status: "trial" | "active" | "past_due" | "suspended" | "cancelled"
      invoice_status: "unpaid" | "paid" | "void"
      member_gender: "male" | "female" | "other"
      member_status: "pending" | "active" | "inactive"
      membership_status: "active" | "frozen" | "cancelled"
      payment_kind: "membership" | "due" | "sale" | "other"
      payment_method: "cash" | "bkash" | "nagad" | "rocket" | "card"
      payment_status: "pending_verification" | "completed" | "cancelled"
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
      biometric_method: ["face", "fingerprint", "rfid"],
      gym_role: ["owner", "manager", "reception", "trainer"],
      gym_status: ["trial", "active", "past_due", "suspended", "cancelled"],
      invoice_status: ["unpaid", "paid", "void"],
      member_gender: ["male", "female", "other"],
      member_status: ["pending", "active", "inactive"],
      membership_status: ["active", "frozen", "cancelled"],
      payment_kind: ["membership", "due", "sale", "other"],
      payment_method: ["cash", "bkash", "nagad", "rocket", "card"],
      payment_status: ["pending_verification", "completed", "cancelled"],
      platform_role: ["super_admin", "support"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
    },
  },
} as const

