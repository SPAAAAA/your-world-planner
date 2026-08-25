// ============================================================
// Your World Planner — configuration
//
// Fill these in after you create your Supabase project:
//   Supabase dashboard → Project Settings → API
//     - "Project URL"      -> SUPABASE_URL
//     - "anon public" key  -> SUPABASE_ANON_KEY
//
// Both values are safe to expose in client-side code — they are
// public by design. Your data is protected by Row Level Security
// policies (see sql/schema.sql), not by keeping these secret.
// ============================================================

export const SUPABASE_URL = "https://pnaodvvwkjkhhjtanhtf.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_WPuNA-CYtHk2CSv_eWIpNA_03J58K7X";

// Extra Google OAuth scope so we can read the user's Google Calendar.
// Supabase will ask Google for this scope during the login redirect.
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
