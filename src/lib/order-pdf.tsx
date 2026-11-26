import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, supabaseParceiro } from "@/lib/supabase";
import {
  calcularVencimentosPadrao,
  calcularValorParcela,
  formatBrDecimal,
  formatClientAddressLine,
  formatUnidadeMedida,
} from "@/lib/utils";
import React from "react";

export const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);

export interface OrderItem {
  id?: string;
  produto_id?: string;
  produto?: {
    nome?: string;
    codigo?: string;
    unidade_medida?: string;
    emoji?: string;
    imagem?: string;
  };
  produtos?: {
    nome?: string;
    codigo?: string;
    unidade_medida?: string;
    emoji?: string;
    imagem?: string;
  };
  produto_nome?: string;
  codigo?: string;
  unidade_medida?: string;
  imagem?: string;
  quantidade?: number;
  qtd?: number;
  valor_unitario?: number;
  subtotal?: number;
  total?: number;
}

export interface OrderData {
  id: string;
  numero_venda?: number | string;
  numero?: number | string;
  tipo?: string;
  created_at: string;
  valor_total?: number;
  total?: number;
  subtotal?: number;
  desconto_valor?: number;
  desconto_percentual?: number;
  frete_valor?: number;
  condicao_pagamento?: string;
  metodo_pagamento?: string;
  frete_tipo?: string;
  prazo_entrega?: string;
  observacoes?: string;
  validade?: string;
  vencimentos?: any[];
  cliente_id?: string;
  cliente_nome?: string;
  cliente_cnpj?: string;
  cliente_telefone?: string;
  cliente_endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  cliente?: {
    nome?: string;
    cpf_cnpj?: string;
    telefone?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    email?: string;
  } | null;
  clientes?: {
    nome?: string;
    cpf_cnpj?: string;
    telefone?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    email?: string;
  } | null;
  vendedor?:
    | {
        nome?: string;
      }
    | string
    | null;
  vendedor_nome?: string;
}

/**
 * Retorna o cliente supabase ativo de acordo com a sessão (admin ou parceiro)
 */
async function getActiveSupabase() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return supabase;
  } catch {}
  return supabaseParceiro;
}

async function queryDb<T>(fn: (client: typeof supabase) => PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  const active = await getActiveSupabase();
  try {
    const res = await fn(active);
    if (!res.error && res.data) return res.data;
  } catch {}
  // Tenta fallback com o outro client
  const fallback = active === supabase ? supabaseParceiro : supabase;
  try {
    const res2 = await fn(fallback);
    if (!res2.error && res2.data) return res2.data;
  } catch {}
  return null;
}

/**
 * Retorna o número legível do pedido/orçamento formatado
 */
export function getOrderNumber(order: OrderData): string {
  const num = order.numero_venda ?? order.numero;
  if (num !== undefined && num !== null) {
    return String(num).padStart(3, "0");
  }
  return order.id ? order.id.substring(0, 8).toUpperCase() : "000";
}

/**
 * Retorna o nome do cliente normalizado
 */
export function getClientName(order: OrderData): string {
  return order.cliente?.nome || order.clientes?.nome || (order as any).cliente_nome || "Cliente não informado";
}

/**
 * Retorna o tipo legível: Orçamento ou Pedido
 */
export function isOrderDav(order: OrderData): boolean {
  return order.tipo === "DAV";
}

export function getShortOrderParam(order: OrderData): string {
  const numVenda = order.numero_venda ?? (order as any).rawVenda?.numero_venda;
  if (numVenda !== undefined && numVenda !== null && String(numVenda).trim() !== "") {
    return String(numVenda);
  }
  if (order.numero !== undefined && order.numero !== null && String(order.numero).trim() !== "") {
    return (order as any).isVenda ? String(order.numero) : `D${order.numero}`;
  }
  return String(order.id || "");
}

/**
 * Constrói texto da mensagem do WhatsApp formatado
 */
export function buildWhatsAppMessage(order: OrderData, items: OrderItem[], includeLink = true): string {
  const isDAV = isOrderDav(order);
  const num = getOrderNumber(order);
  const docType = isDAV ? "ORÇAMENTO" : "PEDIDO";
  const clienteNome = order.cliente?.nome || order.clientes?.nome || (order as any).cliente_nome || "Cliente";

  let msg = `*${docType} - GARDEN PLUS*\n`;
  msg += `Nº: ${num}\n`;
  msg += `Data: ${new Date(order.created_at).toLocaleDateString("pt-BR")}\n`;
  msg += `Cliente: ${clienteNome}\n\n`;
  msg += `*ITENS:*\n`;

  for (const it of items) {
    const nome = it.produto_nome || it.produto?.nome || it.produtos?.nome || (it as any).produto || "Produto";
    const cod = it.codigo || it.produto?.codigo || it.produtos?.codigo || (it as any).produto_codigo || (it as any).cod || "";
    const qtd = it.quantidade || it.qtd || 1;
    const total = it.total || it.subtotal || 0;
    msg += `• ${qtd}x ${cod ? `[${cod}] ` : ""}${nome} - R$ ${Number(total).toFixed(2).replace(".", ",")}\n`;
  }

  const vTot = Number(order.valor_total || order.total || 0).toFixed(2).replace(".", ",");
  msg += `\n*TOTAL: R$ ${vTot}*\n`;

  const shortParam = getShortOrderParam(order);
  if (includeLink && typeof window !== "undefined" && shortParam) {
    const linkPdf = `${window.location.origin}/orcamento/${shortParam}`;
    msg += `\n📄 *Acesse o documento formal em PDF aqui:*\n${linkPdf}`;
  }

  return msg;
}

/**
 * Garante que tanto os dados do pedido/orçamento (especialmente os dados do cliente)
 * quanto os itens (com código e imagem do produto) estejam completos para o PDF.
 */
export async function enrichOrderAndItems(
  rawOrder: OrderData,
  rawItems?: OrderItem[]
): Promise<{ order: OrderData; items: OrderItem[] }> {
  const order: OrderData = { ...rawOrder };
  let items: OrderItem[] = rawItems && rawItems.length > 0 ? [...rawItems] : [];

  // 1. Resolver cliente se ausente ou incompleto
  const existingClient = order.cliente || order.clientes || (order as any).client;
  const hasClientName = Boolean(existingClient?.nome || (order as any).cliente_nome);
  const hasClientAddressOrCity = Boolean(
    existingClient?.cidade ||
    existingClient?.endereco ||
    existingClient?.bairro ||
    (order as any).cidade ||
    (order as any).bairro ||
    (order as any).cliente_endereco
  );
  const hasClientCep = Boolean(existingClient?.cep || (order as any).cep);

  if ((!hasClientName || !hasClientAddressOrCity || !hasClientCep) && order.id) {
    // Tenta primeiro em 'vendas'
    try {
      const v = await queryDb<any>((client) =>
        client
          .from("vendas")
          .select("*, clientes(*), vendedor:vendedores(nome)")
          .eq("id", order.id)
          .maybeSingle()
      );

      if (v) {
        order.numero_venda = order.numero_venda ?? v.numero_venda ?? v.numero;
        order.tipo = order.tipo ?? v.tipo;
        order.condicao_pagamento = order.condicao_pagamento ?? v.condicao_pagamento ?? v.metodo_pagamento;
        order.total = order.total ?? v.valor_total;
        order.subtotal = order.subtotal ?? v.subtotal ?? v.valor_total;
        order.desconto_valor = order.desconto_valor ?? v.desconto_valor;
        order.desconto_percentual = order.desconto_percentual ?? v.desconto_percentual;
        order.frete_valor = order.frete_valor ?? v.frete_valor;
        order.vencimentos = order.vencimentos ?? v.vencimentos;
        order.created_at = order.created_at || v.created_at;
        if (v.vendedor) {
          order.vendedor_nome = order.vendedor_nome ?? (typeof v.vendedor === "object" ? v.vendedor?.nome : v.vendedor);
        }
        if (v.clientes) {
          order.cliente = {
            nome: v.clientes.nome || existingClient?.nome,
            cpf_cnpj: v.clientes.cpf_cnpj || existingClient?.cpf_cnpj,
            telefone: v.clientes.telefone || existingClient?.telefone,
            endereco: v.clientes.endereco || existingClient?.endereco,
            numero: v.clientes.numero || existingClient?.numero,
            bairro: v.clientes.bairro || existingClient?.bairro,
            cidade: v.clientes.cidade || existingClient?.cidade,
            uf: v.clientes.uf || existingClient?.uf,
            cep: v.clientes.cep || existingClient?.cep,
            email: (v.clientes as any).email || existingClient?.email,
          };
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar venda para enriquecer PDF:", e);
    }

    // Se ainda não achou o cliente completo, tenta em 'davs'
    if ((!order.cliente?.nome || !order.cliente?.cidade || !order.cliente?.cep) && order.id) {
      try {
        const d = await queryDb<any>((client) =>
          client.from("davs").select("*").eq("id", order.id).maybeSingle()
        );

        if (d) {
          order.numero = order.numero ?? d.numero;
          order.tipo = order.tipo ?? "DAV";
          order.condicao_pagamento = order.condicao_pagamento ?? d.condicao_pagamento;
          order.frete_tipo = order.frete_tipo ?? d.frete_tipo;
          order.prazo_entrega = order.prazo_entrega ?? d.prazo_entrega;
          order.observacoes = order.observacoes ?? d.observacoes;
          order.desconto_valor = order.desconto_valor ?? d.desconto_valor;
          order.frete_valor = order.frete_valor ?? d.frete_valor;
          order.vencimentos = order.vencimentos ?? d.vencimentos;
          order.total = order.total ?? d.total;
          order.subtotal = order.subtotal ?? d.subtotal;
          order.created_at = order.created_at || d.created_at;
          order.vendedor_nome = order.vendedor_nome ?? d.vendedor;
          if (d.validade) (order as any).validade = (order as any).validade ?? d.validade;

          let cliData: any = null;
          if (d.cliente_id) {
            cliData = await queryDb<any>((client) =>
              client.from("clientes").select("*").eq("id", d.cliente_id).maybeSingle()
            );
          } else if (d.cliente_cnpj) {
            cliData = await queryDb<any>((client) =>
              client.from("clientes").select("*").eq("cpf_cnpj", d.cliente_cnpj).limit(1).maybeSingle()
            );
          }

          order.cliente = {
            nome: cliData?.nome || d.cliente_nome || order.cliente?.nome,
            cpf_cnpj: cliData?.cpf_cnpj || d.cliente_cnpj || order.cliente?.cpf_cnpj,
            telefone: cliData?.telefone || d.cliente_telefone || order.cliente?.telefone,
            endereco: cliData?.endereco || d.cliente_endereco || order.cliente?.endereco,
            numero: cliData?.numero || order.cliente?.numero || "",
            bairro: cliData?.bairro || d.bairro || order.cliente?.bairro,
            cidade: cliData?.cidade || d.cidade || order.cliente?.cidade,
            uf: cliData?.uf || d.uf || order.cliente?.uf,
            cep: cliData?.cep || (d as any).cep || order.cliente?.cep,
            email: cliData?.email || d.cliente_email || d.email || order.cliente?.email,
          };
        }
      } catch (e) {
        console.warn("Erro ao buscar dav para enriquecer PDF:", e);
      }
    }
  }

  // Normalizar objeto cliente (mantendo CEP separado do Endereço para não duplicar)
  const rawC = order.cliente || order.clientes || (order as any).client || {};
  const cepVal = rawC.cep || (order as any).cep || (order as any).cliente_cep || "";
  const endFormatted = formatClientAddressLine(
    rawC.endereco || (order as any).cliente_endereco || "",
    rawC.numero || (order as any).cliente_numero || "",
  );

  order.cliente = {
    nome: rawC.nome || (order as any).cliente_nome || "-",
    cpf_cnpj: rawC.cpf_cnpj || rawC.cnpj || rawC.cpf || (order as any).cliente_cnpj || "-",
    telefone: rawC.telefone || rawC.phone || (order as any).cliente_telefone || "-",
    endereco: endFormatted,
    numero: rawC.numero || "",
    bairro: rawC.bairro || (order as any).bairro || "-",
    cidade: rawC.cidade || (order as any).cidade || "-",
    uf: rawC.uf || (order as any).uf || "-",
    cep: cepVal || "-",
    email: rawC.email || (order as any).cliente_email || (order as any).email || "-",
  };

  // 2. Buscar itens no banco se vieram vazios
  if (!items || items.length === 0) {
    if (order.id) {
      try {
        const vi = await queryDb<any[]>((client) =>
          client
            .from("vendas_itens")
            .select("*, produtos(nome, codigo, unidade_medida, emoji, imagem)")
            .eq("venda_id", order.id)
        );

        if (vi && vi.length > 0) {
          items = vi.map((it: any) => ({
            id: it.id,
            produto_id: it.produto_id,
            produto_nome: it.produtos?.nome || it.produto_nome,
            codigo: it.produtos?.codigo || it.codigo,
            unidade_medida: it.produtos?.unidade_medida || it.unidade_medida,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
            subtotal: it.subtotal,
            total: it.subtotal,
            imagem: it.produtos?.imagem,
            produtos: it.produtos,
          }));
        } else {
          const di = await queryDb<any[]>((client) =>
            client
              .from("dav_items")
              .select("*, produtos(nome, codigo, unidade_medida, emoji, imagem)")
              .eq("dav_id", order.id)
          );

          if (di && di.length > 0) {
            items = di.map((it: any) => ({
              id: it.id,
              produto_id: it.produto_id,
              produto_nome: it.produtos?.nome || it.produto,
              codigo: it.produtos?.codigo || it.codigo,
              unidade_medida: it.produtos?.unidade_medida || it.unidade_medida,
              quantidade: it.qtd || it.quantidade,
              valor_unitario: it.valor_unitario,
              subtotal: it.total || it.subtotal,
              total: it.total || it.subtotal,
              imagem: it.produtos?.imagem,
              produtos: it.produtos,
            }));
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar itens do pedido para PDF:", e);
      }
    }
  }

  // 3. Garantir códigos e unidades de medida para todos os itens passados
  const missingMeta = items.filter((it: any) => {
    const hasCod = Boolean(it.codigo || it.produto?.codigo || it.produtos?.codigo || it.produto_codigo || it.cod);
    const hasMed = Boolean(it.unidade_medida || it.produto?.unidade_medida || it.produtos?.unidade_medida);
    return (!hasCod || !hasMed) && (it.produto_id || it.id);
  });

  if (missingMeta.length > 0) {
    const missingIds = missingMeta.map((it: any) => it.produto_id || it.id).filter(Boolean);
    if (missingIds.length > 0) {
      try {
        const prods = await queryDb<any[]>((client) =>
          client
            .from("produtos")
            .select("id, codigo, unidade_medida, imagem, nome")
            .in("id", missingIds)
        );

        if (prods && prods.length > 0) {
          const prodMap = new Map(prods.map((p) => [p.id, p]));
          items = items.map((it: any) => {
            const p = prodMap.get(it.produto_id) || prodMap.get(it.id);
            if (p) {
              return {
                ...it,
                codigo: it.codigo || it.produtos?.codigo || it.produto?.codigo || p.codigo,
                unidade_medida: it.unidade_medida || it.produtos?.unidade_medida || it.produto?.unidade_medida || p.unidade_medida,
                imagem: it.imagem || it.produtos?.imagem || it.produto?.imagem || p.imagem,
                produto_nome: it.produto_nome || it.produtos?.nome || it.produto?.nome || p.nome,
                produtos: {
                  ...it.produtos,
                  codigo: it.produtos?.codigo || p.codigo,
                  unidade_medida: it.produtos?.unidade_medida || p.unidade_medida,
                  imagem: it.produtos?.imagem || p.imagem,
                  nome: it.produtos?.nome || p.nome,
                },
              };
            }
            return it;
          });
        }
      } catch (e) {
        console.warn("Erro ao complementar códigos e unidades dos produtos:", e);
      }
    }
  }

  // Normalizar campos em cada item
  items = items.map((it: any) => ({
    ...it,
    codigo: it.codigo || it.produtos?.codigo || it.produto?.codigo || it.produto_codigo || it.cod || "-",
    unidade_medida: formatUnidadeMedida(
      it.unidade_medida || it.produtos?.unidade_medida || it.produto?.unidade_medida
    ),
    produto_nome: it.produto_nome || it.produtos?.nome || it.produto?.nome || it.produto || "Produto Indisponível",
    imagem: it.imagem || it.produtos?.imagem || it.produto?.imagem || null,
  }));

  return { order, items };
}

/**
 * Busca os itens do pedido no Supabase caso não tenham sido passados
 */
export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { items } = await enrichOrderAndItems({ id: orderId, created_at: new Date().toISOString() });
  return items;
}

let cachedLogos: { prime: string | null; plus: string | null } | null = null;

export async function preloadLogos(): Promise<{ prime: string | null; plus: string | null }> {
  if (cachedLogos) return cachedLogos;
  if (typeof window === "undefined") return { prime: null, plus: null };

  const toBase64 = (url: string): Promise<string | null> =>
    fetch(url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => null);

  try {
    const [prime, plus] = await Promise.all([
      toBase64("/garden-prime-pdf.png").then((res) => res || toBase64("/garden-prime-lado.png")).then((res) => res || toBase64("/garden-prime-logo.png")),
      toBase64("/logo-02.png").then((res) => res || toBase64("/garden-plus.png")),
    ]);
    cachedLogos = { prime, plus };
  } catch {
    cachedLogos = { prime: null, plus: null };
  }
  return cachedLogos;
}

/**
 * Gera um documento PDF estruturado e profissional com jsPDF e jspdf-autotable
 */
export async function generateOrderPdfDoc(
  order: OrderData,
  items: OrderItem[],
  _logos?: { prime?: string | null; plus?: string | null; icons?: any },
): Promise<{ doc: jsPDF; blob: Blob; file: File; filename: string }> {
  // Buscar configurações da empresa
  let config: any = null;
  try {
    const active = await getActiveSupabase();
    const { data } = await active.from("configuracoes").select("*").eq("id", 1).single();
    if (data) config = data;
  } catch (e) {
    console.error("Erro ao buscar configuracoes da empresa para o PDF", e);
  }

  const isDAV = isOrderDav(order);
  const num = getOrderNumber(order);
  const numDisplay = num.padStart(6, "0");
  const filename = `${isDAV ? "orcamento" : "pedido"}_${num}.pdf`;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);

  // ── 1. CABEÇALHO EMPRESARIAL COMPACTO (ESTILO DAV) ────────────────────────────
  const headerStartY = y;

  // Faixa 1: Título Legal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(
    `DOCUMENTO AUXILIAR DE VENDA - ${isDAV ? "ORÇAMENTO" : "PEDIDO DE VENDA"}`,
    pageWidth / 2,
    y + 4.8,
    { align: "center" },
  );
  doc.setFontSize(7.2);
  doc.text(
    "NÃO É DOCUMENTO FISCAL - NÃO É VÁLIDO COMO RECIBO E COMO GARANTIA DE MERCADORIA - NÃO COMPROVA PAGAMENTO",
    pageWidth / 2,
    y + 9.2,
    { align: "center" },
  );

  y += 11.5;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  // Faixa 2: Dados da Empresa Emitente
  const razaoSocial = config?.razao_social || "GARDEN PLUS LTDA";
  const nomeFantasia = config?.nome_fantasia || "GARDEN PRIME";
  const cnpj = config?.cnpj || "50.387.381/0001-81";
  const ie = config?.inscricao_estadual || "266031100110";
  const tipoLog = config?.tipo_logradouro ? `${config.tipo_logradouro} ` : "";
  const endRua = config?.endereco || "MATEUS RODRIGUES DA COSTA";
  const endNum = config?.numero ? `, ${config.numero}` : "";
  const endCompl = config?.complemento ? ` ${config.complemento}` : "";
  const endBairro = config?.bairro ? ` - ${config.bairro}` : "";
  const empresaEndereco = `${tipoLog}${endRua}${endNum}${endCompl}${endBairro}`;
  const empresaCep = config?.cep ? `${config.cep} - ` : "";
  const empresaCidadeUf = `${empresaCep}${config?.municipio || "Charqueada"} - ${config?.uf || "SP"}`;
  const empresaFone = config?.celular || config?.telefone || "(19) 99930-8784";
  const empresaEmail = config?.email_contato || "garden-plus@hotmail.com";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`${razaoSocial} - ${nomeFantasia}`, margin + 3, y + 4.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`CNPJ: ${cnpj} - Insc. Estadual: ${ie}`, margin + 3, y + 8.0);
  doc.text(doc.splitTextToSize(empresaEndereco, 125)[0], margin + 3, y + 11.6);
  doc.text(empresaCidadeUf, margin + 3, y + 15.2);

  // Direita da Faixa 2: Fone + Email (Página X/Y é inserida no final em todas as páginas)
  const pageNumberY = y + 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Fone: ${empresaFone}`, pageWidth - margin - 3, y + 11.6, { align: "right" });
  doc.text(empresaEmail, pageWidth - margin - 3, y + 15.2, { align: "right" });

  y += 17.5;
  doc.line(margin, y, pageWidth - margin, y);

  // Faixa 3: Metadados do Pedido / DAV
  const createdDate = order.created_at ? new Date(order.created_at) : new Date();
  const dataEmissao = createdDate.toLocaleDateString("pt-BR");
  const horaEmissao = createdDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let validadeStr: string;
  if ((order as any).validade) {
    validadeStr = new Date((order as any).validade).toLocaleDateString("pt-BR");
  } else {
    const base = new Date(createdDate);
    base.setDate(base.getDate() + 30);
    validadeStr = base.toLocaleDateString("pt-BR");
  }

  const vendedorNome = order.vendedor_nome
    ? String(order.vendedor_nome).toUpperCase()
    : "DIRETO";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Tipo: ${isDAV ? "Orçamento (DAV)" : "Pedido de Venda"}`, margin + 3, y + 4.0);
  doc.text(`Vendedor: ${vendedorNome}`, margin + 3, y + 7.8);
  doc.text(`Validade: ${validadeStr}`, margin + 3, y + 11.6);

  const metaRightX = margin + 105;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`${isDAV ? "DAV" : "DAV / Pedido"}:`, metaRightX, y + 4.8);
  doc.setFontSize(9.5);
  doc.text(numDisplay, pageWidth - margin - 3, y + 4.8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`Data: ${dataEmissao}`, metaRightX, y + 10.6);
  doc.text(`Hora: ${horaEmissao}`, pageWidth - margin - 3, y + 10.6, { align: "right" });

  y += 13.8;
  doc.setLineWidth(0.35);
  doc.rect(margin, headerStartY, contentW, y - headerStartY);

  y += 2.2;

  // ── 2. IDENTIFICAÇÃO DO SOLICITANTE (DADOS DO CLIENTE) ────────────────────────
  const c = order.cliente || order.clientes || ({} as any);
  const clientStartY = y;

  const nomeStr = String(c.nome || "-");
  const enderecoLimpo = formatClientAddressLine(c.endereco, c.numero);
  const cidadeUfStr = `${c.cidade || "-"}${c.uf && c.uf !== "-" ? ` / ${c.uf}` : ""}`;
  const freteInfo = order.frete_tipo || (order as any).frete || "Retirada";
  const prazoInfo = order.prazo_entrega || (order as any).prazo || "Imediato";
  const pagInfo = order.condicao_pagamento || order.metodo_pagamento || "Não informado";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const nomeLines = doc.splitTextToSize(nomeStr, 84).slice(0, 2);
  const endLines = doc.splitTextToSize(enderecoLimpo, 84).slice(0, 2);
  const extraNomeH = nomeLines.length > 1 ? 3.5 : 0;
  const extraEndH = endLines.length > 1 ? 3.5 : 0;

  const clientBoxH = 27.5 + extraNomeH + extraEndH;
  doc.setLineWidth(0.35);
  doc.rect(margin, clientStartY, contentW, clientBoxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.text("Identificação do Solicitante", margin + 3, clientStartY + 4.4);

  const lblX1 = margin + 3;
  const valX1 = margin + 21;
  const lblX2 = margin + 110;
  const valX2 = margin + 131;
  const maxRightW = pageWidth - margin - 3 - valX2;

  let cy = clientStartY + 9.0;
  const drawField = (lx: number, vx: number, label: string, val: string | string[], rowY: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label, lx, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(val, vx, rowY);
  };

  // Linha 1
  drawField(lblX1, valX1, "Cliente:", nomeLines, cy);
  drawField(lblX2, valX2, "CPF/CNPJ:", doc.splitTextToSize(String(c.cpf_cnpj || "-"), maxRightW)[0], cy);
  cy += 4.0 + extraNomeH;

  // Linha 2
  drawField(lblX1, valX1, "Endereço:", endLines, cy);
  drawField(lblX2, valX2, "Bairro:", doc.splitTextToSize(String(c.bairro || "-"), maxRightW)[0], cy);
  cy += 4.0 + extraEndH;

  // Linha 3
  drawField(lblX1, valX1, "CEP:", String(c.cep || "-"), cy);
  drawField(lblX2, valX2, "Cidade/UF:", doc.splitTextToSize(cidadeUfStr, maxRightW)[0], cy);
  cy += 4.0;

  // Linha 4
  drawField(lblX1, valX1, "Telefone:", String(c.telefone || "-"), cy);
  drawField(lblX2, valX2, "Pagamento:", doc.splitTextToSize(pagInfo, maxRightW)[0], cy);
  cy += 4.0;

  // Linha 5
  drawField(lblX1, valX1, "E-mail:", doc.splitTextToSize(String(c.email || "-"), 84)[0], cy);
  drawField(lblX2, valX2, "Frete/Prazo:", doc.splitTextToSize(`${freteInfo} | ${prazoInfo}`, maxRightW)[0], cy);

  y = clientStartY + clientBoxH + 4.5;

  // ── 3. RELAÇÃO DE PRODUTOS / SERVIÇOS ─────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Relação de Produtos/Serviços", margin, y);
  y += 1.8;

  const tableBody = items.map((it) => {
    const nome =
      it.produto_nome ||
      it.produto?.nome ||
      it.produtos?.nome ||
      (it as any).produto ||
      "Produto Indisponível";
    const codigo =
      it.codigo ||
      it.produto?.codigo ||
      it.produtos?.codigo ||
      (it as any).produto_codigo ||
      (it as any).cod ||
      "-";
    const med = formatUnidadeMedida(
      it.unidade_medida || it.produto?.unidade_medida || it.produtos?.unidade_medida,
    );
    const qtdNum = Number(it.quantidade || it.qtd || 1);
    const unitNum = Number(it.valor_unitario || 0);
    const totNum = Number(it.total ?? it.subtotal ?? qtdNum * unitNum);
    const itemDiscount = Math.max(0, qtdNum * unitNum - totNum);

    return [
      String(codigo),
      String(nome),
      formatBrDecimal(qtdNum),
      med,
      formatBrDecimal(unitNum),
      formatBrDecimal(itemDiscount),
      formatBrDecimal(totNum),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 14 },
    tableWidth: contentW,
    head: [["Código", "Descrição", "Qtd", "Med", "Unitário", "Desconto", "Total"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      valign: "middle",
      fontSize: 7.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 },
      lineWidth: { top: 0.3, bottom: 0.3 },
      lineColor: [0, 0, 0],
    },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 },
      valign: "middle",
      overflow: "linebreak",
      fontStyle: "normal",
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 16, fontStyle: "bold" },
      1: { halign: "left" },
      2: { halign: "right", cellWidth: 19 },
      3: { halign: "center", cellWidth: 11 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 24, fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ── 4. CONDIÇÕES, VENCIMENTOS, TOTAIS E ASSINATURAS ───────────────────────────
  const orderTotalNum = Number(order.valor_total || order.total || order.subtotal || 0);
  const subtotalNum = Number(order.subtotal || orderTotalNum);
  const descontoNum = Number(order.desconto_valor || 0);
  const freteNum = Number(order.frete_valor || 0);

  let orderVenc = (order as any).vencimentos;
  if (!Array.isArray(orderVenc) || orderVenc.length === 0) {
    if (order.condicao_pagamento && order.condicao_pagamento.trim() !== "") {
      orderVenc = calcularVencimentosPadrao(
        order.condicao_pagamento,
        order.created_at,
        orderTotalNum,
      );
    }
  }
  const vencList = Array.isArray(orderVenc) ? orderVenc : [];
  const vencDisplayLines: string[] = vencList.map((v: any, idx: number) => {
    const d = typeof v === "object" && v !== null ? v.data : v;
    const clean = (d || "").split("T")[0].split("-");
    const dtBr = clean.length === 3 ? `${clean[2]}/${clean[1]}/${clean[0]}` : String(d || "");
    const valParcela = calcularValorParcela(v, idx, vencList.length, orderTotalNum);
    const valStr = valParcela > 0 ? ` — R$ ${formatBrDecimal(valParcela)}` : "";
    return `${idx + 1}ª: ${dtBr}${valStr}`;
  });

  const obsLines = order.observacoes
    ? doc.splitTextToSize(`Obs.: ${order.observacoes}`, 114).slice(0, 3)
    : [];
  const vencRowsCount = Math.max(1, Math.ceil(vencDisplayLines.length / 2));
  const summaryH = Math.max(24, 15 + vencRowsCount * 3.8 + obsLines.length * 3.6);
  const neededBottomH = summaryH + 34;

  if (y + neededBottomH > pageHeight - 10) {
    doc.addPage();
    y = margin + 4;
  }

  const splitX = margin + 122;
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentW, summaryH);
  doc.line(splitX, y, splitX, y + summaryH);

  // Esquerda: Pagamento, Vencimentos, Frete, Obs
  let ly = y + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Condições de Pagamento / Vencimentos", margin + 3, ly);
  ly += 4.2;

  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(`Pagamento: ${pagInfo}`, 116)[0], margin + 3, ly);
  ly += 3.8;

  if (vencDisplayLines.length > 0) {
    for (let i = 0; i < vencDisplayLines.length; i += 2) {
      const leftItem = vencDisplayLines[i];
      const rightItem = vencDisplayLines[i + 1];
      doc.setFont("helvetica", "bold");
      doc.text(leftItem, margin + 3, ly);
      if (rightItem) {
        doc.text(rightItem, margin + 62, ly);
      }
      ly += 3.7;
    }
  } else {
    doc.text("Vencimento: ___ / ___ / ______", margin + 3, ly);
    ly += 3.7;
  }

  doc.setFont("helvetica", "normal");
  doc.text(`Frete: ${freteInfo}   |   Prazo: ${prazoInfo}`, margin + 3, ly);
  if (obsLines.length > 0) {
    ly += 3.7;
    doc.text(obsLines, margin + 3, ly);
  }

  // Direita: Totais
  let ry = y + 4.8;
  const rLblX = splitX + 3;
  const rValX = pageWidth - margin - 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Subtotal:", rLblX, ry);
  doc.text(`R$ ${formatBrDecimal(subtotalNum)}`, rValX, ry, { align: "right" });
  ry += 4.2;

  if (descontoNum > 0) {
    doc.text("Desconto:", rLblX, ry);
    doc.text(`- R$ ${formatBrDecimal(descontoNum)}`, rValX, ry, { align: "right" });
    ry += 4.2;
  }

  if (freteNum > 0) {
    doc.text("Frete:", rLblX, ry);
    doc.text(`R$ ${formatBrDecimal(freteNum)}`, rValX, ry, { align: "right" });
    ry += 4.2;
  }

  const totalBarH = 8;
  const totalBarY = y + summaryH - totalBarH;
  doc.setFillColor(243, 244, 246);
  doc.rect(splitX, totalBarY, pageWidth - margin - splitX, totalBarH, "F");
  doc.setLineWidth(0.3);
  doc.line(splitX, totalBarY, pageWidth - margin, totalBarY);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentW, summaryH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("TOTAL:", rLblX, totalBarY + 5.4);
  doc.text(`R$ ${formatBrDecimal(orderTotalNum)}`, rValX, totalBarY + 5.4, { align: "right" });

  // Assinaturas e Caixa de Recebimento / Data da Entrega
  const signTopY = y + summaryH + 4;
  const recBoxW = 104;
  const recBoxH = 22;
  const recBoxX = pageWidth - margin - recBoxW;

  // Assinatura do Vendedor (Esquerda)
  const vendLineY = signTopY + 15;
  doc.setLineWidth(0.35);
  doc.line(margin + 4, vendLineY, margin + 78, vendLineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  const vendSignLabel = order.vendedor_nome
    ? `ASSINATURA DO VENDEDOR (${order.vendedor_nome.toUpperCase()})`
    : "ASSINATURA DO VENDEDOR";
  doc.text(vendSignLabel, margin + 41, vendLineY + 4, { align: "center" });

  // Caixa de Data da Entrega + Assinatura de quem receber (Direita)
  doc.setLineWidth(0.35);
  doc.rect(recBoxX, signTopY, recBoxW, recBoxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("RECEBIMENTO / ENTREGA", recBoxX + 3, signTopY + 4.8);

  // Caixinha da Data da Entrega
  doc.setFontSize(7);
  doc.text("Data da Entrega:", recBoxX + 46, signTopY + 4.8);
  doc.setLineWidth(0.3);
  doc.rect(recBoxX + 68, signTopY + 1.6, 33, 4.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.text("____/____/________", recBoxX + 84.5, signTopY + 5.0, { align: "center" });

  // Linha de assinatura dentro da caixa
  doc.setLineWidth(0.35);
  doc.line(recBoxX + 6, signTopY + 15.5, recBoxX + recBoxW - 6, signTopY + 15.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("ASSINATURA DO CLIENTE / RECEBEDOR", recBoxX + recBoxW / 2, signTopY + 19.5, {
    align: "center",
  });

  // Numeração de páginas e rodapé discreto
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    const pgY = p === 1 ? pageNumberY : margin + 3;
    doc.text(`Página ${p}/${totalPages}`, pageWidth - margin - 3, pgY, { align: "right" });

    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `Documento Auxiliar de Venda — Sem valor fiscal.`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" },
    );
  }

  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  return { doc, blob, file, filename };
}


export async function shareOrderWhatsApp(rawOrder: OrderData, rawItems?: OrderItem[]): Promise<boolean> {
  try {
    const [enriched, logos] = await Promise.all([
      enrichOrderAndItems(rawOrder, rawItems),
      preloadLogos(),
    ]);

    const { file } = await generateOrderPdfDoc(enriched.order, enriched.items, logos);
    const msgWithLink = buildWhatsAppMessage(enriched.order, enriched.items, true);
    const msgWithoutLink = buildWhatsAppMessage(enriched.order, enriched.items, false);

    const isDAV = isOrderDav(enriched.order);
    const num = getOrderNumber(enriched.order);
    const title = `${isDAV ? "Orçamento" : "Pedido"} #${num} - Garden Prime`;

    // 2. Tenta compartilhar via Web Share API com o arquivo PDF anexado
    if (typeof navigator !== "undefined" && navigator.canShare) {
      const shareDataWithFile = {
        title,
        text: msgWithoutLink,
        files: [file],
      };

      if (navigator.canShare(shareDataWithFile)) {
        try {
          await navigator.share(shareDataWithFile);
          return true;
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") {
            return false;
          }
          console.warn("Falha no navigator.share com arquivo, tentando texto:", shareErr);
        }
      }
    }

    // 3. Fallback: Abre o WhatsApp (wa.me) com a mensagem completa e link do PDF
    const url = `https://wa.me/?text=${encodeURIComponent(msgWithLink)}`;
    window.open(url, "_blank");
    return true;
  } catch (err: any) {
    console.error("Erro ao compartilhar pedido no WhatsApp:", err);
    alert("Não foi possível gerar o compartilhamento: " + (err.message || err));
    return false;
  }
}

/**
 * Abre a tela de visualização e impressão oficial do pedido em nova aba com o modal de impressão
 */
export function openOrderPdf(rawOrderOrId: string | OrderData, rawItems?: OrderItem[]): void {
  const param =
    typeof rawOrderOrId === "string"
      ? rawOrderOrId
      : rawOrderOrId
        ? getShortOrderParam(rawOrderOrId)
        : "";
  if (!param) return;
  const url = `/orcamento/${param}`;
  window.open(url, "_blank");
}

/**
 * Faz download direto do arquivo PDF gerado no dispositivo
 */
export async function downloadOrderPdf(rawOrder: OrderData, rawItems?: OrderItem[]): Promise<void> {
  try {
    const [enriched, logos] = await Promise.all([
      enrichOrderAndItems(rawOrder, rawItems),
      preloadLogos(),
    ]);
    const { doc, filename } = await generateOrderPdfDoc(enriched.order, enriched.items, logos);
    doc.save(filename);
  } catch (err: any) {
    console.error("Erro ao baixar PDF:", err);
    // Fallback: abre a rota de visualização
    openOrderPdf(rawOrder);
  }
}

