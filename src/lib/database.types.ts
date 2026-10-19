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
      contact_access_log: {
        Row: {
          accessed_at: string
          id: number
          subject_id: string
          viewer_id: string
        }
        Insert: {
          accessed_at?: string
          id?: number
          subject_id: string
          viewer_id: string
        }
        Update: {
          accessed_at?: string
          id?: number
          subject_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_access_log_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_access_log_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_access_log_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_access_log_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_units: {
        Row: {
          centroid: unknown
          created_at: string
          id: string
          lgd_code: string | null
          name_bft: string | null
          name_en: string
          name_ur: string | null
          parent_id: string | null
          path: unknown
          slug: string
          type: Database["public"]["Enums"]["geo_type"]
        }
        Insert: {
          centroid?: unknown
          created_at?: string
          id?: string
          lgd_code?: string | null
          name_bft?: string | null
          name_en: string
          name_ur?: string | null
          parent_id?: string | null
          path: unknown
          slug: string
          type: Database["public"]["Enums"]["geo_type"]
        }
        Update: {
          centroid?: unknown
          created_at?: string
          id?: string
          lgd_code?: string | null
          name_bft?: string | null
          name_en?: string
          name_ur?: string | null
          parent_id?: string | null
          path?: unknown
          slug?: string
          type?: Database["public"]["Enums"]["geo_type"]
        }
        Relationships: [
          {
            foreignKeyName: "geo_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          in_directory: boolean
          show_avatar: Database["public"]["Enums"]["visibility"]
          show_occupation: Database["public"]["Enums"]["visibility"]
          show_phone: Database["public"]["Enums"]["visibility"]
          user_id: string
        }
        Insert: {
          in_directory?: boolean
          show_avatar?: Database["public"]["Enums"]["visibility"]
          show_occupation?: Database["public"]["Enums"]["visibility"]
          show_phone?: Database["public"]["Enums"]["visibility"]
          user_id: string
        }
        Update: {
          in_directory?: boolean
          show_avatar?: Database["public"]["Enums"]["visibility"]
          show_occupation?: Database["public"]["Enums"]["visibility"]
          show_phone?: Database["public"]["Enums"]["visibility"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          phone: string | null
          phone_verified: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          occupation: string | null
          panchayat_id: string | null
          privacy_reviewed_at: string | null
          roles: Database["public"]["Enums"]["user_role"][]
          updated_at: string
          village_changed_at: string | null
          village_id: string | null
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          occupation?: string | null
          panchayat_id?: string | null
          privacy_reviewed_at?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          updated_at?: string
          village_changed_at?: string | null
          village_id?: string | null
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          occupation?: string | null
          panchayat_id?: string | null
          privacy_reviewed_at?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          updated_at?: string
          village_changed_at?: string | null
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_panchayat_id_fkey"
            columns: ["panchayat_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
        ]
      }
      village_change_log: {
        Row: {
          changed_at: string
          from_village: string | null
          id: number
          to_village: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          from_village?: string | null
          id?: number
          to_village?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          from_village?: string | null
          id?: number
          to_village?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "village_change_log_from_village_fkey"
            columns: ["from_village"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_change_log_to_village_fkey"
            columns: ["to_village"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_change_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_change_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      directory_members: {
        Row: {
          avatar_path: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          occupation: string | null
          panchayat_id: string | null
          phone_available: boolean | null
          roles: Database["public"]["Enums"]["user_role"][] | null
          village_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_panchayat_id_fkey"
            columns: ["panchayat_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admins_geo: { Args: { unit: string }; Returns: boolean }
      geo_children: {
        Args: { parent?: string }
        Returns: {
          has_children: boolean
          id: string
          name_bft: string
          name_en: string
          name_ur: string
          slug: string
          type: Database["public"]["Enums"]["geo_type"]
        }[]
      }
      has_role: {
        Args: { r: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_phone_verified: { Args: never; Returns: boolean }
      my_village: { Args: never; Returns: string }
      my_weather_point: {
        Args: never
        Returns: {
          exact: boolean
          lat: number
          lon: number
          place: string
        }[]
      }
      set_my_privacy: {
        Args: {
          in_directory: boolean
          show_avatar: Database["public"]["Enums"]["visibility"]
          show_occupation: Database["public"]["Enums"]["visibility"]
          show_phone: Database["public"]["Enums"]["visibility"]
        }
        Returns: undefined
      }
      set_my_village: {
        Args: { panchayat?: string; village: string }
        Returns: undefined
      }
      shares_my_village: { Args: { uid: string }; Returns: boolean }
    }
    Enums: {
      booking_status:
        | "requested"
        | "confirmed"
        | "cancelled_by_passenger"
        | "cancelled_by_driver"
        | "no_show"
        | "completed"
      event_category:
        | "religious_islamic"
        | "religious_buddhist"
        | "cultural_local"
        | "national"
        | "civic_local"
      gallery_kind: "place" | "festival" | "general"
      geo_type:
        | "ut"
        | "district"
        | "block"
        | "village"
        | "town"
        | "panchayat"
        | "municipality"
      issue_status:
        | "submitted"
        | "acknowledged"
        | "forwarded"
        | "in_progress"
        | "resolved"
        | "rejected"
        | "reopened"
      mod_status: "pending" | "approved" | "rejected"
      notice_category: "vacation" | "order" | "event" | "alert" | "general"
      place_category:
        | "school"
        | "hospital"
        | "mosque"
        | "imambargah"
        | "khanqah"
        | "government_office"
        | "bank_atm"
        | "water_point"
        | "tourist"
        | "market"
        | "sports"
        | "other"
      seat_kind: "driver" | "window" | "middle" | "aisle" | "folding"
      seat_status: "free" | "held" | "booked" | "blocked"
      trip_class: "long" | "short"
      trip_mode: "shared" | "charter"
      trip_status:
        | "open"
        | "filling"
        | "confirmed"
        | "departed"
        | "completed"
        | "cancelled"
      user_role:
        | "member"
        | "driver"
        | "panchayat_admin"
        | "dept_liaison"
        | "district_admin"
        | "super_admin"
      vehicle_type:
        | "xylo"
        | "innova"
        | "tempo_traveller"
        | "bus_large"
        | "omni"
        | "eeco"
        | "bus_small"
        | "other"
      visibility: "villagers" | "officials" | "nobody"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: [
        "requested",
        "confirmed",
        "cancelled_by_passenger",
        "cancelled_by_driver",
        "no_show",
        "completed",
      ],
      event_category: [
        "religious_islamic",
        "religious_buddhist",
        "cultural_local",
        "national",
        "civic_local",
      ],
      gallery_kind: ["place", "festival", "general"],
      geo_type: [
        "ut",
        "district",
        "block",
        "village",
        "town",
        "panchayat",
        "municipality",
      ],
      issue_status: [
        "submitted",
        "acknowledged",
        "forwarded",
        "in_progress",
        "resolved",
        "rejected",
        "reopened",
      ],
      mod_status: ["pending", "approved", "rejected"],
      notice_category: ["vacation", "order", "event", "alert", "general"],
      place_category: [
        "school",
        "hospital",
        "mosque",
        "imambargah",
        "khanqah",
        "government_office",
        "bank_atm",
        "water_point",
        "tourist",
        "market",
        "sports",
        "other",
      ],
      seat_kind: ["driver", "window", "middle", "aisle", "folding"],
      seat_status: ["free", "held", "booked", "blocked"],
      trip_class: ["long", "short"],
      trip_mode: ["shared", "charter"],
      trip_status: [
        "open",
        "filling",
        "confirmed",
        "departed",
        "completed",
        "cancelled",
      ],
      user_role: [
        "member",
        "driver",
        "panchayat_admin",
        "dept_liaison",
        "district_admin",
        "super_admin",
      ],
      vehicle_type: [
        "xylo",
        "innova",
        "tempo_traveller",
        "bus_large",
        "omni",
        "eeco",
        "bus_small",
        "other",
      ],
      visibility: ["villagers", "officials", "nobody"],
    },
  },
} as const

