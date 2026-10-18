import { supabase } from "@/lib/supabase";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AsaasBillingType = "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface AsaasPaymentPayload {
  customer: string; // asaas customer id
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
}

export interface AsaasPaymentResponse {
  id: string;
  status: string;
  billingType: string;
  value: number;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  pixQrCode?: { encodedImage: string; payload: string };
}

// ─── Config ──────────────────────────────────────────────────────────────────

async function getAsaasConfig(): Promise<{ ambiente: "sandbox" | "producao" }> {
  try {
    const local = typeof window !== "undefined" ? localStorage.getItem("asaas_ambiente") : null;
    if (local === "sandbox" || local === "producao") {
      return { ambiente: local };
    }
  } catch {}
  return { ambiente: "producao" };
}

// ─── Função base de chamada ───────────────────────────────────────────────────

async function asaasRequest<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: object
): Promise<T> {
  const { ambiente } = await getAsaasConfig();

  const { data: funcData, error } = await supabase.functions.invoke("asaas-proxy", {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "asaas-target-path": path,
      "asaas-environment": ambiente,
      // O método não pode ser passado via headers no invoke, mas POST é o default.
      // Para GET usamos o body como null e o proxy lê o método do req
    },
    method,
  });

  if (error) {
    throw new Error(`Erro ASAAS [${path}]: ${error.message}`);
  }

  // funcData pode ser string ou objeto dependendo do content-type
  const result = typeof funcData === "string" ? JSON.parse(funcData) : funcData;

  // A proxy sempre retorna 200, mas embute o status real em _asaas_status
  if (result?._asaas_status && result._asaas_status >= 400) {
    const msgs = result.errors?.map((e: any) => e.description).join(", ")
      || result.message
      || `Status ${result._asaas_status}`;
    throw new Error(`ASAAS: ${msgs}`);
  }

  if (result?.errors?.length) {
    const msgs = result.errors.map((e: any) => e.description).join(", ");
    throw new Error(`ASAAS: ${msgs}`);
  }

  return result as T;
}

// ─── Clientes ────────────────────────────────────────────────────────────────

/**
 * Cria ou recupera o customer_id do ASAAS para um cliente do ERP.
 * Armazena o ID na tabela `clientes` para evitar duplicatas.
 */
export async function obterOuCriarCustomerAsaas(cliente: {
  id: string;
  nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  asaas_customer_id?: string;
}): Promise<string> {
  // Se já tem ID cacheado, usa direto
  if (cliente.asaas_customer_id) {
    return cliente.asaas_customer_id;
  }

  // Cria o customer no ASAAS
  const payload: any = {
    name: cliente.nome,
    notificationDisabled: true, // não enviar notificações automáticas pelo ASAAS
  };
  if (cliente.cpf_cnpj) payload.cpfCnpj = cliente.cpf_cnpj.replace(/\D/g, "");
  if (cliente.email) payload.email = cliente.email;
  if (cliente.telefone) payload.mobilePhone = cliente.telefone.replace(/\D/g, "");

  const response = await asaasRequest<AsaasCustomer>("POST", "/v3/customers", payload);

  // Salva o ID no banco para reutilizar
  await supabase
    .from("clientes")
    .update({ asaas_customer_id: response.id })
    .eq("id", cliente.id);

  return response.id;
}

// ─── Cobranças ───────────────────────────────────────────────────────────────

/**
 * Cria uma cobrança no ASAAS e persiste no banco local.
 */
export async function criarCobrancaAsaas(params: {
  cliente: {
    id: string;
    nome: string;
    cpf_cnpj?: string;
    email?: string;
    telefone?: string;
    asaas_customer_id?: string;
  };
  valor: number;
  vencimento: string; // YYYY-MM-DD
  descricao?: string;
  tipo: AsaasBillingType;
  venda_id?: string;
  conta_receber_id?: string;
  installmentCount?: number;
}): Promise<AsaasPaymentResponse & { cobranca_id: string }> {
  // 1. Obter/criar customer no ASAAS
  const asaasCustomerId = await obterOuCriarCustomerAsaas(params.cliente);

  // 2. Criar cobrança no ASAAS
  const payload: AsaasPaymentPayload = {
    customer: asaasCustomerId,
    billingType: params.tipo,
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao || "Cobrança Garden Prime ERP",
    externalReference: params.venda_id || undefined,
  };

  if (params.installmentCount && params.installmentCount > 1) {
    payload.installmentCount = params.installmentCount;
    payload.installmentValue = Number((params.valor / params.installmentCount).toFixed(2));
  }

  const paymentResponse = await asaasRequest<AsaasPaymentResponse>(
    "POST",
    "/v3/payments",
    payload
  );

  // 3. Se for PIX, buscar QR Code
  let pixCopiaECola: string | undefined;
  let pixImagemUrl: string | undefined;

  if (params.tipo === "PIX" && paymentResponse.id) {
    try {
      const pixData = await asaasRequest("GET", `/v3/payments/${paymentResponse.id}/pixQrCode`);
      pixCopiaECola = pixData?.payload;
      pixImagemUrl = pixData?.encodedImage
        ? `data:image/png;base64,${pixData.encodedImage}`
        : undefined;
      paymentResponse.pixQrCode = pixData;
    } catch (e) {
      console.warn("Não foi possível buscar QR Code PIX:", e);
    }
  }

  // 4. Persistir cobrança no banco local
  const { data: cobrancaSalva, error } = await supabase
    .from("asaas_cobrancas")
    .insert({
      asaas_id: paymentResponse.id,
      tipo: params.tipo,
      status: paymentResponse.status || "PENDING",
      valor: params.valor,
      vencimento: params.vencimento,
      descricao: params.descricao,
      cliente_id: params.cliente.id,
      venda_id: params.venda_id || null,
      conta_receber_id: params.conta_receber_id || null,
      link_boleto: paymentResponse.bankSlipUrl || null,
      pix_copia_cola: pixCopiaECola || null,
      pix_imagem_url: pixImagemUrl || null,
      invoice_url: paymentResponse.invoiceUrl || null,
      asaas_customer_id: asaasCustomerId,
      raw_response: paymentResponse as any,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao salvar cobrança no banco:", error);
    throw new Error("Cobrança criada no ASAAS, mas não foi possível salvar no banco.");
  }

  return { ...paymentResponse, cobranca_id: cobrancaSalva!.id };
}

/**
 * Cancela uma cobrança no ASAAS e atualiza o banco local.
 */
export async function cancelarCobrancaAsaas(asaasId: string): Promise<void> {
  await asaasRequest("DELETE", `/v3/payments/${asaasId}`);
  await supabase
    .from("asaas_cobrancas")
    .update({ status: "DELETED", updated_at: new Date().toISOString() })
    .eq("asaas_id", asaasId);
}

// ─── Pagamento Direto com Cartão de Crédito ──────────────────────────────────

export interface AsaasCreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCartaoPaymentParams {
  cliente: {
    id?: string;
    nome: string;
    cpf_cnpj: string;
    email?: string;
    telefone?: string;
    cep?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    asaas_customer_id?: string;
  };
  valor: number;
  parcelas: number;
  cartao: AsaasCreditCardData;
  descricao?: string;
  venda_id?: string;
}

export async function pagarComCartaoCreditoAsaas(
  params: AsaasCartaoPaymentParams
): Promise<AsaasPaymentResponse & { cobranca_id?: string }> {
  // 1. Obter ou criar customer no ASAAS
  let asaasCustomerId = params.cliente.asaas_customer_id;
  if (!asaasCustomerId) {
    const payloadCustomer: any = {
      name: params.cliente.nome,
      notificationDisabled: true,
    };
    if (params.cliente.cpf_cnpj) payloadCustomer.cpfCnpj = params.cliente.cpf_cnpj.replace(/\D/g, "");
    if (params.cliente.email) payloadCustomer.email = params.cliente.email;
    if (params.cliente.telefone) payloadCustomer.mobilePhone = params.cliente.telefone.replace(/\D/g, "");
    if (params.cliente.cep) payloadCustomer.postalCode = params.cliente.cep.replace(/\D/g, "");
    if (params.cliente.endereco) payloadCustomer.address = params.cliente.endereco;
    if (params.cliente.numero) payloadCustomer.addressNumber = params.cliente.numero;

    const custResp = await asaasRequest<AsaasCustomer>("POST", "/v3/customers", payloadCustomer);
    asaasCustomerId = custResp.id;

    if (params.cliente.id) {
      try {
        await supabase.from("clientes").update({ asaas_customer_id: asaasCustomerId }).eq("id", params.cliente.id);
      } catch {}
    }
  }

  // 2. Montar payload do pagamento via Cartão
  const numLimpo = params.cartao.number.replace(/\D/g, "");
  const ccvLimpo = params.cartao.ccv.replace(/\D/g, "");
  const mesFormatado = params.cartao.expiryMonth.replace(/\D/g, "").padStart(2, "0");
  let anoFormatado = params.cartao.expiryYear.replace(/\D/g, "");
  if (anoFormatado.length === 2) anoFormatado = `20${anoFormatado}`;

  const payload: any = {
    customer: asaasCustomerId,
    billingType: "CREDIT_CARD",
    value: params.valor,
    dueDate: new Date().toISOString().split("T")[0],
    description: params.descricao || "Pedido Catálogo Garden Prime",
    externalReference: params.venda_id || undefined,
    creditCard: {
      holderName: params.cartao.holderName.trim().toUpperCase(),
      number: numLimpo,
      expiryMonth: mesFormatado,
      expiryYear: anoFormatado,
      ccv: ccvLimpo,
    },
    creditCardHolderInfo: {
      name: params.cartao.holderName.trim().toUpperCase(),
      email: params.cliente.email || "contatogardenprime@gmail.com",
      cpfCnpj: params.cliente.cpf_cnpj.replace(/\D/g, ""),
      postalCode: (params.cliente.cep || "13519-022").replace(/\D/g, ""),
      addressNumber: params.cliente.numero || "S/N",
      addressComplement: null,
      phone: (params.cliente.telefone || "19997141112").replace(/\D/g, ""),
      mobilePhone: (params.cliente.telefone || "19997141112").replace(/\D/g, ""),
    },
  };

  if (params.parcelas && params.parcelas > 1) {
    payload.installmentCount = params.parcelas;
    payload.installmentValue = Number((params.valor / params.parcelas).toFixed(2));
  }

  const paymentResponse = await asaasRequest<AsaasPaymentResponse>(
    "POST",
    "/v3/payments",
    payload
  );

  // 3. Tenta salvar na tabela asaas_cobrancas caso permitido
  let cobrancaId: string | undefined;
  try {
    const { data: cobrancaSalva } = await supabase
      .from("asaas_cobrancas")
      .insert({
        asaas_id: paymentResponse.id,
        tipo: "CREDIT_CARD",
        status: paymentResponse.status || "CONFIRMED",
        valor: params.valor,
        vencimento: new Date().toISOString().split("T")[0],
        descricao: params.descricao,
        cliente_id: params.cliente.id || null,
        venda_id: params.venda_id || null,
        invoice_url: paymentResponse.invoiceUrl || null,
        asaas_customer_id: asaasCustomerId,
        raw_response: paymentResponse as any,
      })
      .select("id")
      .maybeSingle();

    if (cobrancaSalva?.id) cobrancaId = cobrancaSalva.id;
  } catch (err) {
    console.warn("Aviso ao persistir em asaas_cobrancas:", err);
  }

  return { ...paymentResponse, cobranca_id: cobrancaId };
}

// ─── Mapeamento de forma de pagamento ────────────────────────────────────────

/**
 * Converte o metodo_pagamento/condicao_pagamento do ERP para o billingType do ASAAS.
 */
export function inferirBillingType(metodoPagamento?: string): AsaasBillingType {
  if (!metodoPagamento) return "UNDEFINED";
  const m = metodoPagamento.toLowerCase();
  if (m.includes("pix")) return "PIX";
  if (m.includes("boleto")) return "BOLETO";
  if (m.includes("crédito") || m.includes("credito") || m.includes("cartão")) return "CREDIT_CARD";
  return "UNDEFINED";
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const ASAAS_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Aguardando Pagamento", color: "text-warning" },
  RECEIVED: { label: "Recebido", color: "text-success" },
  CONFIRMED: { label: "Confirmado", color: "text-success" },
  OVERDUE: { label: "Vencido", color: "text-destructive" },
  REFUNDED: { label: "Estornado", color: "text-muted-foreground" },
  REFUND_REQUESTED: { label: "Estorno Solicitado", color: "text-warning" },
  CHARGEBACK_REQUESTED: { label: "Chargeback", color: "text-destructive" },
  DELETED: { label: "Cancelado", color: "text-muted-foreground" },
};

export const ASAAS_TIPO_LABEL: Record<string, string> = {
  BOLETO: "🏦 Boleto",
  PIX: "⚡ PIX",
  CREDIT_CARD: "💳 Cartão de Crédito",
  UNDEFINED: "🔀 Multi-meios",
};

// ─── Notas Fiscais (NFS-e) ───────────────────────────────────────────────────

export interface AsaasInvoicePayload {
  customer: string;
  serviceDescription: string;
  observation?: string;
  value: number;
  deductions?: number;
  effectiveDate: string;
  serviceListItem?: string; // Usado para MEI/Portal Nacional
  cityServiceCode?: string;
  municipalServiceCode?: string;
  municipalServiceCodeDescription?: string;
  updatePayment?: boolean;
}

export interface AsaasInvoiceResponse {
  id: string;
  status: string;
  customer: string;
  value: number;
  type: string;
  statusDescription: string;
  pdfUrl?: string;
  xmlUrl?: string;
  rpsNumber?: string;
  rpsSerie?: string;
  number?: string;
}

/**
 * Cria uma nota fiscal de serviço no ASAAS.
 */
export async function emitirNotaFiscalAsaas(
  params: AsaasInvoicePayload
): Promise<AsaasInvoiceResponse> {
  const response = await asaasRequest<AsaasInvoiceResponse>("POST", "/v3/invoices", params);
  return response;
}
