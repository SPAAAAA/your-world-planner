import { supabase } from "./supabaseClient.js";

export async function listClients(userId) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("client_number", { ascending: true });
  if (error) {
    console.error("Failed to load clients", error);
    return [];
  }
  return data;
}

export async function createClient(userId, firstName, lastName) {
  // Figure out the next per-user sequential id (1, 2, 3, …).
  const { data: existing, error: lookupError } = await supabase
    .from("clients")
    .select("client_number")
    .eq("user_id", userId)
    .order("client_number", { ascending: false })
    .limit(1);
  if (lookupError) {
    console.error("Failed to determine next client id", lookupError);
  }
  const nextNumber = existing && existing.length ? existing[0].client_number + 1 : 1;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      client_number: nextNumber,
      first_name: firstName,
      last_name: lastName,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to create client", error);
    return null;
  }
  return data;
}

const EDITABLE_FIELDS = ["email", "phone", "address", "city", "state", "postal_code"];

export async function updateClientField(id, field, value) {
  if (!EDITABLE_FIELDS.includes(field)) {
    console.error("Refusing to update unknown client field:", field);
    return;
  }
  const { error } = await supabase
    .from("clients")
    .update({ [field]: value })
    .eq("id", id);
  if (error) console.error("Failed to update client", error);
}

export async function deleteClient(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) console.error("Failed to delete client", error);
}

export async function listClientUpdates(clientId) {
  const { data, error } = await supabase
    .from("client_updates")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load client updates", error);
    return [];
  }
  return data;
}

export async function addClientUpdate(userId, clientId, body) {
  const { data, error } = await supabase
    .from("client_updates")
    .insert({ user_id: userId, client_id: clientId, body })
    .select()
    .single();
  if (error) {
    console.error("Failed to add client update", error);
    return null;
  }
  return data;
}
