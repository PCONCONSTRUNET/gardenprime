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
import { Search, Save, Pencil, Printer, ArrowUpDown, ArrowUp, ArrowDown, FileText, Calendar, Package, TrendingUp, DollarSign, EyeOff, FileInput, X, Layers } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ImportarPedidosModal,
  type ImportedOrdersResult,
} from "@/components/importar-pedidos-modal";
import { formatOrderRangeSummary } from "@/lib/utils";
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

function VendasProdutos() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaCodigo, setBuscaCodigo] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [mostrarValorImpressao, setMostrarValorImpressao] = useState<boolean>(false);
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importedBatch, setImportedBatch] = useState<ImportedOrdersResult | null>(null);
  const [showAllInImport, setShowAllInImport] = useState<boolean>(false);

  const isImportMode = Boolean(importedBatch && importedBatch.orders.length > 0);

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
          .select("id, nome, codigo, categoria, estoque, valor, status, created_at, emoji, quantidade_vendas, imagem")
          .order("created_at", { ascending: false })
          .range(pFrom, pFrom + PAGE_SIZE - 1);
        if (pError) throw pError;
        const rows = pBatch || [];
        prods.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        pFrom += PAGE_SIZE;
      }

      // Fetch all items from valid sales to compute system sales
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

  useEffect(() => {
    fetchProductsAndSales();
  }, []);

  const handleSave = async (id: string) => {
    try {
      const p = products.find((prod) => prod.id === id);
      if (!p) return;

      const vs = p.vendas_sistema || 0;
      const novo_ajuste = editValue - vs;

      const { error } = await supabase
        .from("produtos")
        .update({ quantidade_vendas: novo_ajuste })
        .eq("id", id);

      if (error) throw error;

      toast.success("Quantidade atualizada com sucesso!");
      setEditingId(null);
      fetchProductsAndSales();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      const agg = isImportMode ? importedBatch?.productMap[p.id] : undefined;
      const importedQty = agg?.quantidade || 0;
      const importedSubtotal = agg?.subtotal || 0;
      const importedOrders = agg?.pedidos || [];
      return {
        ...p,
        imported_qty: importedQty,
        imported_subtotal: importedSubtotal,
        imported_orders: importedOrders,
        display_total: isImportMode ? importedQty : p.total_calculado,
      };
    });
  }, [products, isImportMode, importedBatch]);

  const codeQuery = buscaCodigo.trim().toLowerCase();
  const hasExactCodeMatch =
    codeQuery.length > 0 &&
    enrichedProducts.some((p) => {
      const pCode = p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";
      return pCode === codeQuery || (/^\d+$/.test(codeQuery) && /^\d+$/.test(pCode) && Number(pCode) === Number(codeQuery));
    });

  const filteredProducts = useMemo(() => {
    const filtered = enrichedProducts.filter((p) => {
      if (isImportMode && !showAllInImport && p.imported_qty <= 0) {
        return false;
      }

      const search = busca.toLowerCase().trim();
      const nome = p.nome ? String(p.nome).toLowerCase() : "";
      const codigo = p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";
      
      const normalize = (str: string) => 
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
      const searchNormalized = normalize(search);
      const nomeNormalized = normalize(nome);
      const codigoNormalized = normalize(codigo);

      const searchTerms = searchNormalized.split(/\s+/).filter(Boolean);
      
      const matchBusca =
        searchTerms.length === 0 ||
        searchTerms.every((term) =>
          nomeNormalized.includes(term) || codigoNormalized.includes(term)
        );

      let matchCodigo = true;
      if (codeQuery.length > 0) {
        if (hasExactCodeMatch) {
          matchCodigo =
            codigo === codeQuery ||
            (/^\d+$/.test(codeQuery) && /^\d+$/.test(codigo) && Number(codigo) === Number(codeQuery));
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
  }, [enrichedProducts, isImportMode, showAllInImport, busca, codeQuery, hasExactCodeMatch, categoriaFilter, sortColumn, sortDirection]);

  const printableProducts = useMemo(() => {
    if (selectedProducts.length > 0) {
      return filteredProducts.filter((p) => selectedProducts.includes(p.id));
    }
    return filteredProducts;
  }, [filteredProducts, selectedProducts]);

  const totalVendasImpressao = useMemo(
    () => printableProducts.reduce((acc, p) => acc + Number(p.display_total || 0), 0),
    [printableProducts]
  );

  const totalVendasGlobais = products.reduce((acc, p) => acc + (p.total_calculado || 0), 0);

  const importedRangeSummary = useMemo(
    () => (isImportMode ? formatOrderRangeSummary(importedBatch!.orders) : ""),
    [isImportMode, importedBatch]
  );

  const importedProductsCount = useMemo(
    () => (isImportMode ? enrichedProducts.filter((p) => p.imported_qty > 0).length : 0),
    [isImportMode, enrichedProducts]
  );

  const totalImportedUnits = useMemo(
    () => (isImportMode ? enrichedProducts.reduce((acc, p) => acc + Number(p.imported_qty || 0), 0) : 0),
    [isImportMode, enrichedProducts]
  );

  const totalImportedValue = useMemo(
    () => (isImportMode ? enrichedProducts.reduce((acc, p) => acc + Number(p.imported_subtotal || 0), 0) : 0),
    [isImportMode, enrichedProducts]
  );

  const handleImportOrders = (result: ImportedOrdersResult) => {
    setImportedBatch(result);
    setShowAllInImport(false);
    setSelectedProducts([]);
    setEditingId(null);
  };

  const handleClearImport = () => {
    setImportedBatch(null);
    setShowAllInImport(false);
    setSelectedProducts([]);
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

  const dataEmissao = new Date().toLocaleDateString("pt-BR");
  const horaEmissao = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleConfirmPrint = (comValor: boolean) => {
    setMostrarValorImpressao(comValor);
    setPrintModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

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
        subtitle="Acompanhe e ajuste o número de vendas por produto ou importe um lote de pedidos"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              onClick={() => setImportModalOpen(true)}
              className="bg-gradient-brand text-primary-foreground font-bold"
            >
              <FileInput className="mr-2 h-4 w-4" />
              {isImportMode ? "Alterar Pedidos Importados" : "Importar Pedidos"}
            </Button>
            <Button variant="outline" onClick={() => setPrintModalOpen(true)} className="font-bold">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir Relatório
            </Button>
          </div>
        }
      />

      <ImportarPedidosModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        initialSelectedIds={importedBatch?.orders.map((o) => o.id) || []}
        onImport={handleImportOrders}
      />

      {printModalOpen && (
        <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
          <DialogContent className="sm:max-w-md print:hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                Opções de Impressão do Relatório
              </DialogTitle>
              <DialogDescription>
                Escolha se deseja exibir a coluna com o valor unitário (Vlr. Unit.) dos produtos na impressão ou PDF.
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

      <div className="grid gap-4 sm:grid-cols-3 mb-6 print:hidden">
        {isImportMode ? (
          <>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground font-semibold">Produtos nos Pedidos</p>
                <p className="mt-1 font-display text-2xl font-bold text-primary">
                  {importedProductsCount}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  de {products.length} produtos cadastrados
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground font-semibold">Unidades no Lote</p>
                <p className="mt-1 font-display text-2xl font-bold text-success">
                  {totalImportedUnits}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total dos itens: R$ {totalImportedValue.toFixed(2).replace(".", ",")}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-card border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground font-semibold">Pedidos Importados</p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">
                  {importedBatch!.orders.length}
                </p>
                <p className="text-xs font-semibold text-primary mt-0.5 truncate" title={importedRangeSummary}>
                  {importedRangeSummary}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground font-semibold">Total de Produtos</p>
                <p className="mt-1 font-display text-2xl font-bold text-primary">{products.length}</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground font-semibold">Vendas Globais</p>
                <p className="mt-1 font-display text-2xl font-bold text-success">
                  {totalVendasGlobais}
                </p>
              </CardContent>
            </Card>
            <Card
              className="shadow-card border-dashed border-primary/40 hover:border-primary/70 transition-colors cursor-pointer"
              onClick={() => setImportModalOpen(true)}
            >
              <CardContent className="p-5 flex items-center justify-between gap-3 h-full">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold">Importar Lote de Pedidos</p>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    Filtre por faixa (ex: 150 a 161) sem procurar nos {products.length} itens
                  </p>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileInput className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {isImportMode && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Layers className="h-4 w-4 text-primary shrink-0" />
              <span>Filtro por Pedidos Ativo:</span>
              <Badge className="bg-primary text-primary-foreground font-bold">
                {importedRangeSummary} ({importedBatch!.orders.length} pedido
                {importedBatch!.orders.length === 1 ? "" : "s"})
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {importedBatch!.orders.slice(0, 10).map((ord) => (
                <Badge
                  key={ord.id}
                  variant="outline"
                  className="bg-background font-mono text-[11px] font-semibold"
                  title={`${ord.cliente_nome} — R$ ${ord.valor_total.toFixed(2).replace(".", ",")}`}
                >
                  #{ord.numero_venda ?? ord.numero ?? ord.id.slice(0, 6)}
                </Badge>
              ))}
              {importedBatch!.orders.length > 10 && (
                <Badge variant="secondary" className="text-[11px] font-bold">
                  +{importedBatch!.orders.length - 10} pedidos
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClearImport}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Limpar Filtro
            </Button>
          </div>
        </div>
      )}

      {/* TELA INTERATIVA */}
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
          <div className="relative w-full sm:w-[240px]">
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
              {Array.from(new Set(products.map((p) => p.categoria).filter(Boolean)))
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
                {isImportMode ? (
                  <>
                    <TableHead className="font-bold">Pedidos no Lote</TableHead>
                    <TableHead className="text-right font-bold">Subtotal Lote</TableHead>
                    <TableHead
                      className="text-right font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("total_calculado")}
                    >
                      Qtd. no Lote <SortIcon column="total_calculado" />
                    </TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right font-bold">Sistema</TableHead>
                    <TableHead className="text-right font-bold">Ajuste</TableHead>
                    <TableHead
                      className="text-right font-bold cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("total_calculado")}
                    >
                      Total Vendas <SortIcon column="total_calculado" />
                    </TableHead>
                    <TableHead className="text-right font-bold">Ações</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isImportMode ? 8 : 9} className="text-center py-8 text-muted-foreground">
                    Carregando produtos...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isImportMode ? 8 : 9} className="text-center py-8 text-muted-foreground">
                    {isImportMode
                      ? "Nenhum produto encontrado nos pedidos importados para os filtros atuais."
                      : "Nenhum produto encontrado na busca."}
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
                          <p className="text-xs font-semibold text-muted-foreground">SKU interno</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-bold">{p.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      R$ {Number(p.valor).toFixed(2).replace(".", ",")}
                    </TableCell>
                    {isImportMode ? (
                      <>
                        <TableCell>
                          {p.imported_orders.length === 0 ? (
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
                          R$ {Number(p.imported_subtotal || 0).toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-lg text-primary">
                            {p.imported_qty || 0}
                          </span>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right font-bold">
                          <span className="text-muted-foreground">{p.vendas_sistema || 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              p.quantidade_vendas > 0
                                ? "default"
                                : p.quantidade_vendas < 0
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {p.quantidade_vendas > 0 ? "+" : ""}
                            {p.quantidade_vendas || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === p.id ? (
                            <div className="flex justify-end">
                              <Input
                                type="number"
                                className="w-24 text-right h-8 font-bold"
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                min={0}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="font-bold text-lg text-primary">
                              {p.total_calculado || 0}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === p.id ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={() => handleSave(p.id)}>
                                <Save className="h-4 w-4 mr-2" />
                                Salvar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(p.id);
                                setEditValue(p.total_calculado || 0);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* LAYOUT EXCLUSIVO E ORGANIZADO PARA IMPRESSÃO / PDF */}
      <div className="hidden print:block bg-white text-black font-sans w-full">
        {/* 1. CABEÇALHO EMPRESARIAL */}
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

        {/* 2. FAIXA ESCURA DE TÍTULO E RESUMO */}
        <div className="bg-[#112321] text-white rounded-xl px-4 py-3 flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-[#C5A059] rounded-lg text-[#C5A059] flex items-center justify-center">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide uppercase text-white leading-tight">
                {isImportMode
                  ? "RELATÓRIO DE PRODUTOS POR PEDIDOS"
                  : "RELATÓRIO DE DESEMPENHO DE PRODUTOS"}
              </h1>
              <p className="text-[11px] text-[#E5C378] font-bold">
                {isImportMode
                  ? `Pedidos: ${importedRangeSummary} (${importedBatch!.orders.length} pedido${importedBatch!.orders.length === 1 ? "" : "s"}) • Categoria: ${categoriaFilter === "Todas" ? "Todas as Categorias" : categoriaFilter}`
                  : `Categoria: ${categoriaFilter === "Todas" ? "Todas as Categorias" : categoriaFilter}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#C5A059] stroke-[2.5]" />
              <div className="text-xs leading-tight">
                <p className="text-[10px] text-[#E5C378] font-bold">Produtos Listados</p>
                <p className="text-sm text-white font-black">{printableProducts.length}</p>
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
                  {dataEmissao} às {horaEmissao}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. TABELA ORGANIZADA DE PRODUTOS */}
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
              {mostrarValorImpressao && (
                <th className="py-2 px-2.5 text-right font-black uppercase tracking-wider border border-slate-400 w-24">
                  Vlr. Unit.
                </th>
              )}
              <th className="py-2 px-2.5 text-right font-black uppercase tracking-wider border border-slate-400 w-28 text-[#E5C378]">
                {isImportMode ? "Qtd. Pedidos" : "Total Vendas"}
              </th>
            </tr>
          </thead>
          <tbody>
            {printableProducts.map((p) => (
              <tr
                key={p.id}
                className="bg-white"
              >
                <td className="py-1.5 px-2.5 text-center font-mono font-black text-xs text-black border border-slate-300">
                  {p.codigo}
                </td>
                <td className="py-1.5 px-2.5 border border-slate-300">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded border border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                      {p.imagem ? (
                        <img
                          src={p.imagem}
                          alt={p.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs">📦</span>
                      )}
                    </div>
                    <span className="font-bold text-black text-xs leading-snug">
                      {p.nome}
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-2.5 text-center font-bold text-[11px] text-slate-800 border border-slate-300">
                  {p.categoria || "-"}
                </td>
                {mostrarValorImpressao && (
                  <td className="py-1.5 px-2.5 text-right font-bold text-xs text-black border border-slate-300 whitespace-nowrap">
                    R$ {Number(p.valor || 0).toFixed(2).replace(".", ",")}
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
                colSpan={mostrarValorImpressao ? 4 : 3}
                className="py-2.5 px-3 text-right font-black uppercase tracking-wider text-xs border border-slate-400 text-[#E5C378]"
              >
                TOTAL GERAL ({printableProducts.length} PRODUTOS LISTADOS):
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
