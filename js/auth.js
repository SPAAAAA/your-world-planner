import { supabase } from "./supabaseClient.js";
import { GOOGLE_CALENDAR_SCOPE } from "./config.js";

export async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: GOOGLE_CALENDAR_SCOPE,
      // access_type + prompt=consent ask Google for a refresh token and
      // force the consent screen so the calendar scope is always granted,
      // not just the basic profile scope.
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) {
    console.error("Google sign-in failed", error);
    alert("Sign-in failed: " + error.message);
  }
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

// The Google access token Supabase captured during login (used to call
// the Calendar API directly from the browser). Note: this token expires
// after roughly an hour and Supabase does not silently refresh Google's
// token for you — if calendar events stop loading, signing out and back
// in refreshes it.
export async function getGoogleAccessToken() {
  const session = await getSession();
  return session?.provider_token || null;
}
