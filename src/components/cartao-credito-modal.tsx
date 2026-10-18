import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Download,
  ExternalLink,
} from "lucide-react";
import { pagarComCartaoCreditoAsaas } from "@/lib/asaas";
import { downloadOrderPdf, openOrderPdf, WhatsAppIcon } from "@/lib/order-pdf";
import { supabase } from "@/lib/supabase";

interface CartaoCreditoModalProps {
  open: boolean;
  onClose: () => void;
  cart: { produto: any; qtd: number }[];
  empresaData: {
    nome: string;
    cnpj: string;
    cep?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    telefone?: string;
    email?: string;
  };
  partner?: any;
  onSuccessOrder?: () => void;
}

export function CartaoCreditoModal({
  open,
  onClose,
  cart,
  empresaData,
  partner,
  onSuccessOrder,
}: CartaoCreditoModalProps) {
  const total = cart.reduce((acc, item) => acc + item.qtd * Number(item.produto.valor), 0);

  // ─── Taxas Asaas (Cobranças Online - Cartão de Crédito) ───────────────────
  // À vista (1x): 1,99% + R$0,49  |  2–6x: 2,49% + R$0,49  |  7–12x: 2,99% + R$0,49
  const calcularTaxaAsaas = (valorBase: number, nParcelas: number) => {
    const percentual = nParcelas === 1 ? 1.99 : nParcelas <= 6 ? 2.49 : 2.99;
    const taxa = parseFloat((valorBase * (percentual / 100) + 0.49).toFixed(2));
    const totalComTaxa = parseFloat((valorBase + taxa).toFixed(2));
    const valorParcela = parseFloat((totalComTaxa / nParcelas).toFixed(2));
    return { percentual, taxa, totalComTaxa, valorParcela };
  };

  // Form states
  const [numeroCartao, setNumeroCartao] = useState("");
  const [nomeTitular, setNomeTitular] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [parcelas, setParcelas] = useState("1");

  // Status states
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{
    vendaId: string;
    numeroVenda: string | number;
    asaasPaymentId: string;
    total: number;
    totalComTaxa: number;
    parcelas: number;
  } | null>(null);

  // Detecção de bandeira
  const getBandeira = (num: string) => {
    const limpo = num.replace(/\D/g, "");
    if (/^4/.test(limpo)) return "Visa";
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(limpo)) return "Mastercard";
    if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|651|655)/.test(limpo)) return "Elo";
    if (/^(606282|3841)/.test(limpo)) return "Hipercard";
    if (/^3[47]/.test(limpo)) return "Amex";
    return null;
  };

  const bandeira = getBandeira(numeroCartao);

  // Formatação do número do cartão (0000 0000 0000 0000)
  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 16);
    let partes = [];
    for (let i = 0; i < v.length; i += 4) {
      partes.push(v.slice(i, i + 4));
    }
    setNumeroCartao(partes.join(" "));
  };

  // Formatação de validade (MM/AA)
  const handleValidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length > 2) {
      v = `${v.slice(0, 2)}/${v.slice(2)}`;
    }
    setValidade(v);
  };

  // Processamento do pagamento
  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const numLimpo = numeroCartao.replace(/\D/g, "");
    if (numLimpo.length < 13 || numLimpo.length > 19) {
      setErro("Número de cartão inválido.");
      return;
    }

    if (!nomeTitular.trim() || nomeTitular.trim().split(" ").length < 2) {
      setErro("Informe o nome completo impresso no cartão.");
      return;
    }

    const [mes, ano] = validade.split("/");
    if (!mes || !ano || Number(mes) < 1 || Number(mes) > 12) {
      setErro("Data de validade inválida (use MM/AA).");
      return;
    }

    if (cvv.trim().length < 3) {
      setErro("Código de segurança (CVV) inválido.");
      return;
    }

    setLoading(true);

    try {
      const nParcelas = parseInt(parcelas) || 1;
      const { totalComTaxa, taxa, valorParcela, percentual } = calcularTaxaAsaas(total, nParcelas);

      // 1. Processar com Asaas (cobra valor COM taxa — repassada ao cliente)
      const respAsaas = await pagarComCartaoCreditoAsaas({
        cliente: {
          nome: empresaData.nome,
          cpf_cnpj: empresaData.cnpj,
          email: empresaData.email || "contatogardenprime@gmail.com",
          telefone: empresaData.telefone,
          cep: empresaData.cep,
          endereco: empresaData.endereco,
          numero: empresaData.numero,
          bairro: empresaData.bairro,
          cidade: empresaData.cidade,
          uf: empresaData.uf,
        },
        valor: totalComTaxa,
        parcelas: nParcelas,
        cartao: {
          holderName: nomeTitular,
          number: numLimpo,
          expiryMonth: mes,
          expiryYear: ano,
          ccv: cvv.trim(),
        },
        descricao: `Pedido Catálogo Garden Prime - ${empresaData.nome}`,
      });

      // 2. Salvar ou recuperar Cliente no ERP
      let finalClienteId: string | null = null;
      if (empresaData.cnpj && empresaData.cnpj.trim()) {
        const { data: existingClient } = await supabase
          .from("clientes")
          .select("id, asaas_customer_id")
          .eq("cpf_cnpj", empresaData.cnpj.trim())
          .maybeSingle();

        if (existingClient) {
          finalClienteId = existingClient.id;
        }
      }

      if (!finalClienteId) {
        const { data: novoCliente, error: cliErr } = await supabase
          .from("clientes")
          .insert([
            {
              nome: empresaData.nome,
              cpf_cnpj: empresaData.cnpj,
              telefone: empresaData.telefone || null,
              email: empresaData.email || null,
              cep: empresaData.cep || null,
              endereco: empresaData.endereco || null,
              numero: empresaData.numero || null,
              bairro: empresaData.bairro || null,
              cidade: empresaData.cidade || null,
              uf: empresaData.uf || null,
              status: "Ativo",
              asaas_customer_id: (respAsaas as any).customer || null,
            },
          ])
          .select()
          .maybeSingle();

        if (novoCliente) {
          finalClienteId = novoCliente.id;
        }
      }

      // 3. Pegar próximo número de venda
      let nextNumero = 1;
      const { data: maxVenda } = await supabase
        .from("vendas")
        .select("numero")
        .not("numero", "is", null)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxVenda && maxVenda.numero) {
        nextNumero = Number(maxVenda.numero) + 1;
      }

      // 4. Salvar Venda no ERP (valor_total = com taxa Asaas, subtotal = valor líquido do pedido)
      const condPag =
        nParcelas > 1
          ? `Cartão de Crédito (${nParcelas}x de R$ ${valorParcela.toFixed(2).replace(".", ",")} | taxa ${percentual.toFixed(2)}% + R$0,49)`
          : `Cartão de Crédito à Vista (taxa ${percentual.toFixed(2)}% + R$0,49)`;

      const { data: vendaData, error: vendaError } = await supabase
        .from("vendas")
        .insert([
          {
            tipo: "CATALOGO",
            status: "Pago",
            status_aprovacao: "Aprovado",
            subtotal: total,
            valor_total: totalComTaxa,
            numero: nextNumero,
            cliente_id: finalClienteId,
            vendedor_id: partner?.id || null,
            metodo_pagamento: "Cartão de Crédito",
            condicao_pagamento: condPag,
          },
        ])
        .select()
        .single();

      if (vendaError) {
        console.error("Erro ao registrar venda:", vendaError);
        throw new Error("Pagamento aprovado no Asaas, mas houve erro ao salvar o pedido no sistema.");
      }

      // 5. Inserir itens da venda
      const itensToInsert = cart.map((i) => ({
        venda_id: vendaData.id,
        produto_id: i.produto.id,
        quantidade: i.qtd,
        valor_unitario: Number(i.produto.valor),
        subtotal: i.qtd * Number(i.produto.valor),
      }));

      await supabase.from("vendas_itens").insert(itensToInsert);

      // 6. Atualizar estoque
      for (const item of cart) {
        if (item.produto?.estoque !== undefined) {
          const novoEstoque = Math.max(0, (item.produto.estoque || 0) - item.qtd);
          await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", item.produto.id);
        }
      }

      // 7. Criar Conta a Receber baixada (valor cobrado = com taxa)
      const dataHoje = new Date().toISOString().split("T")[0];
      await supabase.from("contas_receber").insert([
        {
          venda_id: vendaData.id,
          cliente_id: finalClienteId,
          descricao: `Venda #${vendaData.numero_venda || nextNumero} (Cartão Asaas - taxa ${percentual.toFixed(2)}% + R$0,49)`,
          valor: totalComTaxa,
          vencimento: dataHoje,
          data_pagamento: dataHoje,
          status: "Recebido",
        },
      ]);

      // Sucesso!
      const numeroFinal = vendaData.numero_venda || nextNumero;
      setSucesso({
        vendaId: vendaData.id,
        numeroVenda: numeroFinal,
        asaasPaymentId: respAsaas.id,
        total,
        totalComTaxa,
        parcelas: nParcelas,
      });

      if (onSuccessOrder) {
        onSuccessOrder();
      }
    } catch (err: any) {
      console.error(err);
      setErro(err.message || "Erro desconhecido ao processar pagamento com cartão.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarNotificacaoWhatsApp = () => {
    if (!sucesso) return;
    let telefoneDestino = "5519997141112"; // Telefone padrão Garden Prime
    if (partner && partner.telefone) {
      const limpo = partner.telefone.replace(/\D/g, "");
      if (limpo.length >= 10) telefoneDestino = `55${limpo}`;
    }

    const linkGuia = `${window.location.origin}/orcamento/${sucesso.vendaId}`;

    let msg = `🎉 *PAGAMENTO APROVADO NO CARTÃO DE CRÉDITO!*\n\n`;
    msg += `Olá! Acabei de fazer um pedido pelo Catálogo Online e o pagamento foi aprovado com sucesso via Asaas.\n\n`;
    msg += `*DADOS DO PEDIDO:*\n`;
    msg += `• Pedido Nº: *#${sucesso.numeroVenda}*\n`;
    msg += `• Cliente: *${empresaData.nome}*\n`;
    msg += `• CNPJ: ${empresaData.cnpj}\n`;
    if (empresaData.cidade) msg += `• Cidade: ${empresaData.cidade}/${empresaData.uf || ""}\n`;
    msg += `• Valor Total: *R$ ${sucesso.total.toFixed(2).replace(".", ",")}*\n`;
    msg += `• Forma: Cartão de Crédito (${sucesso.parcelas}x)\n`;
    msg += `• Transação Asaas: \`${sucesso.asaasPaymentId}\`\n\n`;

    msg += `*ITENS DO PEDIDO:*\n`;
    cart.forEach((i) => {
      msg += `• ${i.qtd}x ${i.produto.nome} (R$ ${Number(i.produto.valor).toFixed(2).replace(".", ",")})\n`;
    });

    msg += `\n📄 *Comprovante / Guia do Pedido:*\n${linkGuia}\n\n`;
    msg += `Por favor, confirmar o recebimento do pedido e os prazos de entrega!`;

    window.open(`https://wa.me/${telefoneDestino}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!loading ? onClose() : null)}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {sucesso ? (
          // ─── TELA DE SUCESSO / COMPROVANTE ───
          <div className="p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto flex-1">
            <div className="mx-auto w-16 h-16 bg-success/15 text-success rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-display font-bold text-slate-900">
                Pagamento Aprovado!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Seu pedido foi confirmado e pago com sucesso via Cartão de Crédito.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Número do Pedido:</span>
                <span className="font-mono font-bold text-slate-900 text-base">
                  #{sucesso.numeroVenda}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valor do Pedido:</span>
                <span className="font-medium text-slate-700">
                  R$ {sucesso.total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-amber-700">
                <span>Taxa Asaas:</span>
                <span>+ R$ {(sucesso.totalComTaxa - sucesso.total).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t">
                <span className="font-semibold text-slate-700">Total Cobrado:</span>
                <span className="font-bold text-success text-base">
                  R$ {sucesso.totalComTaxa.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Condição:</span>
                <span className="font-medium text-slate-700">
                  {sucesso.parcelas > 1
                    ? `${sucesso.parcelas}x de R$ ${(sucesso.totalComTaxa / sucesso.parcelas).toFixed(2).replace(".", ",")}`
                    : "1x (à vista)"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                <span>Transação Asaas:</span>
                <span className="font-mono">{sucesso.asaasPaymentId}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                onClick={() => openOrderPdf(sucesso.vendaId)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Visualizar / Imprimir Guia do Pedido
              </Button>

              <Button
                variant="outline"
                className="w-full bg-success/10 text-success hover:bg-success/20 border-success/30 font-semibold h-11"
                onClick={handleEnviarNotificacaoWhatsApp}
              >
                <WhatsAppIcon className="mr-2 h-5 w-5" />
                Enviar Comprovante via WhatsApp
              </Button>

              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-700 text-sm"
                onClick={onClose}
              >
                Fechar e Voltar ao Catálogo
              </Button>
            </div>
          </div>
        ) : (
          // ─── FORMULÁRIO DO CARTÃO DE CRÉDITO ───
          <form onSubmit={handlePagar} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* ── Header Premium ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0a0f1e] via-[#111827] to-[#0c1f3f] p-5 pb-4 shrink-0">
              {/* Glow de fundo */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-600/20 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

              <div className="relative flex items-start justify-between gap-3">
                {/* Lado esquerdo: título + total */}
                <div className="space-y-1.5">
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-blue-300" />
                    </div>
                    Pagamento com Cartão
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs">
                    Processado com segurança via
                  </DialogDescription>
                  {/* Logo Asaas inline */}
                  <img
                    src="/asaas-logo.png"
                    alt="Asaas"
                    className="h-5 object-contain brightness-0 invert opacity-80 mt-0.5"
                  />
                </div>

                {/* Lado direito: total destacado + badge */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                    <Lock className="h-3 w-3" />
                    Ambiente Seguro
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total do Pedido</p>
                    <p className="text-xl font-black text-white tracking-tight">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[10px] text-slate-400">{cart.length} {cart.length === 1 ? "item" : "itens"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* ── Cartão Visual Premium ── */}
              <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-xl space-y-4"
                style={{
                  background: "linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)",
                }}
              >
                {/* Brilho no canto */}
                <div className="absolute top-0 right-0 w-40 h-24 bg-white/10 rounded-full blur-2xl -translate-y-6 translate-x-6 pointer-events-none" />

                <div className="flex justify-between items-center">
                  {/* Chip EMV */}
                  <div className="relative w-10 h-7 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 border border-amber-200 shadow-md overflow-hidden">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-px p-0.5 opacity-60">
                      {Array.from({length: 9}).map((_, i) => (
                        <div key={i} className="bg-amber-600/60 rounded-[1px]" />
                      ))}
                    </div>
                  </div>
                  {/* Bandeira / nome */}
                  <div className="flex flex-col items-end">
                    {bandeira ? (
                      <span className="font-black text-base tracking-widest text-white drop-shadow">{bandeira.toUpperCase()}</span>
                    ) : (
                      <span className="font-bold text-sm tracking-widest text-white/70">CARTÃO</span>
                    )}
                    <span className="text-[9px] text-white/50 uppercase tracking-wider">Credit Card</span>
                  </div>
                </div>

                <div className="font-mono text-base tracking-[0.2em] text-white/90 min-h-[24px] drop-shadow">
                  {numeroCartao || "•••• •••• •••• ••••"}
                </div>

                <div className="flex justify-between items-end text-xs text-white/80">
                  <div>
                    <p className="text-[9px] text-white/50 uppercase tracking-widest mb-0.5">Titular</p>
                    <p className="font-bold tracking-wide uppercase truncate max-w-[180px] drop-shadow">
                      {nomeTitular || empresaData.nome || "NOME DO TITULAR"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-white/50 uppercase tracking-widest mb-0.5">Validade</p>
                    <p className="font-mono font-bold drop-shadow">{validade || "MM/AA"}</p>
                  </div>
                </div>
              </div>

              {erro && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-lg text-xs animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="num_cartao" className="text-xs">Número do Cartão</Label>
                  <Input
                    id="num_cartao"
                    placeholder="0000 0000 0000 0000"
                    value={numeroCartao}
                    onChange={handleNumeroChange}
                    className="font-mono h-10"
                    maxLength={19}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nome_titular" className="text-xs">Nome no Cartão</Label>
                  <Input
                    id="nome_titular"
                    placeholder="Como impresso no cartão"
                    value={nomeTitular}
                    onChange={(e) => setNomeTitular(e.target.value.toUpperCase())}
                    className="uppercase h-10"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="validade_cartao" className="text-xs">Validade (MM/AA)</Label>
                    <Input
                      id="validade_cartao"
                      placeholder="MM/AA"
                      value={validade}
                      onChange={handleValidadeChange}
                      className="font-mono h-10"
                      maxLength={5}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cvv_cartao" className="text-xs">CVV (Cód. Segurança)</Label>
                    <Input
                      id="cvv_cartao"
                      placeholder="123"
                      type="password"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="font-mono h-10"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parcelas_cartao" className="text-xs font-semibold">Parcelas</Label>
                  <Select value={parcelas} onValueChange={setParcelas}>
                    <SelectTrigger id="parcelas_cartao" className="h-10">
                      <SelectValue placeholder="Selecione as parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                        const { percentual, totalComTaxa: tc, valorParcela: vp } = calcularTaxaAsaas(total, n);
                        return (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de R$ {vp.toFixed(2).replace(".", ",")}
                            {n === 1 ? " (à vista)" : ""} — total R$ {tc.toFixed(2).replace(".", ",")} ({percentual.toFixed(2).replace(".", ",")}% taxa)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {/* Painel de taxas Asaas por faixa */}
                  {(() => {
                    const nAtual = parseInt(parcelas) || 1;
                    const { totalComTaxa, taxa, valorParcela, percentual } = calcularTaxaAsaas(total, nAtual);
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-[11px]">
                        <p className="font-bold text-amber-900 text-xs">Taxas Asaas — Cobranças Online</p>
                        {[
                          { faixa: "1x (à vista)", pct: 1.99, ativo: nAtual === 1 },
                          { faixa: "2 a 6x", pct: 2.49, ativo: nAtual >= 2 && nAtual <= 6 },
                          { faixa: "7 a 12x", pct: 2.99, ativo: nAtual >= 7 },
                        ].map(({ faixa, pct, ativo }) => (
                          <div
                            key={faixa}
                            className={`flex justify-between px-2 py-1 rounded-lg ${ativo ? "bg-amber-200 font-bold text-amber-900" : "text-amber-700"}`}
                          >
                            <span>{faixa}</span>
                            <span>{pct.toFixed(2).replace(".", ",")}% + R$0,49</span>
                          </div>
                        ))}
                        <div className="border-t border-amber-200 pt-2 space-y-0.5">
                          <div className="flex justify-between text-amber-700">
                            <span>Pedido:</span>
                            <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex justify-between text-amber-700">
                            <span>Taxa ({percentual.toFixed(2).replace(".", ",")}% + R$0,49):</span>
                            <span>+ R$ {taxa.toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex justify-between font-bold text-amber-900 text-xs pt-0.5 border-t border-amber-200">
                            <span>Total cobrado{nAtual > 1 ? ` (${nAtual}x de R$ ${valorParcela.toFixed(2).replace(".", ",")})` : " à vista"}:</span>
                            <span>R$ {totalComTaxa.toFixed(2).replace(".", ",")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── Compra Segura / Trust Bar ────────────────────────── */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                {/* Linha 1: Compra Segura + cadeado */}
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-[12px] font-bold text-emerald-800">Compra 100% Segura</p>
                    <p className="text-[10px] text-emerald-700 leading-snug">
                      Seus dados são criptografados e nunca armazenados no nosso servidor.
                    </p>
                  </div>
                </div>
                {/* Linha 2: Badges de segurança + logo Asaas */}
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/70">
                  <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-medium">
                    <span className="flex items-center gap-1 bg-white border border-emerald-200 rounded px-1.5 py-0.5">
                      <Lock className="h-3 w-3 text-emerald-600" /> SSL 256-bit
                    </span>
                    <span className="flex items-center gap-1 bg-white border border-emerald-200 rounded px-1.5 py-0.5">
                      🔒 PCI DSS
                    </span>
                  </div>
                  {/* Logo Asaas */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider">Gateway</span>
                    <img
                      src="/asaas-logo.png"
                      alt="Asaas"
                      className="h-4 object-contain opacity-80"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t shrink-0 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Voltar
              </Button>
              {(() => {
                const nAtual = parseInt(parcelas) || 1;
                const { totalComTaxa, valorParcela } = calcularTaxaAsaas(total, nAtual);
                return (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1 h-11"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando com Asaas...
                      </>
                    ) : (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="flex items-center gap-1">
                          <Lock className="h-4 w-4" />
                          Pagar R$ {totalComTaxa.toFixed(2).replace(".", ",")}
                        </span>
                        {nAtual > 1 && (
                          <span className="text-blue-200 text-[10px] font-normal">
                            {nAtual}x de R$ {valorParcela.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    )}
                  </Button>
                );
              })()}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
