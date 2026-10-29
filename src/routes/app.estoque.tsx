import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Settings2,
  Package,
  AlertTriangle,
  Loader2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/app/estoque")({
  head: () => ({ meta: [{ title: "Estoque — GARDEN PRIME ERP" }] }),
  component: Estoque,
});

function Estoque() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [tipoMovimentacao, setTipoMovimentacao] = useState("Entrada");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const fetchData = async () => {
    try {
      const [prodRes, movRes] = await Promise.all([
        supabase.from("produtos").select("id, nome, codigo, categoria, estoque, estoque_minimo, valor, status").order("nome"),
        supabase
          .from("movimentacoes_estoque")
          .select("*, produto:produtos(nome)")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (prodRes.data) setProdutos(prodRes.data);
      if (movRes.data) setMovimentacoes(movRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openDialog = (tipo: string) => {
    setTipoMovimentacao(tipo);
    setProdutoSelecionado("");
    setQuantidade(0);
    setMotivo("");
    setOpenModal(true);
  };

  const handleSalvarMovimentacao = async () => {
    if (!produtoSelecionado || quantidade === 0) {
      alert("Selecione um produto e informe uma quantidade (diferente de zero).");
      return;
    }

    setSalvando(true);
    try {
      const prod = produtos.find((p) => p.id === produtoSelecionado);
      if (!prod) throw new Error("Produto não encontrado");

      // For Entrada, the quantity should be positive. For Saída, it should be negative.
      // If user typed a positive number for Saída, we convert it to negative.
      let finalQtd = Number(quantidade);
      if (tipoMovimentacao === "Saída" && finalQtd > 0) finalQtd = -finalQtd;
      if (tipoMovimentacao === "Entrada" && finalQtd < 0) finalQtd = Math.abs(finalQtd);

      const novoEstoque = Number(prod.estoque) + finalQtd;

      // 1. Atualizar produto
      await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", produtoSelecionado);

      // 2. Registrar movimentação
      await supabase.from("movimentacoes_estoque").insert({
        produto_id: produtoSelecionado,
        tipo: tipoMovimentacao,
        quantidade: finalQtd,
        motivo: motivo || null,
      });

      await fetchData();
      setOpenModal(false);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleGerarPedidoCompra = async () => {
    const criticos = produtos.filter((p) => Number(p.estoque) <= 10);
    if (criticos.length === 0) {
      alert("Não há produtos com estoque crítico para gerar pedido!");
      return;
    }

    try {
      // Cria compra rascunho
      const { data: compra, error } = await supabase
        .from("compras")
        .insert({
          status: "Rascunho",
          valor_total: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Cria os itens (sugere comprar 50 unidades de cada)
      const itens = criticos.map((c) => {
        const valorCustoSugestao = Number((c.valor * 0.5).toFixed(2)); // Sugestão 50% do valor de venda
        return {
          compra_id: compra.id,
          produto_id: c.id,
          quantidade: 50,
          valor_unitario: valorCustoSugestao,
          subtotal: 50 * valorCustoSugestao,
        };
      });

      await supabase.from("compras_itens").insert(itens);

      const totalCompra = itens.reduce((acc, curr) => acc + curr.subtotal, 0);
      await supabase.from("compras").update({ valor_total: totalCompra }).eq("id", compra.id);

      alert("Pedido de compra gerado com sucesso! Redirecionando...");
      navigate({ to: "/app/compras" });
    } catch (e: any) {
      alert("Erro ao gerar pedido: " + e.message);
    }
  };

  const getSomaCategoria = (categoriaBusca: string) =>
    produtos
      .filter((p) => p.categoria?.toLowerCase().includes(categoriaBusca.toLowerCase()))
      .reduce((acc, p) => acc + Number(p.estoque || 0), 0);

  const cats = [
    {
      l: "Total de Vasos",
      v: getSomaCategoria("Vaso"),
      c: "bg-primary/10 text-primary",
      pct: 78,
    },
    {
      l: "Total de Floreiras",
      v: getSomaCategoria("Floreira"),
      c: "bg-success/15 text-success",
      pct: 62,
    },
    { l: "Total de Cuias", v: getSomaCategoria("Cuia"), c: "bg-terra/10 text-terra", pct: 48 },
    { l: "Total de Pratos", v: getSomaCategoria("Prato"), c: "bg-info/10 text-info", pct: 55 },
  ];

  const critical = produtos.filter((p) => Number(p.estoque) <= 10).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Movimentação consolidada — Centro de distribuição Bauru/SP"
        actions={
          <>
            <Button variant="outline" onClick={() => openDialog("Inventário")}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Inventário
            </Button>
            <Button variant="outline" onClick={() => openDialog("Ajuste")}>
              <Settings2 className="mr-2 h-4 w-4" />
              Ajuste
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() => openDialog("Entrada")}
            >
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Entrada
            </Button>
            <Button
              className="bg-gradient-brand text-primary-foreground"
              onClick={() => openDialog("Saída")}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Saída
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {cats.map((c) => (
          <Card key={c.l} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${c.c}`}>
                  <Package className="h-5 w-5" />
                </div>
                <Badge variant="secondary">{c.pct}% capacidade</Badge>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{c.l}</p>
              <p className="mt-1 font-display text-2xl font-bold">{c.v.toLocaleString("pt-BR")}</p>
              <Progress value={c.pct} className="mt-3 h-1.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card flex flex-col">
          <CardHeader>
            <CardTitle>Últimas movimentações</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
            <div className="divide-y">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : movimentacoes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                movimentacoes.map((m) => {
                  const neg = Number(m.quantidade) < 0;
                  const d = new Date(m.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={m.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedTransaction(m)}
                    >
                      <div
                        className={`grid h-9 w-9 place-items-center rounded-lg ${neg ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"}`}
                      >
                        {neg ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {m.produto?.nome || "Produto excluído"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.tipo} · {m.usuario} {m.motivo ? `· ${m.motivo}` : ""} · {d}
                        </p>
                      </div>
                      <p
                        className={`font-mono text-sm font-bold ${neg ? "text-destructive" : "text-success"}`}
                      >
                        {neg ? m.quantidade : `+${m.quantidade}`}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Estoque crítico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-center py-4 text-muted-foreground">Carregando...</p>
            ) : critical.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">Nenhum produto crítico.</p>
            ) : (
              critical.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold truncate pr-2">{c.nome}</span>
                    <span className="text-destructive font-medium whitespace-nowrap">
                      {c.estoque} unid.
                    </span>
                  </div>
                  <Progress value={(Number(c.estoque) / 10) * 100} className="mt-1.5 h-2" />
                </div>
              ))
            )}
            <Button variant="outline" className="w-full mt-4" onClick={handleGerarPedidoCompra}>
              Gerar pedido de compra
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova {tipoMovimentacao}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                  >
                    {produtoSelecionado
                      ? produtos.find((p) => p.id === produtoSelecionado)?.nome
                      : "Selecione ou pesquise um produto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar produto..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtos.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.codigo || ""} ${p.nome} ${p.id}`} // CommandItem matches against the value prop
                            onSelect={() => {
                              setProdutoSelecionado(p.id);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                produtoSelecionado === p.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {p.nome} (Estoque: {p.estoque})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                placeholder={
                  tipoMovimentacao === "Saída"
                    ? "Ex: 10 (será subtraído)"
                    : "Ex: 50 (será adicionado)"
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo / Observação</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Nota Fiscal 123, Ajuste de contagem..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-brand text-primary-foreground"
              onClick={handleSalvarMovimentacao}
              disabled={salvando}
            >
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Confirmar Movimentação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTransaction} onOpenChange={(o) => !o && setSelectedTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Movimentação</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div>
                <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Produto
                </p>
                <p className="font-semibold">
                  {selectedTransaction.produto?.nome || "Produto excluído"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Tipo
                  </p>
                  <Badge variant="outline">{selectedTransaction.tipo}</Badge>
                </div>
                <div>
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Quantidade
                  </p>
                  <p
                    className={`font-mono font-bold ${Number(selectedTransaction.quantidade) < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {Number(selectedTransaction.quantidade) > 0
                      ? `+${selectedTransaction.quantidade}`
                      : selectedTransaction.quantidade}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Data / Hora
                  </p>
                  <p className="text-sm">
                    {new Date(selectedTransaction.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Usuário
                  </p>
                  <p className="text-sm">{selectedTransaction.usuario}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Motivo / Observação
                </p>
                <p className="text-sm p-3 bg-muted rounded-md">
                  {selectedTransaction.motivo || "Não informado"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
