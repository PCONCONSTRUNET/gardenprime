import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCategoryPriority(cat?: string | null): number {
  if (!cat) return 99;
  const c = cat.toLowerCase().trim();

  // 1. Terra em primeiro lugar
  if (c.includes("terra")) return 1;

  // 2. Substrato em segundo lugar
  if (c.includes("substrat")) return 2;

  // 3. Casca, Adubo e Fertilizantes
  if (c.includes("casca") || c.includes("adubo") || c.includes("fertiliz") || c.includes("npk")) return 3;

  // 4. Mogi Mirim
  if (c.includes("mogi")) return 4;

  // 5. Jardinagem
  if (c.includes("jardinagem")) return 5;

  // 6. Pedra / Pedras Decorativas
  if (c.includes("pedra")) return 6;

  // 9. Ferragens, Suportes, Correntes, Alças (no final de tudo)
  if (
    c.includes("suporte") ||
    c.includes("ferrag") ||
    c.includes("corrente") ||
    c.includes("alça") ||
    c.includes("alca")
  ) {
    return 9;
  }

  // 8. Vasos (no final, conforme solicitado)
  if (c.includes("vaso")) {
    return 8;
  }

  // 7. Intermediários (Pratos, Cuias, Floreiras, Sementeiras, etc.)
  return 7;
}

export function sortCategorias(a: string, b: string): number {
  const pA = getCategoryPriority(a);
  const pB = getCategoryPriority(b);
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
