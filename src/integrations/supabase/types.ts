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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      answer_disputes: {
        Row: {
          category: string
          created_at: string
          room_id: string
          round_number: number
          target_player_id: string
          voter_player_id: string
        }
        Insert: {
          category: string
          created_at?: string
          room_id: string
          round_number: number
          target_player_id: string
          voter_player_id: string
        }
        Update: {
          category?: string
          created_at?: string
          room_id?: string
          round_number?: number
          target_player_id?: string
          voter_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_disputes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_disputes_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_disputes_voter_player_id_fkey"
            columns: ["voter_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_secrets: {
        Row: {
          player_id: string
          secret: string
        }
        Insert: {
          player_id: string
          secret?: string
        }
        Update: {
          player_id?: string
          secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_secrets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          id: string
          joined_at: string
          last_round_points: number
          name: string
          room_id: string
          score: number
        }
        Insert: {
          id?: string
          joined_at?: string
          last_round_points?: number
          name: string
          room_id: string
          score?: number
        }
        Update: {
          id?: string
          joined_at?: string
          last_round_points?: number
          name?: string
          room_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          categories: Json
          code: string
          created_at: string
          current_letter: string | null
          game_start_round: number
          host_player_id: string | null
          id: string
          letters: string[]
          max_rounds: number | null
          round_number: number
          round_seconds: number | null
          round_started_at: string | null
          status: string
          stopped_at: string | null
          stopped_by: string | null
          updated_at: string
          used_letters: string[]
        }
        Insert: {
          categories?: Json
          code: string
          created_at?: string
          current_letter?: string | null
          game_start_round?: number
          host_player_id?: string | null
          id?: string
          letters?: string[]
          max_rounds?: number | null
          round_number?: number
          round_seconds?: number | null
          round_started_at?: string | null
          status?: string
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string
          used_letters?: string[]
        }
        Update: {
          categories?: Json
          code?: string
          created_at?: string
          current_letter?: string | null
          game_start_round?: number
          host_player_id?: string | null
          id?: string
          letters?: string[]
          max_rounds?: number | null
          round_number?: number
          round_seconds?: number | null
          round_started_at?: string | null
          status?: string
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string
          used_letters?: string[]
        }
        Relationships: []
      }
      round_answers: {
        Row: {
          answers: Json
          id: string
          kept: string[]
          player_id: string
          points: Json
          rejected: string[]
          room_id: string
          round_number: number
          total: number
          updated_at: string
        }
        Insert: {
          answers?: Json
          id?: string
          kept?: string[]
          player_id: string
          points?: Json
          rejected?: string[]
          room_id: string
          round_number: number
          total?: number
          updated_at?: string
        }
        Update: {
          answers?: Json
          id?: string
          kept?: string[]
          player_id?: string
          points?: Json
          rejected?: string[]
          room_id?: string
          round_number?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_stop: {
        Args: {
          p_answers: Json
          p_player_id: string
          p_round: number
          p_secret: string
        }
        Returns: undefined
      }
      check_player: {
        Args: { p_player_id: string; p_secret: string }
        Returns: boolean
      }
      confirm_round: {
        Args: { p_player_id: string; p_secret: string }
        Returns: undefined
      }
      create_room: { Args: { p_name: string }; Returns: Json }
      end_game: {
        Args: { p_player_id: string; p_secret: string }
        Returns: undefined
      }
      finish_round: {
        Args: { p_player_id: string; p_secret: string }
        Returns: undefined
      }
      join_room: { Args: { p_code: string; p_name: string }; Returns: Json }
      leave_room: {
        Args: { p_player_id: string; p_secret: string }
        Returns: undefined
      }
      reset_room: {
        Args: { p_player_id: string; p_secret: string }
        Returns: undefined
      }
      rule_answer: {
        Args: {
          p_category: string
          p_player_id: string
          p_secret: string
          p_target: string
          p_verdict: string
        }
        Returns: undefined
      }
      save_answers: {
        Args: {
          p_answers: Json
          p_player_id: string
          p_round: number
          p_secret: string
        }
        Returns: undefined
      }
      start_round: {
        Args: { p_player_id: string; p_secret: string }
        Returns: undefined
      }
      stop_categories: { Args: never; Returns: string[] }
      stop_clean_answers:
        | { Args: { p_answers: Json }; Returns: Json }
        | { Args: { p_answers: Json; p_keys: string[] }; Returns: Json }
      stop_normalize: { Args: { t: string }; Returns: string }
      stop_room_categories: { Args: { p_room_id: string }; Returns: string[] }
      stop_score_round: { Args: { p_room_id: string }; Returns: undefined }
      stop_verify_player: {
        Args: { p_player_id: string; p_secret: string }
        Returns: {
          id: string
          joined_at: string
          last_round_points: number
          name: string
          room_id: string
          score: number
        }
        SetofOptions: {
          from: "*"
          to: "room_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stop_votes_needed: { Args: { p_players: number }; Returns: number }
      time_up_round: {
        Args: { p_player_id: string; p_round: number; p_secret: string }
        Returns: undefined
      }
      toggle_dispute: {
        Args: {
          p_category: string
          p_player_id: string
          p_secret: string
          p_target: string
        }
        Returns: undefined
      }
      update_room_settings: {
        Args: {
          p_categories: Json
          p_letters: string[]
          p_max_rounds: number
          p_player_id: string
          p_round_seconds: number
          p_secret: string
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
  public: {
    Enums: {},
  },
} as const
