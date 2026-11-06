import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, MapPin, Clock, CheckCircle2, FileText, Trash2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";

export const Route = createFileRoute("/app/logistica")({
  head: () => ({ meta: [{ title: "Logística — GARDEN PRIME ERP" }] }),
  component: Logistica,
});

function Logistica() {
  const confirm = useConfirm();
  const [vendas, setVendas] = useState<any[]>([]);
  const [rotasReais, setRotasReais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Rota
  const [openNovaRota, setOpenNovaRota] = useState(false);
  const [openRelatorio, setOpenRelatorio] = useState(false);
  const [motoristaRota, setMotoristaRota] = useState("");
  const [veiculoRota, setVeiculoRota] = useState("");
  const [pedidosSelecionados, setPedidosSelecionados] = useState<string[]>([]);

  const fetchRotas = async () => {
    try {
      const { data } = await supabase
        .from("rotas")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setRotasReais(data);
    } catch (e) {
      // Ignora se a tabela não existir ainda
    }
  };

  const fetchVendas = async () => {
    try {
      const { data } = await supabase
        .from("vendas")
        .select("*, clientes(nome, cidade)")
        .eq("tipo", "VENDA")
        .order("created_at", { ascending: false });
      if (data) {
        setVendas(data);
      } else {
        setVendas([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendas();
    fetchRotas();
  }, []);

  const handleNovaRota = async () => {
    if (!motoristaRota || !veiculoRota || pedidosSelecionados.length === 0) {
      alert("Preencha motorista, veículo e selecione pelo menos um pedido.");
      return;
    }

    try {
      const { data: novaRota, error: erroRota } = await supabase
        .from("rotas")
        .insert([{ motorista: motoristaRota, veiculo: veiculoRota }])
        .select()
        .single();
      if (pedidosSelecionados.length > 0) {
        const { error: errVendas } = await supabase
          .from("vendas")
          .update({ rota_id: novaRota.id, status: "Em Transporte" })
          .in("id", pedidosSelecionados);

        if (errVendas) {
          console.error("Erro Vendas:", errVendas);
          throw new Error("Erro ao vincular pedidos.");
        }
      }

      setOpenNovaRota(false);
      setMotoristaRota("");
      setVeiculoRota("");
      setPedidosSelecionados([]);
      if (pedidosSelecionados.length > 0) fetchVendas();
      fetchRotas();
    } catch (err) {
      console.error(err);
      alert(
        "Atenção: Ocorreu um erro ao criar a rota. Se for o primeiro uso, verifique o console.",
      );
    }
  };

  const handleExcluirRota = async (id: string) => {
    if (
      !(await confirm(
        "Tem certeza que deseja excluir esta rota? Os pedidos voltarão para pendentes.",
      ))
    )
      return;
    try {
      await supabase.from("vendas").update({ rota_id: null, status: "PENDENTE" }).eq("rota_id", id);
      await supabase.from("rotas").delete().eq("id", id);
      fetchRotas();
      fetchVendas();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEntregar = async (id: string) => {
    if (!(await confirm("Confirmar entrega deste pedido?"))) return;
    try {
      await supabase.from("vendas").update({ status: "Entregue" }).eq("id", id);
      fetchVendas();
    } catch (err) {
      alert("Erro ao atualizar status.");
    }
  };

  const handleEmRota = async (id: string) => {
    try {
      await supabase.from("vendas").update({ status: "Em Transporte" }).eq("id", id);
      fetchVendas();
    } catch (err) {
      alert("Erro ao atualizar status.");
    }
  };

  const handleExcluir = async (id: string) => {
    if (
      !(await confirm({
        description:
          "Tem certeza que deseja excluir este pedido? Essa ação apagará a venda do sistema.",
        variant: "destructive",
      }))
    )
      return;
    try {
      await supabase.from("vendas").delete().eq("id", id);
      fetchVendas();
    } catch (err) {
      alert("Erro ao excluir pedido.");
    }
  };

  const pendingVendas = vendas.filter((v) => v.status !== "Entregue");
  const pending = vendas.filter((v) => v.status === "Pendente" || v.status === "PENDENTE").length;
  const inTransit = vendas.filter(
    (v) => v.status === "Em Transporte" || v.status === "EM_ROTA",
  ).length;
  const delivered = vendas.filter((v) => v.status === "Entregue").length;

  const cityCounts: Record<string, number> = {};
  pendingVendas.forEach((v) => {
    const cidade = v.clientes?.cidade || "Sem Cidade";
    const uf = v.clientes?.uf ? `/${v.clientes.uf}` : "";
    const label = `${cidade}${uf}`;
    cityCounts[label] = (cityCounts[label] || 0) + 1;
  });

  const mapSlots = [
    { x: "30%", y: "55%" },
    { x: "60%", y: "40%" },
    { x: "40%", y: "25%" },
    { x: "75%", y: "65%" },
    { x: "20%", y: "35%" },
    { x: "85%", y: "30%" },
    { x: "50%", y: "75%" },
    { x: "15%", y: "70%" },
  ];

  const dynamicCities = Object.entries(cityCounts).map(([cidade, count], index) => {
    const slot = mapSlots[index % mapSlots.length];
    return { c: cidade, q: count, x: slot.x, y: slot.y };
  });

  const cityRoutes: Record<string, { total: number; delivered: number }> = {};
  vendas.forEach((v) => {
    const cidade = v.clientes?.cidade || "Diversas";
    if (!cityRoutes[cidade]) cityRoutes[cidade] = { total: 0, delivered: 0 };
    cityRoutes[cidade].total += 1;
    if (v.status === "Entregue") cityRoutes[cidade].delivered += 1;
  });

  const dynamicRoutes = Object.entries(cityRoutes)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cidade, counts], i) => ({
      v: `Veículo ${String(i + 1).padStart(2, "0")} — Rota ${cidade}`,
      m: "Motorista Parceiro",
      e: counts.total,
      ok: counts.delivered,
      st: counts.delivered === counts.total ? "Concluída" : "Em rota",
      cor: counts.delivered === counts.total ? "success" : "info",
    }));

  const displayRoutes =
    rotasReais.length > 0
      ? rotasReais.map((r) => {
          const rVendas = vendas.filter((v) => v.rota_id === r.id);
          const total = rVendas.length || 1;
          const delivered = rVendas.filter((v) => v.status === "Entregue").length;
          return {
            v: `${r.veiculo}`,
            m: r.motorista,
            e: rVendas.length,
            ok: delivered,
            st: delivered > 0 && delivered === total ? "Concluída" : "Em rota",
            cor: delivered > 0 && delivered === total ? "success" : "info",
          };
        })
      : dynamicRoutes;

  const tones: Record<string, string> = {
    info: "bg-info/15 text-info border-0",
    success: "bg-success/15 text-success border-0",
    warning: "bg-warning/15 text-warning border-0",
  };

  return (
    <>
      <PageHeader
        title="Logística"
        subtitle="Frota, rotas e entregas"
        actions={
          <div className="flex gap-2">
            <Dialog open={openRelatorio} onOpenChange={setOpenRelatorio}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-background text-foreground hover:bg-accent">
                  <FileText className="mr-2 h-4 w-4" /> Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Relatório de Rotas de Entrega</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4 overflow-hidden">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border rounded-lg p-3 bg-card shadow-sm">
                      <p className="text-sm text-muted-foreground font-medium">Total de Rotas</p>
                      <p className="text-2xl font-bold">{rotasReais.length}</p>
                    </div>
                    <div className="border rounded-lg p-3 bg-info/10 border-info/20 shadow-sm">
                      <p className="text-sm text-info font-medium">Rotas Ativas</p>
                      <p className="text-2xl font-bold text-info">
                        {
                          rotasReais.filter((r) =>
                            vendas.some((v) => v.rota_id === r.id && v.status !== "Entregue"),
                          ).length
                        }
                      </p>
                    </div>
                    <div className="border rounded-lg p-3 bg-success/10 border-success/20 shadow-sm">
                      <p className="text-sm text-success font-medium">Rotas Concluídas</p>
                      <p className="text-2xl font-bold text-success">
                        {
                          rotasReais.filter(
                            (r) =>
                              vendas.some((v) => v.rota_id === r.id) &&
                              vendas.every((v) => v.rota_id !== r.id || v.status === "Entregue"),
                          ).length
                        }
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-md flex-1 overflow-hidden">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader className="bg-secondary/50 sticky top-0">
                          <TableRow>
                            <TableHead>Motorista</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Progresso</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rotasReais.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center text-muted-foreground py-8"
                              >
                                Nenhuma rota registrada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rotasReais.map((rota) => {
                              const pedidosDaRota = vendas.filter((v) => v.rota_id === rota.id);
                              const totalPedidos = pedidosDaRota.length;
                              const entregues = pedidosDaRota.filter(
                                (v) => v.status === "Entregue",
                              ).length;
                              const dataSaida = rota.created_at
                                ? new Date(rota.created_at).toLocaleDateString("pt-BR")
                                : "-";

                              return (
                                <TableRow key={rota.id}>
                                  <TableCell className="font-medium">{rota.motorista}</TableCell>
                                  <TableCell>{rota.veiculo}</TableCell>
                                  <TableCell>{dataSaida}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-success"
                                          style={{
                                            width:
                                              totalPedidos > 0
                                                ? `${(entregues / totalPedidos) * 100}%`
                                                : "0%",
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {entregues}/{totalPedidos}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleExcluirRota(rota.id)}
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={openNovaRota} onOpenChange={setOpenNovaRota}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-brand text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" /> Nova rota
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Montar Romaneio de Carga</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Motorista responsável</Label>
                      <Input
                        value={motoristaRota}
                        onChange={(e) => setMotoristaRota(e.target.value)}
                        placeholder="Ex: João Souza"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Veículo</Label>
                      <Input
                        value={veiculoRota}
                        onChange={(e) => setVeiculoRota(e.target.value)}
                        placeholder="Ex: VW Delivery (ABC-1234)"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Pedidos Disponíveis para Rota</Label>
                    <div className="border rounded-md max-h-[200px] overflow-y-auto p-2 space-y-2">
                      {vendas.filter(
                        (v) =>
                          v.status !== "Entregue" && v.status !== "Em Transporte" && !v.rota_id,
                      ).length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">
                          Nenhum pedido pendente sem rota atribuída.
                        </p>
                      ) : (
                        vendas
                          .filter(
                            (v) =>
                              v.status !== "Entregue" && v.status !== "Em Transporte" && !v.rota_id,
                          )
                          .map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center space-x-2 bg-secondary/50 p-2 rounded"
                            >
                              <Checkbox
                                id={`chk-${v.id}`}
                                checked={pedidosSelecionados.includes(v.id)}
                                onCheckedChange={(checked) => {
                                  if (checked)
                                    setPedidosSelecionados([...pedidosSelecionados, v.id]);
                                  else
                                    setPedidosSelecionados(
                                      pedidosSelecionados.filter((id) => id !== v.id),
                                    );
                                }}
                              />
                              <label
                                htmlFor={`chk-${v.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {v.clientes?.nome} - {v.clientes?.cidade}
                              </label>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setOpenNovaRota(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="bg-gradient-brand text-primary-foreground"
                    onClick={handleNovaRota}
                  >
                    Criar Rota
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        {[
          { l: "Entregas do dia", v: String(vendas.length), i: Truck, c: "text-primary" },
          { l: "Concluídas", v: String(delivered), i: CheckCircle2, c: "text-success" },
          { l: "Em rota", v: String(inTransit), i: Clock, c: "text-info" },
          { l: "Pendentes", v: String(pending), i: MapPin, c: "text-warning" },
        ].map((k) => (
          <Card key={k.l} className="shadow-card">
            <CardContent className="p-5 flex items-center gap-4">
              <k.i className={`h-8 w-8 ${k.c}`} />
              <div>
                <p className="text-sm text-muted-foreground">{k.l}</p>
                <p className={`font-display text-2xl font-bold ${k.c}`}>{k.v}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2 shadow-card overflow-hidden">
          <CardHeader>
            <CardTitle>Mapa de entregas (Visão Geral)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-[250px] rounded-xl border bg-gradient-to-br from-accent/40 to-secondary overflow-hidden">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-30">
                <path
                  d="M10 40 Q 25 30, 40 45 T 70 38 Q 85 30, 95 50"
                  stroke="#166534"
                  strokeWidth="0.3"
                  fill="none"
                />
                <path
                  d="M15 70 Q 35 55, 55 65 T 90 60"
                  stroke="#22C55E"
                  strokeWidth="0.3"
                  fill="none"
                />
                <path
                  d="M5 25 Q 30 15, 50 30 T 95 20"
                  stroke="#92400E"
                  strokeWidth="0.3"
                  fill="none"
                />
              </svg>
              {dynamicCities.map((c) => (
                <div
                  key={c.c}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: c.x, top: c.y }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 animate-ping" />
                    <div className="relative h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-brand text-primary-foreground grid place-items-center text-xs font-bold shadow-elevated">
                      {c.q}
                    </div>
                  </div>
                  <div className="absolute left-5 -top-2 whitespace-nowrap rounded-md bg-card border px-2 py-0.5 text-xs font-semibold shadow-card">
                    {c.c}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Rotas do dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto max-h-[250px] pr-2">
            {displayRoutes.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-4">
                Nenhuma rota ativa no momento.
              </div>
            ) : (
              displayRoutes.map((r, i) => (
                <div key={r.v + i} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-sm truncate">{r.v}</p>
                      <p className="text-xs text-muted-foreground">Motorista: {r.m}</p>
                    </div>
                    <Badge className={tones[r.cor]}>{r.st}</Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-semibold">
                        {r.ok}/{r.e}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-gradient-brand transition-all duration-500"
                        style={{ width: `${(r.ok / r.e) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card overflow-x-auto">
        <CardHeader>
          <CardTitle>Pedidos para Entrega</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Carregando entregas...
                </TableCell>
              </TableRow>
            ) : vendas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  Nenhum pedido de venda encontrado.
                </TableCell>
              </TableRow>
            ) : (
              vendas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                  <TableCell className="font-semibold">
                    {v.clientes?.nome || "Cliente não informado"}
                  </TableCell>
                  <TableCell>{v.clientes?.cidade || "Endereço não cadastrado"}</TableCell>
                  <TableCell>
                    {(() => {
                      let badgeText = "Pendente";
                      let badgeColor = "border-warning text-warning";

                      if (v.status === "Entregue") {
                        badgeText = "Concluída";
                        badgeColor =
                          "border-success text-success bg-success/10 hover:bg-success/20";
                      } else if (v.status === "Em Transporte") {
                        badgeText = v.rota_id ? "Em Rota (Veículo)" : "Em Rota";
                        badgeColor = v.rota_id
                          ? "border-indigo-500 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                          : "border-info text-info bg-info/10 hover:bg-info/20";
                      }

                      const badgeElement = (
                        <Badge
                          variant="outline"
                          className={`transition-colors ${v.status !== "Pendente" ? "cursor-pointer" : ""} ${badgeColor}`}
                        >
                          {badgeText}
                        </Badge>
                      );

                      if (v.status === "Pendente") return badgeElement;

                      return (
                        <Popover>
                          <PopoverTrigger asChild>{badgeElement}</PopoverTrigger>
                          <PopoverContent className="w-64 p-3 shadow-elevated" side="top">
                            {(() => {
                              if (!v.rota_id) {
                                return (
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm border-b pb-1">
                                      Despacho Simplificado
                                    </h4>
                                    <div className="text-sm space-y-1">
                                      <p>
                                        <span className="text-muted-foreground font-medium">
                                          Motorista:
                                        </span>{" "}
                                        Padrão (Sem Romaneio)
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground font-medium">
                                          Veículo:
                                        </span>{" "}
                                        Frota Padrão
                                      </p>
                                      {v.status === "Entregue" && (
                                        <p className="text-success font-semibold mt-2 text-xs flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> Pacote entregue ao
                                          cliente.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              const rotaInfo = rotasReais.find((r) => r.id === v.rota_id);
                              if (!rotaInfo)
                                return (
                                  <p className="text-sm text-muted-foreground">
                                    Buscando informações do veículo...
                                  </p>
                                );

                              const horarioSaida = rotaInfo.created_at
                                ? new Date(rotaInfo.created_at).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Agora";

                              return (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm border-b pb-1">
                                    Detalhes do Romaneio
                                  </h4>
                                  <div className="text-sm space-y-1">
                                    <p>
                                      <span className="text-muted-foreground font-medium">
                                        Motorista:
                                      </span>{" "}
                                      {rotaInfo.motorista}
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground font-medium">
                                        Veículo:
                                      </span>{" "}
                                      {rotaInfo.veiculo}
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground font-medium">
                                        Horário de Saída:
                                      </span>{" "}
                                      {horarioSaida}
                                    </p>
                                    {v.status === "Entregue" && (
                                      <p className="text-success font-semibold mt-2 text-xs flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Pacote entregue ao
                                        cliente.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button asChild size="sm" variant="outline" className="text-slate-600">
                        <a href={`/declaracao/${v.numero_venda || v.id}`} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" /> Etiqueta
                        </a>
                      </Button>
                      {v.status !== "Entregue" ? (
                        <>
                          {v.status !== "Em Transporte" && (
                            <Button
                              onClick={() => handleEmRota(v.id)}
                              size="sm"
                              variant="outline"
                              className="text-info hover:bg-info/10"
                            >
                              <Truck className="h-4 w-4 mr-2" /> Em Rota
                            </Button>
                          )}
                          <Button
                            onClick={() => handleEntregar(v.id)}
                            size="sm"
                            variant="outline"
                            className="text-primary hover:bg-primary/10"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Entregue
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm font-semibold ml-2">
                          Realizada
                        </span>
                      )}
                      <Button
                        onClick={() => handleExcluir(v.id)}
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 ml-1 text-destructive"
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
    </>
  );
}
