import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabaseParceiro as supabase } from "@/lib/supabase";
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
  produto?: {
    nome?: string;
    codigo?: string;
    emoji?: string;
  };
  produtos?: {
    nome?: string;
    codigo?: string;
  };
  produto_nome?: string;
  codigo?: string;
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
  observacoes?: string;
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
  } | null;
  clientes?: {
    nome?: string;
    cpf_cnpj?: string;
    telefone?: string;
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
  return order.cliente?.nome || order.clientes?.nome || "Cliente não informado";
}

/**
 * Retorna o tipo legível: Orçamento ou Pedido
 */
export function isOrderDav(order: OrderData): boolean {
  return order.tipo === "DAV";
}

/**
 * Busca os itens do pedido no Supabase caso não tenham sido passados
 */
export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  try {
    const { data, error } = await supabase
      .from("vendas_itens")
      .select("*, produto:produtos(nome, codigo, emoji, imagem)")
      .eq("venda_id", orderId);

    if (error) {
      console.warn("Erro ao buscar vendas_itens:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error("Falha ao buscar itens:", e);
    return [];
  }
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
      toBase64("/garden-prime-logo.png"),
      toBase64("/garden-plus.png"),
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
    const imgUrl = (it.produto as any)?.imagem || (it.produtos as any)?.imagem;
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
  // Logo left
  const primeLogo = logos?.prime || cachedLogos?.prime;
  if (primeLogo) {
    try {
      doc.addImage(primeLogo, "PNG", margin, y, 50, 20); // adjust size
    } catch {}
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.text("GARDEN PRIME", margin, y + 10);
    doc.setFontSize(10);
    doc.text("TERRA VEGETAL E VASOS", margin, y + 15);
  }

  // Divisor 1
  const div1X = margin + 65;
  doc.setDrawColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.line(div1X, y + 2, div1X, y + 18);

  // Info Empresa
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  const infoX = div1X + 4;
  doc.text("CNPJ: 63.874.628/0001-36", infoX, y + 5);
  doc.text("Inscr. Estadual: 266.037.553.113", infoX, y + 8);
  doc.text("Rua Santa Teresinha, 86 - Paraisolândia", infoX, y + 12);
  doc.text("Charqueada - SP", infoX, y + 15);
  doc.text("(19) 99714-1112", infoX, y + 19);
  doc.text("contato@gardenprime.com.br", infoX, y + 23);

  // Slogan Top Right
  doc.setFont("times", "italic");
  doc.setFontSize(14);
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Mais verde", pageWidth - margin - 40, y + 8);
  doc.text("para um futuro", pageWidth - margin - 40, y + 13);
  doc.text("melhor!", pageWidth - margin - 35, y + 18);

  y += 28;

  // 2. BLOCO ESCURO (TÍTULO)
  doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(docType, margin + 20, y + 9);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`DAV Nº: ${num}`, margin + 20, y + 15);

  const dataEmissao = new Date(order.created_at).toLocaleDateString("pt-BR");
  const horaEmissao = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  
  // Emissão
  doc.setFontSize(6);
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Emissão", margin + 80, y + 8);
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`${dataEmissao} às ${horaEmissao}`, margin + 80, y + 13);

  // Validade
  let validadeStr = "--/--/----";
  if ((order as any).validade) validadeStr = new Date((order as any).validade).toLocaleDateString("pt-BR");
  doc.setFontSize(6);
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Validade", margin + 120, y + 8);
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(validadeStr, margin + 120, y + 13);

  // Box Dourado de Condições Comerciais
  const boxW = 60;
  doc.setFillColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.roundedRect(pageWidth - margin - boxW, y + 2, boxW - 2, 18, 1, 1, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.text("CONDIÇÕES COMERCIAIS", pageWidth - margin - boxW + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(`Pagamento: ${order.condicao_pagamento || "Não informado"}`, pageWidth - margin - boxW + 4, y + 11);
  doc.text(`Frete: Retirada | Prazo: Imediato`, pageWidth - margin - boxW + 4, y + 15);

  y += 28;

  // 3. DADOS DO CLIENTE
  doc.setFillColor(colorGray[0], colorGray[1], colorGray[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 2, 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text("DADOS DO CLIENTE", margin + 10, y + 6);
  
  const c = order.cliente || order.clientes || ({} as any);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  const labelX1 = margin + 5;
  const valX1 = margin + 25;
  const labelX2 = margin + 85;
  const valX2 = margin + 105;

  let cy = y + 14;
  doc.text("Nome:", labelX1, cy); doc.text(c.nome || "-", valX1, cy);
  doc.text("Bairro:", labelX2, cy); doc.text(c.bairro || "-", valX2, cy);
  cy += 5;
  doc.text("CNPJ/CPF:", labelX1, cy); doc.text(c.cpf_cnpj || "-", valX1, cy);
  doc.text("Cidade:", labelX2, cy); doc.text(c.cidade || "-", valX2, cy);
  cy += 5;
  doc.text("Telefone:", labelX1, cy); doc.text(c.telefone || "-", valX1, cy);
  doc.text("UF:", labelX2, cy); doc.text(c.uf || "-", valX2, cy);
  cy += 5;
  doc.text("Endereço:", labelX1, cy); doc.text(c.endereco || "-", valX1, cy);
  doc.text("E-mail:", labelX2, cy); doc.text(c.email || "-", valX2, cy);

  // Obrigado box
  const obX = pageWidth - margin - 50;
  doc.setFillColor(250, 250, 245);
  doc.roundedRect(obX, y + 4, 45, 24, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.text("Obrigado pela", obX + 15, y + 10);
  doc.text("sua confiança!", obX + 15, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text("Estamos à disposição", obX + 15, y + 20);
  doc.text("para lhe atender sempre!", obX + 15, y + 23);

  y += 38;

  // 4. PRODUTOS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text("PRODUTOS", margin + 10, y + 2);
  y += 6;

  const tableBody = items.map((it) => {
    const nome = it.produto_nome || it.produto?.nome || it.produtos?.nome || "Produto Indisponível";
    const codigo = it.codigo || it.produto?.codigo || it.produtos?.codigo || "-";
    const qtd = Number(it.quantidade || it.qtd || 1).toString();
    const vUnit = `R$ ${Number(it.valor_unitario || 0).toFixed(2).replace(".", ",")}`;
    const vTotal = `R$ ${Number(it.total || it.subtotal || 0).toFixed(2).replace(".", ",")}`;
    return [codigo, "", nome, qtd, vUnit, vTotal, (it as any)._imagemBase64 || ""];
  });

  autoTable(doc, {
    startY: y,
    head: [["Código", "", "Produto", "Qtd", "Vlr. Unit.", "Vlr. Total"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: colorDark,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    styles: {
      fontSize: 7,
      cellPadding: 3,
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 15 },
      1: { cellWidth: 15 }, // Imagem
      2: { halign: "left" }, // Produto
      3: { halign: "center", cellWidth: 15 }, // Qtd
      4: { halign: "center", cellWidth: 20 }, // Unit
      5: { halign: "right", cellWidth: 25, fontStyle: "bold" }, // Total
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
    willDrawCell: (data) => {
       // if we want to change text color dynamically we can do it here
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // 5. SUBTOTAL E TOTAL
  const totW = 60;
  const totX = pageWidth - margin - totW;
  
  doc.setFillColor(colorGray[0], colorGray[1], colorGray[2]);
  doc.rect(totX, y, totW, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text("Subtotal", totX + 2, y + 5);
  const vSub = `R$ ${Number(order.subtotal || order.valor_total || 0).toFixed(2).replace(".", ",")}`;
  doc.text(vSub, totX + totW - 2, y + 5, { align: "right" });
  
  y += 8;
  doc.setFillColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.rect(totX, y, totW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", totX + 2, y + 5.5);
  const vTot = `R$ ${Number(order.valor_total || order.total || 0).toFixed(2).replace(".", ",")}`;
  doc.text(vTot, totX + totW - 2, y + 5.5, { align: "right" });

  y += 25;

  // 6. ASSINATURAS
  doc.setDrawColor(200, 200, 200);
  doc.line(margin + 5, y, margin + 65, y);
  doc.line(margin + 80, y, margin + 140, y);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(50, 50, 50);
  doc.text("ASSINATURA DO VENDEDOR", margin + 35, y + 4, { align: "center" });
  doc.text("ASSINATURA DO CLIENTE", margin + 110, y + 4, { align: "center" });
  
  // Caixa Este doc nao possui valor fiscal
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin + 150, y - 5, 40, 12, 1, 1, "F");
  doc.setDrawColor(colorGold[0], colorGold[1], colorGold[2]);
  doc.roundedRect(margin + 150, y - 5, 40, 12, 1, 1, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(100, 100, 100);
  doc.text("Este documento não possui", margin + 155, y - 1);
  doc.text("valor fiscal, é apenas um", margin + 155, y + 2);
  doc.text("Documento Auxiliar de Venda.", margin + 155, y + 5);

  // 7. RODAPÉ ESCURO
  const footerH = 20;
  doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.rect(0, pageHeight - footerH, pageWidth, footerH, "F");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(200, 200, 200);
  doc.text("Qualidade em cada detalhe", 30, pageHeight - 10);
  doc.text("Entrega rápida e segura", 80, pageHeight - 10);
  doc.text("Produtos selecionados para o seu jardim", 130, pageHeight - 10);
  
  if (primeLogo) {
    try {
      // Trying to add logo to footer
      doc.addImage(primeLogo, "PNG", pageWidth - 45, pageHeight - 15, 30, 12);
    } catch {}
  }

  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  return { doc, blob, file, filename };
}


export async function shareOrderWhatsApp(order: OrderData, items?: OrderItem[]): Promise<boolean> {
  try {
    // Garante que temos os itens e logos carregados
    const [loadedItems, logos] = await Promise.all([
      items && items.length > 0 ? items : fetchOrderItems(order.id),
      preloadLogos(),
    ]);

    // 1. Gera o documento PDF e o arquivo .pdf com os logos
    const { file, filename } = await generateOrderPdfDoc(order, loadedItems, logos);
    const msg = buildWhatsAppMessage(order, loadedItems);
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
    const imgUrl = (it.produto as any)?.imagem || (it.produtos as any)?.imagem;
    if (imgUrl) {
      const b64 = await toBase64(imgUrl);
      if (b64) {
        (it as any)._imagemBase64 = b64;
      }
    }
  }

  const isDAV = isOrderDav(order);
    const num = getOrderNumber(order);
    const title = `${isDAV ? "Orçamento" : "Pedido"} #${num} - Garden Prime`;

    // 2. Tenta compartilhar via Web Share API com o arquivo PDF anexado
    if (typeof navigator !== "undefined" && navigator.canShare) {
      const shareDataWithFile = {
        title,
        text: msg,
        files: [file],
      };

      if (navigator.canShare(shareDataWithFile)) {
        try {
          await navigator.share(shareDataWithFile);
          return true;
        } catch (shareErr: any) {
          // Se o usuário cancelou o menu de compartilhamento, não faz nada
          if (shareErr.name === "AbortError") {
            return false;
          }
          console.warn("Falha no navigator.share com arquivo, tentando texto:", shareErr);
        }
      }
    }

    // 3. Fallback: Abre o WhatsApp (wa.me) com a mensagem completa e link do PDF
    // O wa.me sem telefone abre a lista de contatos do WhatsApp para o vendedor escolher para quem enviar
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    return true;
  } catch (err: any) {
    console.error("Erro ao compartilhar pedido no WhatsApp:", err);
    alert("Não foi possível gerar o compartilhamento: " + (err.message || err));
    return false;
  }
}

/**
 * Abre a visualização / impressão oficial do PDF do pedido em uma nova aba
 */
export function openOrderPdf(orderId: string): void {
  const url = `/orcamento/${orderId}`;
  window.open(url, "_blank");
}

/**
 * Faz download direto do arquivo PDF gerado no dispositivo
 */
export async function downloadOrderPdf(order: OrderData, items?: OrderItem[]): Promise<void> {
  try {
    const [loadedItems, logos] = await Promise.all([
      items && items.length > 0 ? items : fetchOrderItems(order.id),
      preloadLogos(),
    ]);
    const { doc, filename } = await generateOrderPdfDoc(order, loadedItems, logos);
    doc.save(filename);
  } catch (err: any) {
    console.error("Erro ao baixar PDF:", err);
    // Fallback: abre a rota de visualização
    openOrderPdf(order.id);
  }
}
