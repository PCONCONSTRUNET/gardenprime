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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  const openDetails = async (venda: any) => {
    setSelectedVenda(venda);
    setIsDetailsOpen(true);
    setLoadingItens(true);
    setVendaItens([]);
    try {
      const { data, error } = await supabase
        .from("vendas_itens")
        .select("*, produto:produtos(nome, codigo, emoji, imagem)")
        .eq("venda_id", venda.id);
      if (data) setVendaItens(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItens(false);
    }
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
            .select("*, clientes(*)")
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "aprovado":
      case "aceito":
      case "pago":
      case "entregue":
      case "faturado":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "pendente":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "rejeitado":
      case "cancelado":
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

    if (searchTerm) {
      const nome = (v.clientes?.nome || "").toLowerCase();
      matchesSearch = nome.includes(searchTerm.toLowerCase());
    }

    if (selectedDate) {
      matchesDate = v.created_at.startsWith(selectedDate);
    }

    return matchesSearch && matchesDate;
  });

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVendas.map((v) => {
            const isDav = isOrderDav(v);
            const num = getOrderNumber(v);
            const isSharing = sharingId === v.id;

            return (
              <div
                key={v.id}
                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 cursor-pointer hover:border-brand/30 transition-all hover:shadow-md active:scale-[0.99]"
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
                    {v.status_aprovacao && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(v.status_aprovacao)}`}
                      >
                        Aprovação: {v.status_aprovacao}
                      </span>
                    )}
                    {v.status && v.status !== v.status_aprovacao && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(v.status)}`}
                      >
                        {isDav ? "Orçamento" : "Pedido"}: {v.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botões de Ação Rápida no Card */}
                <div className="border-t border-slate-100 pt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSharing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(v);
                    }}
                    className="flex-1 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 border border-emerald-200/60 shadow-xs"
                    title="Enviar arquivo PDF e resumo no WhatsApp"
                  >
                    {isSharing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                    ) : (
                      <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrderPdf(v.id);
                    }}
                    className="flex-1 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 border border-slate-200"
                    title="Visualizar e Imprimir PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Ver PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {isOrderDav(selectedVenda || {}) ? "Ficha do Orçamento" : "Ficha do Pedido"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {isOrderDav(selectedVenda || {}) ? "Orçamento" : "Pedido"} #
                {getOrderNumber(selectedVenda || {})} •{" "}
                {selectedVenda && new Date(selectedVenda.created_at).toLocaleDateString("pt-BR")}
                {selectedVenda?.clientes?.nome && (
                  <div className="mt-3 text-sm text-slate-700 bg-slate-100 p-3 rounded-xl border border-slate-200 text-left">
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      👤 {selectedVenda.clientes.nome}
                    </p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {loadingItens ? (
              <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
                <span>Carregando itens...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[260px] overflow-y-auto divide-y border rounded-xl">
                  {vendaItens.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum item encontrado.
                    </div>
                  ) : (
                    vendaItens.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{item.produto?.emoji || "📦"}</div>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">
                              {item.produto?.nome || "Produto Excluído"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantidade}x R${" "}
                              {Number(item.valor_unitario).toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-brand">
                          R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-100 rounded-xl">
                  <span className="font-semibold text-slate-700">Total do Pedido:</span>
                  <span className="text-xl font-bold font-display text-slate-900">
                    R${" "}
                    {Number(selectedVenda?.valor_total || 0)
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                </div>
              </div>
            )}

            {!loadingItens && selectedVenda && (
              <div className="pt-4 space-y-2.5">
                {/* Botão principal de WhatsApp com PDF */}
                <Button
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  onClick={() => handleShare(selectedVenda, vendaItens)}
                  disabled={sharingId === selectedVenda.id}
                >
                  {sharingId === selectedVenda.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  )}
                  <span>Enviar PDF no WhatsApp</span>
                </Button>

                {/* Botões secundários: Ver / Imprimir PDF e Baixar PDF */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    onClick={() => openOrderPdf(selectedVenda.id)}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Ver / Imprimir PDF</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    onClick={() => downloadOrderPdf(selectedVenda, vendaItens)}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Baixar PDF</span>
                  </Button>
                </div>

                {/* Clonar Pedido */}
                {vendaItens.length > 0 && (
                  <Button
                    variant="secondary"
                    className="w-full h-10 font-bold border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-xs text-slate-700"
                    onClick={() => {
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

                {/* Ações de Cancelamento e Exclusão */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
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
              </div>
            )}
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
