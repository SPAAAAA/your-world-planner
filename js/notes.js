import { supabase } from "./supabaseClient.js";

export async function listNotes(userId) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Failed to load notes", error);
    return [];
  }
  return data;
}

export async function createNote(userId) {
  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: userId, title: "Untitled note", content: "" })
    .select()
    .single();
  if (error) {
    console.error("Failed to create note", error);
    return null;
  }
  return data;
}

export async function saveNote(id, fields) {
  const { error } = await supabase
    .from("notes")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("Failed to save note", error);
}

export async function deleteNote(id) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) console.error("Failed to delete note", error);
}

export async function togglePin(id, pinned) {
  const { error } = await supabase
    .from("notes")
    .update({ pinned })
    .eq("id", id);
  if (error) console.error("Failed to toggle pin", error);
}
