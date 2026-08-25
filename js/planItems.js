import { supabase } from "./supabaseClient.js";

function dateKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function getPlanItems(userId, date) {
  const { data, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_date", dateKey(date))
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load plan items", error);
    return [];
  }
  return data;
}

export async function addPlanItem(userId, date, title) {
  const { data, error } = await supabase
    .from("plan_items")
    .insert({ user_id: userId, plan_date: dateKey(date), title })
    .select()
    .single();
  if (error) {
    console.error("Failed to add plan item", error);
    return null;
  }
  return data;
}

export async function togglePlanItem(id, done) {
  const { error } = await supabase
    .from("plan_items")
    .update({ done })
    .eq("id", id);
  if (error) console.error("Failed to update plan item", error);
}

export async function deletePlanItem(id) {
  const { error } = await supabase.from("plan_items").delete().eq("id", id);
  if (error) console.error("Failed to delete plan item", error);
}
