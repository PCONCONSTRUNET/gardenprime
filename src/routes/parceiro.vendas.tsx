import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import {
  Loader2,
  PackageOpen,
  FileText,
  Search,
  X,
  Trash2,
  Download,
  Copy,
  Ban,
  PackagePlus,
  ShoppingCart,
  Save,
  Plus,
  Minus,
  Truck,
  CheckCircle2,
  Clock,
  UserCheck,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WhatsAppIcon,
  shareOrderWhatsApp,
  openOrderPdf,
  downloadOrderPdf,
  getOrderNumber,
  isOrderDav,
} from "@/lib/order-pdf";
import { OrderProductPicker, type PickerProduct } from "@/components/order-product-picker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parceiro/vendas")({
  head: () => ({ meta: [{ title: "Minhas Vendas — GARDEN PRIME" }] }),
  component: VendasParceiro,
});

function VendasParceiro() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);

  const [selectedVenda, setSelectedVenda] = useState<any>(null);
  const [vendaItens, setVendaItens] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);

  // Delivery state
  const [activeTab, setActiveTab] = useState<"todos" | "aguardando" | "transporte" | "entregue" | "cancelado">("todos");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [updatingDelivery, setUpdatingDelivery] = useState(false);

  // Item editing states
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItens, setEditItens] = useState<any[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const openConfirm = (title: string, description: string, onConfirm: () => void, danger = true) => {
    setConfirmDialog({ open: true, title, description, onConfirm, danger });
  };
  const closeConfirm = () => setConfirmDialog((p) => ({ ...p, open: false }));

  const handleShare = async (venda: any, itens?: any[]) => {
    setSharingId(venda.id);
    try {
      await shareOrderWhatsApp(venda, itens);
    } finally {
      setSharingId(null);
    }
  };

  const openDetails = async (venda: any, autoEdit = false) => {
    setSelectedVenda(venda);
    setDeliveryStatus(venda.status || "Aguardando Entrega");
    setDeliveryPerson(venda.rotas?.motorista || "");
    setIsDetailsOpen(true);
    setIsEditingItems(false);
    setLoadingItens(true);
    setVendaItens([]);
    try {
      const [{ data }] = await Promise.all([
        supabase
          .from("vendas_itens")
          .select("*, produto:produtos(nome, codigo, emoji, imagem, valor, estoque)")
          .eq("venda_id", venda.id),
        autoEdit ? fetchProdutos() : Promise.resolve(),
      ]);
      if (data) {
        setVendaItens(data);
        if (autoEdit) {
          setEditItens(data.map((i: any) => ({ ...i })));
          setRemovedIds([]);
          setNewItems([]);
          setIsEditingItems(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItens(false);
    }
  };

  const handleSaveDelivery = async (newStatus?: string) => {
    if (!selectedVenda) return;
    const targetStatus = newStatus || deliveryStatus || selectedVenda.status || "Aguardando Entrega";
    setUpdatingDelivery(true);
    try {
      let currentRotaId = selectedVenda.rota_id;
      const cleanPerson = deliveryPerson.trim();

      if (cleanPerson) {
        if (currentRotaId) {
          await supabase
            .from("rotas")
            .update({ motorista: cleanPerson })
            .eq("id", currentRotaId);
        } else {
          const { data: novaRota, error: erroRota } = await supabase
            .from("rotas")
            .insert([{ motorista: cleanPerson, veiculo: "Transporte / Entrega" }])
            .select()
            .single();
          if (erroRota) throw erroRota;
          if (novaRota) {
            currentRotaId = novaRota.id;
          }
        }
      }

      const { error: errVenda } = await supabase
        .from("vendas")
        .update({
          status: targetStatus,
          rota_id: currentRotaId || selectedVenda.rota_id,
        })
        .eq("id", selectedVenda.id);

      if (errVenda) throw errVenda;

      const updatedRotas = cleanPerson
        ? { id: currentRotaId, motorista: cleanPerson, veiculo: "Transporte / Entrega" }
        : selectedVenda.rotas;

      setSelectedVenda((prev: any) => ({
        ...prev,
        status: targetStatus,
        rota_id: currentRotaId || prev?.rota_id,
        rotas: updatedRotas,
      }));

      setVendas((prev) =>
        prev.map((v) =>
          v.id === selectedVenda.id
            ? {
                ...v,
                status: targetStatus,
                rota_id: currentRotaId || v.rota_id,
                rotas: updatedRotas,
              }
            : v
        )
      );

      setDeliveryStatus(targetStatus);
      alert("Status de entrega atualizado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar entrega:", err);
      alert("Erro ao atualizar entrega: " + err.message);
    } finally {
      setUpdatingDelivery(false);
    }
  };

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

  useEffect(() => {
    async function fetchVendas() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const { data: vendedor } = await supabase
          .from("vendedores")
          .select("id")
          .eq("user_id", session.user.id)
          .single();

        if (vendedor) {
          const { data, error } = await supabase
            .from("vendas")
            .select("*, clientes(*), rotas(id, motorista, veiculo)")
            .eq("vendedor_id", vendedor.id)
            .order("created_at", { ascending: false });

          if (data) setVendas(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchVendas();
  }, []);

  // ─── Item editing ────────────────────────────────────────────────────────────

  const handleStartEditItems = async () => {
    await fetchProdutos();
    setEditItens(vendaItens.map((i) => ({ ...i })));
    setRemovedIds([]);
    setNewItems([]);
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
        const currentQ = typeof i.quantidade === "number" ? i.quantidade : (parseInt(String(i.quantidade)) || 1);
        const novaQtd = Math.max(1, currentQ + delta);
        const uVal = typeof i.valor_unitario === "number" ? i.valor_unitario : (parseFloat(String(i.valor_unitario)) || 0);
        return { ...i, quantidade: novaQtd, subtotal: novaQtd * uVal };
      })
    );
  };

  const handleSetExistingQty = (itemId: string, val: string) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        if (val === "") {
          return { ...i, quantidade: "", subtotal: 0 };
        }
        const novaQtd = parseInt(val);
        if (isNaN(novaQtd) || novaQtd < 0) return i;
        const uVal = typeof i.valor_unitario === "number" ? i.valor_unitario : (parseFloat(String(i.valor_unitario)) || 0);
        return { ...i, quantidade: novaQtd, subtotal: novaQtd * uVal };
      })
    );
  };

  const handleSetExistingUnitPrice = (itemId: string, val: string | number) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        if (val === "") {
          return { ...i, valor_unitario: "", subtotal: 0 };
        }
        const newU = typeof val === "number" ? val : parseFloat(val);
        if (isNaN(newU) || newU < 0) return i;
        const qVal = typeof i.quantidade === "number" ? i.quantidade : (parseInt(String(i.quantidade)) || 0);
        return { ...i, valor_unitario: newU, subtotal: qVal * newU };
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
        const currentQ = typeof item.quantidade === "number" ? item.quantidade : (parseInt(String(item.quantidade)) || 1);
        const novaQtd = Math.max(1, currentQ + delta);
        const uVal = typeof item.valor_unitario === "number" ? item.valor_unitario : (parseFloat(String(item.valor_unitario)) || 0);
        return { ...item, quantidade: novaQtd, subtotal: novaQtd * uVal };
      })
    );
  };

  const handleSetNewItemQty = (idx: number, val: string) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (val === "") {
          return { ...item, quantidade: "", subtotal: 0 };
        }
        const novaQtd = parseInt(val);
        if (isNaN(novaQtd) || novaQtd < 0) return item;
        const uVal = typeof item.valor_unitario === "number" ? item.valor_unitario : (parseFloat(String(item.valor_unitario)) || 0);
        return { ...item, quantidade: novaQtd, subtotal: novaQtd * uVal };
      })
    );
  };

  const handleSetNewItemUnitPrice = (idx: number, val: string | number) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (val === "") {
          return { ...item, valor_unitario: "", subtotal: 0 };
        }
        const newU = typeof val === "number" ? val : parseFloat(val);
        if (isNaN(newU) || newU < 0) return item;
        const qVal = typeof item.quantidade === "number" ? item.quantidade : (parseInt(String(item.quantidade)) || 0);
        return { ...item, valor_unitario: newU, subtotal: qVal * newU };
      })
    );
  };

  const handleQuickAddProduct = (prod: PickerProduct, quantidade: number) => {
    const qtdSafe = Math.max(1, Number(quantidade) || 1);
    const unitVal = Number(prod.valor || 0);

    setNewItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.produto_id === prod.id);
      if (existingIdx >= 0) {
        return prev.map((item, idx) => {
          if (idx !== existingIdx) return item;
          const nextQty = (Number(item.quantidade) || 0) + qtdSafe;
          const uVal = Number(item.valor_unitario) || 0;
          return { ...item, quantidade: nextQty, subtotal: nextQty * uVal };
        });
      }
      return [
        ...prev,
        {
          produto_id: prod.id,
          codigo: prod.codigo ?? null,
          nome: prod.nome,
          imagem: prod.imagem,
          emoji: prod.emoji,
          quantidade: qtdSafe,
          valor_unitario: unitVal,
          subtotal: unitVal * qtdSafe,
          estoque: prod.estoque,
        },
      ];
    });
  };

  const handleSaveItems = async () => {
    setSavingItems(true);
    try {
      const vendaId = selectedVenda.id;
      const isVendaComEstoque = ["Pago", "Faturado", "Entregue"].includes(selectedVenda.status);

      // 1. Remove itens marcados
      for (const itemId of removedIds) {
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
                .update({ estoque: prod.estoque + Number(removed.quantidade || 0) })
                .eq("id", removed.produto_id);
            }
          }
        }
        await supabase.from("vendas_itens").delete().eq("id", itemId);
      }

      // 2. Atualizar itens existentes alterados (quantidade e/ou valor unitário)
      for (const item of editItens) {
        const qNum = typeof item.quantidade === "number" ? item.quantidade : (parseInt(String(item.quantidade)) || 1);
        const uNum = typeof item.valor_unitario === "number" ? item.valor_unitario : (parseFloat(String(item.valor_unitario)) || 0);
        const subtotal = qNum * uNum;

        const original = vendaItens.find((i) => i.id === item.id);
        if (original && isVendaComEstoque) {
          const diff = qNum - Number(original.quantidade || 0);
          if (diff !== 0) {
            const { data: prod } = await supabase
              .from("produtos")
              .select("estoque")
              .eq("id", item.produto_id)
              .single();
            if (prod) {
              const novoEstoque = prod.estoque - diff;
              if (diff > 0 && novoEstoque < 0) {
                alert(`Estoque insuficiente para ${item.produto?.nome || "produto"}. Disponível: ${prod.estoque}`);
                setSavingItems(false);
                return;
              }
              await supabase
                .from("produtos")
                .update({ estoque: novoEstoque })
                .eq("id", item.produto_id);
            }
          }
        }

        const { error: updErr } = await supabase
          .from("vendas_itens")
          .update({
            quantidade: qNum,
            valor_unitario: uNum,
            subtotal: subtotal,
          })
          .eq("id", item.id);
        if (updErr) throw updErr;
      }

      // 3. Inserir novos itens
      for (const item of newItems) {
        const qNum = typeof item.quantidade === "number" ? item.quantidade : (parseInt(String(item.quantidade)) || 1);
        const uNum = typeof item.valor_unitario === "number" ? item.valor_unitario : (parseFloat(String(item.valor_unitario)) || 0);
        const subtotal = qNum * uNum;

        if (isVendaComEstoque) {
          const { data: prod } = await supabase
            .from("produtos")
            .select("estoque")
            .eq("id", item.produto_id)
            .single();
          if (prod) {
            const novoEstoque = prod.estoque - qNum;
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
        const { error: insErr } = await supabase.from("vendas_itens").insert({
          venda_id: vendaId,
          produto_id: item.produto_id,
          quantidade: qNum,
          valor_unitario: uNum,
          subtotal: subtotal,
        });
        if (insErr) throw insErr;
      }

      // 4. Recalcular total da venda
      const { data: allItens } = await supabase
        .from("vendas_itens")
        .select("subtotal")
        .eq("venda_id", vendaId);

      const novoTotal = (allItens || []).reduce(
        (acc: number, i: any) => acc + Number(i.subtotal || 0),
        0
      );

      await supabase
        .from("vendas")
        .update({ valor_total: novoTotal, subtotal: novoTotal })
        .eq("id", vendaId);

      await supabase
        .from("contas_receber")
        .update({ valor: novoTotal })
        .eq("venda_id", vendaId);

      // 5. Recarregar itens
      const { data: updatedItens } = await supabase
        .from("vendas_itens")
        .select("*, produto:produtos(nome, codigo, emoji, imagem, valor, estoque)")
        .eq("venda_id", vendaId);

      setVendaItens(updatedItens || []);
      setSelectedVenda((prev: any) => ({ ...prev, valor_total: novoTotal, subtotal: novoTotal }));
      setVendas((prev) =>
        prev.map((v) => (v.id === vendaId ? { ...v, valor_total: novoTotal, subtotal: novoTotal } : v))
      );

      setIsEditingItems(false);
      setEditItens([]);
      setRemovedIds([]);
      setNewItems([]);
    } catch (err: any) {
      console.error("Erro ao salvar itens:", err);
      alert("Erro ao salvar itens: " + err.message);
    } finally {
      setSavingItems(false);
    }
  };

  // ─── Existing handlers ────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "aprovado":
      case "aprovada":
      case "aceito":
      case "pago":
      case "faturado":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "entregue":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "em transporte":
      case "em rota":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "aguardando entrega":
      case "pendente":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "rejeitado":
      case "rejeitada":
      case "cancelado":
      case "cancelada":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const deleteVenda = async (id: string, isDav: boolean = false) => {
    const label = isDav ? "orçamento" : "pedido";
    openConfirm(
      `Excluir ${label}`,
      `Tem certeza que deseja excluir este ${label}? Essa ação não pode ser desfeita.`,
      async () => {
        try {
          await supabase.from("vendas_itens").delete().eq("venda_id", id);
          const { error } = await supabase.from("vendas").delete().eq("id", id);
          if (error) throw error;
          setVendas((prev) => prev.filter((v) => v.id !== id));
          if (selectedVenda?.id === id) {
            setSelectedVenda(null);
            setIsDetailsOpen(false);
          }
        } catch (err: any) {
          alert(`Erro ao excluir ${label}: ` + err.message);
        }
      }
    );
  };

  const cancelarOrcamento = async (id: string) => {
    openConfirm(
      "Cancelar orçamento",
      "Tem certeza que deseja cancelar este orçamento? Ele será marcado como cancelado.",
      async () => {
        try {
          const { error } = await supabase
            .from("vendas")
            .update({ status: "Cancelado", status_aprovacao: "Cancelado" })
            .eq("id", id);
          if (error) throw error;

          setVendas((prev) =>
            prev.map((v) =>
              v.id === id ? { ...v, status: "Cancelado", status_aprovacao: "Cancelado" } : v,
            ),
          );
          if (selectedVenda?.id === id) {
            setSelectedVenda((prev: any) =>
              prev ? { ...prev, status: "Cancelado", status_aprovacao: "Cancelado" } : null,
            );
          }
        } catch (err: any) {
          alert("Erro ao cancelar orçamento: " + err.message);
        }
      }
    );
  };

  const filteredVendas = vendas.filter((v) => {
    let matchesSearch = true;
    let matchesDate = true;
    let matchesTab = true;

    if (searchTerm) {
      const nome = (v.clientes?.nome || "").toLowerCase();
      const num = String(v.numero_venda || v.numero || "").toLowerCase();
      matchesSearch = nome.includes(searchTerm.toLowerCase()) || num.includes(searchTerm.toLowerCase());
    }

    if (selectedDate) {
      matchesDate = v.created_at.startsWith(selectedDate);
    }

    if (activeTab === "aguardando") {
      matchesTab = v.status === "Aguardando Entrega" || v.status === "Pendente" || v.status === "Faturado";
    } else if (activeTab === "transporte") {
      matchesTab = v.status === "Em Transporte" || v.status === "Em rota" || v.status === "EM_ROTA";
    } else if (activeTab === "entregue") {
      matchesTab = v.status === "Entregue";
    } else if (activeTab === "cancelado") {
      matchesTab = v.status === "Cancelado" || v.status_aprovacao === "Cancelado" || v.status_aprovacao === "Rejeitada";
    }

    return matchesSearch && matchesDate && matchesTab;
  });

  // Preview total while editing
  const editTotal = [
    ...editItens.map((i) => Number(i.subtotal) || 0),
    ...newItems.map((i) => Number(i.subtotal) || 0),
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-800">
          Minhas Vendas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe o histórico e status dos seus pedidos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-11 bg-white border-slate-200 rounded-xl"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative w-full sm:w-auto">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-11 bg-white border-slate-200 rounded-xl w-full sm:w-[160px]"
          />
        </div>
      </div>

      {/* ── Abas de Filtro de Pedidos / Entrega ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("todos")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
            activeTab === "todos"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          Todos ({vendas.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("aguardando")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
            activeTab === "aguardando"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white border border-amber-200/80 text-amber-700 hover:bg-amber-50"
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          Aguardando Entrega ({vendas.filter(v => v.status === "Aguardando Entrega" || v.status === "Pendente" || v.status === "Faturado").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("transporte")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
            activeTab === "transporte"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-blue-200/80 text-blue-700 hover:bg-blue-50"
          )}
        >
          <Truck className="w-3.5 h-3.5" />
          Em Transporte ({vendas.filter(v => v.status === "Em Transporte" || v.status === "Em rota" || v.status === "EM_ROTA").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("entregue")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
            activeTab === "entregue"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white border border-emerald-200/80 text-emerald-700 hover:bg-emerald-50"
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Pedidos Entregues ({vendas.filter(v => v.status === "Entregue").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cancelado")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
            activeTab === "cancelado"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-white border border-rose-200/80 text-rose-700 hover:bg-rose-50"
          )}
        >
          Cancelados ({vendas.filter(v => v.status === "Cancelado" || v.status_aprovacao === "Cancelado" || v.status_aprovacao === "Rejeitada").length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
        </div>
      ) : vendas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">Nenhuma venda encontrada</p>
          <p className="text-sm text-muted-foreground">
            Suas vendas aparecerão aqui após você enviar um pedido no PDV.
          </p>
        </div>
      ) : filteredVendas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">Nenhum resultado encontrado</p>
          <p className="text-sm text-muted-foreground">Tente buscar por outro cliente ou data.</p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {filteredVendas.map((v) => {
            const isDav = isOrderDav(v);
            const num = getOrderNumber(v);
            const isSharing = sharingId === v.id;

            return (
              <div
                key={v.id}
                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 cursor-pointer hover:border-brand/30 transition-all hover:shadow-md active:scale-[0.99] overflow-hidden"
                onClick={() => openDetails(v)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {v.clientes?.nome || "Cliente não informado"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-semibold text-slate-700">
                          {isDav ? "Orçamento" : "Pedido"} #{num}
                        </span>{" "}
                        • {new Date(v.created_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(v.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetails(v, true);
                      }}
                      className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                      title={isDav ? "Editar orçamento" : "Editar pedido"}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isDav && v.status !== "Cancelado" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelarOrcamento(v.id);
                        }}
                        className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Cancelar orçamento"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVenda(v.id, isDav);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title={isDav ? "Excluir orçamento" : "Excluir pedido"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-dashed my-0.5 border-slate-200"></div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Valor Total
                    </p>
                    <p className="font-black text-brand text-lg">
                      R${" "}
                      {Number(v.valor_total || 0)
                        .toFixed(2)
                        .replace(".", ",")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {v.status === "Entregue" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pedido Entregue
                      </span>
                    ) : v.status === "Em Transporte" || v.status === "Em rota" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Em Transporte
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {v.status || "Aguardando"}
                      </span>
                    )}

                    {v.rotas?.motorista && (
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                        🚚 {v.rotas.motorista}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botões de Ação Rápida no Card */}
                <div className="border-t border-slate-100 pt-2.5 grid grid-cols-3 gap-1.5 w-full">
                  <button
                    type="button"
                    disabled={isSharing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(v);
                    }}
                    className="w-full min-w-0 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center justify-center gap-1 transition-colors active:scale-95 border border-emerald-200/60 shadow-xs px-1"
                    title="Enviar arquivo PDF e resumo no WhatsApp"
                  >
                    {isSharing ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-700 shrink-0" />
                    ) : (
                      <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate text-[11px] sm:text-xs">WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrderPdf(v);
                    }}
                    className="w-full min-w-0 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1 transition-colors active:scale-95 border border-slate-200 px-1"
                    title="Visualizar e Imprimir PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate text-[11px] sm:text-xs">Ver PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/parceiro/pdv?draft_id=${v.id}`;
                    }}
                    className="w-full min-w-0 h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center gap-1 transition-colors active:scale-95 border border-blue-200/60 shadow-xs px-1"
                    title="Clonar Pedido (Refazer a mesma venda)"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate text-[11px] sm:text-xs">Clonar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Full-Screen Details & Order Editor Dialog ── */}
      <Dialog
        open={isDetailsOpen}
        onOpenChange={(o) => {
          setIsDetailsOpen(o);
          if (!o) handleCancelEditItems();
        }}
      >
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !max-w-none !rounded-none !border-0 !p-0 flex flex-col bg-slate-50/95 overflow-hidden [&>button.absolute]:hidden">
          {/* ── Top Header Bar ── */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-slate-600 hover:text-slate-900 rounded-xl shrink-0"
                onClick={() => setIsDetailsOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <DialogHeader className="text-left space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    {isOrderDav(selectedVenda || {}) ? "Orçamento" : "Pedido"} #
                    {getOrderNumber(selectedVenda || {})}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-bold px-2 py-0.5",
                      getStatusColor(selectedVenda?.status || "")
                    )}
                  >
                    {selectedVenda?.status || "Aguardando"}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 truncate">
                  {selectedVenda?.clientes?.nome || "Cliente não informado"} •{" "}
                  {selectedVenda &&
                    new Date(selectedVenda.created_at).toLocaleDateString("pt-BR")}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedVenda && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 text-xs font-semibold gap-1.5"
                    onClick={() => openOrderPdf(selectedVenda, vendaItens)}
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span className="hidden md:inline">Ver / Imprimir PDF</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 text-xs font-semibold gap-1.5"
                    onClick={() => downloadOrderPdf(selectedVenda, vendaItens)}
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span className="hidden md:inline">Baixar PDF</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                    onClick={() => handleShare(selectedVenda, vendaItens)}
                    disabled={sharingId === selectedVenda.id}
                  >
                    {sharingId === selectedVenda.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="hidden md:inline">WhatsApp</span>
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-900"
                onClick={() => setIsDetailsOpen(false)}
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Main Full-Screen 2-Column Workspace ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 items-start">
              {/* ── LEFT WIDE COLUMN: Itens do Pedido + Catálogo ── */}
              <div className="space-y-5 min-w-0">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          {isOrderDav(selectedVenda || {})
                            ? "Itens do Orçamento"
                            : "Itens do Pedido"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {isEditingItems
                            ? `${editItens.length + newItems.length} item(ns) no pedido`
                            : `${vendaItens.length} item(ns) registrados`}
                        </p>
                      </div>
                    </div>

                    {!loadingItens && (
                      <div className="flex items-center gap-2">
                        {isEditingItems ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-semibold rounded-xl"
                              onClick={handleCancelEditItems}
                              disabled={savingItems}
                            >
                              <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar Edição
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl px-4"
                              onClick={handleSaveItems}
                              disabled={savingItems}
                            >
                              <Save className="h-3.5 w-3.5 mr-1.5" />
                              {savingItems ? "Salvando..." : "Salvar Alterações"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs font-semibold gap-1.5 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={handleStartEditItems}
                          >
                            <PackagePlus className="h-3.5 w-3.5" /> Editar Produtos / Adicionar Itens
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {loadingItens ? (
                    <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-brand" />
                      <span className="text-sm">Carregando itens...</span>
                    </div>
                  ) : isEditingItems ? (
                    <div className="space-y-3">
                      {editItens.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-slate-50/40 hover:bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                              {item.produto?.imagem ? (
                                <img
                                  src={item.produto.imagem}
                                  alt={item.produto?.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                item.produto?.emoji || "📦"
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm text-slate-800 truncate">
                                {item.produto?.nome || "Produto Excluído"}
                              </p>
                              {item.produto?.codigo && (
                                <p className="text-[11px] text-slate-400 font-medium truncate">
                                  Cód: {item.produto.codigo}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap shrink-0">
                            {/* Stepper e Input Qtd */}
                            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200/70 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleChangeExistingQty(item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-xs hover:bg-slate-50 active:scale-95 text-slate-700"
                                title="Diminuir"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade === "" ? "" : item.quantidade}
                                onChange={(e) => handleSetExistingQty(item.id, e.target.value)}
                                onBlur={() => {
                                  if (
                                    item.quantidade === "" ||
                                    parseInt(String(item.quantidade)) <= 0
                                  ) {
                                    handleSetExistingQty(item.id, "1");
                                  }
                                }}
                                className="w-12 text-center text-xs font-black text-slate-800 bg-transparent border-0 outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Quantidade"
                              />
                              <button
                                type="button"
                                onClick={() => handleChangeExistingQty(item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-xs hover:bg-slate-50 active:scale-95 text-slate-700"
                                title="Aumentar"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Input Valor Unitário */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 focus-within:border-emerald-600 rounded-lg px-2 py-1 transition-all shrink-0">
                              <span className="text-[11px] font-bold text-slate-500 select-none">
                                R$
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.valor_unitario === "" ? "" : item.valor_unitario}
                                onChange={(e) =>
                                  handleSetExistingUnitPrice(item.id, e.target.value)
                                }
                                onBlur={() => {
                                  if (
                                    item.valor_unitario === "" ||
                                    isNaN(Number(item.valor_unitario))
                                  ) {
                                    handleSetExistingUnitPrice(item.id, "0");
                                  }
                                }}
                                className="w-16 text-xs font-bold text-slate-800 bg-transparent outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Editar valor unitário"
                                placeholder="0,00"
                              />
                              <span className="text-[10px] font-semibold text-slate-400 select-none">
                                un
                              </span>
                            </div>

                            {/* Subtotal */}
                            <div className="min-w-[84px] text-right shrink-0">
                              <p className="font-black text-brand text-sm">
                                R${" "}
                                {Number(item.subtotal || 0)
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveExistingItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                              title="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {newItems.map((item, idx) => (
                        <div
                          key={`new-${idx}`}
                          className="p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                              {item.imagem ? (
                                <img
                                  src={item.imagem}
                                  alt={item.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                item.emoji || "📦"
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-emerald-400 text-emerald-700 bg-white px-1.5 py-0 h-4 shrink-0"
                                >
                                  novo
                                </Badge>
                                <p className="font-bold text-sm text-slate-800 truncate">
                                  {item.nome}
                                </p>
                              </div>
                              {item.codigo && (
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                                  Cód: {item.codigo}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap shrink-0">
                            {/* Stepper e Input Qtd */}
                            <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-emerald-200 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleChangeNewItemQty(idx, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-50 rounded-md shadow-xs hover:bg-slate-100 active:scale-95 text-slate-700"
                                title="Diminuir"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade === "" ? "" : item.quantidade}
                                onChange={(e) => handleSetNewItemQty(idx, e.target.value)}
                                onBlur={() => {
                                  if (
                                    item.quantidade === "" ||
                                    parseInt(String(item.quantidade)) <= 0
                                  ) {
                                    handleSetNewItemQty(idx, "1");
                                  }
                                }}
                                className="w-12 text-center text-xs font-black text-slate-800 bg-transparent border-0 outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Quantidade"
                              />
                              <button
                                type="button"
                                onClick={() => handleChangeNewItemQty(idx, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-50 rounded-md shadow-xs hover:bg-slate-100 active:scale-95 text-slate-700"
                                title="Aumentar"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Input Valor Unitário */}
                            <div className="flex items-center gap-1 bg-white border border-emerald-200 focus-within:border-emerald-600 rounded-lg px-2 py-1 transition-all shrink-0">
                              <span className="text-[11px] font-bold text-slate-500 select-none">
                                R$
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.valor_unitario === "" ? "" : item.valor_unitario}
                                onChange={(e) =>
                                  handleSetNewItemUnitPrice(idx, e.target.value)
                                }
                                onBlur={() => {
                                  if (
                                    item.valor_unitario === "" ||
                                    isNaN(Number(item.valor_unitario))
                                  ) {
                                    handleSetNewItemUnitPrice(idx, "0");
                                  }
                                }}
                                className="w-16 text-xs font-bold text-slate-800 bg-transparent outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Editar valor unitário"
                                placeholder="0,00"
                              />
                              <span className="text-[10px] font-semibold text-slate-400 select-none">
                                un
                              </span>
                            </div>

                            {/* Subtotal */}
                            <div className="min-w-[84px] text-right shrink-0">
                              <p className="font-black text-brand text-sm">
                                R${" "}
                                {Number(item.subtotal || 0)
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveNewItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                              title="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {editItens.length === 0 && newItems.length === 0 && (
                        <div className="p-8 text-center text-sm text-muted-foreground bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          Nenhum item restante. Utilize o catálogo abaixo para adicionar produtos.
                        </div>
                      )}
                    </div>
                  ) : vendaItens.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-slate-200 rounded-xl">
                      Nenhum item encontrado.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                      {vendaItens.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3.5 bg-white hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                              {item.produto?.imagem ? (
                                <img
                                  src={item.produto.imagem}
                                  alt={item.produto?.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                item.produto?.emoji || "📦"
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-900 truncate">
                                {item.produto?.nome || "Produto Excluído"}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                {item.produto?.codigo && (
                                  <span className="font-medium text-slate-400">
                                    Cód: {item.produto.codigo} •
                                  </span>
                                )}
                                <span>
                                  {item.quantidade}x R${" "}
                                  {Number(item.valor_unitario).toFixed(2).replace(".", ",")}
                                </span>
                              </p>
                            </div>
                          </div>
                          <p className="font-bold text-brand text-sm sm:text-base shrink-0">
                            R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Catálogo rápido de produtos no modo edição */}
                {isEditingItems && (
                  <OrderProductPicker
                    produtos={produtos}
                    onAddProduct={handleQuickAddProduct}
                  />
                )}
              </div>

              {/* ── RIGHT SIDEBAR: Total, Cliente, Entrega & Ações ── */}
              <div className="space-y-4 lg:sticky lg:top-0">
                {/* Card Total */}
                <div className="rounded-2xl bg-slate-900 text-white p-5 shadow-md space-y-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-300 font-semibold">
                    <span>
                      {isEditingItems
                        ? "Novo Total Estimado"
                        : isOrderDav(selectedVenda || {})
                        ? "Total do Orçamento"
                        : "Total do Pedido"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white">
                      {isEditingItems ? editItens.length + newItems.length : vendaItens.length}{" "}
                      itens
                    </span>
                  </div>
                  <div className="text-3xl font-black tracking-tight">
                    R${" "}
                    {(isEditingItems ? editTotal : Number(selectedVenda?.valor_total || 0))
                      .toFixed(2)
                      .replace(".", ",")}
                  </div>
                  {isEditingItems && (
                    <div className="pt-2 flex flex-col gap-2">
                      <Button
                        className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl"
                        onClick={handleSaveItems}
                        disabled={savingItems}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {savingItems ? "Salvando Alterações..." : "Salvar Alterações"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full h-9 text-slate-200 hover:text-white hover:bg-white/10 rounded-xl text-xs"
                        onClick={handleCancelEditItems}
                        disabled={savingItems}
                      >
                        Descartar Edição
                      </Button>
                    </div>
                  )}
                </div>

                {/* Cliente */}
                {selectedVenda?.clientes?.nome && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Cliente
                    </h4>
                    <p className="font-bold text-sm text-slate-900">
                      👤 {selectedVenda.clientes.nome}
                    </p>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {selectedVenda.clientes.cnpj_cpf && (
                        <p>CNPJ/CPF: {selectedVenda.clientes.cnpj_cpf}</p>
                      )}
                      {selectedVenda.clientes.telefone && (
                        <p>Tel: {selectedVenda.clientes.telefone}</p>
                      )}
                      {(selectedVenda.clientes.cidade || selectedVenda.clientes.uf) && (
                        <p>
                          {[selectedVenda.clientes.cidade, selectedVenda.clientes.uf]
                            .filter(Boolean)
                            .join(" / ")}
                          {selectedVenda.clientes.cep
                            ? ` • CEP ${selectedVenda.clientes.cep}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Status & Responsável pela Entrega */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
                          Status & Entrega
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Controle de frete e entregador
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 shrink-0",
                        deliveryStatus === "Entregue"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : deliveryStatus === "Em Transporte" || deliveryStatus === "Em rota"
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      )}
                    >
                      {deliveryStatus === "Entregue"
                        ? "✅ Entregue"
                        : deliveryStatus === "Em Transporte" || deliveryStatus === "Em rota"
                        ? "🚚 Em Transporte"
                        : "⏳ Aguardando"}
                    </Badge>
                  </div>

                  {/* Botões de Seleção do Status */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDeliveryStatus("Aguardando Entrega")}
                      className={cn(
                        "py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 min-w-0",
                        deliveryStatus === "Aguardando Entrega" ||
                          (!deliveryStatus &&
                            selectedVenda?.status !== "Entregue" &&
                            selectedVenda?.status !== "Em Transporte")
                          ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] truncate w-full text-center">Aguardando</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryStatus("Em Transporte")}
                      className={cn(
                        "py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 min-w-0",
                        deliveryStatus === "Em Transporte" || deliveryStatus === "Em rota"
                          ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] truncate w-full text-center">Transportando</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryStatus("Entregue")}
                      className={cn(
                        "py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 min-w-0",
                        deliveryStatus === "Entregue"
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] truncate w-full text-center">Entregue</span>
                    </button>
                  </div>

                  {/* Responsável pela Entrega */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      Responsável pela Entrega / Motorista
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={deliveryPerson}
                        onChange={(e) => setDeliveryPerson(e.target.value)}
                        placeholder="Ex: Carlos Silva, Transportadora XYZ..."
                        className="h-9 text-xs bg-white border-slate-200 rounded-xl flex-1 min-w-0"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={updatingDelivery}
                        onClick={() => handleSaveDelivery()}
                        className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shrink-0"
                      >
                        {updatingDelivery ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Ações do Pedido */}
                {!loadingItens && selectedVenda && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Ações
                    </h4>

                    {vendaItens.length > 0 && (
                      <Button
                        variant="secondary"
                        className="w-full h-10 font-bold border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-xs text-slate-700"
                        onClick={() => {
                          if (selectedVenda?.id) {
                            window.location.href = `/parceiro/pdv?draft_id=${selectedVenda.id}`;
                            return;
                          }
                          const itemsMagic = vendaItens
                            .map((i) => `${i.produto_id}:${i.quantidade}`)
                            .join(",");
                          window.location.href = `/parceiro/pdv?c=${itemsMagic}`;
                        }}
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Clonar Pedido no PDV</span>
                      </Button>
                    )}

                    {isOrderDav(selectedVenda) ? (
                      <>
                        {selectedVenda.status !== "Cancelado" && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-10 font-bold border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl flex items-center justify-center gap-1.5 text-xs"
                            onClick={() => cancelarOrcamento(selectedVenda.id)}
                          >
                            <Ban className="w-4 h-4 text-amber-600" />
                            <span>Cancelar Orçamento</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold"
                          onClick={() => deleteVenda(selectedVenda.id, true)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir Orçamento Definitivamente</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 font-bold border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl flex items-center justify-center gap-1.5 text-xs"
                        onClick={() => deleteVenda(selectedVenda.id, false)}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        <span>Excluir Pedido</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog Modal */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => !o && closeConfirm()}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.danger ? "bg-rose-100" : "bg-amber-100"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${confirmDialog.danger ? "text-rose-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {confirmDialog.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {confirmDialog.description}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeConfirm}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
                className={`flex-1 h-11 rounded-xl font-semibold text-sm text-white transition-colors ${confirmDialog.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
