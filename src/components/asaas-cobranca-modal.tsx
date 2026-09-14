import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  Zap,
  CreditCard,
  Copy,
  CheckCheck,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  criarCobrancaAsaas,
  inferirBillingType,
  type AsaasBillingType,
} from "@/lib/asaas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AsaasCobrancaModalProps {
  open: boolean;
  onClose: () => void;
  cliente: {
    id: string;
    nome: string;
    cpf_cnpj?: string;
    email?: string;
    telefone?: string;
    asaas_customer_id?: string;
  } | null;
  valor: number;
  descricao?: string;
  vencimentoSugerido?: string; // YYYY-MM-DD
  metodoPagamentoSugerido?: string;
  venda_id?: string;
  conta_receber_id?: string;
  onSuccess?: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function AsaasCobrancaModal({
  open,
  onClose,
  cliente,
  valor,
  descricao,
  vencimentoSugerido,
  metodoPagamentoSugerido,
  venda_id,
  conta_receber_id,
  onSuccess,
}: AsaasCobrancaModalProps) {
  const hoje = new Date().toISOString().split("T")[0];

  const [tipo, setTipo] = useState<AsaasBillingType>(
    inferirBillingType(metodoPagamentoSugerido)
  );
  const [vencimento, setVencimento] = useState(vencimentoSugerido || hoje);
  const [parcelas, setParcelas] = useState("1");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Resultado após criação
  const [resultado, setResultado] = useState<null | {
    tipo: AsaasBillingType;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    pixCopiaECola?: string;
    pixImagemUrl?: string;
    status: string;
  }>(null);

  const [copied, setCopied] = useState(false);

  const handleCriar = async () => {
    if (!cliente) return;
    setErro(null);
    setLoading(true);
    try {
      const nParcelas = parseInt(parcelas) || 1;
      const response = await criarCobrancaAsaas({
        cliente,
        valor,
        vencimento,
        descricao: descricao || `Cobrança Garden Prime`,
        tipo,
        venda_id,
        conta_receber_id,
        installmentCount: nParcelas > 1 ? nParcelas : undefined,
      });

      setResultado({
        tipo,
        invoiceUrl: response.invoiceUrl,
        bankSlipUrl: response.bankSlipUrl,
        pixCopiaECola: response.pixQrCode?.payload,
        pixImagemUrl: response.pixQrCode?.encodedImage
          ? `data:image/png;base64,${response.pixQrCode.encodedImage}`
          : undefined,
        status: response.status,
      });

      onSuccess?.();
    } catch (err: any) {
      setErro(err.message || "Erro ao criar cobrança.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setResultado(null);
    setErro(null);
    setLoading(false);
    onClose();
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── Tela de Resultado ──────────────────────────────────────────────────────

  if (resultado) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCheck className="h-5 w-5" />
              Cobrança criada com sucesso!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Cliente:</span>{" "}
                <strong>{cliente?.nome}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Valor:</span>{" "}
                <strong>{fmt(valor)}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                <strong>
                  {resultado.tipo === "PIX"
                    ? "⚡ PIX"
                    : resultado.tipo === "BOLETO"
                      ? "🏦 Boleto"
                      : resultado.tipo === "CREDIT_CARD"
                        ? "💳 Cartão de Crédito"
                        : "🔀 Multi-meios"}
                </strong>
              </p>
            </div>

            {/* PIX */}
            {resultado.tipo === "PIX" && resultado.pixCopiaECola && (
              <div className="space-y-3">
                {resultado.pixImagemUrl && (
                  <div className="flex justify-center">
                    <img
                      src={resultado.pixImagemUrl}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-lg border shadow-sm"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={resultado.pixCopiaECola}
                      className="text-xs font-mono"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopiar(resultado.pixCopiaECola!)}
                    >
                      {copied ? (
                        <CheckCheck className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Boleto */}
            {resultado.tipo === "BOLETO" && (
              <div className="space-y-2">
                {resultado.bankSlipUrl && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => window.open(resultado.bankSlipUrl, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir / Baixar Boleto PDF
                  </Button>
                )}
              </div>
            )}

            {/* Cartão / Link Fatura (para todos os tipos) */}
            {resultado.invoiceUrl && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Link da Fatura / Checkout</Label>
                <div className="flex gap-2">
                  <Input readOnly value={resultado.invoiceUrl} className="text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopiar(resultado.invoiceUrl!)}
                  >
                    {copied ? (
                      <CheckCheck className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  className="w-full mt-1"
                  variant="outline"
                  onClick={() => window.open(resultado.invoiceUrl, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir Link de Pagamento
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleClose} className="w-full bg-gradient-brand text-white">
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Tela de Criação ────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Gerar Cobrança via ASAAS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumo */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Cliente:</span>{" "}
              <strong>{cliente?.nome || "—"}</strong>
            </p>
            {!cliente?.cpf_cnpj && (
              <p className="text-warning text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                CPF/CNPJ não cadastrado — a cobrança pode ser criada, mas é recomendado informar.
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Valor:</span>{" "}
              <strong className="text-success">{fmt(valor)}</strong>
            </p>
          </div>

          {/* Tipo de cobrança */}
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "PIX", label: "PIX", icon: Zap, color: "text-emerald-600" },
                  { value: "BOLETO", label: "Boleto", icon: Banknote, color: "text-blue-600" },
                  { value: "CREDIT_CARD", label: "Cartão", icon: CreditCard, color: "text-purple-600" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipo(opt.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    tipo === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <opt.icon className={`h-5 w-5 ${opt.color}`} />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Vencimento */}
          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Input
              type="date"
              value={vencimento}
              min={hoje}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>

          {/* Parcelamento (apenas cartão) */}
          {tipo === "CREDIT_CARD" && (
            <div className="space-y-2">
              <Label>Parcelamento</Label>
              <Select value={parcelas} onValueChange={setParcelas}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {fmt(valor / n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {erro}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleCriar}
            disabled={loading || !cliente}
            className="bg-gradient-brand text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Gerar Cobrança
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
