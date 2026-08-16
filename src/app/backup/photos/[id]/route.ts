import { createClient } from "@/lib/supabase/server";

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const { id } = await params;
  const { data: image, error } = await supabase.from("wine_images").select("storage_path, original_filename, mime_type, image_type").eq("id", id).single();
  if (error || !image) return new Response("Photograph not found", { status: 404 });

  const { data: file, error: downloadError } = await supabase.storage.from("wine-labels").download(image.storage_path);
  if (downloadError) return new Response("Photograph could not be downloaded", { status: 500 });

  const fallback = `wine-label-${image.image_type}.jpg`;
  return new Response(file, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeFilename(image.original_filename || fallback)}"`,
      "Content-Type": image.mime_type || "image/jpeg",
    },
  });
}
