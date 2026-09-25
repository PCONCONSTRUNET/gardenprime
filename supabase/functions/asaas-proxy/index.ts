import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-target-path, asaas-environment, asaas-method",
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

    // Permite sobrescrever o método via header (supabase.functions.invoke sempre usa POST)
    const forwardMethod = req.headers.get("asaas-method") || req.method;

    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let requestBody: BodyInit | undefined = undefined;
    let requestHeaders: Record<string, string> = {
      "access_token": apiKey,
      "User-Agent": "GardenPrimeERP/1.0.0",
    };

    if (forwardMethod !== "GET" && forwardMethod !== "HEAD") {
      if (isMultipart) {
        // Para uploads de arquivo: repassa o FormData diretamente sem modificar
        requestBody = await req.formData();
        // Não define Content-Type — o fetch define automaticamente com o boundary correto
      } else {
        requestBody = await req.text();
        requestHeaders["Content-Type"] = "application/json";
      }
    } else {
      requestHeaders["Content-Type"] = "application/json";
    }

    console.log(`[ASAAS Proxy] ${forwardMethod} ${baseUrl}${targetPath} | multipart=${isMultipart}`);

    const response = await fetch(`${baseUrl}${targetPath}`, {
      method: forwardMethod,
      headers: requestHeaders,
      body: requestBody,
    });

    const data = await response.text();
    console.log(`[ASAAS Proxy] Resposta: ${response.status}`);

    // Sempre retorna 200 para o supabase-js não ocultar o erro com "non-2xx status code".
    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = { raw: data };
    }

    return new Response(JSON.stringify({ _asaas_status: response.status, ...parsed }), {
      status: 200,
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
