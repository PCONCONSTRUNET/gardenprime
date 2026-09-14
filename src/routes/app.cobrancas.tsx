import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Zap,
  Banknote,
  CreditCard,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cancelarCobrancaAsaas, ASAAS_STATUS_LABEL, ASAAS_TIPO_LABEL } from "@/lib/asaas";
import { useConfirm } from "@/contexts/ConfirmContext";

export const Route = createFileRoute("/app/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças ASAAS — GARDEN PRIME ERP" }] }),
  component: CobrancasAsaas,
});

function CobrancasAsaas() {
  const confirm = useConfirm();
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCobrancas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("asaas_cobrancas")
        .select(`*, clientes(nome, cpf_cnpj), vendas(numero_venda)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCobrancas(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCobrancas();
  }, [fetchCobrancas]);

  const handleCancelar = async (cobranca: any) => {
    if (
      !(await confirm({
        description: `Deseja cancelar esta cobrança de ${cobranca.tipo} no valor de R$ ${Number(cobranca.valor).toFixed(2)}?`,
        variant: "destructive",
      }))
    )
      return;
    try {
      await cancelarCobrancaAsaas(cobranca.asaas_id);
      fetchCobrancas();
    } catch (err: any) {
      alert("Erro ao cancelar: " + err.message);
    }
  };

  const handleCopiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtradas = cobrancas.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.clientes?.nome || "").toLowerCase().includes(q) ||
      (c.asaas_id || "").toLowerCase().includes(q) ||
      (c.tipo || "").toLowerCase().includes(q) ||
      (c.status || "").toLowerCase().includes(q)
    );
  });

  // Totais
  const totalPendente = cobrancas
    .filter((c) => c.status === "PENDING")
    .reduce((s, c) => s + Number(c.valor), 0);
  const totalRecebido = cobrancas
    .filter((c) => c.status === "RECEIVED" || c.status === "CONFIRMED")
    .reduce((s, c) => s + Number(c.valor), 0);
  const totalVencido = cobrancas
    .filter((c) => c.status === "OVERDUE")
    .reduce((s, c) => s + Number(c.valor), 0);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusBadgeClass = (status: string) => {
    if (status === "RECEIVED" || status === "CONFIRMED")
      return "border-success text-success bg-success/10";
    if (status === "PENDING") return "border-warning text-warning bg-warning/10";
    if (status === "OVERDUE") return "border-destructive text-destructive bg-destructive/10";
    return "border-muted-foreground text-muted-foreground bg-muted/10";
  };

  const tipoBadgeContent = (tipo: string) => {
    if (tipo === "PIX") return <><Zap className="h-3 w-3" /> PIX</>;
    if (tipo === "BOLETO") return <><Banknote className="h-3 w-3" /> Boleto</>;
    if (tipo === "CREDIT_CARD") return <><CreditCard className="h-3 w-3" /> Cartão</>;
    return <>Multi-meios</>;
  };

  return (
    <>
      <PageHeader
        title="Cobranças ASAAS"
        subtitle="Boletos, PIX e cartões gerados pelo sistema"
        actions={
          <Button variant="outline" onClick={fetchCobrancas} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {[
          {
            label: "Pendentes",
            value: fmt(totalPendente),
            icon: Clock,
            c: "text-warning",
            bg: "bg-warning/10",
          },
          {
            label: "Recebidos",
            value: fmt(totalRecebido),
            icon: CheckCircle2,
            c: "text-success",
            bg: "bg-success/10",
          },
          {
            label: "Vencidos",
            value: fmt(totalVencido),
            icon: AlertTriangle,
            c: "text-destructive",
            bg: "bg-destructive/10",
          },
        ].map((k) => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="p-5">
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${k.bg}`}>
                <k.icon className={`h-5 w-5 ${k.c}`} />
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">{k.label}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${k.c}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Busca */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, tipo, status..."
            className="pl-8 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabela */}
      <Card className="shadow-card overflow-x-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Cobranças ({filtradas.length})
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando cobranças...
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma cobrança encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {c.clientes?.nome || "—"}
                    {c.vendas?.numero_venda && (
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        Venda #{c.vendas.numero_venda}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 w-fit text-xs"
                    >
                      {tipoBadgeContent(c.tipo)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.vencimento
                      ? new Date(c.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(c.status)}>
                      {ASAAS_STATUS_LABEL[c.status]?.label || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(Number(c.valor))}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* PIX Copia e Cola */}
                      {c.tipo === "PIX" && c.pix_copia_cola && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Copiar PIX Copia e Cola"
                          onClick={() => handleCopiar(c.pix_copia_cola, c.id + "-pix")}
                        >
                          {copied === c.id + "-pix" ? (
                            <CheckCheck className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Zap className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </Button>
                      )}

                      {/* Link Boleto */}
                      {c.link_boleto && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Abrir Boleto"
                          onClick={() => window.open(c.link_boleto, "_blank")}
                        >
                          <Banknote className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                      )}

                      {/* Invoice URL */}
                      {c.invoice_url && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Abrir Link de Pagamento"
                          onClick={() => window.open(c.invoice_url, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Copiar Link */}
                      {c.invoice_url && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Copiar link"
                          onClick={() => handleCopiar(c.invoice_url, c.id + "-link")}
                        >
                          {copied === c.id + "-link" ? (
                            <CheckCheck className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}

                      {/* Cancelar (só pendentes) */}
                      {c.status === "PENDING" && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                          title="Cancelar Cobrança"
                          onClick={() => handleCancelar(c)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
