import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { ShoppingCart, PackageOpen, Search, X, Trash2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/parceiro/catalogo")({
  head: () => ({ meta: [{ title: "Meus Carrinhos — GARDEN PRIME" }] }),
  component: ParceiroCarrinhos,
});

function ParceiroCarrinhos() {
  const navigate = useNavigate();
  const [carrinhos, setCarrinhos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCarrinho, setSelectedCarrinho] = useState<any | null>(null);
  const [carrinhoItens, setCarrinhoItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const openConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, onConfirm });
  };
  const closeConfirm = () => setConfirmDialog((p) => ({ ...p, open: false }));

  useEffect(() => {
    const fetchCarrinhos = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate({ to: "/parceiro/login" });
        return;
      }

      const { data: vendedor } = await supabase
        .from("vendedores")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (vendedor) {
        const { data, error } = await supabase
          .from("vendas")
          .select("*, clientes(nome)")
          .eq("vendedor_id", vendedor.id)
          .eq("tipo", "DAV")
          .eq("status", "Rascunho")
          .order("created_at", { ascending: false });

        if (data) setCarrinhos(data);
        if (error) console.error("Erro ao buscar carrinhos:", error);
      }
      setLoading(false);
    };
    fetchCarrinhos();
  }, [navigate]);

  
  useEffect(() => {
    if (selectedCarrinho) {
      setLoadingItens(true);
      const fetchItens = async () => {
        const { data, error } = await supabase
          .from("vendas_itens")
          .select("*, produtos(nome, imagem)")
          .eq("venda_id", selectedCarrinho.id);
        if (data) setCarrinhoItens(data);
        setLoadingItens(false);
      };
      fetchItens();
    } else {
      setCarrinhoItens([]);
    }
  }, [selectedCarrinho]);

  const deleteCarrinho = async (id: string) => {
    openConfirm(
      "Excluir carrinho",
      "Tem certeza que deseja excluir este carrinho salvo? Essa ação não pode ser desfeita.",
      async () => {
        try {
          await supabase.from("vendas_itens").delete().eq("venda_id", id);
          const { error } = await supabase.from("vendas").delete().eq("id", id);
          if (error) throw error;
          setCarrinhos((prev) => prev.filter((c) => c.id !== id));
          if (selectedCarrinho?.id === id) setSelectedCarrinho(null);
        } catch (err: any) {
          alert("Erro ao excluir carrinho: " + err.message);
        }
      }
    );
  };

  const continuarCarrinho = (id: string) => {
    navigate({ to: "/parceiro/pdv", search: { draft_id: id } as any });
  };

  const filtered = carrinhos.filter((c) => {
    if (!searchTerm) return true;
    const nome = (c.clientes?.nome || "").toLowerCase();
    return nome.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-brand" />
          Meus Carrinhos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Rascunhos e orçamentos salvos para finalizar depois.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-12 pl-10 pr-10 rounded-xl bg-white shadow-sm border-0 ring-1 ring-slate-900/5"
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

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 h-28 animate-pulse"
            >
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/4 mb-4" />
              <div className="flex justify-between mt-auto">
                <div className="h-6 bg-slate-100 rounded w-1/3" />
                <div className="h-8 bg-slate-100 rounded-xl w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : carrinhos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">
            🛒
          </div>
          <p className="font-semibold text-slate-700">Nenhum carrinho salvo</p>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            Inicie uma nova venda no PDV e clique em "Salvar Carrinho" para continuar depois.
          </p>
          <button
            onClick={() => navigate({ to: "/parceiro/pdv" })}
            className="mt-4 px-6 py-2.5 bg-gradient-brand text-white font-bold rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            Nova Venda
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">
            🔍
          </div>
          <p className="font-semibold text-slate-700">Nenhum resultado</p>
          <p className="text-sm text-muted-foreground">Tente buscar por outro nome de cliente.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3 cursor-pointer hover:border-[#12794C]/30 transition-colors"
              onClick={() => setSelectedCarrinho(c)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {c.clientes?.nome || "Cliente não informado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(c.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCarrinho(c.id); }}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Excluir Carrinho"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="border-t border-dashed border-slate-200"></div>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Valor Previsto
                  </p>
                  <p className="font-black text-brand text-lg">
                    R$ {Number(c.valor_total || 0).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); continuarCarrinho(c.id); }}
                  className="h-10 px-4 bg-[#12794C] hover:bg-emerald-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-sm"
                >
                  Continuar <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet para Pré-visualização do Carrinho */}
      <Sheet open={!!selectedCarrinho} onOpenChange={(open) => !open && setSelectedCarrinho(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 flex flex-col z-[100]">
          <SheetHeader className="p-4 border-b text-left shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="flex items-center gap-2 text-lg text-slate-800">
                  <PackageOpen className="w-5 h-5 text-[#12794C]" /> Resumo do Carrinho
                </SheetTitle>
                {selectedCarrinho && (
                  <p className="text-sm font-bold text-[#12794C] mt-1">
                    {selectedCarrinho.clientes?.nome || "Cliente não informado"}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedCarrinho(null)}
                className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingItens ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#12794C]" />
                <p className="text-sm text-slate-500">Carregando itens...</p>
              </div>
            ) : carrinhoItens.length === 0 ? (
              <p className="text-center text-slate-500 py-10 text-sm">Nenhum item encontrado.</p>
            ) : (
              carrinhoItens.map((item) => (
                <div key={item.id} className="flex gap-3 bg-white border rounded-xl p-3 shadow-sm">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                    {item.produtos?.imagem ? (
                      <img src={item.produtos.imagem} alt={item.produtos.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🌱</div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="font-bold text-sm text-slate-800 leading-tight line-clamp-2">
                      {item.produtos?.nome || "Produto desconhecido"}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {item.quantidade}x R$ {Number(item.valor_unitario).toFixed(2).replace(".", ",")}
                      </span>
                      <span className="font-black text-brand text-sm">
                        R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedCarrinho && (
            <div className="p-4 bg-slate-50 border-t flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Total
                </p>
                <p className="font-black text-brand text-2xl leading-none">
                  R$ {Number(selectedCarrinho.valor_total || 0).toFixed(2).replace(".", ",")}
                </p>
              </div>
              <button
                onClick={() => continuarCarrinho(selectedCarrinho.id)}
                className="h-12 px-6 bg-[#12794C] hover:bg-emerald-800 text-white text-base font-bold rounded-xl shadow-md active:scale-95 transition-transform flex items-center gap-2"
              >
                Continuar Venda <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog Modal */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => !o && closeConfirm()}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                className="flex-1 h-11 rounded-xl font-semibold text-sm text-white bg-rose-600 hover:bg-rose-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
