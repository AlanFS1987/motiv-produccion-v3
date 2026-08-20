// Cabeceras CORS compartidas por todas las Edge Functions.
// Necesarias porque la app web llama a estas funciones directamente
// desde el navegador del responsable.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonError(mensaje: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: mensaje }), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

export function jsonOk(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
