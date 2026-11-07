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
      admin_grants: {
        Row: {
          geo_unit_id: string
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          geo_unit_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          geo_unit_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_grants_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          code: string
          created_at: string
          id: string
          passenger_id: string
          phone: string | null
          pickup_note: string | null
          seat_nos: number[]
          status: Database["public"]["Enums"]["booking_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          passenger_id: string
          phone?: string | null
          pickup_note?: string | null
          seat_nos: number[]
          status?: Database["public"]["Enums"]["booking_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          passenger_id?: string
          phone?: string | null
          pickup_note?: string | null
          seat_nos?: number[]
          status?: Database["public"]["Enums"]["booking_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
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
      devices: {
        Row: {
          created_at: string
          expo_token: string
          id: string
          last_seen_at: string
          locale: string | null
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_token: string
          id?: string
          last_seen_at?: string
          locale?: string | null
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expo_token?: string
          id?: string
          last_seen_at?: string
          locale?: string | null
          platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_images: {
        Row: {
          banner_position: number | null
          caption: string | null
          created_at: string
          geo_path: unknown
          geo_unit_id: string
          id: string
          kind: Database["public"]["Enums"]["gallery_kind"]
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["mod_status"]
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          banner_position?: number | null
          caption?: string | null
          created_at?: string
          geo_path: unknown
          geo_unit_id: string
          id?: string
          kind?: Database["public"]["Enums"]["gallery_kind"]
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["mod_status"]
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          banner_position?: number | null
          caption?: string | null
          created_at?: string
          geo_path?: unknown
          geo_unit_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["gallery_kind"]
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["mod_status"]
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
      live_claims: {
        Row: {
          created_at: string
          expires_at: string
          live_id: string
          passenger_id: string
          pickup_note: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          live_id: string
          passenger_id: string
          pickup_note?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          live_id?: string
          passenger_id?: string
          pickup_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_claims_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_claims_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_claims_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rides: {
        Row: {
          contact_phone: string | null
          driver_id: string
          ended_at: string | null
          ended_reason: string | null
          expires_at: string
          fare: number | null
          from_label: string
          id: string
          seats_free: number
          stand_note: string | null
          to_label: string
          vehicle_id: string
          went_live_at: string
        }
        Insert: {
          contact_phone?: string | null
          driver_id: string
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string
          fare?: number | null
          from_label: string
          id?: string
          seats_free: number
          stand_note?: string | null
          to_label: string
          vehicle_id: string
          went_live_at?: string
        }
        Update: {
          contact_phone?: string | null
          driver_id?: string
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string
          fare?: number | null
          from_label?: string
          id?: string
          seats_free?: number
          stand_note?: string | null
          to_label?: string
          vehicle_id?: string
          went_live_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_sources: {
        Row: {
          disclaimer: string | null
          enabled: boolean
          homepage_url: string | null
          key: string
          label: string
        }
        Insert: {
          disclaimer?: string | null
          enabled?: boolean
          homepage_url?: string | null
          key: string
          label: string
        }
        Update: {
          disclaimer?: string | null
          enabled?: boolean
          homepage_url?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["notice_category"]
          created_at: string
          expires_at: string | null
          fetched_at: string | null
          geo_path: unknown
          geo_unit_id: string
          id: string
          is_pinned: boolean
          published_at: string
          published_by: string | null
          pushed_at: string | null
          source: string
          source_ref: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category?: Database["public"]["Enums"]["notice_category"]
          created_at?: string
          expires_at?: string | null
          fetched_at?: string | null
          geo_path: unknown
          geo_unit_id: string
          id?: string
          is_pinned?: boolean
          published_at?: string
          published_by?: string | null
          pushed_at?: string | null
          source?: string
          source_ref?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["notice_category"]
          created_at?: string
          expires_at?: string | null
          fetched_at?: string | null
          geo_path?: unknown
          geo_unit_id?: string
          id?: string
          is_pinned?: boolean
          published_at?: string
          published_by?: string | null
          pushed_at?: string | null
          source?: string
          source_ref?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "notice_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          description: string | null
          geo_path: unknown
          geo_unit_id: string
          id: string
          lat: number | null
          lon: number | null
          name_bft: string | null
          name_en: string
          phone: string | null
          photo_paths: string[]
          point: unknown
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["mod_status"]
          submitted_by: string
          timings: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["place_category"]
          created_at?: string
          description?: string | null
          geo_path: unknown
          geo_unit_id: string
          id?: string
          lat?: number | null
          lon?: number | null
          name_bft?: string | null
          name_en: string
          phone?: string | null
          photo_paths: string[]
          point: unknown
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["mod_status"]
          submitted_by: string
          timings?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string
          description?: string | null
          geo_path?: unknown
          geo_unit_id?: string
          id?: string
          lat?: number | null
          lon?: number | null
          name_bft?: string | null
          name_en?: string
          phone?: string | null
          photo_paths?: string[]
          point?: unknown
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["mod_status"]
          submitted_by?: string
          timings?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          occupation_asked_at: string | null
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
          occupation_asked_at?: string | null
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
          occupation_asked_at?: string | null
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
      trip_seats: {
        Row: {
          booking_id: string | null
          held_by: string | null
          hold_expires_at: string | null
          seat_no: number
          status: Database["public"]["Enums"]["seat_status"]
          trip_id: string
        }
        Insert: {
          booking_id?: string | null
          held_by?: string | null
          hold_expires_at?: string | null
          seat_no: number
          status?: Database["public"]["Enums"]["seat_status"]
          trip_id: string
        }
        Update: {
          booking_id?: string | null
          held_by?: string | null
          hold_expires_at?: string | null
          seat_no?: number
          status?: Database["public"]["Enums"]["seat_status"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_seats_held_by_fkey"
            columns: ["held_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_seats_held_by_fkey"
            columns: ["held_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_seats_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cancel_reason: string | null
          class: Database["public"]["Enums"]["trip_class"]
          contact_phone: string | null
          created_at: string
          departure_date: string
          departure_window: string | null
          driver_id: string
          from_label: string
          id: string
          mode: Database["public"]["Enums"]["trip_mode"]
          pickup_note: string | null
          price_per_seat: number
          seats_total: number
          status: Database["public"]["Enums"]["trip_status"]
          to_label: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cancel_reason?: string | null
          class?: Database["public"]["Enums"]["trip_class"]
          contact_phone?: string | null
          created_at?: string
          departure_date: string
          departure_window?: string | null
          driver_id: string
          from_label: string
          id?: string
          mode?: Database["public"]["Enums"]["trip_mode"]
          pickup_note?: string | null
          price_per_seat: number
          seats_total: number
          status?: Database["public"]["Enums"]["trip_status"]
          to_label: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cancel_reason?: string | null
          class?: Database["public"]["Enums"]["trip_class"]
          contact_phone?: string | null
          created_at?: string
          departure_date?: string
          departure_window?: string | null
          driver_id?: string
          from_label?: string
          id?: string
          mode?: Database["public"]["Enums"]["trip_mode"]
          pickup_note?: string | null
          price_per_seat?: number
          seats_total?: number
          status?: Database["public"]["Enums"]["trip_status"]
          to_label?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          registration: string | null
          seats: number
          type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          registration?: string | null
          seats: number
          type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          registration?: string | null
          seats?: number
          type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      village_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          designation: string
          geo_path: unknown
          geo_unit_id: string
          id: string
          name: string
          phone: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          designation: string
          geo_path: unknown
          geo_unit_id: string
          id?: string
          name: string
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          designation?: string
          geo_path?: unknown
          geo_unit_id?: string
          id?: string
          name?: string
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "village_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_contacts_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
        ]
      }
      village_profiles: {
        Row: {
          cover_path: string | null
          description: string | null
          geo_path: unknown
          geo_unit_id: string
          history_note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cover_path?: string | null
          description?: string | null
          geo_path: unknown
          geo_unit_id: string
          history_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cover_path?: string | null
          description?: string | null
          geo_path?: unknown
          geo_unit_id?: string
          history_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "village_profiles_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: true
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      village_stats: {
        Row: {
          geo_path: unknown
          geo_unit_id: string
          metric_key: string
          source: string
          updated_at: string
          updated_by: string | null
          value: number
          year: number
        }
        Insert: {
          geo_path: unknown
          geo_unit_id: string
          metric_key: string
          source: string
          updated_at?: string
          updated_by?: string | null
          value: number
          year: number
        }
        Update: {
          geo_path?: unknown
          geo_unit_id?: string
          metric_key?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "village_stats_geo_unit_id_fkey"
            columns: ["geo_unit_id"]
            isOneToOne: false
            referencedRelation: "geo_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_stats_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "directory_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_stats_updated_by_fkey"
            columns: ["updated_by"]
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
      book_seats: {
        Args: {
          phone?: string
          pickup_note?: string
          seat_nos: number[]
          trip: string
        }
        Returns: {
          booking_id: string
          code: string
        }[]
      }
      cancel_booking: { Args: { booking: string }; Returns: undefined }
      cancel_trip: {
        Args: { reason: string; trip: string }
        Returns: undefined
      }
      claim_live_seat: {
        Args: { live: string; pickup_note?: string }
        Returns: undefined
      }
      confirm_booking: { Args: { booking: string }; Returns: undefined }
      create_trip: {
        Args: {
          contact_phone?: string
          departure_date: string
          departure_window?: string
          from_label: string
          mode?: Database["public"]["Enums"]["trip_mode"]
          pickup_note?: string
          price_per_seat: number
          seats_total: number
          to_label: string
          vehicle: string
        }
        Returns: string
      }
      delete_village_contact: { Args: { p_id: string }; Returns: undefined }
      delete_village_stat: {
        Args: { geo_unit: string; metric_key: string; year: number }
        Returns: undefined
      }
      end_live: { Args: { live: string; reason?: string }; Returns: undefined }
      forget_device_token: { Args: { p_token: string }; Returns: undefined }
      forget_my_devices: { Args: { token?: string }; Returns: undefined }
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
      geo_nearest: {
        Args: { lat: number; lon: number; max_km?: number; village_km?: number }
        Returns: {
          distance_m: number
          has_children: boolean
          id: string
          name_bft: string
          name_en: string
          name_ur: string
          slug: string
          type: Database["public"]["Enums"]["geo_type"]
        }[]
      }
      get_member_contact: {
        Args: { member_id: string }
        Returns: {
          phone: string
          phone_verified: boolean
        }[]
      }
      go_live: {
        Args: {
          contact_phone?: string
          fare?: number
          from_label: string
          seats_free: number
          stand_note?: string
          to_label: string
          vehicle: string
        }
        Returns: string
      }
      has_role: {
        Args: { r: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      hold_seats: {
        Args: { seat_nos: number[]; trip: string }
        Returns: number[]
      }
      import_official_notice: {
        Args: {
          p_category?: Database["public"]["Enums"]["notice_category"]
          p_expires_at?: string
          p_geo_path: string
          p_published_at?: string
          p_source: string
          p_source_ref: string
          p_source_url: string
          p_title: string
        }
        Returns: string
      }
      is_phone_verified: { Args: never; Returns: boolean }
      live_board: {
        Args: never
        Returns: {
          claimed: number
          contact: string
          driver_id: string
          driver_name: string
          expires_at: string
          fare: number
          from_label: string
          id: string
          registration: string
          seats_free: number
          stand_note: string
          to_label: string
          vehicle: Database["public"]["Enums"]["vehicle_type"]
          went_live_at: string
        }[]
      }
      my_admin_units: {
        Args: never
        Returns: {
          id: string
          name_en: string
          role: Database["public"]["Enums"]["user_role"]
          type: Database["public"]["Enums"]["geo_type"]
        }[]
      }
      my_village: { Args: never; Returns: string }
      my_village_path: { Args: never; Returns: unknown }
      my_weather_point: {
        Args: never
        Returns: {
          exact: boolean
          lat: number
          lon: number
          place: string
        }[]
      }
      notice_push_queue: {
        Args: { max_age_days?: number }
        Returns: {
          category: Database["public"]["Enums"]["notice_category"]
          expo_token: string
          locale: string
          notice_id: string
          title: string
          user_id: string
        }[]
      }
      places_near: {
        Args: {
          category: Database["public"]["Enums"]["place_category"]
          lat: number
          lon: number
          radius_m?: number
        }
        Returns: {
          distance_m: number
          id: string
          name_en: string
        }[]
      }
      publish_notice: {
        Args: {
          body: string
          category?: Database["public"]["Enums"]["notice_category"]
          expires_at?: string
          geo_unit: string
          is_pinned?: boolean
          title: string
        }
        Returns: string
      }
      publish_village_contact: {
        Args: {
          designation: string
          geo_unit: string
          name: string
          phone?: string
          sort_order?: number
        }
        Returns: string
      }
      record_notice_push: { Args: { p_notice_id: string }; Returns: number }
      register_my_device: {
        Args: { locale?: string; platform?: string; token: string }
        Returns: undefined
      }
      release_live_claim: { Args: { live: string }; Returns: undefined }
      release_my_holds: { Args: { trip: string }; Returns: undefined }
      review_gallery_image: {
        Args: { approve: boolean; image_id: string; reason?: string }
        Returns: undefined
      }
      review_place: {
        Args: { approve: boolean; place_id: string; reason?: string }
        Returns: undefined
      }
      ride_hold_minutes: { Args: never; Returns: string }
      save_vehicle: {
        Args: {
          registration?: string
          seats: number
          type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_id?: string
        }
        Returns: string
      }
      set_gallery_kind: {
        Args: {
          image_id: string
          new_kind: Database["public"]["Enums"]["gallery_kind"]
        }
        Returns: undefined
      }
      set_live_seats: {
        Args: { live: string; seats_free: number }
        Returns: undefined
      }
      set_my_occupation: { Args: { p_occupation?: string }; Returns: undefined }
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
      set_village_banner: {
        Args: { geo_unit: string; image_ids: string[] }
        Returns: undefined
      }
      set_village_profile: {
        Args: {
          cover_path?: string
          description?: string
          geo_unit: string
          history_note?: string
        }
        Returns: undefined
      }
      set_village_stat: {
        Args: {
          geo_unit: string
          metric_key: string
          source: string
          value: number
          year: number
        }
        Returns: undefined
      }
      shares_my_village: { Args: { uid: string }; Returns: boolean }
      submit_gallery_image: {
        Args: { caption?: string; geo_unit: string; storage_path: string }
        Returns: string
      }
      submit_place: {
        Args: {
          category: Database["public"]["Enums"]["place_category"]
          description?: string
          duplicate_acknowledged?: boolean
          geo_unit: string
          lat: number
          lon: number
          name_bft?: string
          name_en: string
          phone?: string
          photo_paths: string[]
          timings?: string
        }
        Returns: string
      }
      update_village_contact: {
        Args: {
          p_designation: string
          p_id: string
          p_name: string
          p_phone?: string
          p_sort_order?: number
        }
        Returns: undefined
      }
      withdraw_gallery_image: { Args: { image_id: string }; Returns: string }
      withdraw_place: { Args: { place_id: string }; Returns: string[] }
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

