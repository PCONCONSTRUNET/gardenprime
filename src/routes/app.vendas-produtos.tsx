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
import { Search, Save, Pencil, Printer } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const fetchProductsAndSales = async () => {
    try {
      const { data: prods, error: pError } = await supabase
        .from("produtos")
        .select("*")
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

  const filteredProducts = products.filter((p) => {
    const search = busca.toLowerCase().trim();
    const nome = p.nome ? String(p.nome).toLowerCase() : "";
    const codigo = p.codigo ? String(p.codigo).toLowerCase() : "";
    
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

    const matchCat = categoriaFilter === "Todas" || p.categoria === categoriaFilter;
    return matchBusca && matchCat;
  });

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

  return (
    <>
      <PageHeader
        title="Desempenho de Produtos"
        subtitle="Acompanhe e ajuste o número de vendas por produto"
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Relatório
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6 print:hidden">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total de Produtos</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{products.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Vendas Globais</p>
            <p className="mt-1 font-display text-2xl font-bold text-success">
              {totalVendasGlobais}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4 print:hidden">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome…"
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-[180px] h-9">
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
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 print:hidden">
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
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="print:hidden">Categoria</TableHead>
                <TableHead className="text-right print:hidden">Valor</TableHead>
                <TableHead className="text-right print:hidden">Sistema</TableHead>
                <TableHead className="text-right print:hidden">Ajuste</TableHead>
                <TableHead className="text-right">Total Vendas</TableHead>
                <TableHead className="text-right print:hidden">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando produtos...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado na busca.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => (
                  <TableRow
                    key={p.id}
                    className={
                      selectedProducts.length > 0 && !selectedProducts.includes(p.id)
                        ? "print:hidden"
                        : ""
                    }
                  >
                    <TableCell className="print:hidden">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={selectedProducts.includes(p.id)}
                        onChange={() => toggleSelection(p.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 overflow-hidden place-items-center rounded-lg bg-accent text-lg border">
                          {p.imagem ? (
                            <img
                              src={p.imagem}
                              alt={p.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="opacity-50">{p.emoji || "📦"}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">SKU interno</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="print:hidden">
                      <Badge variant="secondary">{p.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold print:hidden">
                      R$ {Number(p.valor).toFixed(2).replace(".", ",")}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <span className="text-muted-foreground">{p.vendas_sistema || 0}</span>
                    </TableCell>
                    <TableCell className="text-right print:hidden">
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
                            className="w-24 text-right h-8"
                            value={editValue}
                            onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                            min={0}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-lg text-primary">
                          {p.total_calculado || 0}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
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
    </>
  );
}
