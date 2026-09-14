import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Wallet,
  Clock,
  CheckCircle2,
  TrendingUp,
  XCircle,
  FileText,
  Download,
  Loader2,
  Trash2,
  Ban,
} from "lucide-react";
import {
  WhatsAppIcon,
  shareOrderWhatsApp,
  openOrderPdf,
  downloadOrderPdf,
  getOrderNumber,
  isOrderDav,
} from "@/lib/order-pdf";

export const Route = createFileRoute("/parceiro/dashboard")({
  head: () => ({ meta: [{ title: "Meu Painel — GARDEN PRIME" }] }),
  component: ParceiroDashboard,
});

function ParceiroDashboard() {
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState("");
  const [tipoComissao, setTipoComissao] = useState<string>("porcentagem");
  const [valorComissao, setValorComissao] = useState<number>(0);
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [isSaleDetailsOpen, setIsSaleDetailsOpen] = useState(false);
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false);

  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editClientData, setEditClientData] = useState({ nome: "", cpf_cnpj: "", telefone: "" });
  const [savingClient, setSavingClient] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const handleShare = async (venda: any, itens?: any[]) => {
    setSharingId(venda.id);
    try {
      await shareOrderWhatsApp(venda, itens);
    } finally {
      setSharingId(null);
    }
  };

  const openSaleDetails = async (venda: any) => {
    setSelectedSaleForDetails(venda);
    setIsSaleDetailsOpen(true);
    setLoadingSaleDetails(true);
    setSaleItems([]);

    try {
      const { data, error } = await supabase
        .from("vendas_itens")
        .select("*, produto:produtos(nome, codigo, emoji, imagem)")
        .eq("venda_id", venda.id);

      if (!error && data) {
        setSaleItems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaleDetails(false);
    }
  };

  const handleDeleteSale = async (venda: any) => {
    const isDav = isOrderDav(venda);
    const label = isDav ? "orçamento" : "pedido";
    if (!confirm(`Tem certeza que deseja excluir este ${label}? Esta ação não pode ser desfeita.`))
      return;

    setDeletingOrder(true);
    try {
      // Exclui os itens primeiro para integridade referencial
      await supabase.from("vendas_itens").delete().eq("venda_id", venda.id);
      // Exclui a venda
      const { error } = await supabase.from("vendas").delete().eq("id", venda.id);
      if (error) throw error;
      setVendas((prev) => prev.filter((v) => v.id !== venda.id));
      setIsSaleDetailsOpen(false);
    } catch (err: any) {
      alert(`Erro ao excluir ${label}: ` + err.message);
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleCancelDav = async (venda: any) => {
    if (!confirm("Tem certeza que deseja cancelar este orçamento?")) return;

    try {
      const { error } = await supabase
        .from("vendas")
        .update({ status: "Cancelado", status_aprovacao: "Cancelado" })
        .eq("id", venda.id);
      if (error) throw error;

      setVendas((prev) =>
        prev.map((v) =>
          v.id === venda.id ? { ...v, status: "Cancelado", status_aprovacao: "Cancelado" } : v,
        ),
      );
      if (selectedSaleForDetails?.id === venda.id) {
        setSelectedSaleForDetails((prev: any) =>
          prev ? { ...prev, status: "Cancelado", status_aprovacao: "Cancelado" } : null,
        );
      }
    } catch (err: any) {
      alert("Erro ao cancelar orçamento: " + err.message);
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Tenta achar o vendedor atrelado a este usuário
        const { data: vData, error: fetchError } = await supabase
          .from("vendedores")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (vData) {
          setVendedorId(vData.id);
          setNome(vData.nome);
          setStatus(vData.status || "Ativo");

          // Busca as vendas dele ignorando os Orçamentos (DAV)
          const { data: vendasData } = await supabase
            .from("vendas")
            .select("*, cliente:clientes(*)")
            .eq("vendedor_id", vData.id)
            .neq("tipo", "DAV")
            .order("created_at", { ascending: false });

          if (vendasData) setVendas(vendasData);
        } else {
          // Se não achou (falha de sincronia ou RLS no insert inicial), recria usando os metadados da sessão
          const meta = session.user.user_metadata || {};
          const newNome = meta.nome || "Parceiro";
          const newTelefone = meta.telefone || "";

          const { data: newVData, error: insertError } = await supabase
            .from("vendedores")
            .insert([
              {
                user_id: session.user.id,
                nome: newNome,
                email: session.user.email,
                telefone: newTelefone,
                status: "Aguardando Aprovação",
                valor_comissao: 0,
              },
            ])
            .select()
            .single();

          if (newVData && !insertError) {
            setVendedorId(newVData.id);
            setNome(newVData.nome);
            setStatus(newVData.status);

            // Tenta notificar o dono caso não tenha ido na primeira vez
            await supabase.from("notificacoes").insert([
              {
                tipo: "parceiro",
                titulo: `Nova solicitação de parceria`,
                mensagem: `${newNome} (${session.user.email}) se cadastrou e está aguardando aprovação.`,
              },
            ]);
          } else if (insertError) {
            // Se falhou por conflito (ex: email já existe), significa que o registro já estava lá.
            // Isso acontece se o usuário foi deletado do auth mas não da tabela vendedores.
            // Vamos buscar pelo E-MAIL em vez do user_id, e atualizar o user_id!
            const { data: retryData } = await supabase
              .from("vendedores")
              .select("*")
              .eq("email", session.user.email)
              .maybeSingle();
            if (retryData) {
              await supabase
                .from("vendedores")
                .update({ user_id: session.user.id })
                .eq("id", retryData.id);
              setVendedorId(retryData.id);
              setNome(retryData.nome);
              setStatus(retryData.status || "Aguardando Aprovação");
              setTipoComissao(retryData.tipo_comissao || "porcentagem");
              setValorComissao(Number(retryData.valor_comissao || 0));
              setTipoComissao(retryData.tipo_comissao || "porcentagem");
              setValorComissao(Number(retryData.valor_comissao || 0));
            } else {
              // Se falhou mesmo assim, vamos preencher o formulário manual com os metadados
              setNome(newNome);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard do parceiro:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  const comissoesAReceber = vendas
    .filter((v) => v.status_aprovacao === "Aprovada" && v.status_pagamento_comissao !== "Paga")
    .reduce((acc, v) => acc + (Number(v.valor_comissao) || 0), 0);

  const comissoesPagas = vendas
    .filter((v) => v.status_pagamento_comissao === "Paga")
    .reduce((acc, v) => acc + (Number(v.valor_comissao) || 0), 0);

  const aguardandoAprovacao = vendas.filter((v) => v.status_aprovacao === "Pendente").length;
  const aprovadas = vendas.filter((v) => v.status_aprovacao === "Aprovada").length;

  if (loading)
    return <div className="text-center py-10 text-muted-foreground">Carregando painel...</div>;

  if (vendedorId && status === "Aguardando Aprovação") {
    return (
      <div className="flex justify-center py-10 px-4">
        <Card className="w-full max-w-md border-0 shadow-lg ring-1 ring-slate-900/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold font-display text-slate-800">Conta em Análise</h2>
            <p className="text-sm text-slate-600">
              Olá, <strong>{nome}</strong>! Seu cadastro foi recebido com sucesso. Nossa equipe está
              avaliando sua solicitação de parceria.
            </p>
            <p className="text-sm text-muted-foreground pt-4 border-t">
              Por favor, aguarde nosso contato ou retorne mais tarde para verificar se sua conta foi
              aprovada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (vendedorId && status === "Rejeitado") {
    return (
      <div className="flex justify-center py-10 px-4">
        <Card className="w-full max-w-md border-0 shadow-lg ring-1 ring-slate-900/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold font-display text-slate-800">Solicitação Recusada</h2>
            <p className="text-sm text-slate-600">
              Olá, <strong>{nome}</strong>. Infelizmente sua solicitação de parceria não foi
              aprovada neste momento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCompletarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.from("vendedores").insert([
        {
          user_id: session.user.id,
          nome: nome,
          email: session.user.email,
          telefone: "", // Pede para ele atualizar depois se quiser
          status: "Aguardando Aprovação",
          valor_comissao: 0,
        },
      ]);

      if (error) throw error;

      // Recarrega a página para puxar os dados atualizados
      window.location.reload();
    } catch (err: any) {
      alert("Erro ao concluir o cadastro: " + err.message);
      setLoading(false);
    }
  };

  if (!vendedorId) {
    return (
      <div className="flex justify-center py-10 px-4">
        <Card className="w-full max-w-md border-0 shadow-lg ring-1 ring-slate-900/5">
          <CardContent className="p-6 text-center space-y-4">
            <h2 className="text-xl font-bold font-display">Cadastro Incompleto</h2>
            <p className="text-sm text-muted-foreground">
              Detectamos que seu usuário foi criado, mas seu perfil de vendedor não foi gerado
              devido a um erro anterior.
            </p>

            <form onSubmit={handleCompletarCadastro} className="space-y-4 pt-4 text-left">
              <div>
                <label className="text-sm font-medium">Confirme seu Nome Completo</label>
                <Input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="mt-1 h-12"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 font-bold bg-gradient-brand"
                disabled={loading}
              >
                {loading ? "Concluindo..." : "Concluir Meu Cadastro"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "Aguardando Aprovação") {
    return (
      <div className="text-center py-16 px-4 space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-display text-slate-800">Conta em Análise</h2>
        <p className="text-slate-600">
          Olá, {nome.split(" ")[0]}! Sua conta foi criada com sucesso e no momento está aguardando a
          aprovação do administrador.
        </p>
        <p className="text-sm text-muted-foreground mt-4 border-t pt-4">
          Assim que seu acesso for liberado, você poderá acessar o caixa e registrar suas vendas por
          aqui.
        </p>
      </div>
    );
  }

  if (status === "Rejeitado") {
    return (
      <div className="text-center py-16 px-4 space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-display text-slate-800">Conta Recusada</h2>
        <p className="text-slate-600">
          Olá, {nome.split(" ")[0]}. Infelizmente, sua solicitação de parceria não foi aprovada pelo
          administrador.
        </p>
        <p className="text-sm text-muted-foreground mt-4 border-t pt-4">
          Se achar que houve um engano, entre em contato diretamente com a loja.
        </p>
      </div>
    );
  }

  const handleEnviarPedido = async () => {
    if (!selectedSaleForDetails) return;
    try {
      setLoadingSaleDetails(true);
      // Notifica o admin
      await supabase.from("notificacoes").insert([
        {
          tipo: "venda",
          titulo: `Pedido reenviado pelo parceiro: ${nome.split(" ")[0]}`,
          mensagem: `O parceiro reenviou o pedido #${selectedSaleForDetails.numero_venda} para aprovação.`,
        },
      ]);
      alert("Pedido enviado para o dono com sucesso!");
      setIsSaleDetailsOpen(false);
    } catch (err: any) {
      alert("Erro ao enviar pedido: " + err.message);
    } finally {
      setLoadingSaleDetails(false);
    }
  };

  const openEditClient = () => {
    setEditClientData({
      nome: selectedSaleForDetails.cliente?.nome || "",
      cpf_cnpj: selectedSaleForDetails.cliente?.cpf_cnpj || "",
      telefone: selectedSaleForDetails.cliente?.telefone || "",
    });
    setIsEditingClient(true);
  };

  const handleSalvarCliente = async () => {
    if (!selectedSaleForDetails?.cliente_id) return;
    try {
      setSavingClient(true);
      const { error } = await supabase
        .from("clientes")
        .update({
          nome: editClientData.nome,
          cpf_cnpj: editClientData.cpf_cnpj,
          telefone: editClientData.telefone,
        })
        .eq("id", selectedSaleForDetails.cliente_id);

      if (error) throw error;

      // Atualiza estado local
      setSelectedSaleForDetails((prev: any) => ({
        ...prev,
        cliente: {
          ...prev.cliente,
          nome: editClientData.nome,
          cpf_cnpj: editClientData.cpf_cnpj,
          telefone: editClientData.telefone,
        },
      }));
      setVendas((prev) =>
        prev.map((v) =>
          v.id === selectedSaleForDetails.id
            ? { ...v, cliente: { ...v.cliente, ...editClientData } }
            : v,
        ),
      );

      alert("Informações do cliente atualizadas!");
      setIsEditingClient(false);
    } catch (err: any) {
      alert("Erro ao atualizar cliente: " + err.message);
    } finally {
      setSavingClient(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-bold font-display text-slate-800">
          Olá, {nome.split(" ")[0]}! 👋
        </h1>
                <p className="text-sm text-muted-foreground mt-1">Aqui está o resumo das suas vendas.</p>
        <div className="inline-flex items-center gap-1.5 mt-2 bg-brand/10 text-brand px-3 py-1.5 rounded-lg border border-brand/20">
          <span className="text-xs font-semibold uppercase tracking-wider">Sua Comissão:</span>
          <span className="text-sm font-black">{tipoComissao === 'porcentagem' ? `${valorComissao}%` : `R$ ${valorComissao.toFixed(2).replace('.', ',')}`}</span>
        </div>
      </div>

      <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-brand">Seu Catálogo Digital</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envie este link para seus clientes comprarem com você.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-brand/30 text-brand hover:bg-brand/10 shrink-0"
          onClick={() => {
            const primeiroNome = nome.split(" ")[0].replace(/[^a-zA-ZÀ-ÿ]/g, "");
            const link = `${window.location.origin}/catalogo?v=${primeiroNome}`;
            navigator.clipboard.writeText(link);
            alert("Link do catálogo copiado!\n\n" + link);
          }}
        >
          Copiar Link
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-sm border-0 ring-1 ring-amber-500/20 bg-amber-50/50">
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 opacity-90 text-amber-700">
              <Wallet className="h-5 w-5" />
              <h3 className="font-medium text-sm">A Receber</h3>
            </div>
            <p className="text-3xl font-extrabold font-display text-amber-600">
              <span className="text-lg font-bold mr-1 opacity-80">R$</span>
              {comissoesAReceber.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 ring-1 ring-emerald-500/20 bg-emerald-50/50">
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 opacity-90 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="font-medium text-sm">Pagas</h3>
            </div>
            <p className="text-3xl font-extrabold font-display text-emerald-600">
              <span className="text-lg font-bold mr-1 opacity-80">R$</span>
              {comissoesPagas.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 ring-1 ring-slate-900/5">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 grid place-items-center mb-2">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{aguardandoAprovacao}</p>
            <p className="text-xs text-muted-foreground font-medium">Aguardando</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 ring-1 ring-slate-900/5">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-full bg-success/20 text-success grid place-items-center mb-2">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{aprovadas}</p>
            <p className="text-xs text-muted-foreground font-medium">Aprovadas</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand" /> Últimas Vendas
        </h2>

        <div className="space-y-3">
          {vendas.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4 bg-white rounded-xl shadow-sm border border-slate-100">
              Nenhuma venda registrada ainda.
            </p>
          ) : (
            vendas.slice(0, 10).map((v) => {
              const isDav = isOrderDav(v);
              const num = getOrderNumber(v);
              const isSharing = sharingId === v.id;

              return (
                <div
                  key={v.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 cursor-pointer active:scale-[0.99] transition-all hover:border-brand/30"
                  onClick={() => openSaleDetails(v)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-800 text-base">
                        R$ {Number(v.valor_total).toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-semibold text-slate-700">
                          {isDav ? "Orçamento" : "Pedido"} #{num}
                        </span>{" "}
                        • {new Date(v.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {v.status_aprovacao === "Aprovada" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-md">
                            <CheckCircle2 className="h-3 w-3" /> Aprovada
                          </span>
                        ) : v.status_aprovacao === "Rejeitada" || v.status === "Cancelado" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-md">
                            {v.status === "Cancelado" ? "Cancelado" : "Rejeitada"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}

                        {/* Ações Rápidas */}
                        {isDav && v.status !== "Cancelado" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelDav(v);
                            }}
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                            title="Cancelar orçamento"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSale(v);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title={isDav ? "Excluir orçamento" : "Excluir pedido"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {v.status_aprovacao === "Aprovada" && v.valor_comissao > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          + R$ {Number(v.valor_comissao).toFixed(2)} comissão
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações rápidas no card */}
                  <div className="border-t border-slate-100 pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSharing}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(v);
                      }}
                      className="flex-1 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/60"
                      title="Enviar arquivo PDF e resumo no WhatsApp"
                    >
                      {isSharing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                      ) : (
                        <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOrderPdf(v.id);
                      }}
                      className="flex-1 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                      title="Visualizar e Imprimir PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Ver PDF</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isSaleDetailsOpen} onOpenChange={setIsSaleDetailsOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {isOrderDav(selectedSaleForDetails || {}) ? "Ficha do Orçamento" : "Ficha do Pedido"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {isOrderDav(selectedSaleForDetails || {}) ? "Orçamento" : "Pedido"} #
                {getOrderNumber(selectedSaleForDetails || {})} •{" "}
                {selectedSaleForDetails &&
                  new Date(selectedSaleForDetails?.created_at).toLocaleDateString("pt-BR")}
                {selectedSaleForDetails?.cliente?.nome && (
                  <div className="mt-3 text-sm text-slate-700 bg-slate-100 p-3 rounded-xl border border-slate-200 text-left">
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      👤 {selectedSaleForDetails.cliente.nome}
                    </p>
                    {selectedSaleForDetails.cliente.cpf_cnpj && (
                      <p className="mt-1">📄 {selectedSaleForDetails.cliente.cpf_cnpj}</p>
                    )}
                    {selectedSaleForDetails.cliente.telefone && (
                      <p className="mt-1">📞 {selectedSaleForDetails.cliente.telefone}</p>
                    )}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {loadingSaleDetails ? (
              <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
                <span>Carregando itens...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[260px] overflow-y-auto divide-y border rounded-xl">
                  {saleItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum item encontrado.
                    </div>
                  ) : (
                    saleItems.map((item) => (
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
                    {Number(selectedSaleForDetails?.valor_total || 0)
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="pt-2 flex flex-col gap-2.5 w-full">
            {/* Botão principal de WhatsApp com PDF */}
            {selectedSaleForDetails && (
              <>
                <Button
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  onClick={() => handleShare(selectedSaleForDetails, saleItems)}
                  disabled={sharingId === selectedSaleForDetails.id}
                >
                  {sharingId === selectedSaleForDetails.id ? (
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
                    onClick={() => openOrderPdf(selectedSaleForDetails.id)}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Ver / Imprimir PDF</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    onClick={() => downloadOrderPdf(selectedSaleForDetails, saleItems)}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Baixar PDF</span>
                  </Button>
                </div>
              </>
            )}

            {selectedSaleForDetails?.status_aprovacao === "Pendente" && (
              <>
                <Button
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
                  onClick={handleEnviarPedido}
                >
                  🚀 Enviar pedido para o dono
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-800 font-semibold rounded-xl"
                  onClick={openEditClient}
                >
                  ✏️ Editar Informações do Cliente
                </Button>
              </>
            )}
            {/* Ações de Cancelar Orçamento e Excluir */}
            {isOrderDav(selectedSaleForDetails || {}) ? (
              <div className="space-y-2">
                {selectedSaleForDetails?.status !== "Cancelado" && (
                  <Button
                    variant="outline"
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold rounded-xl flex items-center justify-center gap-1.5"
                    onClick={() => handleCancelDav(selectedSaleForDetails)}
                  >
                    <Ban className="h-4 w-4 text-amber-600" />
                    <span>Cancelar Orçamento</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs"
                  disabled={deletingOrder}
                  onClick={() => handleDeleteSale(selectedSaleForDetails)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>
                    {deletingOrder ? "Excluindo..." : "Excluir Orçamento Definitivamente"}
                  </span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl flex items-center justify-center gap-1.5"
                disabled={deletingOrder}
                onClick={() => handleDeleteSale(selectedSaleForDetails)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span>{deletingOrder ? "Excluindo..." : "Excluir Pedido"}</span>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full border-slate-200 text-slate-600 rounded-xl"
              onClick={() => setIsSaleDetailsOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingClient} onOpenChange={setIsEditingClient}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Editar Informações</DialogTitle>
            <DialogDescription>Corrija os dados do cliente para este pedido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={editClientData.nome}
                onChange={(e) => setEditClientData((p) => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CPF/CNPJ</label>
              <Input
                value={editClientData.cpf_cnpj}
                onChange={(e) => setEditClientData((p) => ({ ...p, cpf_cnpj: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={editClientData.telefone}
                onChange={(e) => setEditClientData((p) => ({ ...p, telefone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingClient(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarCliente} disabled={savingClient}>
              {savingClient ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
