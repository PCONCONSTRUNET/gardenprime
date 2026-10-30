import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, ArrowLeft, Plus, Trash2, PackagePlus } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/compra-nova")({
  head: () => ({ meta: [{ title: "Nova Compra — GARDEN PRIME ERP" }] }),
  component: NovaCompra,
});

function NovaCompra() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

  // Form State
  const [fornecedorId, setFornecedorId] = useState("");
  const [status, setStatus] = useState("Recebido");

  // Cart State
  const [itens, setItens] = useState<any[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [custoUnitario, setCustoUnitario] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: f } = await supabase.from("fornecedores").select("*").order("empresa");
      const { data: p } = await supabase.from("produtos").select("id, nome, codigo, categoria, estoque, valor, custo_compra, status").order("nome");
      if (f) setFornecedores(f);
      if (p) setProdutos(p);
    };
    fetchData();
  }, []);

  const handleProdutoChange = (id: string) => {
    setProdutoSelecionado(id);
    const prod = produtos.find((p) => p.id === id);
    if (prod) {
      // Seta um custo sugerido (ex: 50% do valor de venda, apenas para facilitar a digitação)
      setCustoUnitario(Number((prod.valor * 0.5).toFixed(2)));
    } else {
      setCustoUnitario(0);
    }
  };

  const handleAddItem = () => {
    if (!produtoSelecionado || quantidade <= 0 || custoUnitario < 0) return;
    const prod = produtos.find((p) => p.id === produtoSelecionado);
    if (!prod) return;

    const novoItem = {
      produto_id: prod.id,
      nome: prod.nome,
      valor_unitario: Number(custoUnitario),
      quantidade: quantidade,
      subtotal: Number(custoUnitario) * quantidade,
    };

    setItens([...itens, novoItem]);
    setProdutoSelecionado("");
    setQuantidade(1);
    setCustoUnitario(0);
  };

  const handleRemoveItem = (index: number) => {
    const novosItens = [...itens];
    novosItens.splice(index, 1);
    setItens(novosItens);
  };

  const valorTotal = itens.reduce((acc, item) => acc + item.subtotal, 0);

  const handleSalvar = async () => {
    if (!fornecedorId) {
      alert("Selecione um fornecedor.");
      return;
    }
    if (itens.length === 0) {
      alert("Adicione pelo menos um produto.");
      return;
    }

    setLoading(true);
    try {
      // 1. Criar a Compra
      const { data: compraData, error: compraError } = await supabase
        .from("compras")
        .insert([
          {
            fornecedor_id: fornecedorId,
            status: status,
            valor_total: valorTotal,
          },
        ])
        .select()
        .single();

      if (compraError) throw compraError;
      const compraId = compraData.id;

      // 2. Inserir os Itens
      const itensToInsert = itens.map((i) => ({
        compra_id: compraId,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        subtotal: i.subtotal,
      }));

      const { error: itensError } = await supabase.from("compras_itens").insert(itensToInsert);
      if (itensError) throw itensError;

      // 3. Dar entrada no estoque se Status = Recebido e gerar financeiro
      if (status === "Recebido") {
        for (const item of itens) {
          const prod = produtos.find((p) => p.id === item.produto_id);
          const novoEstoque = prod.estoque + item.quantidade;
          await supabase
            .from("produtos")
            .update({ estoque: novoEstoque })
            .eq("id", item.produto_id);
        }
      }

      // Criar Conta a Pagar
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + 30); // 30 dias de prazo
      await supabase.from("contas_pagar").insert([
        {
          compra_id: compraId,
          fornecedor_id: fornecedorId,
          descricao: `Compra #${compraId.substring(0, 8).toUpperCase()}`,
          valor: valorTotal,
          vencimento: vencimento.toISOString().split("T")[0],
          status: status === "Recebido" ? "Pago" : "Pendente",
          data_pagamento: status === "Recebido" ? new Date().toISOString().split("T")[0] : null,
        },
      ]);

      alert("Compra finalizada com sucesso!");
      navigate({ to: "/app/compras" });
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nova Compra (Entrada)"
        subtitle="Registre pedidos aos fornecedores e alimente o estoque"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/compras">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button
              className="bg-gradient-brand text-primary-foreground"
              onClick={handleSalvar}
              disabled={loading || itens.length === 0}
            >
              <Save className="mr-2 h-4 w-4" /> {loading ? "Processando..." : "Salvar Compra"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-card p-6 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-brand" /> Dados da Compra
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                >
                  <option value="">Selecione um fornecedor...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.empresa}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Recebido">Recebido (Alimenta Estoque)</option>
                  <option value="Pendente">Pedido Pendente</option>
                  <option value="Em trânsito">Em trânsito</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="shadow-card p-6 space-y-4">
            <h3 className="font-semibold text-lg">Itens Comprados</h3>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label>Produto</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={produtoSelecionado}
                  onChange={(e) => handleProdutoChange(e.target.value)}
                >
                  <option value="">Buscar produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 w-24">
                <Label>Custo Unt.</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoUnitario}
                  onChange={(e) => setCustoUnitario(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 w-20">
                <Label>Qtd</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                />
              </div>
              <Button type="button" onClick={handleAddItem} variant="secondary">
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>

            <div className="border rounded-md mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Nenhum item adicionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-semibold">{item.nome}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right">
                          R$ {item.valor_unitario.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          R$ {item.subtotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-card p-6 bg-accent/30 border-brand/20">
            <h3 className="font-semibold text-lg mb-4">Total da Compra</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Total</span>
                <span className="font-display text-2xl font-bold text-brand">
                  R$ {valorTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                O estoque dos produtos listados será incrementado automaticamente ao salvar a compra
                com status "Recebido".
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
