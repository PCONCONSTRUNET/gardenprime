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
import { Search, Save, Pencil, Printer, ArrowUpDown, ArrowUp, ArrowDown, FileText, Calendar, Package, TrendingUp } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
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
      const { data: prods, error: pError } = await supabase
        .from("produtos")
        .select("id, nome, codigo, categoria, estoque, valor, status, created_at, emoji, quantidade_vendas, imagem")
        .order("created_at", { ascending: false });
      if (pError) throw pError;

      // Fetch all items from valid sales to compute system sales
      const { data: itens, error: iError } = await supabase
        .from("vendas_itens")
        .select("produto_id, quantidade, vendas(status)");
      if (iError) throw iError;

      const validItens = (itens || []).filter((item: any) => {
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

      const mapped = (prods || []).map((p) => {
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

  const codeQuery = buscaCodigo.trim().toLowerCase();
  const hasExactCodeMatch =
    codeQuery.length > 0 &&
    products.some((p) => {
      const pCode = p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";
      return pCode === codeQuery || (/^\d+$/.test(codeQuery) && /^\d+$/.test(pCode) && Number(pCode) === Number(codeQuery));
    });

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
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
      const numA = Number(a[sortColumn] || 0);
      const numB = Number(b[sortColumn] || 0);
      if (numA !== numB) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      const codeA = a.codigo !== undefined && a.codigo !== null ? String(a.codigo).trim() : "";
      const codeB = b.codigo !== undefined && b.codigo !== null ? String(b.codigo).trim() : "";
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [products, busca, buscaCodigo, codeQuery, hasExactCodeMatch, categoriaFilter, sortColumn, sortDirection]);

  const printableProducts = useMemo(() => {
    if (selectedProducts.length > 0) {
      return filteredProducts.filter((p) => selectedProducts.includes(p.id));
    }
    return filteredProducts;
  }, [filteredProducts, selectedProducts]);

  const totalVendasImpressao = useMemo(
    () => printableProducts.reduce((acc, p) => acc + Number(p.total_calculado || 0), 0),
    [printableProducts]
  );

  const totalVendasGlobais = products.reduce((acc, p) => acc + (p.total_calculado || 0), 0);

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

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #ffffff !important; color: #000000 !important; }
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table thead { display: table-header-group; }
          .print-table tfoot { display: table-row-group; }
          .print-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <PageHeader
        title="Desempenho de Produtos"
        subtitle="Acompanhe e ajuste o número de vendas por produto"
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden font-bold">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Relatório
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6 print:hidden">
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
      </div>

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
                <TableHead className="text-right font-bold">Sistema</TableHead>
                <TableHead className="text-right font-bold">Ajuste</TableHead>
                <TableHead
                  className="text-right font-bold cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("total_calculado")}
                >
                  Total Vendas <SortIcon column="total_calculado" />
                </TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Carregando produtos...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado na busca.
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
                RELATÓRIO DE DESEMPENHO DE PRODUTOS
              </h1>
              <p className="text-[11px] text-[#E5C378] font-bold">
                Categoria: {categoriaFilter === "Todas" ? "Todas as Categorias" : categoriaFilter}
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
              <th className="py-2 px-2.5 text-right font-black uppercase tracking-wider border border-slate-400 w-24">
                Vlr. Unit.
              </th>
              <th className="py-2 px-2.5 text-right font-black uppercase tracking-wider border border-slate-400 w-28 text-[#E5C378]">
                Total Vendas
              </th>
            </tr>
          </thead>
          <tbody>
            {printableProducts.map((p, idx) => (
              <tr
                key={p.id}
                className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
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
                <td className="py-1.5 px-2.5 text-right font-bold text-xs text-black border border-slate-300 whitespace-nowrap">
                  R$ {Number(p.valor || 0).toFixed(2).replace(".", ",")}
                </td>
                <td className="py-1.5 px-2.5 text-right font-black text-sm text-[#112321] border border-slate-300 whitespace-nowrap">
                  {p.total_calculado || 0}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#112321] text-white">
              <td
                colSpan={4}
                className="py-2.5 px-3 text-right font-black uppercase tracking-wider text-xs border border-slate-400 text-[#E5C378]"
              >
                TOTAL GERAL ({printableProducts.length} PRODUTOS LISTADOS):
              </td>
              <td className="py-2.5 px-3 text-right font-black text-base text-white border border-slate-400">
                {totalVendasImpressao}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
