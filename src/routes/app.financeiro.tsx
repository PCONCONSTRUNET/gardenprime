import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Check, Plus, Trash2, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/contexts/ConfirmContext";
import { AsaasCobrancaModal } from "@/components/asaas-cobranca-modal";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — GARDEN PRIME ERP" }] }),
  component: Financeiro,
});

function Financeiro() {
  const confirm = useConfirm();
  const [receitas, setReceitas] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState<"receita" | "despesa">("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [statusLancamento, setStatusLancamento] = useState("Pendente");
  const [salvando, setSalvando] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  // ASAAS Modal
  const [openAsaas, setOpenAsaas] = useState(false);
  const [asaasTarget, setAsaasTarget] = useState<{
    cliente: any;
    valor: number;
    descricao: string;
    vencimento: string;
    conta_receber_id: string;
  } | null>(null);

  const fetchFinanceiro = async () => {
    try {
      const { data: rec } = await supabase
        .from("contas_receber")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: des } = await supabase
        .from("contas_pagar")
        .select("*")
        .order("created_at", { ascending: false });

      if (rec) setReceitas(rec);
      if (des) setDespesas(des);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceiro();
  }, []);

  const handleBaixa = async (id: string, tipo: "receber" | "pagar") => {
    if (
      !(await confirm({
        description: "Deseja confirmar o pagamento/recebimento deste título?",
        variant: "default",
      }))
    )
      return;
    try {
      const tabela = tipo === "receber" ? "contas_receber" : "contas_pagar";
      const statusFinal = tipo === "receber" ? "Recebido" : "Pago";
      const dataHoje = new Date().toISOString().split("T")[0];

      await supabase
        .from(tabela)
        .update({
          status: statusFinal,
          data_pagamento: dataHoje,
        })
        .eq("id", id);

      fetchFinanceiro();
    } catch (err) {
      alert("Erro ao dar baixa.");
    }
  };

  const handleExcluir = async (id: string, tipo: "receber" | "pagar") => {
    if (
      !(await confirm({
        description: "Deseja excluir este lançamento permanentemente?",
        variant: "destructive",
      }))
    )
      return;
    try {
      const tabela = tipo === "receber" ? "contas_receber" : "contas_pagar";
      await supabase.from(tabela).delete().eq("id", id);
      fetchFinanceiro();
    } catch (err) {
      alert("Erro ao excluir lançamento.");
    }
  };

  const handleSalvarLancamento = async () => {
    if (!descricao || !valor || !vencimento) return alert("Preencha todos os campos.");
    setSalvando(true);
    try {
      const tabela = tipoLancamento === "receita" ? "contas_receber" : "contas_pagar";
      await supabase.from(tabela).insert([
        {
          descricao,
          valor: Number(valor.replace(",", ".")),
          vencimento,
          status: statusLancamento,
          data_pagamento:
            statusLancamento !== "Pendente" ? new Date().toISOString().split("T")[0] : null,
        },
      ]);
      setOpenModal(false);
      setDescricao("");
      setValor("");
      setVencimento("");
      setStatusLancamento("Pendente");
      fetchFinanceiro();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  const openLancamento = (tipo: "receita" | "despesa") => {
    setTipoLancamento(tipo);
    setStatusLancamento("Pendente");
    setOpenModal(true);
  };

  const lancamentosAll = [
    ...receitas.map((r) => ({ ...r, tipo: "receber", neg: false, c: "Receita" })),
    ...despesas.map((d) => ({ ...d, tipo: "pagar", neg: true, c: "Despesa" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const lancamentos = lancamentosAll.filter((r) => {
    if (!dateFilter?.from || !dateFilter?.to) return true;
    const d = new Date(r.created_at).getTime();
    const to = new Date(dateFilter.to);
    to.setHours(23, 59, 59, 999);
    return d >= dateFilter.from.getTime() && d <= to.getTime();
  });

  const receitasFiltradas = receitas.filter((r) => {
    if (!dateFilter?.from || !dateFilter?.to) return true;
    const d = new Date(r.created_at).getTime();
    const to = new Date(dateFilter.to);
    to.setHours(23, 59, 59, 999);
    return d >= dateFilter.from.getTime() && d <= to.getTime();
  });

  const despesasFiltradas = despesas.filter((d) => {
    if (!dateFilter?.from || !dateFilter?.to) return true;
    const data = new Date(d.created_at).getTime();
    const to = new Date(dateFilter.to);
    to.setHours(23, 59, 59, 999);
    return data >= dateFilter.from.getTime() && data <= to.getTime();
  });

  // Calcular totais reais para os cards (somente os recebidos/pagos do período)
  const totalReceitas = receitasFiltradas
    .filter((r) => r.status === "Recebido")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalDespesas = despesasFiltradas
    .filter((d) => d.status === "Pago")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const lucro = totalReceitas - totalDespesas;
  // Caixa contínuo (o caixa atual não deveria ser filtrado por data, mas para efeito de exibição da variação, mantemos a base + lucro)
  // Mas o ideal para caixa atual é sempre o total histórico. Vamos calcular o total absoluto para o Caixa Atual.
  const totalAbsolutoReceitas = receitas
    .filter((r) => r.status === "Recebido")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalAbsolutoDespesas = despesas
    .filter((d) => d.status === "Pago")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const caixa = totalAbsolutoReceitas - totalAbsolutoDespesas;

  const pendenteReceber = receitasFiltradas
    .filter((r) => r.status === "Pendente")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const pendentePagar = despesasFiltradas
    .filter((d) => d.status === "Pendente")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);

  // Calcular dados do gráfico dividindo o período selecionado em 4 segmentos
  const rangeDiff =
    dateFilter?.to && dateFilter?.from
      ? dateFilter.to.getTime() - dateFilter.from.getTime()
      : 30 * 24 * 60 * 60 * 1000;
  const segmentDuration = Math.max(rangeDiff / 4, 24 * 60 * 60 * 1000); // Mínimo 1 dia por segmento
  const baseTime = dateFilter?.to ? dateFilter.to.getTime() : Date.now();

  const flow = Array.from({ length: 4 }).map((_, i) => {
    const end = new Date(baseTime - (3 - i) * segmentDuration);
    const start = new Date(end.getTime() - segmentDuration);

    const recSeg = receitas.filter(
      (r) => new Date(r.created_at) >= start && new Date(r.created_at) < end,
    );
    const desSeg = despesas.filter(
      (d) => new Date(d.created_at) >= start && new Date(d.created_at) < end,
    );

    return {
      d: `Per. ${i + 1}`,
      e: recSeg.reduce((sum, r) => sum + Number(r.valor), 0),
      s: desSeg.reduce((sum, d) => sum + Number(d.valor), 0),
    };
  });

  const renderDatePicker = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`justify-start text-left font-normal ${!dateFilter?.from ? "text-muted-foreground" : ""}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateFilter?.from ? (
            dateFilter.to ? (
              `${dateFilter.from.toLocaleDateString("pt-BR")} - ${dateFilter.to.toLocaleDateString("pt-BR")}`
            ) : (
              dateFilter.from.toLocaleDateString("pt-BR")
            )
          ) : (
            <span>Selecione um período</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateFilter?.from}
          selected={{ from: dateFilter?.from, to: dateFilter?.to }}
          onSelect={(range: any) => setDateFilter(range || { from: undefined, to: undefined })}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Caixa, fluxo, contas a pagar e a receber"
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            {renderDatePicker()}
            <Button
              variant="outline"
              className="text-success border-success/30 hover:bg-success/10"
              onClick={() => openLancamento("receita")}
            >
              <TrendingUp className="mr-2 h-4 w-4" /> Nova Receita
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => openLancamento("despesa")}
            >
              <TrendingDown className="mr-2 h-4 w-4" /> Nova Despesa
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          {
            l: "Caixa atual",
            v: `R$ ${caixa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            c: "text-primary",
            bg: "bg-primary/10",
            i: Wallet,
          },
          {
            l: "Total Recebido (Mês)",
            v: `R$ ${totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: `+ R$ ${pendenteReceber.toFixed(2)} previstos`,
            c: "text-success",
            bg: "bg-success/15",
            i: TrendingUp,
          },
          {
            l: "Total Pago (Mês)",
            v: `R$ ${totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: `+ R$ ${pendentePagar.toFixed(2)} previstos`,
            c: "text-destructive",
            bg: "bg-destructive/10",
            i: TrendingDown,
          },
          {
            l: "Lucro Líquido",
            v: `R$ ${lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            c: lucro >= 0 ? "text-info" : "text-destructive",
            bg: "bg-info/10",
            i: PiggyBank,
          },
        ].map((k) => (
          <Card key={k.l} className="shadow-card">
            <CardContent className="p-5">
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${k.bg}`}>
                <k.i className={`h-5 w-5 ${k.c}`} />
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">{k.l}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${k.c}`}>{k.v}</p>
              {k.sub && <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Fluxo de caixa</CardTitle>
            <CardDescription>Últimas 4 semanas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={flow}>
                <defs>
                  <linearGradient id="fe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="d"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$ ${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Area
                  type="monotone"
                  dataKey="e"
                  stroke="#22C55E"
                  strokeWidth={2.5}
                  fill="url(#fe)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Receitas × Despesas</CardTitle>
            <CardDescription>Evolução por semana</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="d"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$ ${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Bar dataKey="e" name="Receitas" fill="#22C55E" radius={[6, 6, 0, 0]} />
                <Bar dataKey="s" name="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card overflow-x-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Lançamentos</CardTitle>
          {renderDatePicker()}
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emissão</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : lancamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              lancamentos.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="font-medium">{r.descricao}</TableCell>
                  <TableCell>{new Date(r.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "Recebido" || r.status === "Pago"
                          ? "border-success text-success bg-success/10"
                          : "border-warning text-warning bg-warning/10"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${r.neg ? "text-destructive" : "text-success"}`}
                  >
                    {r.neg ? "-" : "+"} R${" "}
                    {Number(r.valor).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {r.status === "Pendente" && r.tipo === "receber" && (
                        <Button
                          onClick={async () => {
                            // Buscar cliente vinculado se existir
                            let cli = null;
                            if (r.cliente_id) {
                              const { data } = await supabase
                                .from("clientes")
                                .select("id, nome, cpf_cnpj, email, telefone, asaas_customer_id")
                                .eq("id", r.cliente_id)
                                .single();
                              cli = data;
                            }
                            setAsaasTarget({
                              cliente: cli || { id: "avulso", nome: r.descricao },
                              valor: Number(r.valor),
                              descricao: r.descricao,
                              vencimento: r.vencimento
                                ? r.vencimento.split("T")[0]
                                : new Date().toISOString().split("T")[0],
                              conta_receber_id: r.id,
                            });
                            setOpenAsaas(true);
                          }}
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                          title="Cobrar via ASAAS"
                        >
                          <Zap className="h-4 w-4" />
                        </Button>
                      )}
                      {r.status === "Pendente" && (
                        <Button
                          onClick={() => handleBaixa(r.id, r.tipo)}
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-primary"
                          title="Dar baixa"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => handleExcluir(r.id, r.tipo)}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tipoLancamento === "receita" ? "Nova Receita" : "Nova Despesa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Conta de Luz, Aluguel..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusLancamento} onValueChange={setStatusLancamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  {tipoLancamento === "receita" ? (
                    <SelectItem value="Recebido">Recebido (Pago ao sistema)</SelectItem>
                  ) : (
                    <SelectItem value="Pago">Pago (Despesa quitada)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarLancamento}
              disabled={salvando}
              className={
                tipoLancamento === "receita"
                  ? "bg-success hover:bg-success/90 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-white"
              }
            >
              {salvando ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal ASAAS */}
      {openAsaas && asaasTarget && (
        <AsaasCobrancaModal
          open={openAsaas}
          onClose={() => { setOpenAsaas(false); setAsaasTarget(null); }}
          cliente={asaasTarget.cliente}
          valor={asaasTarget.valor}
          descricao={asaasTarget.descricao}
          vencimentoSugerido={asaasTarget.vencimento}
          conta_receber_id={asaasTarget.conta_receber_id}
          onSuccess={() => fetchFinanceiro()}
        />
      )}
    </>
  );
}
