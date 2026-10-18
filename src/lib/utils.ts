import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCategoryPriority(cat?: string | null): number {
  if (!cat) return 99;
  const c = cat.toLowerCase().trim();

  // 1. Mogi Mirim em primeiro
  if (c.includes("mogi")) return 1;

  // 2. Jardinagem em segundo
  if (c.includes("jardinagem")) return 2;

  // 3. Pedra / Pedras Decorativas em terceiro
  if (c.includes("pedra")) return 3;

  // 6. Ferragens, Suportes, Correntes, Alças (no final de tudo)
  if (
    c.includes("suporte") ||
    c.includes("ferrag") ||
    c.includes("corrente") ||
    c.includes("alça") ||
    c.includes("alca")
  ) {
    return 6;
  }

  // 5. Vasos (no final, antes das ferragens/correntes)
  if (c.includes("vaso")) {
    return 5;
  }

  // 4. Intermediários (Pratos, Cuias, Floreiras, Sementeiras, etc.)
  return 4;
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
