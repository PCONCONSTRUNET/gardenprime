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
  Minus,
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
  CreditCard,
  Calendar,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import { downloadOrderPdf, openOrderPdf, shareOrderWhatsApp } from "@/lib/order-pdf";
import { AsaasCobrancaModal } from "@/components/asaas-cobranca-modal";
import { toast } from "sonner";
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

  // Payment editing
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editMetodoPagamento, setEditMetodoPagamento] = useState("");
  const [editCondicaoPagamento, setEditCondicaoPagamento] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Date editing
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  // Client editing
  const [isEditingCliente, setIsEditingCliente] = useState(false);
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [openClientePop, setOpenClientePop] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);

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
      toast.error("Erro ao buscar vendas.");
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

  const fetchClientes = async () => {
    if (clientesList.length > 0) return;
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, cpf_cnpj")
      .order("nome");
    if (data) setClientesList(data);
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
    setIsEditingPayment(false);
    setIsEditingDate(false);
    setIsEditingCliente(false);
    setEditMetodoPagamento(venda.metodo_pagamento || "");
    setEditCondicaoPagamento(venda.condicao_pagamento || "");
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

  // ─── Order detail editing handlers ──────────────────────────────────────────

  const handleSavePayment = async () => {
    if (!selectedVenda) return;
    setSavingPayment(true);
    try {
      const { error } = await supabase
        .from("vendas")
        .update({
          metodo_pagamento: editMetodoPagamento || null,
          condicao_pagamento: editCondicaoPagamento || null,
        })
        .eq("id", selectedVenda.id);

      if (error) throw error;

      setSelectedVenda((prev: any) => ({
        ...prev,
        metodo_pagamento: editMetodoPagamento,
        condicao_pagamento: editCondicaoPagamento,
      }));

      setVendas((prev) =>
        prev.map((v) =>
          v.id === selectedVenda.id
            ? {
                ...v,
                metodo_pagamento: editMetodoPagamento,
                condicao_pagamento: editCondicaoPagamento,
              }
            : v
        )
      );

      setIsEditingPayment(false);
      toast.success("Forma de pagamento atualizada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar pagamento: " + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleStartEditDate = () => {
    if (!selectedVenda?.created_at) return;
    const d = new Date(selectedVenda.created_at);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setEditDateValue(`${yyyy}-${mm}-${dd}`);
    setIsEditingDate(true);
  };

  const handleSaveDate = async () => {
    if (!selectedVenda || !editDateValue) return;
    setSavingDate(true);
    try {
      const updatedDate = new Date(`${editDateValue}T12:00:00Z`).toISOString();
      const { error } = await supabase
        .from("vendas")
        .update({ created_at: updatedDate })
        .eq("id", selectedVenda.id);
      if (error) throw error;

      setSelectedVenda((prev: any) => ({ ...prev, created_at: updatedDate }));
      setVendas((prev) =>
        prev.map((v) => (v.id === selectedVenda.id ? { ...v, created_at: updatedDate } : v))
      );
      setIsEditingDate(false);
      toast.success("Data da operação atualizada!");
    } catch (err: any) {
      toast.error("Erro ao salvar data: " + err.message);
    } finally {
      setSavingDate(false);
    }
  };

  const handleChangeCliente = async (novoClienteId: string) => {
    if (!selectedVenda) return;
    setSavingCliente(true);
    try {
      const { error } = await supabase
        .from("vendas")
        .update({ cliente_id: novoClienteId })
        .eq("id", selectedVenda.id);
      if (error) throw error;

      const novoCliente = clientesList.find((c) => c.id === novoClienteId);
      setSelectedVenda((prev: any) => ({
        ...prev,
        cliente_id: novoClienteId,
        clientes: novoCliente || prev.clientes,
      }));
      setVendas((prev) =>
        prev.map((v) =>
          v.id === selectedVenda.id
            ? { ...v, cliente_id: novoClienteId, clientes: novoCliente || v.clientes }
            : v
        )
      );

      await supabase
        .from("contas_receber")
        .update({ cliente_id: novoClienteId })
        .eq("venda_id", selectedVenda.id);

      setIsEditingCliente(false);
      setOpenClientePop(false);
      toast.success("Cliente do pedido alterado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao alterar cliente: " + err.message);
    } finally {
      setSavingCliente(false);
    }
  };

  // ─── Item editing ────────────────────────────────────────────────────────────

  const handleStartEditItems = async () => {
    await fetchProdutos();
    setEditItens(
      vendaItens.map((i) => ({
        ...i,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
        subtotal: Number(i.subtotal) || 0,
      }))
    );
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

  const handleChangeExistingQty = (itemId: string, delta: number) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const novaQtd = Math.max(1, i.quantidade + delta);
        return { ...i, quantidade: novaQtd, subtotal: novaQtd * Number(i.valor_unitario) };
      })
    );
  };

  const handleSetExistingQty = (itemId: string, qty: number) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const novaQtd = Math.max(1, isNaN(qty) ? 1 : qty);
        return { ...i, quantidade: novaQtd, subtotal: novaQtd * Number(i.valor_unitario) };
      })
    );
  };

  const handleChangeExistingUnitario = (itemId: string, newUnitario: number) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const unit = isNaN(newUnitario) || newUnitario < 0 ? 0 : newUnitario;
        return { ...i, valor_unitario: unit, subtotal: Number(i.quantidade) * unit };
      })
    );
  };

  const handleRemoveNewItem = (idx: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeNewItemQty = (idx: number, delta: number) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const novaQtd = Math.max(1, item.quantidade + delta);
        return { ...item, quantidade: novaQtd, subtotal: novaQtd * Number(item.valor_unitario) };
      })
    );
  };

  const handleSetNewItemQty = (idx: number, qty: number) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const novaQtd = Math.max(1, isNaN(qty) ? 1 : qty);
        return { ...item, quantidade: novaQtd, subtotal: novaQtd * Number(item.valor_unitario) };
      })
    );
  };

  const handleChangeNewItemUnitario = (idx: number, newUnitario: number) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const unit = isNaN(newUnitario) || newUnitario < 0 ? 0 : newUnitario;
        return { ...item, valor_unitario: unit, subtotal: Number(item.quantidade) * unit };
      })
    );
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
    const unit = Number(newUnitario) || 0;
    setNewItems((prev) => [
      ...prev,
      {
        produto_id: prod.id,
        nome: prod.nome,
        imagem: prod.imagem,
        quantidade: newQtd,
        valor_unitario: unit,
        subtotal: unit * newQtd,
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
          if (removed && removed.produto_id) {
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

      // 1b. Atualizar quantidade e valor_unitario dos itens existentes alterados
      for (const item of editItens) {
        const original = vendaItens.find((i) => i.id === item.id);
        if (!original) continue;
        const qtdChanged = original.quantidade !== item.quantidade;
        const unitChanged = Number(original.valor_unitario) !== Number(item.valor_unitario);
        if (!qtdChanged && !unitChanged) continue;

        const diff = item.quantidade - original.quantidade; // positivo = aumentou, negativo = diminuiu
        if (qtdChanged && isVendaComEstoque && item.produto_id) {
          const { data: prod } = await supabase
            .from("produtos")
            .select("estoque")
            .eq("id", item.produto_id)
            .single();
          if (prod) {
            const novoEstoque = prod.estoque - diff;
            if (diff > 0 && novoEstoque < 0) {
              toast.error(`Estoque insuficiente para ${item.produtos?.nome || "produto"}. Disponível: ${prod.estoque}`);
              setSavingItems(false);
              return;
            }
            await supabase
              .from("produtos")
              .update({ estoque: novoEstoque })
              .eq("id", item.produto_id);
          }
        }
        await supabase
          .from("vendas_itens")
          .update({
            quantidade: item.quantidade,
            valor_unitario: Number(item.valor_unitario),
            subtotal: Number(item.subtotal),
          })
          .eq("id", item.id);
      }

      // 2. Inserir novos itens
      for (const item of newItems) {
        // Se venda baixou estoque, decrementar
        if (isVendaComEstoque && item.produto_id) {
          const { data: prod } = await supabase
            .from("produtos")
            .select("estoque")
            .eq("id", item.produto_id)
            .single();
          if (prod) {
            const novoEstoque = prod.estoque - item.quantidade;
            if (novoEstoque < 0) {
              toast.error(`Estoque insuficiente para ${item.nome}. Disponível: ${prod.estoque}`);
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
          valor_unitario: Number(item.valor_unitario),
          subtotal: Number(item.subtotal),
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
      toast.success("Itens e valores do pedido atualizados com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar itens: " + err.message);
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
        <SheetContent className="w-[95vw] sm:w-[640px] sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Operação</SheetTitle>
            <SheetDescription>
              {selectedVenda?.tipo === "DAV" ? "Orçamento" : "Venda"} Nº{" "}
              {selectedVenda?.numero_venda}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl border border-border/50">
              {/* Cliente */}
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Cliente
                </span>
                {isEditingCliente ? (
                  <div className="space-y-1.5">
                    <Popover open={openClientePop} onOpenChange={setOpenClientePop}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-8 text-xs font-normal"
                          onClick={() => fetchClientes()}
                        >
                          <span className="truncate">
                            {selectedVenda?.clientes?.nome || "Selecionar cliente..."}
                          </span>
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar cliente..." />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              {clientesList.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.nome} ${c.cpf_cnpj || ""}`}
                                  onSelect={() => handleChangeCliente(c.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-3.5 w-3.5",
                                      selectedVenda?.cliente_id === c.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="truncate text-xs">
                                    <p className="font-medium">{c.nome}</p>
                                    {c.cpf_cnpj && (
                                      <p className="text-[10px] text-muted-foreground">{c.cpf_cnpj}</p>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setIsEditingCliente(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate" title={selectedVenda?.clientes?.nome}>
                      {selectedVenda?.clientes?.nome || "Cliente Avulso"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-50 hover:opacity-100 shrink-0"
                      title="Alterar cliente"
                      onClick={() => {
                        fetchClientes();
                        setIsEditingCliente(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Data */}
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Data
                </span>
                {isEditingDate ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={editDateValue}
                      onChange={(e) => setEditDateValue(e.target.value)}
                      className="h-8 text-xs font-medium"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-success shrink-0"
                      onClick={handleSaveDate}
                      disabled={savingDate}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => setIsEditingDate(false)}
                      disabled={savingDate}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium">
                      {selectedVenda ? new Date(selectedVenda.created_at).toLocaleDateString() : "-"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-50 hover:opacity-100 shrink-0"
                      title="Alterar data"
                      onClick={handleStartEditDate}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Status
                </span>
                <Select
                  value={selectedVenda?.status || ""}
                  onValueChange={(val) => handleStatusChange(selectedVenda.id, val)}
                >
                  <SelectTrigger className="h-8 text-xs font-medium">
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

              {/* Total */}
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Total
                </span>
                {isEditingTotal ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newTotalValue}
                      onChange={(e) => setNewTotalValue(e.target.value)}
                      className="w-24 border-b border-dashed border-slate-400 outline-none bg-transparent font-semibold text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-success"
                      onClick={handleSaveTotal}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      onClick={() => setIsEditingTotal(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-base text-foreground">
                      R${" "}
                      {Number(selectedVenda?.valor_total || 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-50 hover:opacity-100 shrink-0"
                      title="Editar total diretamente"
                      onClick={handleEditTotal}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Pagamento (Forma e Condição) */}
              <div className="col-span-2 pt-3 border-t border-border/50">
                {isEditingPayment ? (
                  <div className="space-y-3 bg-background p-3 rounded-lg border border-border/60 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" /> Editar Forma de Pagamento
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsEditingPayment(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Forma de Pagamento
                        </label>
                        <Select
                          value={editMetodoPagamento}
                          onValueChange={(val) => setEditMetodoPagamento(val)}
                        >
                          <SelectTrigger className="h-8 text-xs font-medium">
                            <SelectValue placeholder="Selecione a forma..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="Pix">Pix</SelectItem>
                            <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                            <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                            <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="Boleto a Prazo">Boleto a Prazo</SelectItem>
                            <SelectItem value="Transferência">Transferência / TED</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Condição / Prazo
                        </label>
                        <Input
                          className="h-8 text-xs font-medium"
                          placeholder="Ex: À Vista, Boleto a Prazo..."
                          value={editCondicaoPagamento}
                          onChange={(e) => setEditCondicaoPagamento(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Presets rápidos */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Atalhos rápidos de condição:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {[
                          "À Vista",
                          "Boleto a Prazo",
                          "Boleto (28, 35, 42 dias)",
                          "Boleto 30 dias",
                          "Boleto 30/60 dias",
                          "Entrada + 30 dias",
                          "2x sem juros",
                          "3x sem juros",
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setEditCondicaoPagamento(preset);
                              if (preset.toLowerCase().includes("boleto") && !editMetodoPagamento) {
                                setEditMetodoPagamento("Boleto");
                              }
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground border border-border/40"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setIsEditingPayment(false)}
                        disabled={savingPayment}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-gradient-brand text-primary-foreground"
                        onClick={handleSavePayment}
                        disabled={savingPayment}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {savingPayment ? "Salvando..." : "Salvar Pagamento"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                        Pagamento
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">
                          {selectedVenda?.metodo_pagamento || "Não informado"}
                        </span>
                        {selectedVenda?.condicao_pagamento && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {selectedVenda.condicao_pagamento}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditMetodoPagamento(selectedVenda?.metodo_pagamento || "");
                        setEditCondicaoPagamento(selectedVenda?.condicao_pagamento || "");
                        setIsEditingPayment(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Alterar Pagamento
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
                  <div className="space-y-2.5">
                    {editItens.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-border/70 bg-card shadow-sm space-y-2.5 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-base border">
                              {item.produtos?.imagem ? (
                                <img
                                  src={item.produtos.imagem}
                                  alt={item.produtos?.nome || "Produto"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="opacity-50">📦</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-semibold text-sm truncate text-foreground"
                                title={item.produtos?.nome}
                              >
                                {item.produtos?.nome || "Produto"}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                {item.produtos?.codigo && (
                                  <span>Cód: {item.produtos.codigo}</span>
                                )}
                                {item.produtos?.estoque !== undefined && (
                                  <span>• Estoque: {item.produtos.estoque}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 rounded-lg"
                            title="Remover produto do pedido"
                            onClick={() => handleRemoveExistingItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Linha de edição de Quantidade, Preço Unitário e Subtotal */}
                        <div className="grid grid-cols-12 gap-2 pt-2 border-t border-border/40 items-center">
                          {/* Quantidade */}
                          <div className="col-span-5 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Qtd
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 rounded-md shrink-0"
                                onClick={() => handleChangeExistingQty(item.id, -1)}
                                disabled={item.quantidade <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                className="h-7 w-12 text-center text-xs font-semibold px-1"
                                value={item.quantidade}
                                onChange={(e) =>
                                  handleSetExistingQty(item.id, parseInt(e.target.value) || 1)
                                }
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 rounded-md shrink-0"
                                onClick={() => handleChangeExistingQty(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Valor Unitário */}
                          <div className="col-span-4 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Vlr Unit. (R$)
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-7 text-xs font-semibold px-2"
                              value={item.valor_unitario}
                              onChange={(e) =>
                                handleChangeExistingUnitario(
                                  item.id,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="col-span-3 flex flex-col gap-1 text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Subtotal
                            </span>
                            <div className="text-xs font-bold text-foreground truncate h-7 flex items-center justify-end">
                              R${" "}
                              {Number(item.subtotal || 0).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Novos itens adicionados */}
                    {newItems.map((item, idx) => (
                      <div
                        key={`new-${idx}`}
                        className="p-3 rounded-xl border border-brand/40 bg-brand/5 shadow-sm space-y-2.5 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-base border">
                              {item.imagem ? (
                                <img
                                  src={item.imagem}
                                  alt={item.nome || "Produto"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="opacity-50">📦</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-semibold text-sm truncate text-foreground"
                                  title={item.nome}
                                >
                                  {item.nome}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 border-brand/50 text-brand"
                                >
                                  novo
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                {item.estoque !== undefined && <span>Estoque: {item.estoque}</span>}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 rounded-lg"
                            title="Remover produto"
                            onClick={() => handleRemoveNewItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Linha de edição */}
                        <div className="grid grid-cols-12 gap-2 pt-2 border-t border-brand/20 items-center">
                          <div className="col-span-5 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Qtd
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 rounded-md shrink-0"
                                onClick={() => handleChangeNewItemQty(idx, -1)}
                                disabled={item.quantidade <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                className="h-7 w-12 text-center text-xs font-semibold px-1"
                                value={item.quantidade}
                                onChange={(e) =>
                                  handleSetNewItemQty(idx, parseInt(e.target.value) || 1)
                                }
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 rounded-md shrink-0"
                                onClick={() => handleChangeNewItemQty(idx, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="col-span-4 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Vlr Unit. (R$)
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-7 text-xs font-semibold px-2"
                              value={item.valor_unitario}
                              onChange={(e) =>
                                handleChangeNewItemUnitario(
                                  idx,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>

                          <div className="col-span-3 flex flex-col gap-1 text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Subtotal
                            </span>
                            <div className="text-xs font-bold text-foreground truncate h-7 flex items-center justify-end">
                              R${" "}
                              {Number(item.subtotal || 0).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {editItens.length === 0 && newItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item. Adicione produtos abaixo.
                      </p>
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
