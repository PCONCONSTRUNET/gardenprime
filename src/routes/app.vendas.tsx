import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
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
  Plus,
  Calculator,
  Trash2,
  Check,
  X,
  Pencil,
  Search,
  Ban,
  Zap,
  Download,
  Printer,
  ShoppingCart,
  PackagePlus,
  ChevronsUpDown,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import { downloadOrderPdf, openOrderPdf, shareOrderWhatsApp } from "@/lib/order-pdf";
import { AsaasCobrancaModal } from "@/components/asaas-cobranca-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/vendas")({
  head: () => ({ meta: [{ title: "Vendas — GARDEN PRIME ERP" }] }),
  component: Vendas,
});

function Vendas() {
  const confirm = useConfirm();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // States for Details Sheet
  const [selectedVenda, setSelectedVenda] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [vendaItens, setVendaItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [newTotalValue, setNewTotalValue] = useState("");

  // Item editing states
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItens, setEditItens] = useState<any[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [openProdutoPop, setOpenProdutoPop] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState("");
  const [newQtd, setNewQtd] = useState(1);
  const [newUnitario, setNewUnitario] = useState(0);
  const [savingItems, setSavingItems] = useState(false);

  // ASAAS Modal
  const [openAsaas, setOpenAsaas] = useState(false);
  const [asaasCliente, setAsaasCliente] = useState<any>(null);

  const fetchVendas = async () => {
    try {
      const { data, error } = await supabase
        .from("vendas")
        .select(`*, clientes (*)`)
        .or("status_aprovacao.neq.Pendente,status_aprovacao.is.null")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVendas(data || []);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao buscar vendas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendas();
  }, []);

  // Fetch products for editing
  const fetchProdutos = async () => {
    if (produtos.length > 0) return;
    const { data } = await supabase
      .from("produtos")
      .select("id, nome, codigo, valor, estoque, imagem")
      .eq("status", "Ativo")
      .order("nome");
    if (data) setProdutos(data);
  };

  const filteredVendas = vendas.filter((v) => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    const name = (v.clientes?.nome || "").toLowerCase();
    const cnpj = (v.clientes?.cpf_cnpj || "").toLowerCase();
    const numero = String(v.numero_venda || v.numero || v.id).toLowerCase();
    return name.includes(lower) || cnpj.includes(lower) || numero.includes(lower);
  });

  const handleOpenDetails = async (venda: any) => {
    setSelectedVenda(venda);
    setOpenSheet(true);
    setIsEditingTotal(false);
    setIsEditingItems(false);
    setLoadingItens(true);
    try {
      const { data, error } = await supabase
        .from("vendas_itens")
        .select("*, produtos(nome, codigo, imagem, estoque, valor)")
        .eq("venda_id", venda.id);
      if (!error && data) setVendaItens(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItens(false);
    }
  };

  // ─── Item editing ────────────────────────────────────────────────────────────

  const handleStartEditItems = async () => {
    await fetchProdutos();
    setEditItens(vendaItens.map((i) => ({ ...i })));
    setRemovedIds([]);
    setNewItems([]);
    setSelectedProdutoId("");
    setNewQtd(1);
    setNewUnitario(0);
    setIsEditingItems(true);
  };

  const handleCancelEditItems = () => {
    setIsEditingItems(false);
    setEditItens([]);
    setRemovedIds([]);
    setNewItems([]);
  };

  const handleRemoveExistingItem = (itemId: string) => {
    setEditItens((prev) => prev.filter((i) => i.id !== itemId));
    setRemovedIds((prev) => [...prev, itemId]);
  };

  const handleRemoveNewItem = (idx: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSelectProduto = (prodId: string) => {
    const prod = produtos.find((p) => p.id === prodId);
    if (prod) setNewUnitario(Number(prod.valor));
    setSelectedProdutoId(prodId);
    setOpenProdutoPop(false);
  };

  const handleAddNewItem = () => {
    if (!selectedProdutoId || newQtd <= 0) return;
    const prod = produtos.find((p) => p.id === selectedProdutoId);
    if (!prod) return;
    setNewItems((prev) => [
      ...prev,
      {
        produto_id: prod.id,
        nome: prod.nome,
        imagem: prod.imagem,
        quantidade: newQtd,
        valor_unitario: newUnitario,
        subtotal: newUnitario * newQtd,
        estoque: prod.estoque,
      },
    ]);
    setSelectedProdutoId("");
    setNewQtd(1);
    setNewUnitario(0);
  };

  const handleSaveItems = async () => {
    setSavingItems(true);
    try {
      const vendaId = selectedVenda.id;
      const isVendaComEstoque = ["Pago", "Faturado", "Entregue"].includes(selectedVenda.status);

      // 1. Remove itens marcados para remoção
      for (const itemId of removedIds) {
        // Se venda baixou estoque, devolver
        if (isVendaComEstoque) {
          const removed = vendaItens.find((i) => i.id === itemId);
          if (removed) {
            const { data: prod } = await supabase
              .from("produtos")
              .select("estoque")
              .eq("id", removed.produto_id)
              .single();
            if (prod) {
              await supabase
                .from("produtos")
                .update({ estoque: prod.estoque + removed.quantidade })
                .eq("id", removed.produto_id);
            }
          }
        }
        await supabase.from("vendas_itens").delete().eq("id", itemId);
      }

      // 2. Inserir novos itens
      for (const item of newItems) {
        // Se venda baixou estoque, decrementar
        if (isVendaComEstoque) {
          const { data: prod } = await supabase
            .from("produtos")
            .select("estoque")
            .eq("id", item.produto_id)
            .single();
          if (prod) {
            const novoEstoque = prod.estoque - item.quantidade;
            if (novoEstoque < 0) {
              alert(`Estoque insuficiente para ${item.nome}. Disponível: ${prod.estoque}`);
              setSavingItems(false);
              return;
            }
            await supabase
              .from("produtos")
              .update({ estoque: novoEstoque })
              .eq("id", item.produto_id);
          }
        }
        await supabase.from("vendas_itens").insert({
          venda_id: vendaId,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          subtotal: item.subtotal,
        });
      }

      // 3. Recalcular total
      const { data: allItens } = await supabase
        .from("vendas_itens")
        .select("subtotal")
        .eq("venda_id", vendaId);

      const novoTotal = (allItens || []).reduce(
        (acc: number, i: any) => acc + Number(i.subtotal),
        0
      );

      await supabase.from("vendas").update({ valor_total: novoTotal }).eq("id", vendaId);

      // Atualizar contas_receber se existir
      await supabase
        .from("contas_receber")
        .update({ valor: novoTotal })
        .eq("venda_id", vendaId);

      // 4. Recarregar itens
      const { data: updatedItens } = await supabase
        .from("vendas_itens")
        .select("*, produtos(nome, codigo, imagem, estoque, valor)")
        .eq("venda_id", vendaId);

      setVendaItens(updatedItens || []);
      setSelectedVenda((prev: any) => ({ ...prev, valor_total: novoTotal }));
      setVendas((prev) =>
        prev.map((v) => (v.id === vendaId ? { ...v, valor_total: novoTotal } : v))
      );

      setIsEditingItems(false);
      setEditItens([]);
      setRemovedIds([]);
      setNewItems([]);
    } catch (err: any) {
      alert("Erro ao salvar itens: " + err.message);
    } finally {
      setSavingItems(false);
    }
  };

  // ─── Existing handlers ────────────────────────────────────────────────────────

  const handleShareWhatsApp = async (venda: any) => {
    try {
      const { data: itens } = await supabase
        .from("vendas_itens")
        .select("*, produtos(nome)")
        .eq("venda_id", venda.id);

      const mappedVenda = {
        ...venda,
        cliente: venda.clientes || venda.cliente || null,
        cliente_nome: venda.clientes?.nome || venda.cliente_nome,
        valor_total: venda.valor_total || venda.total,
      };

      await shareOrderWhatsApp(mappedVenda, itens || []);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao compartilhar no WhatsApp: " + (err.message || err));
    }
  };

  const handleDelete = async (venda: any) => {
    const isDav = venda.tipo === "DAV";
    if (
      !(await confirm({
        description: `Tem certeza que deseja excluir est${isDav ? "e orçamento" : "a venda"}? ${["Faturado", "Pago", "Entregue"].includes(venda.status) ? "Os itens retornarão ao estoque." : ""}`,
        variant: "destructive",
      }))
    )
      return;
    try {
      if (["Faturado", "Pago", "Entregue"].includes(venda.status)) {
        const { data: itens } = await supabase
          .from("vendas_itens")
          .select("produto_id, quantidade")
          .eq("venda_id", venda.id);
        if (itens) {
          for (const item of itens) {
            const { data: prod } = await supabase
              .from("produtos")
              .select("estoque")
              .eq("id", item.produto_id)
              .single();
            if (prod) {
              await supabase
                .from("produtos")
                .update({ estoque: prod.estoque + item.quantidade })
                .eq("id", item.produto_id);
            }
          }
        }
      }

      await supabase.from("vendas_itens").delete().eq("venda_id", venda.id);
      const { error } = await supabase.from("vendas").delete().eq("id", venda.id);
      if (error) throw error;
      if (selectedVenda?.id === venda.id) {
        setOpenSheet(false);
        setSelectedVenda(null);
      }
      fetchVendas();
    } catch (err: any) {
      alert("Erro ao deletar: " + err.message);
    }
  };

  const handleCancelDav = async (venda: any) => {
    if (
      !(await confirm({
        description: "Tem certeza que deseja cancelar este orçamento?",
        variant: "destructive",
      }))
    )
      return;

    try {
      const { error } = await supabase
        .from("vendas")
        .update({ status: "Cancelado", status_aprovacao: "Cancelado" })
        .eq("id", venda.id);
      if (error) throw error;

      if (selectedVenda?.id === venda.id) {
        setSelectedVenda((prev: any) =>
          prev ? { ...prev, status: "Cancelado", status_aprovacao: "Cancelado" } : null,
        );
      }
      fetchVendas();
    } catch (err: any) {
      alert("Erro ao cancelar orçamento: " + err.message);
    }
  };

  const getTone = (status: string) => {
    if (status === "Pago" || status === "Faturado") return "bg-success/15 text-success border-0";
    if (status === "Aguardando Pagamento" || status === "Aprovado")
      return "bg-warning/15 text-warning border-0";
    if (status === "Rejeitado" || status === "Cancelado")
      return "bg-destructive/10 text-destructive border-0 font-semibold";
    return "bg-info/15 text-info border-0 font-semibold";
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("vendas").update({ status: newStatus }).eq("id", id);
      if (error) throw error;

      setSelectedVenda((prev: any) => ({ ...prev, status: newStatus }));
      setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v)));
    } catch (err: any) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const handleEditTotal = () => {
    setNewTotalValue(selectedVenda?.valor_total?.toString() || "0");
    setIsEditingTotal(true);
  };

  const handleSaveTotal = async () => {
    const val = parseFloat(newTotalValue);
    if (isNaN(val) || val < 0) {
      alert("Valor inválido");
      return;
    }
    try {
      const { error: err1 } = await supabase
        .from("vendas")
        .update({ valor_total: val })
        .eq("id", selectedVenda.id);
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("contas_receber")
        .update({ valor: val })
        .eq("venda_id", selectedVenda.id);
      if (err2) throw err2;

      setSelectedVenda((prev: any) => ({ ...prev, valor_total: val }));
      setVendas((prev) =>
        prev.map((v) => (v.id === selectedVenda.id ? { ...v, valor_total: val } : v)),
      );
      setIsEditingTotal(false);
    } catch (err: any) {
      alert("Erro ao atualizar valor: " + err.message);
    }
  };

  // Preview totals while editing items
  const editTotal = [
    ...editItens.map((i) => i.subtotal),
    ...newItems.map((i) => i.subtotal),
  ].reduce((a, b) => a + Number(b), 0);

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Pedidos, orçamentos e faturamento"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/venda-nova">
                <Calculator className="mr-2 h-4 w-4" />
                Novo Orçamento (DAV)
              </Link>
            </Button>
            <Button className="bg-gradient-brand text-primary-foreground" asChild>
              <Link to="/app/venda-nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova Venda
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome, CNPJ/CPF ou número..."
            className="pl-8 bg-card"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando operações...
                </TableCell>
              </TableRow>
            ) : filteredVendas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma venda ou orçamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredVendas.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenDetails(v)}
                >
                  <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{v.tipo}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {v.cliente_id ? v.clientes?.nome || "Cliente Removido" : "Venda Avulsa"}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground max-w-[120px] truncate"
                    title={
                      v.metodo_pagamento ||
                      "Dinheiro / Pix" + (v.condicao_pagamento ? ` - ${v.condicao_pagamento}` : "")
                    }
                  >
                    <span className="font-semibold text-foreground">
                      {v.metodo_pagamento || "Não info."}
                    </span>
                    {v.condicao_pagamento &&
                      v.condicao_pagamento !== "Dinheiro / Pix" &&
                      v.condicao_pagamento !== "Cartão de Crédito" &&
                      v.condicao_pagamento !== "Cartão de Débito" && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          - {v.condicao_pagamento}
                        </span>
                      )}
                  </TableCell>
                  <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(v.valor_total).toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell>
                    <Badge className={getTone(v.status)}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {v.tipo === "DAV" && v.status !== "Cancelado" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        title="Cancelar Orçamento"
                        onClick={() => handleCancelDav(v)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title={v.tipo === "DAV" ? "Excluir Orçamento" : "Excluir Venda / Pedido"}
                      onClick={() => handleDelete(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={openSheet} onOpenChange={(o) => { setOpenSheet(o); if (!o) handleCancelEditItems(); }}>
        <SheetContent className="w-[400px] sm:w-[560px] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Operação</SheetTitle>
            <SheetDescription>
              {selectedVenda?.tipo === "DAV" ? "Orçamento" : "Venda"} Nº{" "}
              {selectedVenda?.numero_venda}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Cliente
                </span>
                <span className="font-medium">
                  {selectedVenda?.clientes?.nome || "Cliente Removido"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Data
                </span>
                <span className="font-medium">
                  {selectedVenda ? new Date(selectedVenda.created_at).toLocaleDateString() : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Status
                </span>
                <Select
                  value={selectedVenda?.status || ""}
                  onValueChange={(val) => handleStatusChange(selectedVenda.id, val)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Aguardando Pagamento">Aguardando Pagamento</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Faturado">Faturado</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Total
                </span>
                {isEditingTotal ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newTotalValue}
                      onChange={(e) => setNewTotalValue(e.target.value)}
                      className="w-24 border-b border-dashed border-slate-400 outline-none bg-transparent font-semibold"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-success"
                      onClick={handleSaveTotal}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      onClick={() => setIsEditingTotal(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">
                      R${" "}
                      {Number(selectedVenda?.valor_total || 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-40 hover:opacity-100"
                      onClick={handleEditTotal}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Ações / Botões */}
            <div className="flex flex-col gap-3 pt-6 border-t pb-2">
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handleShareWhatsApp(selectedVenda)}
                >
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                  Enviar WhatsApp
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  onClick={() => openOrderPdf(selectedVenda?.id)}
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  Imprimir PDF
                </Button>
                <Button
                  variant="outline"
                  className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  onClick={() => downloadOrderPdf(
                    {
                      ...selectedVenda,
                      cliente: selectedVenda?.clientes || selectedVenda?.cliente,
                      condicao_pagamento: selectedVenda?.metodo_pagamento || selectedVenda?.condicao_pagamento,
                      total: selectedVenda?.valor_total ?? selectedVenda?.total,
                      subtotal: selectedVenda?.subtotal ?? selectedVenda?.valor_total,
                    },
                    vendaItens
                  )}
                >
                  <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  Baixar PDF
                </Button>
              </div>
              <Button
                variant="secondary"
                className="w-full font-bold border border-slate-200"
                onClick={() => {
                  const itemsMagic = vendaItens
                    .map((i) => `${i.produto_id}:${i.quantidade}`)
                    .join(",");
                  window.location.href = `/app/pdv?c=${itemsMagic}`;
                }}
              >
                Clonar Pedido
              </Button>

              <div className="pt-2 border-t flex flex-col gap-2">
                {selectedVenda?.tipo === "DAV" ? (
                  <>
                    {selectedVenda.status !== "Cancelado" && (
                      <Button
                        variant="outline"
                        className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                        onClick={() => handleCancelDav(selectedVenda)}
                      >
                        <Ban className="h-4 w-4 mr-2 text-amber-600" />
                        Cancelar Orçamento
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:bg-destructive/10 font-semibold text-xs"
                      onClick={() => handleDelete(selectedVenda)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Orçamento Definitivamente
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 font-semibold"
                    onClick={() => handleDelete(selectedVenda)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Venda / Pedido
                  </Button>
                )}
              </div>
            </div>

            {/* ── SEÇÃO PRODUTOS ─────────────────────────────────────────── */}
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4 flex items-center justify-between">
                <span>Produtos</span>
                <div className="flex items-center gap-2">
                  {!isEditingItems && (
                    <Badge variant="outline">{vendaItens.length} itens</Badge>
                  )}
                  {isEditingItems ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive hover:bg-destructive/10 text-xs"
                        onClick={handleCancelEditItems}
                        disabled={savingItems}
                      >
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 bg-gradient-brand text-primary-foreground text-xs"
                        onClick={handleSaveItems}
                        disabled={savingItems}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {savingItems ? "Salvando..." : "Salvar Itens"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={handleStartEditItems}
                      disabled={loadingItens}
                    >
                      <PackagePlus className="h-3 w-3" /> Editar Itens
                    </Button>
                  )}
                </div>
              </h4>

              {/* Modo edição */}
              {isEditingItems ? (
                <div className="space-y-4">
                  {/* Itens existentes editáveis */}
                  <div className="space-y-2">
                    {editItens.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-base">
                            {item.produtos?.imagem ? (
                              <img src={item.produtos.imagem} alt={item.produtos.nome} className="h-full w-full object-cover" />
                            ) : (
                              <span className="opacity-50">📦</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">{item.produtos?.nome || "Produto"}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.quantidade}x R$ {Number(item.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium text-sm">
                            R$ {Number(item.subtotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRemoveExistingItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Novos itens adicionados */}
                    {newItems.map((item, idx) => (
                      <div
                        key={`new-${idx}`}
                        className="flex justify-between items-center p-3 rounded-lg border border-brand/30 bg-brand/5"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-base">
                            {item.imagem ? (
                              <img src={item.imagem} alt={item.nome} className="h-full w-full object-cover" />
                            ) : (
                              <span className="opacity-50">📦</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">{item.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.quantidade}x R$ {Number(item.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] border-brand/40 text-brand">novo</Badge>
                          <span className="font-medium text-sm">
                            R$ {Number(item.subtotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRemoveNewItem(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {editItens.length === 0 && newItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum item. Adicione produtos abaixo.</p>
                    )}
                  </div>

                  {/* Formulário para adicionar produto */}
                  <div className="rounded-xl border border-dashed border-brand/30 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ShoppingCart className="h-3.5 w-3.5" /> Adicionar Produto
                    </p>
                    <Popover open={openProdutoPop} onOpenChange={setOpenProdutoPop}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-9 font-normal text-sm"
                        >
                          {selectedProdutoId
                            ? (() => {
                                const p = produtos.find((p) => p.id === selectedProdutoId);
                                return p ? `${p.nome} (Estoque: ${p.estoque})` : "Selecionar produto...";
                              })()
                            : "Selecionar ou buscar produto..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[340px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar produto por nome..." />
                          <CommandList>
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                              {produtos.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.codigo || ""} ${p.nome} ${p.id}`}
                                  onSelect={() => handleSelectProduto(p.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProdutoId === p.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <span className="text-sm">
                                    {p.nome} — R$ {Number(p.valor).toFixed(2)} (Est: {p.estoque})
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Qtd</label>
                        <Input
                          type="number"
                          min="1"
                          value={newQtd}
                          onChange={(e) => setNewQtd(Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Valor Unit. (R$)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newUnitario}
                          onChange={(e) => setNewUnitario(parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          className="h-8 bg-gradient-brand text-primary-foreground"
                          onClick={handleAddNewItem}
                          disabled={!selectedProdutoId || newQtd <= 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Preview do novo total */}
                  <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                    <span className="text-sm font-semibold text-muted-foreground">Novo Total Estimado:</span>
                    <span className="font-bold text-base text-brand">
                      R$ {editTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                /* Modo visualização */
                <div>
                  {loadingItens ? (
                    <p className="text-sm text-muted-foreground">Carregando itens...</p>
                  ) : vendaItens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {vendaItens.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-lg">
                              {item.produtos?.imagem ? (
                                <img
                                  src={item.produtos.imagem}
                                  alt={item.produtos.nome}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="opacity-50">📦</span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">
                                {item.produtos?.nome || "Produto Desconhecido"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.quantidade}x R${" "}
                                {Number(item.valor_unitario).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-medium text-sm">
                            R${" "}
                            {Number(item.subtotal).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal ASAAS */}
      {openAsaas && (
        <AsaasCobrancaModal
          open={openAsaas}
          onClose={() => setOpenAsaas(false)}
          cliente={asaasCliente}
          valor={Number(selectedVenda?.valor_total || 0)}
          descricao={`Venda #${selectedVenda?.numero_venda} — ${asaasCliente?.nome || ""}`}
          vencimentoSugerido={new Date().toISOString().split("T")[0]}
          metodoPagamentoSugerido={selectedVenda?.metodo_pagamento}
          venda_id={selectedVenda?.id}
          onSuccess={() => fetchVendas()}
        />
      )}
    </>
  );
}
