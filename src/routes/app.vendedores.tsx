import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2,
  XCircle,
  Wallet,
  TrendingUp,
  DollarSign,
  Eye,
  Settings,
  Trash2,
  Mail,
  Phone,
  Search,
  Table2,
} from "lucide-react";

export const Route = createFileRoute("/app/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores Parceiros — GARDEN PRIME ERP" }] }),
  component: VendedoresAdmin,
});

function VendedoresAdmin() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [todasVendas, setTodasVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedVendedor, setSelectedVendedor] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [commissionTarget, setCommissionTarget] = useState<any>(null);
  const [commissionType, setCommissionType] = useState("porcentagem");
  const [commissionValue, setCommissionValue] = useState("");
  const [acrescimoCatalogo, setAcrescimoCatalogo] = useState(false);
  const [acrescimoPercentual, setAcrescimoPercentual] = useState("20");

  const [isTabelaPrecosModalOpen, setIsTabelaPrecosModalOpen] = useState(false);
  const [tabelaPrecosTarget, setTabelaPrecosTarget] = useState<any>(null);
  const [produtosParaTabela, setProdutosParaTabela] = useState<any[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [searchProduct, setSearchProduct] = useState("");
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [successAlertModal, setSuccessAlertModal] = useState({ isOpen: false, message: "" });

  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [isSaleDetailsOpen, setIsSaleDetailsOpen] = useState(false);
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    desc: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", desc: "", onConfirm: () => {} });

  const handleConfirmAction = () => {
    confirmModal.onConfirm();
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const [vendedorSearch, setVendedorSearch] = useState("");
  const [vendedorStatusTab, setVendedorStatusTab] = useState<string>("todos");

  const toggleStatusVendedor = async (vendedor: any) => {
    const isAtivo = vendedor.status === "Ativo" || !vendedor.status;
    const novoStatus = isAtivo ? "Inativo" : "Ativo";

    setConfirmModal({
      isOpen: true,
      title: isAtivo ? "Desativar Parceiro Vendedor" : "Ativar Parceiro Vendedor",
      desc: isAtivo
        ? `Tem certeza que deseja desativar o acesso de "${vendedor.nome}"? Ele será desconectado e não conseguirá fazer login no portal até ser reativado.`
        : `Deseja ativar o acesso de "${vendedor.nome}"? O vendedor voltará a ter acesso imediato ao portal com seu login.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from("vendedores")
            .update({ status: novoStatus })
            .eq("id", vendedor.id);

          if (error) throw error;

          setVendedores((prev) =>
            prev.map((v) => (v.id === vendedor.id ? { ...v, status: novoStatus } : v))
          );
          if (selectedVendedor?.id === vendedor.id) {
            setSelectedVendedor((prev: any) => ({ ...prev, status: novoStatus }));
          }

          setSuccessAlertModal({
            isOpen: true,
            message: `Vendedor "${vendedor.nome}" ${isAtivo ? "desativado" : "ativado"} com sucesso!`,
          });
        } catch (err: any) {
          alert("Erro ao alterar status do vendedor: " + err.message);
        }
      },
    });
  };

  const openSaleDetails = async (venda: any) => {
    setSelectedSaleForDetails(venda);
    setIsSaleDetailsOpen(true);
    setLoadingSaleDetails(true);
    setSaleItems([]);

    try {
      const { data, error } = await supabase
        .from("vendas_itens")
        .select("*, produto:produtos(nome, emoji)")
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from("vendedores").select("*");
      if (vData) setVendedores(vData);

      const { data: vendasData, error } = await supabase
        .from("vendas")
        .select("*, vendedores(*), clientes(*)")
        .order("created_at", { ascending: false });

      if (!error && vendasData) {
        // Mapeia para manter a compatibilidade com o resto do código que usa v.vendedor e v.cliente
        const mappedData = vendasData
          .filter((v: any) => v.vendedor_id !== null)
          .map((v: any) => ({
            ...v,
            vendedor: v.vendedores,
            cliente: v.clientes,
          }));
        setTodasVendas(mappedData);
      } else if (error) {
        console.error("Erro ao buscar vendas:", error);
        alert("Erro ao buscar vendas dos parceiros: " + error.message);
      }
    } catch (e) {
      console.warn("Erro:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const vendasPendentes = todasVendas.filter(
    (v) => v.status_aprovacao === "Pendente" && v.tipo !== "DAV",
  );
  const vendasAprovadas = todasVendas.filter(
    (v) => v.status_aprovacao === "Aprovada" && v.tipo !== "DAV",
  );

  const totalFaturadoParceiros = vendasAprovadas.reduce(
    (acc, v) => acc + (Number(v.valor_total) || 0),
    0,
  );
  const totalComissoesDevidas = vendasAprovadas
    .filter((v) => v.status_pagamento_comissao !== "Paga")
    .reduce((acc, v) => acc + (Number(v.valor_comissao) || 0), 0);
  const totalComissoesPagas = vendasAprovadas
    .filter((v) => v.status_pagamento_comissao === "Paga")
    .reduce((acc, v) => acc + (Number(v.valor_comissao) || 0), 0);

  const aprovarVenda = async (venda: any) => {
    if (!confirm("Confirmar aprovação da venda e registro da comissão?")) return;

    try {
      const vendedor = venda.vendedor || vendedores.find((v) => v.id === venda.vendedor_id);
      const valorVenda = Number(venda.valor_total) || 0;
      let valorComissao = 0;

      if (vendedor) {
        if (vendedor.tipo_comissao === "porcentagem") {
          valorComissao = valorVenda * (Number(vendedor.valor_comissao || 0) / 100);
        } else {
          valorComissao = Number(vendedor.valor_comissao || 0);
        }
      }

      const { error } = await supabase
        .from("vendas")
        .update({
          status_aprovacao: "Aprovada",
          status: "Faturado",
          valor_comissao: valorComissao,
          status_pagamento_comissao: "Pendente",
        })
        .eq("id", venda.id);

      if (error) throw error;

      const dataAtual = new Date().toISOString().split("T")[0];
      await supabase.from("contas_receber").insert([
        {
          venda_id: venda.id,
          descricao: `Venda Parceiro #${venda.numero_venda} - ${vendedor?.nome || ""}`,
          valor: valorVenda,
          vencimento: dataAtual,
          status: "Pendente",
          data_pagamento: null,
        },
      ]);

      // Dar baixa no estoque
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
              .update({ estoque: prod.estoque - item.quantidade })
              .eq("id", item.produto_id);
          }
        }
      }

      alert("Venda aprovada com sucesso! Financeiro e Comissão gerados, e estoque atualizado.");
      fetchData();
    } catch (err: any) {
      alert("Erro ao aprovar: " + err.message);
    }
  };

  const rejeitarVenda = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Rejeitar Venda",
      desc: "Tem certeza que deseja rejeitar esta venda? Ela será cancelada.",
      onConfirm: async () => {
        try {
          await supabase
            .from("vendas")
            .update({ status_aprovacao: "Rejeitada", status: "Cancelada" })
            .eq("id", id);
          fetchData();
        } catch (err: any) {
          alert("Erro ao rejeitar: " + err.message);
        }
      },
    });
  };

  const openCommissionModal = (vendedor: any) => {
    setCommissionTarget(vendedor);
    setCommissionType(vendedor.tipo_comissao || "porcentagem");
    setCommissionValue(vendedor.valor_comissao ? String(vendedor.valor_comissao) : "");
    setAcrescimoCatalogo(vendedor.acrescimo_catalogo || false);
    setAcrescimoPercentual(
      vendedor.acrescimo_catalogo_percentual
        ? String(vendedor.acrescimo_catalogo_percentual)
        : "20",
    );
    setIsCommissionModalOpen(true);
  };

  const openTabelaPrecosModal = async (vendedor: any) => {
    setTabelaPrecosTarget(vendedor);
    setSearchProduct("");
    setIsTabelaPrecosModalOpen(true);
    setProdutosParaTabela([]);
    setCustomPrices({});

    const { data: prods } = await supabase
      .from("produtos")
      .select("id, nome, valor")
      .eq("status", "Ativo")
      .order("nome");
    if (prods) setProdutosParaTabela(prods);

    const { data: precos } = await supabase
      .from("parceiro_precos")
      .select("produto_id, preco_personalizado")
      .eq("vendedor_id", vendedor.id);

    if (precos) {
      const pricesMap: Record<string, string> = {};
      precos.forEach((p) => {
        pricesMap[p.produto_id] = p.preco_personalizado.toString().replace(".", ",");
      });
      setCustomPrices(pricesMap);
    }
  };

  const saveTabelaPrecos = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrices(true);

    try {
      await supabase.from("parceiro_precos").delete().eq("vendedor_id", tabelaPrecosTarget.id);

      const inserts = [];
      for (const [prodId, priceStr] of Object.entries(customPrices)) {
        if (!priceStr || priceStr.trim() === "") continue;
        const numPrice = parseFloat(priceStr.replace(",", "."));
        if (!isNaN(numPrice)) {
          inserts.push({
            vendedor_id: tabelaPrecosTarget.id,
            produto_id: prodId,
            preco_personalizado: numPrice,
          });
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from("parceiro_precos").insert(inserts);
        if (error) throw error;
      }

      setIsTabelaPrecosModalOpen(false);
      setSuccessAlertModal({ isOpen: true, message: "Tabela de preços salva com sucesso!" });
    } catch (err: any) {
      alert("Erro ao salvar tabela de preços: " + err.message);
    } finally {
      setIsSavingPrices(false);
    }
  };

  const saveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionTarget) return;

    const v = parseFloat(commissionValue.replace(",", "."));
    if (isNaN(v) || v < 0) {
      alert("Valor numérico inválido.");
      return;
    }

    const ap = parseFloat(acrescimoPercentual.replace(",", "."));
    if (acrescimoCatalogo && (isNaN(ap) || ap < 0)) {
      alert("Percentual de acréscimo inválido.");
      return;
    }

    try {
      const novoStatus =
        commissionTarget.status === "Aguardando Aprovação"
          ? "Ativo"
          : (commissionTarget.status || "Ativo");

      const { error } = await supabase
        .from("vendedores")
        .update({
          status: novoStatus,
          tipo_comissao: commissionType,
          valor_comissao: v,
          acrescimo_catalogo: acrescimoCatalogo,
          acrescimo_catalogo_percentual: acrescimoCatalogo ? ap : 20,
        })
        .eq("id", commissionTarget.id);

      if (error) throw error;

      setIsCommissionModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Erro ao salvar configuração: " + err.message);
    }
  };

  const pagarComissao = async (vendaId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Confirmar Pagamento",
      desc: "Você já transferiu esse valor para o parceiro? Confirmar baixa de pagamento da comissão.",
      onConfirm: async () => {
        try {
          await supabase
            .from("vendas")
            .update({ status_pagamento_comissao: "Paga" })
            .eq("id", vendaId);
          fetchData();
        } catch (err: any) {
          alert("Erro ao pagar comissão: " + err.message);
        }
      },
    });
  };

  const excluirVendaAprovada = async (vendaId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Venda do Parceiro",
      desc: "Atenção: Deseja realmente excluir esta venda do parceiro? O valor será removido das comissões dele e os produtos retornarão ao estoque.",
      onConfirm: async () => {
        try {
          await supabase
            .from("vendas")
            .update({ status_aprovacao: "Rejeitada", valor_comissao: 0, status: "Cancelada" })
            .eq("id", vendaId);

          // Retornar ao estoque
          const { data: itens } = await supabase
            .from("vendas_itens")
            .select("produto_id, quantidade")
            .eq("venda_id", vendaId);
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

          fetchData();
        } catch (err: any) {
          alert("Erro ao excluir venda: " + err.message);
        }
      },
    });
  };

  const excluirVendedor = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Parceiro",
      desc: "Tem certeza que deseja excluir esse parceiro? O cadastro e o acesso dele serão permanentemente apagados do banco de dados.",
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc("delete_vendedor_and_user", { p_vendedor_id: id });
          if (error) throw error;

          setIsSheetOpen(false);
          fetchData();
        } catch (err: any) {
          alert(
            "Erro ao excluir parceiro: " +
              err.message +
              "\n\nVocê precisa rodar o script SQL de deleção no painel do Supabase primeiro!",
          );
        }
      },
    });
  };

  const rejeitarVendedor = async (vendedorId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Recusar Solicitação",
      desc: "Tem certeza que deseja recusar e excluir a solicitação deste usuário? O cadastro dele será apagado do banco de dados para liberar o e-mail.",
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc("delete_vendedor_and_user", {
            p_vendedor_id: vendedorId,
          });
          if (error) throw error;
          fetchData();
        } catch (err: any) {
          alert(
            "Erro ao rejeitar parceiro: " +
              err.message +
              "\n\nVocê precisa rodar o script SQL de deleção no painel do Supabase primeiro!",
          );
        }
      },
    });
  };

  const openVendedorDetails = (vendedor: any) => {
    setSelectedVendedor(vendedor);
    setIsSheetOpen(true);
  };

  // Cálculos do vendedor selecionado
  const vendasDoVendedor = selectedVendedor
    ? vendasAprovadas.filter((v) => v.vendedor_id === selectedVendedor.id)
    : [];
  const vFaturado = vendasDoVendedor.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
  const vDevido = vendasDoVendedor
    .filter((v) => v.status_pagamento_comissao !== "Paga")
    .reduce((acc, v) => acc + (Number(v.valor_comissao) || 0), 0);
  const vPago = vendasDoVendedor
    .filter((v) => v.status_pagamento_comissao === "Paga")
    .reduce((acc, v) => acc + (Number(v.valor_comissao) || 0), 0);

  // Contadores e filtros de vendedores parceiros
  const totalVendedores = vendedores.length;
  const totalAtivos = vendedores.filter((v) => v.status === "Ativo" || !v.status).length;
  const totalInativos = vendedores.filter(
    (v) => v.status === "Inativo" || v.status === "Desativado",
  ).length;
  const totalPendentes = vendedores.filter((v) => v.status === "Aguardando Aprovação").length;

  const filteredVendedores = vendedores.filter((v) => {
    // Filtro por aba selecionada
    if (vendedorStatusTab === "ativos" && v.status !== "Ativo" && v.status) return false;
    if (vendedorStatusTab === "inativos" && v.status !== "Inativo" && v.status !== "Desativado")
      return false;
    if (vendedorStatusTab === "pendentes" && v.status !== "Aguardando Aprovação") return false;

    // Filtro por busca de texto
    if (vendedorSearch.trim()) {
      const q = vendedorSearch.toLowerCase();
      const matchNome = (v.nome || "").toLowerCase().includes(q);
      const matchEmail = (v.email || "").toLowerCase().includes(q);
      const matchTel = (v.telefone || "").toLowerCase().includes(q);
      if (!matchNome && !matchEmail && !matchTel) return false;
    }

    return true;
  });

  return (
    <>
      <PageHeader
        title="Relatório de Parceiros"
        subtitle="Gerencie as vendas, comissões e pagamentos dos seus afiliados."
      />

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Faturado</p>
              <h3 className="text-2xl font-bold font-display text-slate-800">
                R$ {totalFaturadoParceiros.toFixed(2).replace(".", ",")}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-amber-500/20 bg-amber-50/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700">Comissões Devidas</p>
              <h3 className="text-2xl font-bold font-display text-amber-600">
                R$ {totalComissoesDevidas.toFixed(2).replace(".", ",")}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-emerald-500/20 bg-emerald-50/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700">Comissões Pagas</p>
              <h3 className="text-2xl font-bold font-display text-emerald-600">
                R$ {totalComissoesPagas.toFixed(2).replace(".", ",")}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-card flex flex-col">
          <div className="border-b p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-lg text-slate-800">Parceiros Vendedores</h2>
              <p className="text-sm text-muted-foreground">
                Ative ou desative o acesso, configure comissões e veja relatórios.
              </p>
            </div>

            {/* Abas para filtrar por status */}
            <Tabs value={vendedorStatusTab} onValueChange={setVendedorStatusTab} className="w-full">
              <TabsList className="grid grid-cols-3 sm:inline-flex h-9 bg-slate-100 p-1 w-full sm:w-auto">
                <TabsTrigger value="todos" className="text-xs px-2.5 py-1">
                  Todos <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{totalVendedores}</Badge>
                </TabsTrigger>
                <TabsTrigger value="ativos" className="text-xs px-2.5 py-1">
                  Ativos <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800">{totalAtivos}</Badge>
                </TabsTrigger>
                <TabsTrigger value="inativos" className="text-xs px-2.5 py-1">
                  Desativados <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 bg-slate-200 text-slate-700">{totalInativos}</Badge>
                </TabsTrigger>
                {totalPendentes > 0 && (
                  <TabsTrigger value="pendentes" className="text-xs px-2.5 py-1">
                    Pendentes <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800">{totalPendentes}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={vendedorSearch}
                onChange={(e) => setVendedorSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status / Acesso</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendedores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum parceiro encontrado nesta aba.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendedores.map((v) => {
                  const isAtivo = v.status === "Ativo" || !v.status;
                  const isPendente = v.status === "Aguardando Aprovação";

                  return (
                    <TableRow key={v.id} className={cn(!isAtivo && !isPendente && "bg-slate-50/70")}>
                      <TableCell
                        className="cursor-pointer hover:bg-slate-100/50 transition-colors"
                        onClick={() => openVendedorDetails(v)}
                      >
                        <p
                          className={cn(
                            "font-medium hover:underline",
                            isAtivo
                              ? "text-brand"
                              : "text-slate-600 line-through decoration-slate-400 decoration-1",
                          )}
                        >
                          {v.nome}
                        </p>
                        {v.email && (
                          <p className="text-xs text-muted-foreground truncate max-w-[170px]">
                            {v.email}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {isPendente ? (
                          <Badge
                            variant="outline"
                            className="text-amber-700 bg-amber-50 border-amber-200 text-[10px] font-medium"
                          >
                            Pendente
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={isAtivo}
                              onCheckedChange={() => toggleStatusVendedor(v)}
                              title={
                                isAtivo
                                  ? "Clique para Desativar este vendedor"
                                  : "Clique para Ativar este vendedor"
                              }
                            />
                            <span
                              className={cn(
                                "text-xs font-semibold cursor-pointer select-none",
                                isAtivo ? "text-emerald-700" : "text-slate-500",
                              )}
                              onClick={() => toggleStatusVendedor(v)}
                            >
                              {isAtivo ? "Ativo" : "Desativado"}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {v.tipo_comissao === "porcentagem"
                          ? `${v.valor_comissao}%`
                          : `R$ ${v.valor_comissao}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPendente ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => openCommissionModal(v)}
                              className="h-7 text-xs bg-success hover:bg-success/90"
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejeitarVendedor(v.id)}
                              className="h-7 text-xs px-2"
                              title="Recusar Solicitação"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCommissionModal(v)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-brand"
                              title="Editar Comissão"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openTabelaPrecosModal(v)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-brand"
                              title="Tabela de Preços Personalizada"
                            >
                              <Table2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openVendedorDetails(v)}
                              className="h-8 text-xs flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Relatório
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="shadow-card border-brand/50">
          <div className="border-b p-4 bg-brand/5">
            <h2 className="font-semibold text-lg text-brand">Vendas Pendentes de Aprovação</h2>
            <p className="text-sm text-muted-foreground">
              Vendas aguardando sua autorização para baixar estoque e comissão.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasPendentes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    Nenhuma venda pendente.
                  </TableCell>
                </TableRow>
              ) : (
                vendasPendentes.map((v) => (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => openSaleDetails(v)}
                  >
                    <TableCell>
                      <p className="font-medium">{v.vendedor?.nome || "Desconhecido"}</p>
                      <p className="text-xs text-muted-foreground">
                        #{v.numero_venda || v.numero || v.id.substring(0, 6)}
                      </p>
                    </TableCell>
                    <TableCell className="font-semibold">
                      R$ {Number(v.valor_total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() => aprovarVenda(v)}
                          className="bg-success hover:bg-success/90 h-8 px-2"
                          title="Aprovar"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejeitarVenda(v.id)}
                          className="h-8 px-2"
                          title="Rejeitar"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[540px] overflow-y-auto bg-slate-50 p-0"
        >
          {selectedVendedor && (
            <div className="flex flex-col h-full">
              <div className="p-6 bg-white border-b sticky top-0 z-10">
                <SheetHeader>
                  <SheetTitle className="text-2xl font-bold font-display">
                    {selectedVendedor.nome}
                  </SheetTitle>
                  <SheetDescription>
                    <div className="flex flex-col gap-1 mt-2 mb-4">
                      {selectedVendedor.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-4 h-4" /> {selectedVendedor.email}
                        </div>
                      )}
                      {selectedVendedor.telefone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="w-4 h-4" /> {selectedVendedor.telefone}
                        </div>
                      )}
                    </div>
                    Comissão base:{" "}
                    {selectedVendedor.tipo_comissao === "porcentagem"
                      ? `${selectedVendedor.valor_comissao}%`
                      : `R$ ${selectedVendedor.valor_comissao}`}
                  </SheetDescription>
                </SheetHeader>

                {/* Status e Acesso do Vendedor no Sheet */}
                <div
                  className={cn(
                    "p-3.5 rounded-xl border flex items-center justify-between mt-3",
                    selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                      ? "bg-slate-100/90 border-slate-300"
                      : selectedVendedor.status === "Aguardando Aprovação"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-emerald-50/80 border-emerald-200",
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                            ? "bg-slate-400"
                            : selectedVendedor.status === "Aguardando Aprovação"
                            ? "bg-amber-500"
                            : "bg-emerald-500 animate-pulse",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                            ? "text-slate-600"
                            : selectedVendedor.status === "Aguardando Aprovação"
                            ? "text-amber-800"
                            : "text-emerald-800",
                        )}
                      >
                        {selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                          ? "Acesso Desativado"
                          : selectedVendedor.status === "Aguardando Aprovação"
                          ? "Aguardando Aprovação"
                          : "Acesso Ativo"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                        ? "O vendedor está impedido de fazer login no portal."
                        : selectedVendedor.status === "Aguardando Aprovação"
                        ? "Aguardando definição da comissão para liberar o acesso."
                        : "O vendedor possui acesso liberado ao portal de parceiros."}
                    </p>
                  </div>
                  {selectedVendedor.status !== "Aguardando Aprovação" && (
                    <Button
                      size="sm"
                      variant={
                        selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                          ? "default"
                          : "outline"
                      }
                      className={
                        selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                          ? "h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          : "h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
                      }
                      onClick={() => toggleStatusVendedor(selectedVendedor)}
                    >
                      {selectedVendedor.status === "Inativo" || selectedVendedor.status === "Desativado"
                        ? "Ativar Parceiro"
                        : "Desativar Acesso"}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-slate-50 p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Vendeu Total</p>
                    <p className="font-bold text-slate-800">R$ {vFaturado.toFixed(2)}</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-center">
                    <p className="text-xs text-amber-700 font-medium mb-1">Você Deve</p>
                    <p className="font-bold text-amber-600">R$ {vDevido.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center">
                    <p className="text-xs text-emerald-700 font-medium mb-1">Já Pago</p>
                    <p className="font-bold text-emerald-600">R$ {vPago.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1">
                <h3 className="font-semibold text-lg mb-4 text-slate-800">
                  Histórico de Vendas Aprovadas
                </h3>
                <div className="space-y-3">
                  {vendasDoVendedor.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      Nenhuma venda aprovada ainda.
                    </p>
                  ) : (
                    vendasDoVendedor.map((v) => (
                      <div
                        key={v.id}
                        className="bg-white p-4 rounded-xl border shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Pedido #{v.numero_venda}
                            </p>
                            <p className="font-bold text-sm">
                              Venda: R$ {Number(v.valor_total).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">
                              Comissão
                            </p>
                            <p className="font-bold text-brand">
                              R$ {Number(v.valor_comissao).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t pt-3">
                          <Badge
                            variant="outline"
                            className={
                              v.status_pagamento_comissao === "Paga"
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                : "bg-amber-50 text-amber-600 border-amber-200"
                            }
                          >
                            {v.status_pagamento_comissao === "Paga"
                              ? "Comissão Paga"
                              : "Comissão Pendente"}
                          </Badge>

                          <div className="flex items-center gap-2">
                            {v.status_pagamento_comissao !== "Paga" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                                onClick={() => pagarComissao(v.id)}
                              >
                                Marcar como Pago
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => excluirVendaAprovada(v.id)}
                              title="Excluir Venda do Parceiro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t bg-white sticky bottom-0">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => excluirVendedor(selectedVendedor.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Parceiro
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={isCommissionModalOpen} onOpenChange={setIsCommissionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={saveCommission}>
            <DialogHeader>
              <DialogTitle>Configurar Comissão</DialogTitle>
              <DialogDescription>
                {commissionTarget?.status === "Aguardando Aprovação"
                  ? `Aprove o parceiro ${commissionTarget?.nome} definindo sua regra de comissão.`
                  : `Edite a regra de comissão do parceiro ${commissionTarget?.nome}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Tipo de Comissão</label>
                <Select value={commissionType} onValueChange={setCommissionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="porcentagem">% Porcentagem sobre a venda</SelectItem>
                    <SelectItem value="fixo">R$ Valor Fixo por venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Valor da Comissão</label>
                <div className="relative">
                  {commissionType === "fixo" && (
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                      R$
                    </span>
                  )}
                  <Input
                    type="text"
                    required
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    placeholder={commissionType === "porcentagem" ? "Ex: 10" : "Ex: 50,00"}
                    className={commissionType === "fixo" ? "pl-8" : "pr-8"}
                  />
                  {commissionType === "porcentagem" && (
                    <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">
                      %
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-2 mt-2 bg-slate-50 p-3 rounded-xl border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <label className="text-sm font-medium">Acréscimo no Catálogo</label>
                    <p className="text-xs text-muted-foreground">
                      Aumenta o preço dos produtos no catálogo e PDV deste parceiro.
                    </p>
                  </div>
                  <Switch checked={acrescimoCatalogo} onCheckedChange={setAcrescimoCatalogo} />
                </div>
                {acrescimoCatalogo && (
                  <div className="pt-3 border-t mt-1">
                    <label className="text-sm font-medium">Porcentagem de Acréscimo</label>
                    <div className="relative mt-1">
                      <Input
                        type="text"
                        required
                        value={acrescimoPercentual}
                        onChange={(e) => setAcrescimoPercentual(e.target.value)}
                        placeholder="Ex: 30"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCommissionModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-gradient-brand text-white">
                Salvar Comissão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isSaleDetailsOpen} onOpenChange={setIsSaleDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  Pedido #{selectedSaleForDetails?.numero_venda} • Vendedor:{" "}
                  {selectedSaleForDetails?.vendedor?.nome || "Desconhecido"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enviado em:{" "}
                  {selectedSaleForDetails
                    ? new Date(selectedSaleForDetails.created_at).toLocaleDateString("pt-BR")
                    : ""}{" "}
                  às{" "}
                  {selectedSaleForDetails
                    ? new Date(selectedSaleForDetails.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
                {selectedSaleForDetails?.cliente?.nome && (
                  <div className="mt-3 text-sm text-slate-700 bg-slate-100 p-3 rounded-md border border-slate-200">
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      👤 {selectedSaleForDetails.cliente.nome}
                    </p>
                    {selectedSaleForDetails.cliente.cpf_cnpj && (
                      <p className="mt-1">📄 {selectedSaleForDetails.cliente.cpf_cnpj}</p>
                    )}
                    {selectedSaleForDetails.cliente.telefone && (
                      <p className="mt-1">📞 {selectedSaleForDetails.cliente.telefone}</p>
                    )}
                    {selectedSaleForDetails.cliente.endereco && (
                      <p className="mt-1">🏠 {selectedSaleForDetails.cliente.endereco}</p>
                    )}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingSaleDetails ? (
              <div className="text-center py-6 text-muted-foreground">Carregando itens...</div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[300px] overflow-y-auto divide-y border rounded-lg">
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
                              {item.quantidade}x R$ {Number(item.valor_unitario).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-brand">
                          R$ {Number(item.subtotal).toFixed(2)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-100 rounded-lg">
                  <span className="font-semibold text-slate-700">Total do Pedido:</span>
                  <span className="text-xl font-bold font-display text-slate-900">
                    R$ {Number(selectedSaleForDetails?.valor_total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          {selectedSaleForDetails?.status_aprovacao === "Pendente" && (
            <DialogFooter className="flex items-center gap-2 sm:justify-end">
              <Button
                variant="destructive"
                onClick={() => {
                  setIsSaleDetailsOpen(false);
                  rejeitarVenda(selectedSaleForDetails.id);
                }}
              >
                Recusar Pedido
              </Button>
              <Button
                className="bg-success hover:bg-success/90"
                onClick={() => {
                  setIsSaleDetailsOpen(false);
                  aprovarVenda(selectedSaleForDetails);
                }}
              >
                Aprovar Pedido
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmModal.isOpen}
        onOpenChange={(open) => setConfirmModal({ ...confirmModal, isOpen: open })}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{confirmModal.title}</DialogTitle>
            <DialogDescription className="text-base text-slate-700 py-2">
              {confirmModal.desc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Cancelar
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={handleConfirmAction}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTabelaPrecosModalOpen} onOpenChange={setIsTabelaPrecosModalOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[85vh] flex flex-col rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Tabela de Preços Personalizada</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Defina os preços específicos por produto para {tabelaPrecosTarget?.nome}. Se deixar em
              branco, será usada a regra padrão do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-1 sm:mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar produto..."
              className="pl-9 h-9 sm:h-10 rounded-2xl text-sm"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 mt-2 space-y-2">
            {produtosParaTabela
              .filter((p) => p.nome.toLowerCase().includes(searchProduct.toLowerCase()))
              .map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 border rounded-2xl bg-slate-50/50 gap-2"
                >
                  <div className="flex-1 pr-2">
                    <p className="font-medium text-xs sm:text-sm leading-tight">{prod.nome}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      Preço base: R$ {prod.valor.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <div className="w-24 sm:w-28">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 sm:top-2 text-muted-foreground text-[10px] sm:text-xs">
                        R$
                      </span>
                      <Input
                        className="pl-7 text-right h-7 sm:h-8 text-xs sm:text-sm rounded-xl"
                        placeholder="Padrão"
                        value={customPrices[prod.id] || ""}
                        onChange={(e) =>
                          setCustomPrices((prev) => ({ ...prev, [prod.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

            {produtosParaTabela.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Carregando produtos...
              </p>
            )}
          </div>

          <DialogFooter className="mt-4 flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl flex-1 sm:flex-none h-9 sm:h-10"
              onClick={() => setIsTabelaPrecosModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveTabelaPrecos}
              disabled={isSavingPrices}
              className="bg-green-600 text-white hover:bg-green-700 rounded-xl flex-1 sm:flex-none h-9 sm:h-10"
            >
              {isSavingPrices ? "Salvando..." : "Salvar Tabela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={successAlertModal.isOpen}
        onOpenChange={(open) => setSuccessAlertModal({ ...successAlertModal, isOpen: open })}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Sucesso</DialogTitle>
            <DialogDescription className="text-base text-slate-700 py-4 text-center font-medium">
              {successAlertModal.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full bg-green-600 text-white hover:bg-green-700"
              onClick={() => setSuccessAlertModal({ ...successAlertModal, isOpen: false })}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
