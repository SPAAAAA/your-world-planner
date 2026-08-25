import { supabase } from "./supabaseClient.js";

const BUCKET = "moodboard-images";

export async function listMoodboards(userId) {
  const { data, error } = await supabase
    .from("moodboards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load moodboards", error);
    return [];
  }
  return data;
}

export async function createMoodboard(userId, name) {
  const { data, error } = await supabase
    .from("moodboards")
    .insert({ user_id: userId, name: name || "New moodboard" })
    .select()
    .single();
  if (error) {
    console.error("Failed to create moodboard", error);
    return null;
  }
  return data;
}

export async function renameMoodboard(id, name) {
  const { error } = await supabase
    .from("moodboards")
    .update({ name })
    .eq("id", id);
  if (error) console.error("Failed to rename moodboard", error);
}

export async function deleteMoodboard(id) {
  // Clean up any uploaded images that belong to this board before the
  // board (and its item rows, via cascade) are removed.
  const { data: items } = await supabase
    .from("moodboard_items")
    .select("image_path")
    .eq("moodboard_id", id)
    .not("image_path", "is", null);
  const paths = (items || []).map((i) => i.image_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.from("moodboards").delete().eq("id", id);
  if (error) console.error("Failed to delete moodboard", error);
}

export async function listMoodboardItems(moodboardId) {
  const { data, error } = await supabase
    .from("moodboard_items")
    .select("*")
    .eq("moodboard_id", moodboardId)
    .order("z_index", { ascending: true });
  if (error) {
    console.error("Failed to load moodboard items", error);
    return [];
  }
  // Attach a usable signed URL for each image item.
  for (const item of data) {
    if ((item.item_type || "image") === "image" && item.image_path) {
      item.url = await getImageUrl(item.image_path);
    }
  }
  return data;
}

export async function getImageUrl(path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (error) {
    console.error("Failed to sign image URL", error);
    return "";
  }
  return data.signedUrl;
}

export async function uploadImageAndCreateItem(userId, moodboardId, file, position) {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${moodboardId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });
  if (uploadError) {
    console.error("Failed to upload image", uploadError);
    alert("Image upload failed: " + uploadError.message);
    return null;
  }

  const { data, error } = await supabase
    .from("moodboard_items")
    .insert({
      moodboard_id: moodboardId,
      user_id: userId,
      item_type: "image",
      image_path: path,
      x: position?.x ?? 40,
      y: position?.y ?? 40,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to create moodboard item", error);
    return null;
  }
  data.url = await getImageUrl(path);
  return data;
}

export async function createTextItem(userId, moodboardId, position) {
  const { data, error } = await supabase
    .from("moodboard_items")
    .insert({
      moodboard_id: moodboardId,
      user_id: userId,
      item_type: "text",
      content: "Double-click to edit",
      color: "#211f1c",
      width: 200,
      height: 60,
      x: position?.x ?? 40,
      y: position?.y ?? 40,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to create text item", error);
    return null;
  }
  return data;
}

const SHAPE_DEFAULTS = {
  box: { width: 180, height: 120, color: "#d97757" },
  line: { width: 180, height: 6, color: "#d97757" },
  arrow: { width: 180, height: 10, color: "#d97757" },
};

export async function createShapeItem(userId, moodboardId, shapeType, position) {
  const defaults = SHAPE_DEFAULTS[shapeType] || SHAPE_DEFAULTS.box;
  const { data, error } = await supabase
    .from("moodboard_items")
    .insert({
      moodboard_id: moodboardId,
      user_id: userId,
      item_type: shapeType,
      color: defaults.color,
      width: defaults.width,
      height: defaults.height,
      x: position?.x ?? 40,
      y: position?.y ?? 40,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to create shape item", error);
    return null;
  }
  return data;
}

export async function updateItemContent(id, content) {
  const { error } = await supabase.from("moodboard_items").update({ content }).eq("id", id);
  if (error) console.error("Failed to update item text", error);
}

export async function updateItemColor(id, color) {
  const { error } = await supabase.from("moodboard_items").update({ color }).eq("id", id);
  if (error) console.error("Failed to update item color", error);
}

export async function updateItemPosition(id, { x, y, width, height, rotation, z_index }) {
  const patch = {};
  if (x !== undefined) patch.x = x;
  if (y !== undefined) patch.y = y;
  if (width !== undefined) patch.width = width;
  if (height !== undefined) patch.height = height;
  if (rotation !== undefined) patch.rotation = rotation;
  if (z_index !== undefined) patch.z_index = z_index;
  const { error } = await supabase
    .from("moodboard_items")
    .update(patch)
    .eq("id", id);
  if (error) console.error("Failed to update item position", error);
}

export async function deleteItem(id, imagePath) {
  const { error } = await supabase.from("moodboard_items").delete().eq("id", id);
  if (error) console.error("Failed to delete moodboard item", error);
  if (imagePath) {
    await supabase.storage.from(BUCKET).remove([imagePath]);
  }
}
