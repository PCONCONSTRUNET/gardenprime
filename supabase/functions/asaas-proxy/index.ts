import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-target-path, asaas-environment",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const targetPath = req.headers.get("asaas-target-path");
    if (!targetPath) {
      throw new Error("Header 'asaas-target-path' é obrigatório");
    }

    // Ambiente: sandbox (default) ou producao
    const env = req.headers.get("asaas-environment") || "sandbox";
    const baseUrl =
      env === "producao"
        ? "https://api.asaas.com"
        : "https://api-sandbox.asaas.com";

    // Chave de API vem do secret do Supabase
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      throw new Error("ASAAS_API_KEY não configurada nos secrets do Supabase");
    }

    let body: string | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    console.log(`[ASAAS Proxy] ${req.method} ${baseUrl}${targetPath}`);

    const response = await fetch(`${baseUrl}${targetPath}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
        "User-Agent": "GardenPrimeERP/1.0.0",
      },
      body: body || undefined,
    });

    const data = await response.text();

    console.log(`[ASAAS Proxy] Resposta: ${response.status}`);

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[ASAAS Proxy] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
