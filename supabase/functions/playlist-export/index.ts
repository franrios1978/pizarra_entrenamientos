import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PlaylistEntry = {
  submission_id: string;
  athlete_id: string;
  position: number;
  text: string;
  created_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

function buildText(entries: PlaylistEntry[], names: Map<string, string>) {
  const groups = new Map<string, PlaylistEntry[]>();

  for (const entry of entries) {
    const group = groups.get(entry.submission_id);
    if (group) group.push(entry);
    else groups.set(entry.submission_id, [entry]);
  }

  const blocks = [...groups.values()].map((rows) => {
    const first = rows[0];
    const author = names.get(first.athlete_id) ?? first.athlete_id;
    const lines = rows
      .sort((a, b) => a.position - b.position)
      .map((row) => `${row.position}. ${row.text}`)
      .join("\n");

    return `${author} · ${formatDate(first.created_at)}\n${lines}`;
  });

  return [
    "Crew WOD · PlayList",
    `Actualizado: ${formatDate(new Date().toISOString())}`,
    "",
    blocks.join("\n\n"),
    "",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return json({ error: "Faltan las credenciales de Supabase en la función." }, 500);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Reintenta si llegan envíos nuevos mientras se genera el archivo.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: entries, error } = await supabase
        .from("playlist_entries")
        .select("submission_id, athlete_id, position, text, created_at")
        .order("created_at", { ascending: true })
        .order("submission_id", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;

      const { data: athletes, error: athletesError } = await supabase
        .from("athletes")
        .select("id, name");
      if (athletesError) throw athletesError;

      const names = new Map((athletes ?? []).map((athlete) => [athlete.id, athlete.name]));
      const rows = (entries ?? []) as PlaylistEntry[];
      const text = buildText(rows, names);

      const { error: uploadError } = await supabase.storage
        .from("playlists")
        .upload("playlist.txt", new Blob([text], { type: "text/plain;charset=utf-8" }), {
          upsert: true,
          contentType: "text/plain; charset=utf-8",
        });
      if (uploadError) throw uploadError;

      const { count, error: countError } = await supabase
        .from("playlist_entries")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;

      if ((count ?? 0) === rows.length) {
        return json({
          ok: true,
          entries: rows.length,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return json({
      ok: true,
      entries: null,
      updatedAt: new Date().toISOString(),
      warning: "Llegaron envíos nuevos durante la exportación. Vuelve a invocar la función.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
