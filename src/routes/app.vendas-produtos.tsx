import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
  Package,
  TrendingUp,
  DollarSign,
  EyeOff,
  FileInput,
  Layers,
  ArrowLeft,
  Eye,
  Trash2,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
  ImportarPedidosModal,
  type ImportedOrderInfo,
  type ImportedOrdersResult,
  type ImportedProductAgg,
} from "@/components/importar-pedidos-modal";
import { formatBrDecimal, formatOrderRangeSummary } from "@/lib/utils";
import {
  carregarHistorico,
  excluirHistorico,
  salvarHistorico,
  type HistoricoEntry,
  type HistoricoItem,
} from "@/lib/historico-vendas-produtos";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/vendas-produtos")({
  head: () => ({ meta: [{ title: "Desempenho de Produtos — GARDEN PRIME ERP" }] }),
  component: VendasProdutos,
});

type ActiveView =
  | {
      kind: "lote";
      orders: ImportedOrderInfo[];
      productMap: Record<string, ImportedProductAgg>;
      title: string;
    }
  | {
      kind: "relatorio";
      entry: HistoricoEntry;
    }
  | null;

interface PrintSnapshot {
  title: string;
  subtitle: string;
  items: any[];
  comValor: boolean;
  dataEmissao: string;
  horaEmissao: string;
}

function VendasProdutos() {
  const confirm = useConfirm();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [historicoFiltroTipo, setHistoricoFiltroTipo] = useState<"todos" | "lote" | "relatorio">(
    "todos",
  );
  const [historicoBusca, setHistoricoBusca] = useState("");

  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [showAllInImport, setShowAllInImport] = useState(false);

  // Filtros e seleção na visualização detalhada de um lote/relatório
  const [busca, setBusca] = useState("");
  const [buscaCodigo, setBuscaCodigo] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Modais de importação e impressão
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [pendingPrintEntry, setPendingPrintEntry] = useState<HistoricoEntry | null>(null);
  const [printSnapshot, setPrintSnapshot] = useState<PrintSnapshot | null>(null);

  type SortColumn = "codigo" | "nome" | "categoria" | "valor" | "total_calculado";
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<SortColumn>("codigo");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "total_calculado" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline-block opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 inline-block text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 inline-block text-primary" />
    );
  };

  const fetchProductsAndSales = async () => {
    try {
      const PAGE_SIZE = 1000;
      const prods: any[] = [];
      let pFrom = 0;
      while (true) {
        const { data: pBatch, error: pError } = await supabase
          .from("produtos")
          .select(
            "id, nome, codigo, categoria, estoque, valor, status, created_at, emoji, quantidade_vendas, imagem",
          )
          .order("created_at", { ascending: false })
          .range(pFrom, pFrom + PAGE_SIZE - 1);
        if (pError) throw pError;
        const rows = pBatch || [];
        prods.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        pFrom += PAGE_SIZE;
      }

      const itens: any[] = [];
      let iFrom = 0;
      while (true) {
        const { data: iBatch, error: iError } = await supabase
          .from("vendas_itens")
          .select("produto_id, quantidade, vendas(status)")
          .range(iFrom, iFrom + PAGE_SIZE - 1);
        if (iError) throw iError;
        const rows = iBatch || [];
        itens.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        iFrom += PAGE_SIZE;
      }

      const validItens = itens.filter((item: any) => {
        const status = item.vendas?.status;
        return status !== "Cancelado" && status !== "Rejeitado";
      });

      const salesMap: Record<string, number> = {};
      validItens.forEach((item: any) => {
        if (item.produto_id) {
          if (!salesMap[item.produto_id]) salesMap[item.produto_id] = 0;
          salesMap[item.produto_id] += Number(item.quantidade || 0);
        }
      });

      const mapped = prods.map((p) => {
        const vs = salesMap[p.id] || 0;
        return {
          ...p,
          vendas_sistema: vs,
          total_calculado: vs + Number(p.quantidade_vendas || 0),
        };
      });

      setProducts(mapped);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar produtos e vendas.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const list = await carregarHistorico();
      setHistorico(list);
    } finally {
      setLoadingHistorico(false);
    }
  };

  useEffect(() => {
    fetchProductsAndSales();
    fetchHistorico();
  }, []);

  const totalVendasGlobais = useMemo(
    () => products.reduce((acc, p) => acc + Number(p.total_calculado || 0), 0),
    [products],
  );

  // Linhas disponíveis na visualização ativa (lote importado ou relatório aberto)
  const activeSourceProducts = useMemo(() => {
    if (!activeView) return [];

    if (activeView.kind === "lote") {
      return products.map((p) => {
        const agg = activeView.productMap[p.id];
        const qty = agg?.quantidade || 0;
        return {
          ...p,
          imported_qty: qty,
          imported_subtotal: agg?.subtotal || 0,
          imported_orders: agg?.pedidos || [],
          display_total: qty,
        };
      });
    }

    return activeView.entry.itens.map((it) => ({
      id: it.produto_id,
      codigo: it.codigo,
      nome: it.nome,
      categoria: it.categoria,
      imagem: it.imagem,
      valor: it.valor,
      imported_qty: it.quantidade,
      imported_subtotal: it.subtotal,
      imported_orders: it.pedidos || [],
      display_total: it.quantidade,
    }));
  }, [activeView, products]);

  const codeQuery = buscaCodigo.trim().toLowerCase();
  const hasExactCodeMatch =
    codeQuery.length > 0 &&
    activeSourceProducts.some((p) => {
      const pCode =
        p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";
      return (
        pCode === codeQuery ||
        (/^\d+$/.test(codeQuery) && /^\d+$/.test(pCode) && Number(pCode) === Number(codeQuery))
      );
    });

  const filteredProducts = useMemo(() => {
    const filtered = activeSourceProducts.filter((p) => {
      if (activeView?.kind === "lote" && !showAllInImport && p.imported_qty <= 0) {
        return false;
      }

      const search = busca.toLowerCase().trim();
      const nome = p.nome ? String(p.nome).toLowerCase() : "";
      const codigo =
        p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";

      const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const searchNormalized = normalize(search);
      const nomeNormalized = normalize(nome);
      const codigoNormalized = normalize(codigo);
      const searchTerms = searchNormalized.split(/\s+/).filter(Boolean);

      const matchBusca =
        searchTerms.length === 0 ||
        searchTerms.every(
          (term) => nomeNormalized.includes(term) || codigoNormalized.includes(term),
        );

      let matchCodigo = true;
      if (codeQuery.length > 0) {
        if (hasExactCodeMatch) {
          matchCodigo =
            codigo === codeQuery ||
            (/^\d+$/.test(codeQuery) &&
              /^\d+$/.test(codigo) &&
              Number(codigo) === Number(codeQuery));
        } else {
          matchCodigo = codigo.startsWith(codeQuery) || nomeNormalized.includes(`codigo ${codeQuery}`);
        }
      }

      const matchCat = categoriaFilter === "Todas" || p.categoria === categoriaFilter;
      return matchBusca && matchCodigo && matchCat;
    });

    return [...filtered].sort((a, b) => {
      if (sortColumn === "codigo") {
        const strA = a.codigo !== undefined && a.codigo !== null ? String(a.codigo).trim() : "";
        const strB = b.codigo !== undefined && b.codigo !== null ? String(b.codigo).trim() : "";
        const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
        return sortDirection === "asc" ? cmp : -cmp;
      }
      if (sortColumn === "nome" || sortColumn === "categoria") {
        const strA = a[sortColumn] ? String(a[sortColumn]).toLowerCase() : "";
        const strB = b[sortColumn] ? String(b[sortColumn]).toLowerCase() : "";
        const cmp = strA.localeCompare(strB, "pt-BR");
        return sortDirection === "asc" ? cmp : -cmp;
      }
      const sortKey = sortColumn === "total_calculado" ? "display_total" : sortColumn;
      const numA = Number(a[sortKey] || 0);
      const numB = Number(b[sortKey] || 0);
      if (numA !== numB) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      const codeA = a.codigo !== undefined && a.codigo !== null ? String(a.codigo).trim() : "";
      const codeB = b.codigo !== undefined && b.codigo !== null ? String(b.codigo).trim() : "";
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [
    activeSourceProducts,
    activeView,
    showAllInImport,
    busca,
    codeQuery,
    hasExactCodeMatch,
    categoriaFilter,
    sortColumn,
    sortDirection,
  ]);

  const printableFromActiveView = useMemo(() => {
    if (selectedProducts.length > 0) {
      return filteredProducts.filter((p) => selectedProducts.includes(p.id));
    }
    return filteredProducts;
  }, [filteredProducts, selectedProducts]);

  const filteredHistorico = useMemo(() => {
    const q = historicoBusca.trim().toLowerCase();
    return historico.filter((entry) => {
      if (historicoFiltroTipo !== "todos" && entry.tipo !== historicoFiltroTipo) return false;
      if (!q) return true;
      const inTitle = entry.titulo.toLowerCase().includes(q);
      const inDesc = (entry.descricao || "").toLowerCase().includes(q);
      const inOrders = entry.pedidos.some(
        (o) => o.numero.toLowerCase().includes(q) || o.cliente_nome.toLowerCase().includes(q),
      );
      const inItems = entry.itens.some(
        (it) => it.nome.toLowerCase().includes(q) || it.codigo.toLowerCase().includes(q),
      );
      return inTitle || inDesc || inOrders || inItems;
    });
  }, [historico, historicoFiltroTipo, historicoBusca]);

  const buildHistoricoItensFromProducts = (list: any[]): HistoricoItem[] =>
    list.map((p) => {
      const qty = Number(p.display_total ?? p.total_calculado ?? 0);
      const unitVal = Number(p.valor || 0);
      return {
        produto_id: p.id,
        codigo: String(p.codigo || ""),
        nome: String(p.nome || ""),
        categoria: p.categoria || null,
        imagem: p.imagem || null,
        valor: unitVal,
        quantidade: qty,
        subtotal: Number(p.imported_subtotal ?? qty * unitVal),
        pedidos: Array.isArray(p.imported_orders) ? p.imported_orders : [],
      };
    });

  const handleImportOrders = async (result: ImportedOrdersResult) => {
    const rangeSummary = formatOrderRangeSummary(result.orders);
    const title = `Pedidos ${rangeSummary} (${result.orders.length} pedido${
      result.orders.length === 1 ? "" : "s"
    })`;

    setActiveView({
      kind: "lote",
      orders: result.orders,
      productMap: result.productMap,
      title,
    });
    setShowAllInImport(false);
    setSelectedProducts([]);
    setBusca("");
    setBuscaCodigo("");
    setCategoriaFilter("Todas");

    const itensLote: HistoricoItem[] = products
      .filter((p) => (result.productMap[p.id]?.quantidade || 0) > 0)
      .sort((a, b) =>
        String(a.codigo || "").localeCompare(String(b.codigo || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .map((p) => {
        const agg = result.productMap[p.id];
        return {
          produto_id: p.id,
          codigo: String(p.codigo || ""),
          nome: String(p.nome || ""),
          categoria: p.categoria || null,
          imagem: p.imagem || null,
          valor: Number(p.valor || 0),
          quantidade: Number(agg?.quantidade || 0),
          subtotal: Number(agg?.subtotal || 0),
          pedidos: agg?.pedidos || [],
        };
      });

    const totalUnidades = itensLote.reduce((acc, it) => acc + it.quantidade, 0);
    const totalValor = itensLote.reduce((acc, it) => acc + it.subtotal, 0);

    try {
      const saved = await salvarHistorico({
        tipo: "lote",
        titulo: `Pedidos ${rangeSummary}`,
        descricao: `${result.orders.length} pedido(s) • ${itensLote.length} produto(s)`,
        pedidos: result.orders.map((o) => ({
          id: o.id,
          numero: String(o.numero_venda ?? o.numero ?? o.id.slice(0, 6)),
          cliente_nome: o.cliente_nome,
          valor_total: Number(o.valor_total || 0),
        })),
        itens: itensLote,
        total_unidades: totalUnidades,
        total_valor: totalValor,
      });
      setHistorico((prev) => [saved, ...prev.filter((h) => h.id !== saved.id)]);
    } catch (e) {
      console.error("Erro ao registrar lote no histórico:", e);
    }
  };

  const handleOpenHistoricoEntry = (entry: HistoricoEntry) => {
    setSelectedProducts([]);
    setBusca("");
    setBuscaCodigo("");
    setCategoriaFilter("Todas");
    setShowAllInImport(false);

    if (entry.tipo === "lote" && entry.pedidos.length > 0) {
      const orders: ImportedOrderInfo[] = entry.pedidos.map((p) => ({
        id: p.id,
        numero_venda: Number.isFinite(Number(p.numero)) ? Number(p.numero) : null,
        numero: Number.isFinite(Number(p.numero)) ? Number(p.numero) : null,
        tipo: "VENDA",
        status: "",
        valor_total: p.valor_total,
        created_at: entry.created_at,
        cliente_nome: p.cliente_nome,
      }));
      const productMap: Record<string, ImportedProductAgg> = {};
      for (const it of entry.itens) {
        productMap[it.produto_id] = {
          quantidade: it.quantidade,
          subtotal: it.subtotal,
          pedidos: it.pedidos || [],
        };
      }
      setActiveView({
        kind: "lote",
        orders,
        productMap,
        title: entry.titulo,
      });
      return;
    }

    setActiveView({ kind: "relatorio", entry });
  };

  const handleDeleteHistorico = async (entry: HistoricoEntry) => {
    const ok = await confirm({
      title: "Excluir do histórico",
      description: `Deseja remover "${entry.titulo}" do histórico de ${
        entry.tipo === "lote" ? "pedidos importados" : "relatórios"
      }?`,
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await excluirHistorico(entry);
      setHistorico((prev) => prev.filter((item) => item.id !== entry.id));
      toast.success("Registro removido do histórico.");
    } catch (err: any) {
      toast.error("Erro ao excluir registro: " + (err?.message || "Erro desconhecido"));
    }
  };

  const handleConfirmPrint = async (comValor: boolean) => {
    const dataEmissao = new Date().toLocaleDateString("pt-BR");
    const horaEmissao = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let snapshotTitle = "RELATÓRIO DE DESEMPENHO DE PRODUTOS";
    let snapshotSubtitle = "Visão Geral de Produtos";
    let itemsToPrint: any[] = [];
    let shouldSaveToHistory = true;
    let pedidosForHistory: HistoricoEntry["pedidos"] = [];
    let historyTitle = "";

    if (pendingPrintEntry) {
      snapshotTitle =
        pendingPrintEntry.tipo === "lote"
          ? "RELATÓRIO DE PRODUTOS POR PEDIDOS"
          : "RELATÓRIO DE DESEMPENHO DE PRODUTOS";
      snapshotSubtitle = pendingPrintEntry.titulo;
      itemsToPrint = pendingPrintEntry.itens.map((it) => ({
        id: it.produto_id,
        codigo: it.codigo,
        nome: it.nome,
        categoria: it.categoria,
        imagem: it.imagem,
        valor: it.valor,
        display_total: it.quantidade,
        imported_subtotal: it.subtotal,
        imported_orders: it.pedidos,
      }));
      pedidosForHistory = pendingPrintEntry.pedidos;
      historyTitle = `Relatório — ${pendingPrintEntry.titulo}`;
      shouldSaveToHistory = pendingPrintEntry.tipo === "lote";
    } else if (activeView?.kind === "lote") {
      const rangeSummary = formatOrderRangeSummary(activeView.orders);
      snapshotTitle = "RELATÓRIO DE PRODUTOS POR PEDIDOS";
      snapshotSubtitle = `Pedidos: ${rangeSummary} (${activeView.orders.length} pedido${
        activeView.orders.length === 1 ? "" : "s"
      }) • Categoria: ${categoriaFilter === "Todas" ? "Todas as Categorias" : categoriaFilter}`;
      itemsToPrint = printableFromActiveView;
      pedidosForHistory = activeView.orders.map((o) => ({
        id: o.id,
        numero: String(o.numero_venda ?? o.numero ?? o.id.slice(0, 6)),
        cliente_nome: o.cliente_nome,
        valor_total: Number(o.valor_total || 0),
      }));
      historyTitle = `Relatório — Pedidos ${rangeSummary}`;
    } else if (activeView?.kind === "relatorio") {
      snapshotTitle = "RELATÓRIO DE DESEMPENHO DE PRODUTOS";
      snapshotSubtitle = activeView.entry.titulo;
      itemsToPrint = printableFromActiveView;
      shouldSaveToHistory = false;
    } else {
      // Impressão global a partir da tela inicial limpa
      const globalSorted = [...products]
        .map((p) => ({ ...p, display_total: p.total_calculado || 0 }))
        .sort((a, b) =>
          String(a.codigo || "").localeCompare(String(b.codigo || ""), undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        );
      snapshotTitle = "RELATÓRIO DE DESEMPENHO DE PRODUTOS";
      snapshotSubtitle = "Todas as Categorias (Vendas Globais)";
      itemsToPrint = globalSorted;
      historyTitle = `Relatório Geral (${globalSorted.length} produtos)`;
    }

    setPrintSnapshot({
      title: snapshotTitle,
      subtitle: snapshotSubtitle,
      items: itemsToPrint,
      comValor,
      dataEmissao,
      horaEmissao,
    });
    setPrintModalOpen(false);
    setPendingPrintEntry(null);

    if (shouldSaveToHistory && itemsToPrint.length > 0) {
      const histItems = buildHistoricoItensFromProducts(itemsToPrint);
      const totalUnidades = histItems.reduce((acc, it) => acc + it.quantidade, 0);
      const totalValor = histItems.reduce((acc, it) => acc + it.subtotal, 0);
      salvarHistorico({
        tipo: "relatorio",
        titulo: historyTitle,
        descricao: `${histItems.length} produto(s) • ${comValor ? "Com valor" : "Sem valor"}`,
        com_valor: comValor,
        pedidos: pedidosForHistory,
        itens: histItems,
        total_unidades: totalUnidades,
        total_valor: totalValor,
      })
        .then((saved) => {
          setHistorico((prev) => [saved, ...prev.filter((h) => h.id !== saved.id)]);
        })
        .catch((e) => console.error("Erro ao salvar relatório no histórico:", e));
    }

    setTimeout(() => {
      window.print();
    }, 200);
  };

  const toggleSelection = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const totalVendasImpressao = useMemo(
    () =>
      (printSnapshot?.items || []).reduce((acc, p) => acc + Number(p.display_total || 0), 0),
    [printSnapshot],
  );

  const loteCount = useMemo(
    () => historico.filter((h) => h.tipo === "lote").length,
    [historico],
  );
  const relatorioCount = useMemo(
    () => historico.filter((h) => h.tipo === "relatorio").length,
    [historico],
  );

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #ffffff !important; background-color: #ffffff !important; color: #000000 !important; }
          #root, main { background: #ffffff !important; background-color: #ffffff !important; }
          [role="dialog"], [data-radix-portal] { display: none !important; }
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table thead { display: table-header-group; }
          .print-table tfoot { display: table-row-group; }
          .print-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <PageHeader
        title="Desempenho de Produtos"
        subtitle="Importe lotes de pedidos, gere relatórios e consulte o histórico"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              onClick={() => setImportModalOpen(true)}
              className="bg-gradient-brand text-primary-foreground font-bold"
            >
              <FileInput className="mr-2 h-4 w-4" />
              Importar Pedidos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPendingPrintEntry(null);
                setPrintModalOpen(true);
              }}
              className="font-bold"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir Relatório
            </Button>
          </div>
        }
      />

      <ImportarPedidosModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        initialSelectedIds={
          activeView?.kind === "lote" ? activeView.orders.map((o) => o.id) : []
        }
        onImport={handleImportOrders}
      />

      {printModalOpen && (
        <Dialog
          open={printModalOpen}
          onOpenChange={(o) => {
            setPrintModalOpen(o);
            if (!o) setPendingPrintEntry(null);
          }}
        >
          <DialogContent className="sm:max-w-md print:hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                Opções de Impressão do Relatório
              </DialogTitle>
              <DialogDescription>
                Escolha se deseja exibir a coluna com o valor unitário (Vlr. Unit.) dos produtos na
                impressão ou PDF.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleConfirmPrint(false)}
                className="flex-1 font-bold"
              >
                <EyeOff className="mr-2 h-4 w-4" />
                Imprimir SEM Valor
              </Button>
              <Button
                type="button"
                onClick={() => handleConfirmPrint(true)}
                className="flex-1 bg-gradient-brand text-primary-foreground font-bold"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Imprimir COM Valor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 3 CARDS PRINCIPAIS */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6 print:hidden">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-semibold">Total de Produtos</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">
              {loading ? "..." : products.length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-semibold">Vendas Globais</p>
            <p className="mt-1 font-display text-2xl font-bold text-success">
              {loading ? "..." : totalVendasGlobais}
            </p>
          </CardContent>
        </Card>
        <Card
          className="shadow-card border-dashed border-primary/40 hover:border-primary/70 transition-colors cursor-pointer"
          onClick={() => setImportModalOpen(true)}
        >
          <CardContent className="p-5 flex items-center justify-between gap-3 h-full">
            <div>
              <p className="text-sm text-muted-foreground font-semibold">
                Importar Lote de Pedidos
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">
                Filtre por faixa (ex: 150 a 161) sem procurar nos {products.length} itens
              </p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileInput className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ÁREA PRINCIPAL */}
      {!activeView ? (
        <Card className="shadow-card print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-base font-bold leading-tight">
                  Pedidos Importados e Relatórios Feitos
                </h2>
                <p className="text-xs text-muted-foreground">
                  Consulte, reabra ou reimprima lotes importados e relatórios gerados
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={historicoFiltroTipo === "todos" ? "default" : "outline"}
                className="h-8 font-semibold"
                onClick={() => setHistoricoFiltroTipo("todos")}
              >
                Todos ({historico.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historicoFiltroTipo === "lote" ? "default" : "outline"}
                className="h-8 font-semibold"
                onClick={() => setHistoricoFiltroTipo("lote")}
              >
                Pedidos Importados ({loteCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historicoFiltroTipo === "relatorio" ? "default" : "outline"}
                className="h-8 font-semibold"
                onClick={() => setHistoricoFiltroTipo("relatorio")}
              >
                Relatórios ({relatorioCount})
              </Button>
            </div>
          </div>

          <div className="p-4 border-b bg-muted/20">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar no histórico por pedido, título ou produto..."
                className="pl-9 font-medium bg-background"
                value={historicoBusca}
                onChange={(e) => setHistoricoBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="divide-y">
            {loadingHistorico ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Carregando histórico...
              </div>
            ) : filteredHistorico.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {historico.length === 0
                      ? "Nenhum pedido importado ou relatório feito ainda"
                      : "Nenhum registro encontrado na busca"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em <strong>Importar Pedidos</strong> para consolidar uma faixa (ex: 150
                    a 161) ou em <strong>Imprimir Relatório</strong>.
                  </p>
                </div>
                {historico.length === 0 && (
                  <Button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    className="bg-gradient-brand text-primary-foreground font-bold"
                  >
                    <FileInput className="mr-2 h-4 w-4" />
                    Importar Pedidos Agora
                  </Button>
                )}
              </div>
            ) : (
              filteredHistorico.map((entry) => {
                const isLote = entry.tipo === "lote";
                const dt = new Date(entry.created_at);
                const dataBr = dt.toLocaleDateString("pt-BR");
                const horaBr = dt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={entry.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${
                          isLote
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-success/10 text-success border-success/20"
                        }`}
                      >
                        {isLote ? (
                          <Layers className="h-5 w-5" />
                        ) : (
                          <FileSpreadsheet className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={isLote ? "default" : "secondary"}
                            className="text-[11px] font-bold"
                          >
                            {isLote ? "Lote Importado" : "Relatório PDF"}
                          </Badge>
                          {entry.com_valor !== undefined && (
                            <Badge variant="outline" className="text-[11px] font-semibold">
                              {entry.com_valor ? "Com Valor" : "Sem Valor"}
                            </Badge>
                          )}
                          <span className="font-bold text-sm text-foreground">{entry.titulo}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium">
                            {dataBr} às {horaBr}
                          </span>
                          <span>• {entry.itens.length} produto(s)</span>
                          <span className="font-bold text-primary">
                            • {entry.total_unidades} unidade(s)
                          </span>
                          {entry.total_valor > 0 && (
                            <span className="font-semibold text-foreground">
                              • R$ {formatBrDecimal(entry.total_valor)}
                            </span>
                          )}
                        </div>

                        {entry.pedidos.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            {entry.pedidos.slice(0, 8).map((ped) => (
                              <Badge
                                key={ped.id}
                                variant="outline"
                                className="font-mono text-[10px] px-1.5 py-0"
                                title={`${ped.cliente_nome} — R$ ${formatBrDecimal(ped.valor_total)}`}
                              >
                                #{ped.numero}
                              </Badge>
                            ))}
                            {entry.pedidos.length > 8 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                +{entry.pedidos.length - 8}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="font-semibold"
                        onClick={() => handleOpenHistoricoEntry(entry)}
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="font-semibold"
                        onClick={() => {
                          setPendingPrintEntry(entry);
                          setPrintModalOpen(true);
                        }}
                      >
                        <Printer className="mr-1.5 h-4 w-4" />
                        Imprimir
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="Excluir do histórico"
                        onClick={() => handleDeleteHistorico(entry)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* BANNER DO LOTE / RELATÓRIO ABERTO */}
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 font-bold bg-background"
                onClick={() => {
                  setActiveView(null);
                  setSelectedProducts([]);
                }}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Voltar ao Histórico
              </Button>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {activeView.kind === "lote" ? activeView.title : activeView.entry.titulo}
                </span>
                <Badge className="bg-primary text-primary-foreground font-bold">
                  {filteredProducts.length} produto(s) •{" "}
                  {filteredProducts.reduce((acc, p) => acc + Number(p.display_total || 0), 0)} un.
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeView.kind === "lote" && (
                <>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <Checkbox
                      checked={showAllInImport}
                      onCheckedChange={(checked) => setShowAllInImport(checked === true)}
                    />
                    Mostrar todos os {products.length} produtos
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 font-semibold"
                    onClick={() => setImportModalOpen(true)}
                  >
                    Alterar Pedidos
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="sm"
                className="h-8 bg-gradient-brand text-primary-foreground font-bold"
                onClick={() => {
                  setPendingPrintEntry(null);
                  setPrintModalOpen(true);
                }}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir Seleção
              </Button>
            </div>
          </div>

          {/* TABELA DE PRODUTOS DO LOTE / RELATÓRIO ABERTO */}
          <Card className="shadow-card print:hidden">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome…"
                  className="pl-9 font-bold"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary stroke-[2.5]" />
                <Input
                  placeholder="Buscar por código…"
                  className="pl-9 font-bold placeholder:font-bold border-2 border-primary/40 focus-visible:ring-primary"
                  value={buscaCodigo}
                  onChange={(e) => setBuscaCodigo(e.target.value)}
                />
              </div>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-[180px] h-9 font-bold">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas categorias</SelectItem>
                  {Array.from(
                    new Set(activeSourceProducts.map((p) => p.categoria).filter(Boolean)),
                  )
                    .sort()
                    .map((cat: any) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={`${sortColumn}:${sortDirection}`}
                onValueChange={(val) => {
                  const [col, dir] = val.split(":") as [SortColumn, SortDirection];
                  setSortColumn(col);
                  setSortDirection(dir);
                }}
              >
                <SelectTrigger className="w-[210px] h-9 font-bold">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="codigo:asc">Ordem: Código (Crescente)</SelectItem>
                  <SelectItem value="total_calculado:desc">Ordem: Mais Vendidos</SelectItem>
                  <SelectItem value="total_calculado:asc">Ordem: Menos Vendidos</SelectItem>
                  <SelectItem value="nome:asc">Ordem: Nome (A-Z)</SelectItem>
                  <SelectItem value="categoria:asc">Ordem: Categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={
                          filteredProducts.length > 0 &&
                          selectedProducts.length === filteredProducts.length
                        }
                        onChange={toggleSelectAll}
                        title="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead
                      className="font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("codigo")}
                    >
                      Código <SortIcon column="codigo" />
                    </TableHead>
                    <TableHead
                      className="font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("nome")}
                    >
                      Produto <SortIcon column="nome" />
                    </TableHead>
                    <TableHead
                      className="font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("categoria")}
                    >
                      Categoria <SortIcon column="categoria" />
                    </TableHead>
                    <TableHead
                      className="text-right font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("valor")}
                    >
                      Valor <SortIcon column="valor" />
                    </TableHead>
                    <TableHead className="font-bold">Pedidos</TableHead>
                    <TableHead className="text-right font-bold">Subtotal</TableHead>
                    <TableHead
                      className="text-right font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("total_calculado")}
                    >
                      Qtd. <SortIcon column="total_calculado" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum produto encontrado para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            checked={selectedProducts.includes(p.id)}
                            onChange={() => toggleSelection(p.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-bold text-foreground">
                          {p.codigo}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 overflow-hidden place-items-center rounded-lg bg-accent text-lg border">
                              {p.imagem ? (
                                <img
                                  src={p.imagem}
                                  alt={p.nome}
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="opacity-50">{p.emoji || "📦"}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold">{p.nome}</p>
                              <p className="text-xs font-semibold text-muted-foreground">
                                SKU interno
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-bold">
                            {p.categoria || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          R$ {formatBrDecimal(p.valor)}
                        </TableCell>
                        <TableCell>
                          {!p.imported_orders || p.imported_orders.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div
                              className="flex flex-wrap gap-1 max-w-[260px]"
                              title={p.imported_orders
                                .map((o: any) => `#${o.numero}: ${o.quantidade} un.`)
                                .join(", ")}
                            >
                              {p.imported_orders.slice(0, 4).map((o: any) => (
                                <Badge
                                  key={o.numero}
                                  variant="outline"
                                  className="font-mono text-[11px] px-1.5 py-0"
                                >
                                  #{o.numero} ({o.quantidade})
                                </Badge>
                              ))}
                              {p.imported_orders.length > 4 && (
                                <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                                  +{p.imported_orders.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-muted-foreground">
                          R$ {formatBrDecimal(p.imported_subtotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-lg text-primary">
                            {p.display_total || 0}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* LAYOUT EXCLUSIVO E ORGANIZADO PARA IMPRESSÃO / PDF */}
      <div className="hidden print:block bg-white text-black font-sans w-full">
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-[#C5A059]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <img
                src="/garden-prime-pdf.png"
                alt="Garden Prime"
                className="h-12 w-auto object-contain"
              />
              <img
                src="/logo-02.png"
                alt="Garden Plus"
                className="h-11 w-auto object-contain"
              />
            </div>
            <div className="w-px h-12 bg-[#C5A059] mx-1"></div>
            <div className="text-[10px] text-black font-bold leading-snug">
              <p className="font-black text-xs uppercase">GARDEN PLUS LTDA — GARDEN PRIME</p>
              <p>CNPJ: 50.387.381/0001-81 | Inscr. Estadual: 266031100110</p>
              <p>Charqueada - SP | (19) 99930-8784 | garden-plus@hotmail.com</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif italic font-black text-[#C5A059] text-base leading-tight">
              Mais verde para um<br />futuro melhor!
            </p>
          </div>
        </div>

        <div className="bg-[#112321] text-white rounded-xl px-4 py-3 flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-[#C5A059] rounded-lg text-[#C5A059] flex items-center justify-center">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide uppercase text-white leading-tight">
                {printSnapshot?.title || "RELATÓRIO DE DESEMPENHO DE PRODUTOS"}
              </h1>
              <p className="text-[11px] text-[#E5C378] font-bold">
                {printSnapshot?.subtitle || "Visão Geral"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#C5A059] stroke-[2.5]" />
              <div className="text-xs leading-tight">
                <p className="text-[10px] text-[#E5C378] font-bold">Produtos Listados</p>
                <p className="text-sm text-white font-black">{printSnapshot?.items.length || 0}</p>
              </div>
            </div>

            <div className="w-px h-7 bg-white/20"></div>

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#C5A059] stroke-[2.5]" />
              <div className="text-xs leading-tight">
                <p className="text-[10px] text-[#E5C378] font-bold">Total de Vendas</p>
                <p className="text-sm text-white font-black">{totalVendasImpressao}</p>
              </div>
            </div>

            <div className="w-px h-7 bg-white/20"></div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C5A059] stroke-[2.5]" />
              <div className="text-xs leading-tight">
                <p className="text-[10px] text-[#E5C378] font-bold">Emissão</p>
                <p className="text-[11px] text-white font-black">
                  {printSnapshot?.dataEmissao || ""} às {printSnapshot?.horaEmissao || ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        <table className="print-table border border-slate-300 text-xs">
          <thead>
            <tr className="bg-[#112321] text-white">
              <th className="py-2 px-2.5 text-center font-black uppercase tracking-wider border border-slate-400 w-16 text-[#E5C378]">
                Código
              </th>
              <th className="py-2 px-2.5 text-left font-black uppercase tracking-wider border border-slate-400">
                Produto
              </th>
              <th className="py-2 px-2.5 text-center font-black uppercase tracking-wider border border-slate-400 w-32">
                Categoria
              </th>
              {printSnapshot?.comValor && (
                <th className="py-2 px-2.5 text-right font-black uppercase tracking-wider border border-slate-400 w-24">
                  Vlr. Unit.
                </th>
              )}
              <th className="py-2 px-2.5 text-right font-black uppercase tracking-wider border border-slate-400 w-28 text-[#E5C378]">
                Qtd. Vendida
              </th>
            </tr>
          </thead>
          <tbody>
            {(printSnapshot?.items || []).map((p) => (
              <tr key={p.id} className="bg-white">
                <td className="py-1.5 px-2.5 text-center font-mono font-black text-xs text-black border border-slate-300">
                  {p.codigo}
                </td>
                <td className="py-1.5 px-2.5 border border-slate-300">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded border border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                      {p.imagem ? (
                        <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">📦</span>
                      )}
                    </div>
                    <span className="font-bold text-black text-xs leading-snug">{p.nome}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2.5 text-center font-bold text-[11px] text-slate-800 border border-slate-300">
                  {p.categoria || "-"}
                </td>
                {printSnapshot?.comValor && (
                  <td className="py-1.5 px-2.5 text-right font-bold text-xs text-black border border-slate-300 whitespace-nowrap">
                    R$ {formatBrDecimal(p.valor)}
                  </td>
                )}
                <td className="py-1.5 px-2.5 text-right font-black text-lg text-black border border-slate-300 whitespace-nowrap">
                  {p.display_total || 0}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#112321] text-white">
              <td
                colSpan={printSnapshot?.comValor ? 4 : 3}
                className="py-2.5 px-3 text-right font-black uppercase tracking-wider text-xs border border-slate-400 text-[#E5C378]"
              >
                TOTAL GERAL ({printSnapshot?.items.length || 0} PRODUTOS LISTADOS):
              </td>
              <td className="py-2.5 px-3 text-right font-black text-xl text-white border border-slate-400">
                {totalVendasImpressao}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
