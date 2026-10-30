import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cache em memória da ordem customizada das categorias
let customCategoryOrderCache: string[] = [];

export function setCustomCategoryOrder(order: string[] | null | undefined) {
  if (Array.isArray(order) && order.length > 0) {
    customCategoryOrderCache = order;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("gardenprime_ordem_categorias", JSON.stringify(order));
      }
    } catch {}
  } else {
    customCategoryOrderCache = [];
  }
}

export function getCustomCategoryOrder(): string[] {
  if (customCategoryOrderCache.length > 0) {
    return customCategoryOrderCache;
  }
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gardenprime_ordem_categorias");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customCategoryOrderCache = parsed;
          return customCategoryOrderCache;
        }
      }
    }
  } catch {}
  return [];
}

/**
 * Carrega a ordem salva das categorias do banco de dados (tabela configuracoes)
 */
export async function loadCategoryOrderFromDb(): Promise<string[]> {
  try {
    const { data } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();
    let order: string[] | null = null;
    if (data?.ordem_categorias) {
      order = typeof data.ordem_categorias === "string" ? JSON.parse(data.ordem_categorias) : data.ordem_categorias;
    } else if (data?.fax && typeof data.fax === "string" && data.fax.startsWith('["')) {
      try {
        order = JSON.parse(data.fax);
      } catch {}
    }
    if (Array.isArray(order) && order.length > 0) {
      setCustomCategoryOrder(order);
      return order;
    }
  } catch (e) {
    console.warn("Erro ao carregar ordem de categorias:", e);
  }
  return getCustomCategoryOrder();
}

/**
 * Salva a ordem manual das categorias no banco de dados para todo o sistema
 */
export async function saveCategoryOrderToDb(newOrder: string[]): Promise<{ success: boolean; error?: string }> {
  setCustomCategoryOrder(newOrder);
  try {
    // 1. Tenta salvar na coluna oficial ordem_categorias
    const res1 = await supabase.from("configuracoes").update({ ordem_categorias: newOrder }).eq("id", 1);
    if (!res1.error) {
      return { success: true };
    }

    // 2. Se a coluna ordem_categorias não existe ainda no PostgreSQL, salva como fallback seguro em 'fax'
    const jsonStr = JSON.stringify(newOrder);
    const res2 = await supabase.from("configuracoes").update({ fax: jsonStr }).eq("id", 1);
    if (!res2.error) {
      return { success: true };
    }

    return { success: false, error: res1.error?.message || res2.error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getCategoryPriority(cat?: string | null, customOrder?: string[]): number {
  if (!cat) return 999;
  const orderList = customOrder && customOrder.length > 0 ? customOrder : getCustomCategoryOrder();

  if (orderList.length > 0) {
    const norm = cat.trim().toLowerCase();
    const idx = orderList.findIndex((item) => item.trim().toLowerCase() === norm);
    if (idx !== -1) {
      return idx; // Posição exata definida manualmente: 0, 1, 2, 3...
    }
  }

  // Se não estiver na lista customizada, segue as regras inteligentes de prioridade
  const c = cat.toLowerCase().trim();
  const offset = orderList.length > 0 ? 1000 : 0;

  // 1. Terra em primeiro lugar
  if (c.includes("terra")) return offset + 1;

  // 2. Substrato em segundo lugar
  if (c.includes("substrat")) return offset + 2;

  // 3. Casca, Adubo e Fertilizantes
  if (c.includes("casca") || c.includes("adubo") || c.includes("fertiliz") || c.includes("npk")) return offset + 3;

  // 4. Mogi Mirim
  if (c.includes("mogi")) return offset + 4;

  // 5. Jardinagem
  if (c.includes("jardinagem")) return offset + 5;

  // 6. Pedra / Pedras Decorativas
  if (c.includes("pedra")) return offset + 6;

  // 9. Ferragens, Suportes, Correntes, Alças (no final de tudo)
  if (
    c.includes("suporte") ||
    c.includes("ferrag") ||
    c.includes("corrente") ||
    c.includes("alça") ||
    c.includes("alca")
  ) {
    return offset + 9;
  }

  // 8. Vasos (no final, conforme solicitado)
  if (c.includes("vaso")) {
    return offset + 8;
  }

  // 7. Intermediários (Pratos, Cuias, Floreiras, Sementeiras, etc.)
  return offset + 7;
}

export function sortCategorias(a: string, b: string, customOrder?: string[]): number {
  const pA = getCategoryPriority(a, customOrder);
  const pB = getCategoryPriority(b, customOrder);
  if (pA !== pB) return pA - pB;
  return a.localeCompare(b, "pt-BR");
}

/**
 * Regra de faturamento por boleto:
 * - Até R$ 1.000,00 -> 28 dias
 * - Acima de R$ 1.000,00 -> 28, 35, 42 dias
 */
export function getPrazoBoleto(valorTotal: number): string {
  if (valorTotal <= 1000) {
    return "28 dias";
  }
  return "28, 35, 42 dias";
}

export function getDescricaoBoleto(valorTotal: number): string {
  const prazo = getPrazoBoleto(valorTotal);
  return `Boleto a Prazo (${prazo})`;
}

export function getRotuloFaixaBoleto(valorTotal: number): string {
  if (valorTotal <= 1000) {
    return "28 dias (pedidos até R$ 1.000)";
  }
  return "28, 35, 42 dias (pedidos acima de R$ 1.000)";
}

/**
 * Remove qualquer menção a valores de custo ou preços internos (como Fardo: R$ ...)
 * da descrição complementar para não confundir os clientes finais nos catálogos públicos.
 */
export function limparDescricaoComplementar(desc?: string | null): string {
  if (!desc) return "";
  return desc
    .replace(/\s*\|\s*Fardo:\s*R\$?\s*[\d.,]+/gi, "")
    .replace(/Fardo:\s*R\$?\s*[\d.,]+\s*\|\s*/gi, "")
    .replace(/Fardo:\s*R\$?\s*[\d.,]+/gi, "")
    .replace(/\s*\|\s*Custo:\s*R\$?\s*[\d.,]+/gi, "")
    .replace(/Custo:\s*R\$?\s*[\d.,]+/gi, "")
    .trim();
}

export interface ParcelaVencimento {
  parcela: number;
  data: string; // YYYY-MM-DD
  label?: string;
  valor?: number;
}

/**
 * Formata string YYYY-MM-DD para DD/MM/AAAA
 */
export function formatarDataBr(dataStr?: string | null): string {
  if (!dataStr) return "";
  const clean = dataStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dataStr;
}

/**
 * Retorna resumo legível dos vencimentos para impressão ou badges
 * Ex: 28/11/2026 | 05/12/2026 | 12/12/2026
 */
export function formatarVencimentosResumo(vencimentos?: any[] | null): string {
  if (!Array.isArray(vencimentos) || vencimentos.length === 0) return "";
  return vencimentos
    .map((v, i) => {
      const d = typeof v === "object" && v !== null ? v.data : v;
      const dataBr = formatarDataBr(d);
      return vencimentos.length > 1 ? `${i + 1}ª: ${dataBr}` : dataBr;
    })
    .join(" | ");
}

/**
 * Calcula vencimentos padrão sugeridos a partir da condição de pagamento
 */
export function calcularVencimentosPadrao(
  condicao: string = "",
  dataBaseStr?: string,
  valorTotal?: number
): ParcelaVencimento[] {
  const base = dataBaseStr ? new Date(dataBaseStr) : new Date();
  const validBase = isNaN(base.getTime()) ? new Date() : base;

  const addDays = (d: Date, days: number): string => {
    const copy = new Date(d.getTime());
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().split("T")[0];
  };

  const c = (condicao || "").toLowerCase().trim();

  // 1. Detectar padrões com entrada + dias (ex: "Entrada + 30 dias")
  const numeros = c.match(/\d+/g)?.map(Number) || [];

  if (c.includes("entrada") && numeros.length > 0) {
    const res: ParcelaVencimento[] = [
      { parcela: 1, data: validBase.toISOString().split("T")[0], label: "Entrada" },
    ];
    numeros.forEach((num, idx) => {
      res.push({
        parcela: idx + 2,
        data: addDays(validBase, num),
        label: `${idx + 2}ª Parcela (${num} dias)`,
      });
    });
    return res;
  }

  // 2. Múltiplos prazos (ex: "28, 35, 42 dias" ou "30/60/90" ou "30/60")
  if (numeros.length > 1) {
    return numeros.map((dias, idx) => ({
      parcela: idx + 1,
      data: addDays(validBase, dias),
      label: `${idx + 1}º Vencimento (${dias} dias)`,
    }));
  }

  // 3. Apenas um número (ex: "30 dias", "28 dias")
  if (numeros.length === 1) {
    if (c.includes("2x") || c.includes("2 x")) {
      return [
        { parcela: 1, data: addDays(validBase, 30), label: "1º Vencimento (30 dias)" },
        { parcela: 2, data: addDays(validBase, 60), label: "2º Vencimento (60 dias)" },
      ];
    }
    if (c.includes("3x") || c.includes("3 x")) {
      return [
        { parcela: 1, data: addDays(validBase, 30), label: "1º Vencimento (30 dias)" },
        { parcela: 2, data: addDays(validBase, 60), label: "2º Vencimento (60 dias)" },
        { parcela: 3, data: addDays(validBase, 90), label: "3º Vencimento (90 dias)" },
      ];
    }
    return [
      { parcela: 1, data: addDays(validBase, numeros[0]), label: `1º Vencimento (${numeros[0]} dias)` },
    ];
  }

  // 4. Cartão parcelado sem número de dias especificado (ex: "2x sem juros", "3x sem juros")
  if (c.includes("2x") || c.includes("2 x")) {
    return [
      { parcela: 1, data: addDays(validBase, 30), label: "1ª Parcela (30 dias)" },
      { parcela: 2, data: addDays(validBase, 60), label: "2ª Parcela (60 dias)" },
    ];
  }
  if (c.includes("3x") || c.includes("3 x")) {
    return [
      { parcela: 1, data: addDays(validBase, 30), label: "1ª Parcela (30 dias)" },
      { parcela: 2, data: addDays(validBase, 60), label: "2ª Parcela (60 dias)" },
      { parcela: 3, data: addDays(validBase, 90), label: "3ª Parcela (90 dias)" },
    ];
  }

  // 5. Padrão à vista / Pix / Dinheiro / Boleto à vista
  return [
    { parcela: 1, data: validBase.toISOString().split("T")[0], label: "1º Vencimento" },
  ];
}