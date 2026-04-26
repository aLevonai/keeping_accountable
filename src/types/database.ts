export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Cadence = "weekly" | "monthly" | "yearly" | "once";
export type MediaType = "photo" | "video";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          push_token: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          push_token?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          push_token?: string | null;
        };
      };
      couples: {
        Row: {
          id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      couple_members: {
        Row: {
          couple_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          couple_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: Record<string, never>;
      };
      couple_invites: {
        Row: {
          id: string;
          couple_id: string;
          inviter_id: string;
          code: string;
          accepted_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          inviter_id: string;
          code: string;
          accepted_at?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          accepted_at?: string | null;
        };
      };
      goals: {
        Row: {
          id: string;
          couple_id: string;
          owner_id: string | null;
          is_joint: boolean;
          title: string;
          description: string | null;
          cadence: Cadence;
          cadence_target: number;
          emoji: string;
          color: string;
          starts_on: string;
          ends_on: string | null;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          owner_id?: string | null;
          is_joint?: boolean;
          title: string;
          description?: string | null;
          cadence: Cadence;
          cadence_target?: number;
          emoji: string;
          color: string;
          starts_on?: string;
          ends_on?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          cadence?: Cadence;
          cadence_target?: number;
          is_joint?: boolean;
          emoji?: string;
          color?: string;
          ends_on?: string | null;
          archived_at?: string | null;
        };
      };
      completions: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          note: string | null;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          note?: string | null;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
      };
      completion_media: {
        Row: {
          id: string;
          completion_id: string;
          storage_path: string;
          media_type: MediaType;
          width: number | null;
          height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          completion_id: string;
          storage_path: string;
          media_type?: MediaType;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Update: { storage_path?: string; };
      };
      dreams: {
        Row: {
          id: string;
          couple_id: string;
          owner_id: string | null;
          title: string;
          note: string | null;
          emoji: string;
          achieved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          owner_id?: string | null;
          title: string;
          note?: string | null;
          emoji?: string;
          achieved_at?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          note?: string | null;
          emoji?: string;
          achieved_at?: string | null;
        };
      };
    };
  };
}

// Convenience row types
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type CoupleRow = Database["public"]["Tables"]["couples"]["Row"];
export type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
export type CompletionRow = Database["public"]["Tables"]["completions"]["Row"];
export type CompletionMediaRow = Database["public"]["Tables"]["completion_media"]["Row"];
export type DreamRow = Database["public"]["Tables"]["dreams"]["Row"];

export type GoalWithCompletions = GoalRow & {
  completions: CompletionRow[];
};
