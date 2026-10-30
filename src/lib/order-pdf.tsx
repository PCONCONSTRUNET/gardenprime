import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, supabaseParceiro } from "@/lib/supabase";
import { calcularVencimentosPadrao } from "@/lib/utils";
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
    emoji?: string;
    imagem?: string;
  };
  produtos?: {
    nome?: string;
    codigo?: string;
    emoji?: string;
    imagem?: string;
  };
  produto_nome?: string;
  codigo?: string;
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

  if (includeLink && typeof window !== "undefined" && order.id) {
    const linkPdf = `${window.location.origin}/orcamento/${order.id}`;
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

  if ((!hasClientName || !hasClientAddressOrCity) && order.id) {
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
        order.created_at = order.created_at || v.created_at;
        if (v.vendedor) {
          order.vendedor_nome = order.vendedor_nome ?? (typeof v.vendedor === "object" ? v.vendedor?.nome : v.vendedor);
        }
        if (v.clientes) {
          order.cliente = {
            nome: v.clientes.nome,
            cpf_cnpj: v.clientes.cpf_cnpj,
            telefone: v.clientes.telefone,
            endereco: v.clientes.endereco,
            numero: v.clientes.numero,
            bairro: v.clientes.bairro,
            cidade: v.clientes.cidade,
            uf: v.clientes.uf,
            cep: v.clientes.cep,
            email: (v.clientes as any).email,
          };
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar venda para enriquecer PDF:", e);
    }

    // Se ainda não achou o cliente completo, tenta em 'davs'
    if ((!order.cliente?.nome || !order.cliente?.cidade) && order.id) {
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
          }

          order.cliente = {
            nome: cliData?.nome || d.cliente_nome || order.cliente?.nome,
            cpf_cnpj: cliData?.cpf_cnpj || d.cliente_cnpj || order.cliente?.cpf_cnpj,
            telefone: cliData?.telefone || d.cliente_telefone || order.cliente?.telefone,
            endereco: cliData?.endereco || d.cliente_endereco || order.cliente?.endereco,
            numero: cliData?.numero || "",
            bairro: cliData?.bairro || d.bairro || order.cliente?.bairro,
            cidade: cliData?.cidade || d.cidade || order.cliente?.cidade,
            uf: cliData?.uf || d.uf || order.cliente?.uf,
            cep: cliData?.cep || order.cliente?.cep,
            email: cliData?.email || d.email || order.cliente?.email,
          };
        }
      } catch (e) {
        console.warn("Erro ao buscar dav para enriquecer PDF:", e);
      }
    }
  }

  // Normalizar objeto cliente
  const rawC = order.cliente || order.clientes || (order as any).client || {};
  let endFormatted = rawC.endereco || (order as any).cliente_endereco || "";
  if (rawC.numero && endFormatted && !endFormatted.includes(String(rawC.numero))) {
    endFormatted = `${endFormatted}, Nº ${rawC.numero}`;
  }

  order.cliente = {
    nome: rawC.nome || (order as any).cliente_nome || "-",
    cpf_cnpj: rawC.cpf_cnpj || rawC.cnpj || rawC.cpf || (order as any).cliente_cnpj || "-",
    telefone: rawC.telefone || rawC.phone || (order as any).cliente_telefone || "-",
    endereco: endFormatted || "-",
    numero: rawC.numero || "",
    bairro: rawC.bairro || (order as any).bairro || "-",
    cidade: rawC.cidade || (order as any).cidade || "-",
    uf: rawC.uf || (order as any).uf || "-",
    cep: rawC.cep || (order as any).cep || "",
    email: rawC.email || (order as any).email || "-",
  };

  // 2. Buscar itens no banco se vieram vazios
  if (!items || items.length === 0) {
    if (order.id) {
      try {
        const vi = await queryDb<any[]>((client) =>
          client
            .from("vendas_itens")
            .select("*, produtos(nome, codigo, emoji, imagem)")
            .eq("venda_id", order.id)
        );

        if (vi && vi.length > 0) {
          items = vi.map((it: any) => ({
            id: it.id,
            produto_id: it.produto_id,
            produto_nome: it.produtos?.nome || it.produto_nome,
            codigo: it.produtos?.codigo || it.codigo,
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
              .select("*, produtos(nome, codigo, emoji, imagem)")
              .eq("dav_id", order.id)
          );

          if (di && di.length > 0) {
            items = di.map((it: any) => ({
              id: it.id,
              produto_id: it.produto_id,
              produto_nome: it.produtos?.nome || it.produto,
              codigo: it.produtos?.codigo || it.codigo,
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

  // 3. Garantir códigos e imagens para todos os itens passados
  const missingCodOrImg = items.filter((it: any) => {
    const hasCod = Boolean(it.codigo || it.produto?.codigo || it.produtos?.codigo || it.produto_codigo || it.cod);
    const hasImg = Boolean(it.imagem || it.produto?.imagem || it.produtos?.imagem);
    return (!hasCod || !hasImg) && (it.produto_id || it.id);
  });

  if (missingCodOrImg.length > 0) {
    const missingIds = missingCodOrImg.map((it: any) => it.produto_id || it.id).filter(Boolean);
    if (missingIds.length > 0) {
      try {
        const prods = await queryDb<any[]>((client) =>
          client
            .from("produtos")
            .select("id, codigo, imagem, nome")
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
                imagem: it.imagem || it.produtos?.imagem || it.produto?.imagem || p.imagem,
                produto_nome: it.produto_nome || it.produtos?.nome || it.produto?.nome || p.nome,
                produtos: {
                  ...it.produtos,
                  codigo: it.produtos?.codigo || p.codigo,
                  imagem: it.produtos?.imagem || p.imagem,
                  nome: it.produtos?.nome || p.nome,
                },
              };
            }
            return it;
          });
        }
      } catch (e) {
        console.warn("Erro ao complementar códigos e imagens dos produtos:", e);
      }
    }
  }

  // Normalizar campos em cada item
  items = items.map((it: any) => ({
    ...it,
    codigo: it.codigo || it.produtos?.codigo || it.produto?.codigo || it.produto_codigo || it.cod || "-",
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
  logos?: { prime?: string | null; plus?: string | null; icons?: any },
): Promise<{ doc: jsPDF; blob: Blob; file: File; filename: string }> {
  if (!logos) {
    logos = await preloadLogos();
  }

  // Buscar configurações da empresa
  let config: any = null;
  try {
    const active = await getActiveSupabase();
    const { data } = await active.from("configuracoes").select("*").eq("id", 1).single();
    if (data) config = data;
  } catch (e) {
    console.error("Erro ao buscar configuracoes da empresa para o PDF", e);
  }

  // Load images
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

  for (const it of items) {
    const imgUrl = (it as any).imagem || (it.produto as any)?.imagem || (it.produtos as any)?.imagem;
    if (imgUrl) {
      const b64 = await toBase64(imgUrl);
      if (b64) {
        (it as any)._imagemBase64 = b64;
      }
    }
  }

  const isDAV = isOrderDav(order);
  const docType = isDAV ? "ORÇAMENTO" : "PEDIDO";
  const num = getOrderNumber(order);
  const filename = `${isDAV ? "orcamento" : "pedido"}_${num}.pdf`;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  const colorDark = [23, 31, 30] as [number, number, number]; // #171F1E
  const colorGold = [197, 160, 89] as [number, number, number]; // #C5A059
  const colorGray = [243, 244, 246] as [number, number, number]; // #F3F4F6

  // 1. CABEÇALHO CLARO
  // Logo Garden Prime
  const primeLogo = logos?.prime || cachedLogos?.prime;
  const logo02 = logos?.plus || cachedLogos?.plus;

  if (primeLogo) {
    try {
      doc.addImage(primeLogo, "PNG", margin, y, 45, 15.2);
    } catch {}
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.text("GARDEN PRIME", margin, y + 8);
  }

  // Logo 02 embaixo da Garden Prime (tamanho médio para bem grande)
  if (logo02) {
    try {
      doc.addImage(logo02, "PNG", margin + 6, y + 16, 32, 14.1);
    } catch {}
  }

  // Divisor 1
  const div1X = margin + 58;
  doc.setDrawColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.setLineWidth(0.4);
  doc.line(div1X, y + 1, div1X, y + 30);

  // Info Empresa (negrito e preto bem definido)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const infoX = div1X + 4;
  doc.text(`CNPJ: ${config?.cnpj || "50.387.381/0001-81"}`, infoX, y + 5);
  doc.text(`Inscr. Estadual: ${config?.inscricao_estadual || "266031100110"}`, infoX, y + 9);
  
  const tipo = config?.tipo_logradouro ? config.tipo_logradouro + " " : "";
  const end = config?.endereco || "MATEUS RODRIGUES DA COSTA";
  const numero = config?.numero ? ", " + config.numero : "";
  const compl = config?.complemento ? " " + config.complemento : "";
  const bairro = config?.bairro ? ", " + config.bairro : "";
  doc.text(`${tipo}${end}${numero}${compl}${bairro}`, infoX, y + 13);
  
  const mun = config?.municipio || "Charqueada";
  const uf = config?.uf || "SP";
  const cep = config?.cep ? " - CEP " + config.cep : "";
  doc.text(`${mun} - ${uf}${cep}`, infoX, y + 17);
  
  const cel = config?.celular || config?.telefone || "(19) 99930-8784";
  doc.text(cel, infoX, y + 21);
  
  doc.text(config?.email_contato || "garden-plus@hotmail.com", infoX, y + 25);

  // Slogan Top Right
  doc.setFont("times", "bolditalic");
  doc.setFontSize(14);
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Mais verde", pageWidth - margin - 40, y + 8);
  doc.text("para um futuro", pageWidth - margin - 40, y + 13);
  doc.text("melhor!", pageWidth - margin - 35, y + 18);

  y += 33;

  let orderVenc = (order as any).vencimentos;
  if (!Array.isArray(orderVenc) || orderVenc.length === 0) {
    if (order.condicao_pagamento && order.condicao_pagamento.trim() !== "") {
      orderVenc = calcularVencimentosPadrao(
        order.condicao_pagamento,
        order.created_at,
        order.valor_total || order.total
      );
    }
  }
  const hasVencList = Array.isArray(orderVenc) && orderVenc.length > 0;
  const numVenc = hasVencList ? orderVenc.length : 1;
  const extraHeight = numVenc > 1 ? (numVenc - 1) * 3.8 : 0;

  // 2. BLOCO ESCURO (TÍTULO)
  doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 23.5 + extraHeight, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(docType, margin + 18, y + 9.5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`DAV Nº: ${num}`, margin + 18, y + 15.5);

  const dataEmissao = new Date(order.created_at).toLocaleDateString("pt-BR");
  const horaEmissao = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  
  // Emissão
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Emissão", margin + 74, y + 8);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${dataEmissao} às ${horaEmissao}`, margin + 74, y + 13.5);

  // Validade – padrão: 30 dias a partir da emissão
  let validadeStr: string;
  if ((order as any).validade) {
    validadeStr = new Date((order as any).validade).toLocaleDateString("pt-BR");
  } else {
    const base = order.created_at ? new Date(order.created_at) : new Date();
    base.setDate(base.getDate() + 30);
    validadeStr = base.toLocaleDateString("pt-BR");
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Validade", margin + 114, y + 8);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(validadeStr, margin + 114, y + 13.5);

  // Box Preto de Condições Comerciais com campo de Vencimento
  const boxW = 66;
  const boxX = pageWidth - margin - boxW;
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(boxX, y + 1.2, boxW - 1, 21 + extraHeight, 1, 1, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("CONDIÇÕES COMERCIAIS", boxX + 3.5, y + 5.5);
  doc.text(`Pagamento: ${order.condicao_pagamento || "Não informado"}`, boxX + 3.5, y + 9.5);

  let freteY = y + 18.2;

  if (hasVencList && numVenc > 1) {
    // Múltiplos vencimentos organizados 1 EM BAIXO DO OUTRO
    doc.text("Vencimentos:", boxX + 3.5, y + 13.8);
    const vBoxX = boxX + 21;
    const vBoxW = 40;
    const vBoxH = numVenc * 3.6 + 0.6;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(vBoxX, y + 11.0, vBoxW, vBoxH, 0.6, 0.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(10, 10, 10);

    orderVenc.forEach((v: any, idx: number) => {
      const d = typeof v === "object" && v !== null ? v.data : v;
      const clean = (d || "").split("T")[0].split("-");
      const dtBr = clean.length === 3 ? `${clean[2]}/${clean[1]}/${clean[0]}` : d;
      const lineY = y + 13.8 + (idx * 3.6);
      doc.text(`${idx + 1}ª:  ${dtBr}`, vBoxX + vBoxW / 2, lineY, { align: "center" });
    });

    freteY = y + 11.0 + vBoxH + 3.4;
  } else {
    // 1 Vencimento ou campo para preenchimento a mão
    doc.text("Vencimento:", boxX + 3.5, y + 13.8);
    const vBoxX = boxX + 21;
    const vBoxW = 40;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(vBoxX, y + 11.2, vBoxW, 3.8, 0.5, 0.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(40, 40, 40);

    let vencTexto = "___ / ___ / ______";
    if (hasVencList && numVenc === 1) {
      const d = typeof orderVenc[0] === "object" && orderVenc[0] !== null ? orderVenc[0].data : orderVenc[0];
      const clean = (d || "").split("T")[0].split("-");
      vencTexto = clean.length === 3 ? `${clean[2]}/${clean[1]}/${clean[0]}` : d;
    }
    doc.text(vencTexto, vBoxX + vBoxW / 2, y + 13.9, { align: "center" });
    freteY = y + 18.2;
  }

  // Frete e Prazo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  const freteInfo = order.frete_tipo || (order as any).frete || "Retirada";
  const prazoInfo = order.prazo_entrega || (order as any).prazo || "Imediato";
  doc.text(`Frete: ${freteInfo} | Prazo: ${prazoInfo}`, boxX + 3.5, freteY);

  y += (29 + extraHeight);

  // 3. DADOS DO CLIENTE
  doc.setFillColor(colorGray[0], colorGray[1], colorGray[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 2, 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("DADOS DO CLIENTE", margin + 10, y + 6);
  
  const c = order.cliente || order.clientes || ({} as any);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  const labelX1 = margin + 5;
  const valX1 = margin + 25;
  const labelX2 = margin + 85;
  const valX2 = margin + 105;

  let cy = y + 14;
  doc.text("Nome:", labelX1, cy); doc.text(String(c.nome || "-"), valX1, cy);
  doc.text("Bairro:", labelX2, cy); doc.text(String(c.bairro || "-"), valX2, cy);
  cy += 5;
  doc.text("CNPJ/CPF:", labelX1, cy); doc.text(String(c.cpf_cnpj || "-"), valX1, cy);
  doc.text("Cidade:", labelX2, cy); doc.text(String(c.cidade || "-"), valX2, cy);
  cy += 5;
  doc.text("Telefone:", labelX1, cy); doc.text(String(c.telefone || "-"), valX1, cy);
  doc.text("UF:", labelX2, cy); doc.text(String(c.uf || "-"), valX2, cy);
  cy += 5;
  doc.text("Endereço:", labelX1, cy); doc.text(String(c.endereco || "-"), valX1, cy);
  doc.text("E-mail:", labelX2, cy); doc.text(String(c.email || "-"), valX2, cy);

  // Obrigado box
  const obX = pageWidth - margin - 50;
  doc.setFillColor(250, 250, 245);
  doc.roundedRect(obX, y + 4, 45, 24, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Obrigado pela", obX + 15, y + 10);
  doc.text("sua confiança!", obX + 15, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text("Estamos à disposição", obX + 15, y + 20);
  doc.text("para lhe atender sempre!", obX + 15, y + 23);

  y += 38;

  // 4. PRODUTOS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("PRODUTOS", margin + 10, y + 2);
  y += 6;

  const tableBody = items.map((it) => {
    const nome = it.produto_nome || it.produto?.nome || it.produtos?.nome || (it as any).produto || "Produto Indisponível";
    const codigo = it.codigo || it.produto?.codigo || it.produtos?.codigo || (it as any).produto_codigo || (it as any).cod || "-";
    const qtd = Number(it.quantidade || it.qtd || 1).toString();
    const vUnit = `R$ ${Number(it.valor_unitario || 0).toFixed(2).replace(".", ",")}`;
    const vTotal = `R$ ${Number(it.total || it.subtotal || 0).toFixed(2).replace(".", ",")}`;
    return [String(codigo), "", nome, qtd, vUnit, vTotal, (it as any)._imagemBase64 || ""];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - margin * 2,
    head: [["Código", "", "Produto", "Qtd", "Vlr. Unit.", "Vlr. Total"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: colorDark,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      valign: "middle",
      overflow: "linebreak",
      fontStyle: "bold",
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 15, fontStyle: "bold" },
      1: { cellWidth: 14 }, // Imagem
      2: { halign: "left", fontStyle: "bold" }, // Produto (flex - ocupa o restante)
      3: { halign: "center", cellWidth: 12, fontStyle: "bold" }, // Qtd
      4: { halign: "right", cellWidth: 22, fontStyle: "bold" }, // Unit
      5: { halign: "right", cellWidth: 27, fontStyle: "bold" }, // Total
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawCell: (data) => {
      // Draw image in column index 1
      if (data.section === "body" && data.column.index === 1) {
        const rowData = data.row.raw as string[];
        const imgBase64 = rowData[6];
        if (imgBase64) {
          try {
            doc.addImage(imgBase64, "JPEG", data.cell.x + 2, data.cell.y + 1, 10, 10);
          } catch {}
        }
      }
    },
    willDrawCell: (_data) => {
      // hook disponível para customizações futuras
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // 5. SUBTOTAL E TOTAL
  const totW = 60;
  const totX = pageWidth - margin - totW;
  
  doc.setFillColor(colorGray[0], colorGray[1], colorGray[2]);
  doc.rect(totX, y, totW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Subtotal", totX + 2, y + 5);
  const vSub = `R$ ${Number(order.subtotal || order.valor_total || 0).toFixed(2).replace(".", ",")}`;
  doc.text(vSub, totX + totW - 2, y + 5, { align: "right" });
  
  y += 8;
  doc.setFillColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.rect(totX, y, totW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", totX + 2, y + 5.5);
  const vTot = `R$ ${Number(order.valor_total || order.total || 0).toFixed(2).replace(".", ",")}`;
  doc.text(vTot, totX + totW - 2, y + 5.5, { align: "right" });

  y += 25;

  // 6. ASSINATURAS
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);
  doc.line(margin + 5, y, margin + 65, y);
  doc.line(margin + 80, y, margin + 140, y);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(0, 0, 0);
  doc.text("ASSINATURA DO VENDEDOR", margin + 35, y + 4, { align: "center" });
  doc.text("ASSINATURA DO CLIENTE", margin + 110, y + 4, { align: "center" });
  
  // Caixa Este doc nao possui valor fiscal
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin + 150, y - 5, 40, 12, 1, 1, "F");
  doc.setDrawColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.roundedRect(margin + 150, y - 5, 40, 12, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.setTextColor(50, 50, 50);
  doc.text("Este documento não possui", margin + 155, y - 1);
  doc.text("valor fiscal, é apenas um", margin + 155, y + 2);
  doc.text("Documento Auxiliar de Venda.", margin + 155, y + 5);

  // 7. RODAPÉ ESCURO
  const footerH = 20;
  doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.rect(0, pageHeight - footerH, pageWidth, footerH, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(220, 220, 220);
  doc.text("Qualidade em cada detalhe", 25, pageHeight - 10);
  doc.text("Entrega rápida e segura", 75, pageHeight - 10);
  doc.text("Produtos selecionados para o seu jardim", 125, pageHeight - 10);
  
  if (primeLogo) {
    try {
      doc.addImage(primeLogo, "PNG", pageWidth - 55, pageHeight - 16, 26, 7);
    } catch {}
  }
  if (logo02) {
    try {
      doc.addImage(logo02, "PNG", pageWidth - 28, pageHeight - 16, 20, 8.8);
    } catch {}
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
  const id = typeof rawOrderOrId === "string" ? rawOrderOrId : rawOrderOrId?.id;
  if (!id) return;
  const url = `/orcamento/${id}`;
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
    openOrderPdf(rawOrder.id);
  }
}

