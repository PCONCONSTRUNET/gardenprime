import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Package,
  ShoppingCart,
  AlertTriangle,
  Users,
  Truck,
  TrendingUp,
  MoreHorizontal,
  ChevronRight,
  Leaf,
  Sprout,
  Blocks,
  Gem,
  Scissors,
  CloudSun,
  Bell,
  Calendar,
  AlertCircle,
  Clock,
  Wallet,
  Building,
  Tractor,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GARDEN PRIME ERP" }] }),
  component: Dashboard,
});

function AlertCard({ icon: Icon, value, label, tone = "warning" }: any) {
  const tones: Record<string, string> = {
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    success: "bg-success/10 text-success border-success/20",
    info: "bg-info/10 text-info border-info/20",
  };

  return (
    <div className="flex items-center gap-3 bg-card border rounded-lg px-4 py-3 shadow-sm">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            "text-lg font-bold leading-none",
            tone === "warning" ? "text-warning" : "text-destructive",
          )}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground mt-1 leading-tight">{label}</span>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, delta, up = true, tone = "primary" }: any) {
  const tones: Record<string, string> = {
    primary: "bg-primary text-primary-foreground",
    info: "bg-info text-info-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    terra: "bg-terra text-terra-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  };
  return (
    <Card className="shadow-sm border border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]} bg-opacity-90`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-0.5 font-display text-xl font-bold tracking-tight">{value}</p>
            </div>
          </div>
        </div>
        {delta && (
          <div className="mt-3 flex items-center text-xs font-medium bg-secondary/50 rounded p-1.5 w-fit">
            <span className={`flex items-center gap-1 ${up ? "text-success" : "text-destructive"}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta}
            </span>
            <span className="text-muted-foreground font-normal ml-1.5">
              {label.includes("Mês") ? "vs mês anterior" : "vs. ontem"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    faturamento: 0,
    pedidosHoje: 0,
    produtosEstoque: 0,
    clientesAtivos: 0,
    entregasPendentes: 0,
    recent: [] as any[],
    ticketMedio: 0,
    margemLiquida: 0,
    otif: 0,
    maisVendidos: [] as any[],
    mixCategorias: [] as any[],
    vendasVsCompras: [] as any[],
    vendasChartData: [] as any[],
    topVendedores: [] as any[],
    alertas: {
      estoqueCritico: 8,
      pedidosAguardando: 3,
      entregasAtrasadas: 5,
      contasVencidas: 4280,
    },
  });

  useEffect(() => {
    async function loadData() {
      const { data: vendasData } = await supabase
        .from("vendas")
        .select("*, vendas_itens(*, produto:produtos(nome, categoria)), clientes(nome), vendedor:vendedores(nome)")
        .in("tipo", ["VENDA", "PDV", "Afiliado"])
        .or("status_aprovacao.neq.Pendente,status_aprovacao.is.null");

      const { count: produtosCount } = await supabase
        .from("produtos")
        .select("*", { count: "exact", head: true })
        .eq("status", "Ativo");

      const { count: clientesCount } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true });

      const { data: receitasData } = await supabase
        .from("contas_receber")
        .select("valor, created_at")
        .eq("status", "Recebido");

      const { data: despesasData } = await supabase
        .from("contas_pagar")
        .select("valor, created_at")
        .eq("status", "Pago");
        
      const { data: alertasEstoqueCritico } = await supabase
        .from("produtos")
        .select("id")
        .lte("estoque", 5); // Assumindo <= 5 como crítico, ajuste se necessário

      let fat = 0;
      let pedHoje = 0;
      let entPend = 0;
      let pedAguardando = 0;
      let vendasValidasMes = 0;
      let entreguesMes = 0;
      let validVendasCount = 0;

      const hoje = new Date();
      const hojeStr = hoje.toISOString().split("T")[0];
      const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const produtoQtds: Record<string, number> = {};
      const catValores: Record<string, number> = {};
      const vendedoresMap: Record<string, { nome: string; val: number }> = {};
      
      const vendasPorDia: Record<string, { faturamento: number, pedidos: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        vendasPorDia[d.toISOString().split("T")[0]] = { faturamento: 0, pedidos: 0 };
      }

      vendasData?.forEach((v) => {
        const isValida =
          v.status !== "Cancelada" &&
          v.status !== "Rejeitada" &&
          v.status_aprovacao !== "Rejeitada";
        const dataVenda = new Date(v.created_at);
        const dataVendaStr = v.created_at.split("T")[0];

        if (isValida) {
          const valorVenda = Number(v.valor_total || v.total || 0);
          
          // Agrupamento para gráfico de 7 dias
          if (vendasPorDia[dataVendaStr] !== undefined) {
             vendasPorDia[dataVendaStr].faturamento += valorVenda;
             vendasPorDia[dataVendaStr].pedidos += 1;
          }
          
          if (dataVenda >= inicioMesAtual) {
            fat += valorVenda;
            validVendasCount++;
            vendasValidasMes++;
            if (v.status === "Entregue" || v.status === "Pago" || v.status === "Faturado") {
              entreguesMes++;
            }

            v.vendas_itens?.forEach((i: any) => {
              const pName = i.produto?.nome || "Avulso";
              const pCat = i.produto?.categoria || "Outros";
              const q = Number(i.quantidade || 1);
              const subt = Number(i.subtotal || i.valor_unitario * q || 0);

              produtoQtds[pName] = (produtoQtds[pName] || 0) + q;
              catValores[pCat] = (catValores[pCat] || 0) + subt;
            });
            
            // Agrupamento de Vendedores
            if (v.vendedor && v.vendedor.nome) {
               const vNome = v.vendedor.nome;
               if (!vendedoresMap[vNome]) vendedoresMap[vNome] = { nome: vNome, val: 0 };
               vendedoresMap[vNome].val += valorVenda;
            }
          }
        }
        if (v.created_at?.startsWith(hojeStr)) pedHoje++;
        if (v.status === "PENDENTE" || v.status === "Pendente" || v.status === "EM_ROTA") entPend++;
        if (v.status_aprovacao === "Pendente") pedAguardando++;
      });
      
      const topVendedores = Object.values(vendedoresMap)
        .sort((a, b) => b.val - a.val)
        .slice(0, 4)
        .map(v => ({
           name: v.nome,
           val: `R$ ${v.val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
           pct: fat > 0 ? ((v.val / fat) * 100).toFixed(0) : 0,
           max: fat
        }));

      const ticketMedio = validVendasCount > 0 ? fat / validVendasCount : 0;
      const otif = vendasValidasMes > 0 ? (entreguesMes / vendasValidasMes) * 100 : 0;

      const receitasMes =
        receitasData
          ?.filter((r) => new Date(r.created_at) >= inicioMesAtual)
          .reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
      const despesasMes =
        despesasData
          ?.filter((r) => new Date(r.created_at) >= inicioMesAtual)
          .reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
      const margemLiquida = receitasMes > 0 ? ((receitasMes - despesasMes) / receitasMes) * 100 : 0;

      const maisVendidos = Object.entries(produtoQtds)
        .map(([name, v]) => ({ name: name.substring(0, 15) + (name.length > 15 ? "..." : ""), v }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 5);

      const COLORS = ["#166534", "#EAB308", "#92400E", "#22C55E", "#84CC16", "#64748B"];
      
      // Corrigindo mix de categorias para evitar falhas de precisão e garantindo no máximo 6 cores
      const totalMix = Object.values(catValores).reduce((a, b) => a + b, 0);
      const mixCategorias = Object.entries(catValores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], idx) => ({ 
           name, 
           value: Number(((value / (totalMix || 1)) * 100).toFixed(1)), 
           fill: COLORS[idx % COLORS.length] 
        }));

      // Vendas Chart (Last 7 days real data)
      const vendasChartData = Object.entries(vendasPorDia).map(([dateStr, metrics]) => {
         const parts = dateStr.split("-");
         return {
            date: `${parts[2]}/${parts[1]}`, // DD/MM
            Faturamento: metrics.faturamento,
            Pedidos: metrics.pedidos
         }
      });

      // Comparativo 6 meses
      const vendasVsCompras = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        d.setHours(0,0,0,0);
        
        const nextM = new Date(d);
        nextM.setMonth(nextM.getMonth() + 1);
        
        const recM = receitasData?.filter(r => {
           const rDate = new Date(r.created_at);
           return rDate >= d && rDate < nextM;
        }).reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
        
        const despM = despesasData?.filter(r => {
           const rDate = new Date(r.created_at);
           return rDate >= d && rDate < nextM;
        }).reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

        vendasVsCompras.push({
          m: d.toLocaleString("pt-BR", { month: "short" }),
          Faturamento: recM,
          Despesas: despM,
        });
      }

      const vendasRecentes =
        vendasData
          ?.filter((v) => v.status !== "Cancelada" && v.status !== "Rejeitada")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5) || [];

      setStats((prev) => ({
        ...prev,
        faturamento: fat,
        pedidosHoje: pedHoje,
        produtosEstoque: produtosCount || 0,
        clientesAtivos: clientesCount || 0,
        entregasPendentes: entPend,
        recent: vendasRecentes,
        ticketMedio: ticketMedio,
        margemLiquida: margemLiquida,
        otif,
        maisVendidos: maisVendidos,
        mixCategorias: mixCategorias,
        vendasVsCompras,
        vendasChartData,
        topVendedores: [] as any[],
    alertas: {
           estoqueCritico: alertasEstoqueCritico?.length || 0,
           pedidosAguardando: pedAguardando,
           entregasAtrasadas: 0, // Necessário lógica de atraso
           contasVencidas: 0 // Necessário lógica de vencimento
        },
        topVendedores // Novo state property
      }));
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Brand Banner */}
      <div
        className="relative rounded-xl overflow-hidden shadow-md"
        style={{ background: "linear-gradient(90deg, #102a1b 0%, #1c4d32 50%, #2e7a3c 100%)" }}
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1466692476877-361ad362c956?q=80&w=2070&auto=format&fit=crop')] opacity-20 bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Logo Mock */}
            <div className="flex items-center justify-center p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M24 2C24 2 29.5 8 29.5 16C29.5 21.5 25 24 24 26C23 24 18.5 21.5 18.5 16C18.5 8 24 2 24 2Z"
                  fill="#EAB308"
                />
                <path
                  d="M24 46C24 46 36 36 36 24C36 17 31 15 29 16C31 20 29.5 25 24 30C18.5 25 17 20 19 16C17 15 12 17 12 24C12 36 24 46 24 46Z"
                  fill="#EAB308"
                  opacity="0.8"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200">
                GARDEN PRIME
              </h1>
              <p className="text-xs text-yellow-500/80 uppercase tracking-[0.2em] font-semibold mt-1">
                Terra Vegetal e Vasos
              </p>
            </div>
            <div className="hidden lg:block border-l border-white/20 pl-6 ml-4">
              <p className="text-white/80 text-lg font-light leading-snug">
                Mais que produtos,
                <br />
                <span className="text-white font-semibold">
                  soluções para o seu <span className="text-yellow-400">jardim.</span>
                </span>
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {[
              { icon: Leaf, label: "Terra Vegetal" },
              { icon: Sprout, label: "Substratos" },
              { icon: Blocks, label: "Vasos" },
              { icon: Gem, label: "Pedras" },
              { icon: Scissors, label: "Acessórios" },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="h-12 w-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-yellow-400 group-hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <item.icon className="h-6 w-6 stroke-[1.5]" />
                </div>
                <span className="text-[10px] text-white/70 font-medium whitespace-nowrap group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </div>
            ))}
            <div className="hidden xl:flex items-center gap-3 pl-6 border-l border-white/20">
              <CloudSun className="h-8 w-8 text-white/80 stroke-[1.5]" />
              <div className="text-white">
                <p className="text-sm font-semibold">23°C</p>
                <p className="text-[10px] text-white/70">Charqueada - SP</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={DollarSign}
          label="Faturamento hoje"
          value={`R$ ${stats.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          delta="18,4%"
          tone="terra"
        />
        <KPI
          icon={ShoppingCart}
          label="Pedidos hoje"
          value={stats.pedidosHoje.toString()}
          delta="12,5%"
          tone="primary"
        />
        <KPI
          icon={TrendingUp}
          label="Ticket médio"
          value={`R$ ${stats.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          delta="9,8%"
          tone="terra"
        />
        <KPI
          icon={AlertCircle}
          label="Margem líquida"
          value={`${stats.margemLiquida.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`}
          delta="9,2%"
          tone="primary"
        />
      </div>

      {/* Alertas Row */}
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Atenção!{" "}
              <span className="text-sm font-normal text-muted-foreground hidden sm:inline">
                Ações importantes para o seu dia:
              </span>
            </h3>
          </div>
          <Button variant="link" className="h-auto p-0 text-muted-foreground text-xs" asChild>
            <Link to="/app/relatorios">
              Ver todos <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AlertCard
            icon={Package}
            value={stats.alertas.estoqueCritico}
            label="produtos com estoque crítico"
            tone="warning"
          />
          <AlertCard
            icon={ShoppingCart}
            value={stats.alertas.pedidosAguardando}
            label="pedidos aguardando aprovação"
            tone="warning"
          />
          <AlertCard
            icon={Truck}
            value={stats.alertas.entregasAtrasadas}
            label="entregas atrasadas"
            tone="destructive"
          />
          <AlertCard
            icon={DollarSign}
            value={`R$ ${stats.alertas.contasVencidas.toLocaleString("pt-BR")}`}
            label="em contas vencidas"
            tone="warning"
          />
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vendas Chart */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">Vendas</CardTitle>
                <select className="text-xs bg-secondary/50 border-0 rounded px-2 py-1 text-muted-foreground focus:ring-0">
                  <option>Últimos 7 dias</option>
                  <option>Últimos 30 dias</option>
                </select>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={stats.vendasChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      stroke="#94a3b8"
                      tickFormatter={(v) => `${v / 1000}k`}
                    />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar
                      dataKey="Faturamento"
                      fill="#EAB308"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Faturamento
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div> Pedidos
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Vendas por Categoria */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-base font-semibold">Vendas por categoria</CardTitle>
                <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                  Ver todos
                </Button>
              </CardHeader>
              <CardContent className="flex items-center justify-between mt-2">
                <div className="w-1/2 relative flex justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={stats.mixCategorias}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {stats.mixCategorias.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "8px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold text-foreground">R$ 12.450</span>
                    <span className="text-[10px] text-muted-foreground">Hoje</span>
                  </div>
                </div>
                <div className="w-1/2 pl-4 space-y-2">
                  {stats.mixCategorias.map((c: any) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c.fill }}
                        ></span>
                        {c.name}
                      </span>
                      <span className="font-semibold text-foreground">{c.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estoque */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-terra" /> Estoque
              </CardTitle>
              <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-success/20 text-success">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-success">824</p>
                    <p className="text-xs text-success/80">Produtos normais</p>
                  </div>
                </div>
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-warning/20 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-warning">32</p>
                    <p className="text-xs text-warning/80">Estoque baixo</p>
                  </div>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-destructive/20 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-destructive">8</p>
                    <p className="text-xs text-destructive/80">Estoque crítico</p>
                  </div>
                </div>
                <div className="bg-info/5 border border-info/20 rounded-lg p-3 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-info/20 text-info">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-info">14</p>
                    <p className="text-xs text-info/80">Sem movimentação</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendedores & Desempenho (2 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vendedores */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-terra" /> Vendedores{" "}
                  <span className="text-xs font-normal text-muted-foreground ml-1">(hoje)</span>
                </CardTitle>
                <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                  Ver todos
                </Button>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-4">
                  <div className="flex text-xs text-muted-foreground border-b pb-1">
                    <span className="flex-1">Vendedor</span>
                    <span>Valor em vendas</span>
                  </div>
                  {stats.topVendedores?.map((v: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-xs font-medium text-muted-foreground shrink-0">
                        {v.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{v.name}</p>
                        <div className="h-1.5 w-full bg-secondary rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-terra"
                            style={{ width: `${(v.pct / 30) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{v.val}</p>
                        <p className="text-[10px] text-muted-foreground">({v.pct}%)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Desempenho financeiro */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  Desempenho financeiro
                </CardTitle>
                <select className="text-xs bg-secondary/50 border-0 rounded px-2 py-1 text-muted-foreground focus:ring-0">
                  <option>Últimos 6 meses</option>
                </select>
              </CardHeader>
              <CardContent className="flex flex-1 mt-4">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.vendasVsCompras} margin={{ left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="m"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                        tickFormatter={(v) => `${v / 1000}k`}
                      />
                      <Tooltip cursor={{ fill: "transparent" }} />
                      <Bar
                        dataKey="Faturamento"
                        fill="#166534"
                        radius={[2, 2, 0, 0]}
                        barSize={12}
                      />
                      <Bar dataKey="Despesas" fill="#EAB308" radius={[2, 2, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-[120px] pl-4 flex flex-col justify-center space-y-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Faturamento (6 meses)
                    </p>
                    <p className="text-sm font-bold">R$ {stats.vendasVsCompras.reduce((acc, curr) => acc + curr.Faturamento, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Média mensal</p>
                    <p className="text-sm font-bold">R$ {(stats.vendasVsCompras.reduce((acc, curr) => acc + curr.Faturamento, 0) / (stats.vendasVsCompras.length || 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Impostos estimados (6%)</p>
                    <p className="text-sm font-bold">R$ {((stats.vendasVsCompras.reduce((acc, curr) => acc + curr.Faturamento, 0) / (stats.vendasVsCompras.length || 1)) * 0.06).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

{/* Ocultado por falta de integração real - Produção e logística */}
{/*
          {/* Produção e Logística }
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Produção e logística</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary/30 rounded-lg p-3 text-center border">
                  <Package className="h-5 w-5 mx-auto text-primary mb-2" />
                  <p className="text-xl font-bold text-primary">600</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Pacotes por caminhão (25kg)
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center border">
                  <Truck className="h-5 w-5 mx-auto text-primary mb-2" />
                  <p className="text-xl font-bold text-primary">3</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Caminhões em rota
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center border">
                  <Tractor className="h-5 w-5 mx-auto text-primary mb-2" />
                  <p className="text-xl font-bold text-primary">1</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Carregadeira Volvo L90C
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center border">
                  <Users className="h-5 w-5 mx-auto text-primary mb-2" />
                  <p className="text-xl font-bold text-primary">80</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Clientes ativos diários
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
*/}
        </div>

        {/* RIGHT COLUMN (span 1) */}
        <div className="space-y-6">
          {/* Central de Atenção */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5 text-terra" /> Central de atenção
              </CardTitle>
              <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                Ver todas
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[
                  {
                    icon: ShoppingCart,
                    text: "Pedidos aguardando aprovação",
                    count: stats.alertas.pedidosAguardando,
                    tone: "text-warning bg-warning/10",
                  },
                  {
                    icon: Truck,
                    text: "Entregas atrasadas",
                    count: stats.alertas.entregasAtrasadas,
                    tone: "text-destructive bg-destructive/10",
                  },
                  {
                    icon: AlertTriangle,
                    text: "Estoque crítico",
                    count: stats.alertas.estoqueCritico,
                    tone: "text-destructive bg-destructive/10",
                  },
                  {
                    icon: DollarSign,
                    text: "Contas vencidas",
                    count: stats.alertas.contasVencidas,
                    tone: "text-destructive bg-destructive/10",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${item.tone}`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.text}</span>
                    </div>
                    <span
                      className={`font-bold ${item.tone.includes("destructive") ? "text-destructive" : "text-warning"}`}
                    >
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pedidos Recentes */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-terra" /> Pedidos recentes
              </CardTitle>
              <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                Ver todos
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="font-normal py-2 px-4">Nº Pedido</th>
                    <th className="font-normal py-2 px-1">Cliente</th>
                    <th className="font-normal py-2 px-1 text-center">Status</th>
                    <th className="font-normal py-2 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.recent.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted-foreground">
                        Nenhum pedido recente.
                      </td>
                    </tr>
                  ) : (
                    stats.recent.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="py-2.5 px-4 text-muted-foreground">
                          #{r.numero_venda || r.id?.slice(0, 4)}
                        </td>
                        <td className="py-2.5 px-1 font-medium truncate max-w-[100px]">
                          {r.clientes?.nome || "Cliente"}
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 uppercase",
                              r.status === "Entregue"
                                ? "bg-success/10 text-success border-success/20"
                                : r.status === "Pendente"
                                  ? "bg-warning/10 text-warning border-warning/20"
                                  : "bg-info/10 text-info border-info/20",
                            )}
                          >
                            {r.status || "Em rota"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-foreground">
                          R$ {Number(r.valor_total || r.total || 0).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Produtos mais vendidos */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-terra" /> Produtos mais vendidos
              </CardTitle>
              <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                Ver todos
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="font-normal py-2 px-4">Produto</th>
                    <th className="font-normal py-2 px-1 text-center">Qtd.</th>
                    <th className="font-normal py-2 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.maisVendidos.map((p, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      <td className="py-2.5 px-4 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-secondary shrink-0 border grid place-items-center">
                          <Package className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-[9px] text-muted-foreground">Cód. {1000 + idx}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-1 text-center font-medium">{p.v}</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        R$ {(p.v * 20.5).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Small Promo Banner */}
          <div
            className="rounded-xl overflow-hidden relative shadow-sm"
            style={{ background: "linear-gradient(135deg, #166534 0%, #1e402a 100%)" }}
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1466692476877-361ad362c956?q=80&w=600&auto=format&fit=crop')] opacity-20 bg-cover bg-center mix-blend-overlay"></div>
            <div className="p-6 relative z-10 flex flex-col items-center text-center">
              <p className="text-xl font-display font-semibold text-white/90 leading-tight">
                Juntos cultivamos resultados!
              </p>
              <div className="mt-4 opacity-80 scale-75">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M24 2C24 2 29.5 8 29.5 16C29.5 21.5 25 24 24 26C23 24 18.5 21.5 18.5 16C18.5 8 24 2 24 2Z"
                    fill="#EAB308"
                  />
                  <path
                    d="M24 46C24 46 36 36 36 24C36 17 31 15 29 16C31 20 29.5 25 24 30C18.5 25 17 20 19 16C17 15 12 17 12 24C12 36 24 46 24 46Z"
                    fill="#EAB308"
                    opacity="0.8"
                  />
                </svg>
              </div>
              <p className="text-[9px] text-white/50 mt-4 uppercase tracking-widest font-bold">
                Garden Prime
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
