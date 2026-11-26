import { supabase } from "@/lib/supabase";

export type HistoricoTipo = "lote" | "relatorio";

export interface HistoricoPedido {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_total: number;
}

export interface HistoricoItem {
  produto_id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  imagem: string | null;
  valor: number;
  quantidade: number;
  subtotal: number;
  pedidos: { numero: string; quantidade: number }[];
}

export interface HistoricoEntry {
  id: string;
  created_at: string;
  tipo: HistoricoTipo;
  titulo: string;
  descricao?: string;
  com_valor?: boolean;
  pedidos: HistoricoPedido[];
  itens: HistoricoItem[];
  total_unidades: number;
  total_valor: number;
  origem?: "nuvem" | "local";
}

export type NovoHistorico = Omit<HistoricoEntry, "id" | "created_at" | "origem">;

const TABLE = "historico_vendas_produtos";
const LOCAL_KEY = "gardenprime_historico_vendas_produtos";
const MAX_LOCAL = 50;

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocal(): HistoricoEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((e: HistoricoEntry) => ({ ...e, origem: "local" as const }))
      : [];
  } catch (e) {
    console.warn("Histórico local inválido:", e);
    return [];
  }
}

function writeLocal(entries: HistoricoEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
  } catch (e) {
    console.warn("Não foi possível salvar o histórico local:", e);
  }
}

function rowToEntry(row: any): HistoricoEntry {
  const dados = row?.dados || {};
  return {
    id: row.id,
    created_at: row.created_at,
    tipo: row.tipo === "relatorio" ? "relatorio" : "lote",
    titulo: row.titulo || "",
    descricao: dados.descricao,
    com_valor: dados.com_valor,
    pedidos: Array.isArray(dados.pedidos) ? dados.pedidos : [],
    itens: Array.isArray(dados.itens) ? dados.itens : [],
    total_unidades: Number(dados.total_unidades || 0),
    total_valor: Number(dados.total_valor || 0),
    origem: "nuvem",
  };
}

/**
 * Carrega o histórico de lotes importados e relatórios gerados.
 * Usa a tabela `historico_vendas_produtos` no Supabase quando existir
 * e complementa com o histórico salvo localmente no navegador.
 */
export async function carregarHistorico(): Promise<HistoricoEntry[]> {
  const local = readLocal();
  let remote: HistoricoEntry[] = [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, created_at, tipo, titulo, dados")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) remote = data.map(rowToEntry);
  } catch (e) {
    console.warn("Histórico na nuvem indisponível, usando apenas o local:", e);
  }

  const map = new Map<string, HistoricoEntry>();
  [...remote, ...local].forEach((e) => {
    if (!map.has(e.id)) map.set(e.id, e);
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function salvarHistorico(entry: NovoHistorico): Promise<HistoricoEntry> {
  const dados = {
    descricao: entry.descricao,
    com_valor: entry.com_valor,
    pedidos: entry.pedidos,
    itens: entry.itens,
    total_unidades: entry.total_unidades,
    total_valor: entry.total_valor,
  };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ tipo: entry.tipo, titulo: entry.titulo, dados })
      .select("id, created_at, tipo, titulo, dados")
      .single();
    if (!error && data) return rowToEntry(data);
  } catch (e) {
    console.warn("Falha ao salvar histórico na nuvem, salvando localmente:", e);
  }

  const localEntry: HistoricoEntry = {
    ...entry,
    id: genId(),
    created_at: new Date().toISOString(),
    origem: "local",
  };
  writeLocal([localEntry, ...readLocal()]);
  return localEntry;
}

export async function excluirHistorico(entry: HistoricoEntry): Promise<void> {
  if (entry.origem === "nuvem") {
    const { error } = await supabase.from(TABLE).delete().eq("id", entry.id);
    if (error) throw error;
    return;
  }
  writeLocal(readLocal().filter((e) => e.id !== entry.id));
}
