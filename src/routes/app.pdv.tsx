import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Receipt,
  DownloadCloud,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getPrazoBoleto, getDescricaoBoleto, getRotuloFaixaBoleto } from "@/lib/utils";

export const Route = createFileRoute("/app/pdv")({
  head: () => ({ meta: [{ title: "PDV — GARDEN PRIME ERP" }] }),
  component: PDV,
});

function PDV() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pdv_cart_main");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pdv_cart_main", JSON.stringify(cart));
    }
  }, [cart]);

  const [loading, setLoading] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState("Cartão");
  const [condicaoPagamento, setCondicaoPagamento] = useState("À vista");
  const [descontoValor, setDescontoValor] = useState(0);

  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [isOrcamentoModalOpen, setIsOrcamentoModalOpen] = useState(false);
  const [orcamentoIdSelecionado, setOrcamentoIdSelecionado] = useState<string | null>(null);
  const [orcamentoNumeroSelecionado, setOrcamentoNumeroSelecionado] = useState<number | null>(null);
  const [orcamentoOrigem, setOrcamentoOrigem] = useState<"vendas" | "davs" | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<{ id: string; nome: string } | null>(
    null,
  );

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientesBuscaLista, setClientesBuscaLista] = useState<any[]>([]);

  const handleSearchClients = async (q: string) => {
    setClientSearch(q);
    if (!q) {
      setClientesBuscaLista([]);
      return;
    }
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, cpf_cnpj")
      .ilike("nome", `%${q}%`)
      .limit(10);
    setClientesBuscaLista(data || []);
  };

  const fetchOrcamentos = async () => {
    // Busca DAVs antigos da tabela de vendas
    const { data: vendasData } = await supabase
      .from("vendas")
      .select("*, cliente:clientes(nome)")
      .eq("tipo", "DAV")
      .in("status", ["Orçamento", "Aguardando Pagamento"])
      .order("created_at", { ascending: false });

    // Busca Novos DAVs da tabela davs
    const { data: davData, error: davError } = await supabase
      .from("davs")
      .select("*")
      .or("status.is.null,status.eq.Aberto,status.eq.Orçamento")
      .order("created_at", { ascending: false });

    if (davError) {
      console.error(
        "Erro ao buscar novos DAVs (Verifique se as migrations foram rodadas):",
        davError,
      );
    }

    let combined: any[] = [];
    if (vendasData) {
      combined = [...combined, ...vendasData];
    }
    if (davData) {
      const mappedDavs = davData.map((d: any) => ({
        id: d.id,
        numero_venda: d.numero,
        numero: d.numero,
        valor_total: d.total,
        created_at: d.created_at,
        cliente_id: d.cliente_id,
        cliente: { nome: d.cliente_nome },
        condicao_pagamento: d.condicao_pagamento,
        frete_tipo: d.frete_tipo,
        prazo_entrega: d.prazo_entrega,
        isNovoDav: true,
      }));
      combined = [...combined, ...mappedDavs];
    }

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setOrcamentos(combined);
  };

  useEffect(() => {
    const fetchProdutos = async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");
      if (data) {
        setProdutos(data);

        // Formato do Carrinho e Cliente via Catálogo
        const params = new URLSearchParams(window.location.search);
        const cartMagic = params.get("c");
        const pagParam = params.get("pag");
        const prazoParam = params.get("prazo");
        const eParam = params.get("e");
        const cnjParam = params.get("cnpj");
        const telParam = params.get("tel");

        if (eParam || cnjParam) {
          setClienteSelecionado({
            id: "avulso",
            nome: eParam || "Cliente",
          });
        }

        if (pagParam) {
          const isBoleto = pagParam.toLowerCase().includes("boleto");
          const formaPag = isBoleto
            ? (prazoParam ? `Boleto (${prazoParam})` : (pagParam === "Boleto a Prazo" ? "Boleto (28, 35, 42 dias)" : pagParam))
            : pagParam;
          setCondicaoPagamento(formaPag);
          if (isBoleto) {
            setMetodoPagamento("Boleto");
          } else if (pagParam.toLowerCase().includes("cartão") || pagParam.toLowerCase().includes("cartao")) {
            setMetodoPagamento("Cartão");
          } else if (pagParam.toLowerCase().includes("pix")) {
            setMetodoPagamento("Pix");
          }
        }

        if (cartMagic) {
          const parsedCart: any[] = [];
          const items = cartMagic.split(",");
          items.forEach((item) => {
            const [id, qStr] = item.split(":");
            const qty = parseInt(qStr) || 1;
            const prod = data.find((p) => p.id === id);
            if (prod) {
              parsedCart.push({
                id: prod.id,
                p: prod.nome,
                q: qty,
                u: Number(prod.valor),
                t: qty * Number(prod.valor),
                emoji: prod.emoji,
                max: prod.estoque,
              });
            }
          });
          if (parsedCart.length > 0) {
            setCart(parsedCart);
            window.history.replaceState({}, "", "/app/pdv");
          }
        }
      }
    };
    fetchProdutos();
    fetchOrcamentos();
  }, []);

  const puxarOrcamento = async (orcamento: any) => {
    try {
      if (orcamento.isNovoDav) {
        const { data, error } = await supabase
          .from("dav_items")
          .select("*, produtos(nome, estoque, valor, emoji, imagem)")
          .eq("dav_id", orcamento.id);

        if (error) {
          console.error(error);
          alert("Erro ao puxar itens: " + error.message);
          return;
        }
        if (data && data.length > 0) {
          const novoCarrinho = data.map((item) => ({
            id: item.produto_id || item.codigo || Math.random().toString(),
            p: item.produtos?.nome || item.produto || "Produto não encontrado",
            q: item.qtd,
            u: Number(item.valor_unitario),
            t: Number(item.total),
            emoji: item.produtos?.emoji || "📦",
            imagem: item.produtos?.imagem || null,
            max: item.produtos?.estoque || 0,
            hasDbId: !!item.produto_id,
          }));
          setCart(novoCarrinho);
          setOrcamentoIdSelecionado(orcamento.id);
          setOrcamentoNumeroSelecionado(orcamento.numero || orcamento.numero_venda || null);
          setOrcamentoOrigem("davs");
          if (orcamento.cliente?.nome) {
            setClienteSelecionado({
              id: orcamento.cliente_id || "avulso",
              nome: orcamento.cliente.nome,
            });
          }
          if (orcamento.condicao_pagamento) {
            setCondicaoPagamento(orcamento.condicao_pagamento);
            if (orcamento.condicao_pagamento.toLowerCase().includes("boleto")) {
              setMetodoPagamento("Boleto");
            } else if (orcamento.condicao_pagamento.toLowerCase().includes("cartão") || orcamento.condicao_pagamento.toLowerCase().includes("cartao")) {
              setMetodoPagamento("Cartão");
            } else if (orcamento.condicao_pagamento.toLowerCase().includes("pix")) {
              setMetodoPagamento("Pix");
            } else {
              setMetodoPagamento("Dinheiro");
            }
          }
          setIsOrcamentoModalOpen(false);
        } else {
          alert("Nenhum item encontrado.");
        }
      } else {
        const { data, error } = await supabase
          .from("vendas_itens")
          .select("*, produto:produtos(nome, estoque, valor, emoji, imagem)")
          .eq("venda_id", orcamento.id);

        if (error) {
          console.error(error);
          alert("Erro no banco de dados ao puxar os itens: " + error.message);
          return;
        }

        if (data && data.length > 0) {
          const novoCarrinho = data.map((item) => ({
            id: item.produto_id,
            p: item.produto?.nome || "Produto não encontrado",
            q: item.quantidade,
            u: Number(item.valor_unitario),
            t: Number(item.subtotal),
            emoji: item.produto?.emoji || "📦",
            imagem: item.produto?.imagem || null,
            max: item.produto?.estoque || 0,
            hasDbId: true,
          }));
          setCart(novoCarrinho);
          setOrcamentoIdSelecionado(orcamento.id);
          setOrcamentoNumeroSelecionado(orcamento.numero || orcamento.numero_venda || null);
          setOrcamentoOrigem("vendas");
          if (orcamento.cliente?.nome) {
            setClienteSelecionado({
              id: orcamento.cliente_id || "avulso",
              nome: orcamento.cliente.nome,
            });
          }
          const cond = orcamento.condicao_pagamento || orcamento.metodo_pagamento;
          if (cond) {
            setCondicaoPagamento(cond);
            if (cond.toLowerCase().includes("boleto")) {
              setMetodoPagamento("Boleto");
            } else if (cond.toLowerCase().includes("cartão") || cond.toLowerCase().includes("cartao")) {
              setMetodoPagamento("Cartão");
            } else if (cond.toLowerCase().includes("pix")) {
              setMetodoPagamento("Pix");
            } else {
              setMetodoPagamento("Dinheiro");
            }
          }
          setIsOrcamentoModalOpen(false);
        } else {
          alert("Nenhum item encontrado neste orçamento.");
        }
      }
    } catch (e: any) {
      alert("Erro ao puxar itens do orçamento: " + e.message);
    }
  };

  const limparCaixa = () => {
    setCart([]);
    setOrcamentoIdSelecionado(null);
    setOrcamentoNumeroSelecionado(null);
    setOrcamentoOrigem(null);
    setClienteSelecionado(null);
    setDescontoValor(0);
  };

  const addToCart = (produto: any) => {
    if (produto.estoque <= 0) {
      alert("Produto sem estoque!");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === produto.id);
      if (existing) {
        if (existing.q >= produto.estoque) {
          alert("Estoque insuficiente!");
          return prev;
        }
        return prev.map((i) =>
          i.id === produto.id ? { ...i, q: i.q + 1, t: (i.q + 1) * i.u } : i,
        );
      }
      return [
        ...prev,
        {
          id: produto.id,
          p: produto.nome,
          q: 1,
          u: Number(produto.valor),
          t: Number(produto.valor),
          emoji: produto.emoji,
          imagem: produto.imagem,
          max: produto.estoque,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const currentQ = typeof i.q === "number" ? i.q : 0;
          const newQ = currentQ + delta;
          if (newQ <= 0) return i;
          if (newQ > i.max) {
            alert("Estoque insuficiente!");
            return i;
          }
          return { ...i, q: newQ, t: newQ * i.u };
        }
        return i;
      }),
    );
  };

  const setQuantity = (id: string, val: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          if (val === "") {
            return { ...i, q: "", t: 0 };
          }
          const newQ = parseInt(val);
          if (isNaN(newQ) || newQ < 0) return i;
          if (newQ > i.max) {
            alert("Estoque insuficiente!");
            return i;
          }
          return { ...i, q: newQ, t: newQ * i.u };
        }
        return i;
      }),
    );
  };

  const setUnitPrice = (id: string, newU: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          if (newU < 0) return i;
          return { ...i, u: newU, t: i.q * newU };
        }
        return i;
      }),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const subtotal = cart.reduce((s, i) => s + i.t, 0);
  const totalPagamento = Math.max(0, subtotal - descontoValor);

  const handleFinalizar = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      // Pega o último número gerado para evitar pulos
      let nextNumero = 1;

      if (orcamentoNumeroSelecionado) {
        nextNumero = Number(orcamentoNumeroSelecionado);
      } else {
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
      }

      // Cria a venda
      const { data: vendaData, error: vendaError } = await supabase
        .from("vendas")
        .insert([
          {
            tipo: "PDV",
            status: "Pago",
            valor_total: totalPagamento,
            cliente_id: clienteSelecionado?.id === "avulso" ? null : clienteSelecionado?.id || null,
            metodo_pagamento: metodoPagamento,
            condicao_pagamento:
              metodoPagamento === "Boleto"
                ? getDescricaoBoleto(totalPagamento)
                : condicaoPagamento,
            desconto_valor: descontoValor,
            numero: nextNumero,
          },
        ])
        .select()
        .single();

      if (vendaError) throw vendaError;
      const vendaId = vendaData.id;

      // Itens
      const itensToInsert = cart.map((i) => ({
        venda_id: vendaId,
        produto_id: i.hasDbId ? i.id : null,
        quantidade: i.q,
        valor_unitario: i.u,
        subtotal: i.t,
      }));

      const { error: itensError } = await supabase.from("vendas_itens").insert(itensToInsert);
      if (itensError) throw itensError;

      // Financeiro: Conta a Receber (Já paga)
      const dataAtual = new Date().toISOString().split("T")[0];
      await supabase.from("contas_receber").insert([
        {
          venda_id: vendaId,
          descricao: `Venda PDV #${vendaData.numero_venda}`,
          valor: totalPagamento,
          vencimento: dataAtual,
          status: "Recebido",
          data_pagamento: dataAtual,
        },
      ]);

      // Baixa no estoque
      for (const item of cart) {
        if (item.hasDbId === false) continue; // Pula se não tiver ID real do banco (DAVs muito antigos sem produto_id)
        const prod = produtos.find((p) => p.id === item.id);
        if (prod) {
          const novoEstoque = prod.estoque - item.q;
          await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", item.id);

          await supabase.from("movimentacoes_estoque").insert({
            produto_id: item.id,
            tipo: "Saída",
            quantidade: -item.q,
            motivo: `Venda PDV #${vendaData.numero_venda}`,
          });

          prod.estoque = novoEstoque; // Atualiza local
        }
      }

      // Atualiza o orçamento anterior se foi puxado
      if (orcamentoIdSelecionado) {
        if (orcamentoOrigem === "davs") {
          await supabase
            .from("davs")
            .update({ status: "Aprovado" })
            .eq("id", orcamentoIdSelecionado);
        } else {
          await supabase
            .from("vendas")
            .update({ status: "Faturado" })
            .eq("id", orcamentoIdSelecionado);
        }
        fetchOrcamentos();
      }

      setIsSuccessModalOpen(true);
      limparCaixa();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao finalizar venda: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="PDV — Frente de Caixa"
        subtitle="Operador: Douglas de Almeida · Caixa 01"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Bipar código ou buscar produto…"
                  className="h-14 pl-11 text-base"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {produtos.map((p) => (
                  <Button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    variant="outline"
                    size="sm"
                    className="rounded-full pl-2 pr-3 h-9"
                  >
                    {p.imagem ? (
                      <img
                        src={p.imagem}
                        className="h-6 w-6 rounded-full object-cover mr-2"
                        alt=""
                      />
                    ) : (
                      <span className="mr-1">{p.emoji}</span>
                    )}
                    {p.nome}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Itens · {cart.length}</CardTitle>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={limparCaixa}
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    title="Limpar Pedido"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOrcamentoModalOpen(true)}
                className="h-8 text-brand border-brand/20 hover:bg-brand/10"
              >
                <DownloadCloud className="w-4 h-4 mr-2" /> Puxar Orçamento
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[50vh] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum produto no caixa.
                  </div>
                ) : (
                  cart.map((i) => (
                    <div
                      key={i.id}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-1.5 sm:gap-3 px-2 sm:px-6 py-3"
                    >
                      <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-lg bg-accent text-xl sm:text-2xl overflow-hidden relative">
                        {i.imagem ? (
                          <img
                            src={i.imagem}
                            alt={i.p}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          i.emoji || "📦"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm sm:text-base truncate">{i.p}</p>
                        <div className="flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                          R$
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={i.u}
                            onChange={(e) => setUnitPrice(i.id, parseFloat(e.target.value) || 0)}
                            className="w-10 sm:w-16 bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-brand p-0 m-0 text-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          un
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Button
                          onClick={() => updateQuantity(i.id, -1)}
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          −
                        </Button>
                        <input
                          type="number"
                          min="1"
                          value={i.q === "" ? "" : i.q}
                          onChange={(e) => setQuantity(i.id, e.target.value)}
                          className="w-6 sm:w-12 text-center font-semibold bg-transparent border-0 outline-none p-0 focus:ring-0 text-sm sm:text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button
                          onClick={() => updateQuantity(i.id, 1)}
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          +
                        </Button>
                      </div>
                      <p className="font-bold text-primary text-sm sm:text-base">
                        R$ {i.t.toFixed(2)}
                      </p>
                      <Button
                        onClick={() => removeFromCart(i.id)}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 sm:h-8 sm:w-8 text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-elevated bg-card sticky top-24 h-fit">
          <CardHeader>
            <CardTitle>Resumo da venda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 text-sm">
              {clienteSelecionado ? (
                <div className="flex justify-between items-center text-brand font-semibold mb-3 bg-brand/10 p-2 rounded-md">
                  <span>👤 {clienteSelecionado.nome}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-transparent text-brand"
                    onClick={() => setClienteSelecionado(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mb-3 border-dashed"
                  onClick={() => setIsClientModalOpen(true)}
                >
                  + Adicionar Cliente à Venda
                </Button>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <div className="flex items-center gap-1 font-semibold text-destructive">
                  <span>- R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={descontoValor}
                    onChange={(e) => setDescontoValor(parseFloat(e.target.value) || 0)}
                    className="w-20 text-right bg-transparent border-b border-dashed border-destructive/50 outline-none focus:border-destructive p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-brand p-5 text-primary-foreground">
              <p className="text-xs uppercase tracking-widest opacity-80">Total a pagar</p>
              <p className="font-display text-4xl font-extrabold mt-1">
                R$ {totalPagamento.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                Pagamento
              </p>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  onClick={() => setMetodoPagamento("Dinheiro")}
                  variant="outline"
                  className={`h-16 flex-col gap-1 ${metodoPagamento === "Dinheiro" ? "ring-2 ring-primary" : ""}`}
                >
                  <img
                    src="https://img.icons8.com/arcade/64/money.png"
                    alt="Dinheiro"
                    className="h-5 w-5 object-contain"
                  />
                  <span className="text-xs">Dinheiro</span>
                </Button>
                <Button
                  onClick={() => setMetodoPagamento("Cartão")}
                  variant="outline"
                  className={`h-16 flex-col gap-1 ${metodoPagamento === "Cartão" ? "ring-2 ring-primary" : ""}`}
                >
                  <img
                    src="https://img.icons8.com/fluency/48/bank-card-front-side.png"
                    alt="Cartão"
                    className="h-5 w-5 object-contain"
                  />
                  <span className="text-xs">Cartão</span>
                </Button>
                <Button
                  onClick={() => setMetodoPagamento("Pix")}
                  variant="outline"
                  className={`h-16 flex-col gap-1 ${metodoPagamento === "Pix" ? "ring-2 ring-primary" : ""}`}
                >
                  <img
                    src="https://img.icons8.com/fluency/48/pix.png"
                    alt="Pix"
                    className="h-5 w-5 object-contain"
                  />
                  <span className="text-xs">Pix</span>
                </Button>
                <Button
                  onClick={() => {
                    setMetodoPagamento("Boleto");
                    setCondicaoPagamento(getDescricaoBoleto(totalPagamento));
                  }}
                  variant="outline"
                  className={`h-16 flex-col gap-1 ${metodoPagamento === "Boleto" ? "ring-2 ring-primary" : ""}`}
                >
                  <img
                    src="https://img.icons8.com/fluency/48/recurring-appointment.png"
                    alt="Boleto"
                    className="h-5 w-5 object-contain"
                  />
                  <span className="text-xs">Boleto ({getPrazoBoleto(totalPagamento)})</span>
                </Button>
              </div>
              {metodoPagamento === "Boleto" && (
                <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Prazo do Boleto:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      {getPrazoBoleto(totalPagamento)}
                    </span>
                  </div>
                  <Input
                    value={getRotuloFaixaBoleto(totalPagamento)}
                    readOnly
                    disabled
                    className="mt-1.5 h-9 bg-white font-bold text-slate-800 text-xs cursor-not-allowed select-none"
                  />
                  <div className="text-[11px] text-muted-foreground space-y-0.5 mt-1.5 pt-1 border-t border-slate-200/60">
                    <p className={totalPagamento <= 1000 ? "font-bold text-emerald-700" : ""}>
                      • Até R$ 1.000,00: <strong>28 dias</strong>
                    </p>
                    <p className={totalPagamento > 1000 ? "font-bold text-emerald-700" : ""}>
                      • Acima de R$ 1.000,00: <strong>28, 35, 42 dias</strong>
                    </p>
                  </div>
                </div>
              )}
              {(metodoPagamento === "Dinheiro" || metodoPagamento === "Pix") && (
                <div className="mt-3 flex items-center justify-between bg-emerald-50 p-3 rounded-md border border-emerald-100">
                  <span className="font-medium text-emerald-800 text-sm">Aplicar Desconto (%)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Ex: 5"
                      onChange={(e) => {
                        const percent = parseFloat(e.target.value);
                        if (!isNaN(percent)) {
                          setDescontoValor(subtotal * (percent / 100));
                        } else {
                          setDescontoValor(0);
                        }
                      }}
                      className="w-16 text-right bg-white border border-emerald-200 rounded p-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-emerald-800 font-medium text-sm">%</span>
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={handleFinalizar}
              disabled={cart.length === 0 || loading}
              size="lg"
              className="w-full bg-gradient-brand text-primary-foreground h-14 text-base font-bold"
            >
              <Receipt className="mr-2 h-5 w-5" /> {loading ? "Processando..." : "Finalizar Venda"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isOrcamentoModalOpen} onOpenChange={setIsOrcamentoModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Orçamentos Pendentes</DialogTitle>
            <DialogDescription>
              Selecione um orçamento (DAV) para carregar os produtos para o caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[350px] overflow-y-auto space-y-2 py-4">
            {orcamentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum orçamento em aberto encontrado.
              </p>
            ) : (
              orcamentos.map((orc) => (
                <div
                  key={orc.id}
                  onClick={() => puxarOrcamento(orc)}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-brand/5 hover:border-brand/30 transition-colors flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-800">#{orc.numero_venda}</p>
                    <p className="text-sm text-slate-600 font-medium">
                      👤 {orc.cliente?.nome || "Cliente Desconhecido"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(orc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand">R$ {Number(orc.valor_total).toFixed(2)}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold bg-info/10 text-info px-2 py-0.5 rounded">
                      Puxar Venda
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="flex flex-col items-center justify-center py-6">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <DialogTitle className="text-2xl mb-2">Venda Aprovada!</DialogTitle>
            <DialogDescription className="text-base mb-6">
              A venda foi registrada com sucesso e o estoque foi atualizado.
            </DialogDescription>
            <Button
              className="w-full bg-brand hover:bg-brand/90 text-white"
              onClick={() => setIsSuccessModalOpen(false)}
            >
              Nova Venda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar Cliente</DialogTitle>
            <DialogDescription>Busque um cliente para vincular a esta venda.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              placeholder="Buscar por nome..."
              value={clientSearch}
              onChange={(e) => handleSearchClients(e.target.value)}
              className="mb-4"
            />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {clientesBuscaLista.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => {
                    setClienteSelecionado({ id: c.id, nome: c.nome });
                    setIsClientModalOpen(false);
                    setClientSearch("");
                    setClientesBuscaLista([]);
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{c.nome}</span>
                    {c.cpf_cnpj && (
                      <span className="text-xs text-muted-foreground">{c.cpf_cnpj}</span>
                    )}
                  </div>
                </Button>
              ))}
              {clientSearch && clientesBuscaLista.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente encontrado.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PDV;
