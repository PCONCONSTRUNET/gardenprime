import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const event = payload?.event as string;
    const payment = payload?.payment;

    if (!event || !payment) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ASAAS Webhook] Evento: ${event} | Payment: ${payment.id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Mapear status ASAAS → status interno
    const statusMap: Record<string, string> = {
      PAYMENT_RECEIVED: "RECEIVED",
      PAYMENT_CONFIRMED: "CONFIRMED",
      PAYMENT_OVERDUE: "OVERDUE",
      PAYMENT_REFUNDED: "REFUNDED",
      PAYMENT_REFUND_REQUESTED: "REFUND_REQUESTED",
      PAYMENT_CHARGEBACK_REQUESTED: "CHARGEBACK_REQUESTED",
      PAYMENT_DELETED: "DELETED",
    };

    const novoStatus = statusMap[event];

    if (!novoStatus) {
      // Evento não relevante para atualização de status, ignora
      console.log(`[ASAAS Webhook] Evento ${event} ignorado (não mapeado)`);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar cobrança pelo asaas_id
    const { data: cobranca, error: errCobranca } = await supabase
      .from("asaas_cobrancas")
      .select("id, conta_receber_id, venda_id")
      .eq("asaas_id", payment.id)
      .single();

    if (errCobranca || !cobranca) {
      console.warn(`[ASAAS Webhook] Cobrança ${payment.id} não encontrada no banco`);
      // Retorna 200 para o ASAAS não tentar reenviar
      return new Response(JSON.stringify({ ok: true, not_found: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar status da cobrança ASAAS
    await supabase
      .from("asaas_cobrancas")
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cobranca.id);

    // Se recebido/confirmado → dar baixa na conta a receber
    if (
      (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") &&
      cobranca.conta_receber_id
    ) {
      const dataHoje = new Date().toISOString().split("T")[0];
      await supabase
        .from("contas_receber")
        .update({
          status: "Recebido",
          data_pagamento: dataHoje,
        })
        .eq("id", cobranca.conta_receber_id);

      console.log(`[ASAAS Webhook] Baixa em contas_receber: ${cobranca.conta_receber_id}`);
    }

    // Se recebido → atualizar status da venda para "Pago"
    if (event === "PAYMENT_RECEIVED" && cobranca.venda_id) {
      await supabase
        .from("vendas")
        .update({ status: "Pago" })
        .eq("id", cobranca.venda_id)
        .eq("status", "Aguardando Pagamento"); // só atualiza se estava aguardando
    }

    console.log(`[ASAAS Webhook] Processado: ${payment.id} → ${novoStatus}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ASAAS Webhook] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
