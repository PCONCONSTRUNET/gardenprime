import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import {
  Search,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  Loader2,
  Camera,
  Mic,
  Star,
  Flame,
  Bell,
  Barcode,
  Clock,
  Grid,
  RefreshCw,
  Plus,
  Minus,
  X,
  ArrowRight,
  ChevronRight,
  FileText,
  Download,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { WhatsAppIcon, shareOrderWhatsApp, openOrderPdf, downloadOrderPdf } from "@/lib/order-pdf";

export const Route = createFileRoute("/parceiro/pdv")({
  head: () => ({ meta: [{ title: "Nova Venda — GARDEN PRIME" }] }),
  component: ParceiroPDV,
});

function ParceiroPDV() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pdv_cart_parceiro");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pdv_cart_parceiro", JSON.stringify(cart));
    }
  }, [cart]);

  const [loading, setLoading] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pdv_client_parceiro");
      if (saved) return JSON.parse(saved);
    }
    return {
      nome: "",
      documento: "",
      telefone: "",
      cep: "",
      endereco: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      pagamento: "Dinheiro / Pix",
      condicaoBoleto: "",
      frete: "Retirada",
      observacoes: "",
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pdv_client_parceiro", JSON.stringify(clientForm));
    }
  }, [clientForm]);
  const [vendedorInfo, setVendedorInfo] = useState<{ id: string; nome: string; tipo_comissao?: string; valor_comissao?: number; vendas_hoje?: number; avatar_url?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [davGeradoId, setDavGeradoId] = useState<string | null>(null);
  const [davGeradoNumero, setDavGeradoNumero] = useState<string | number | null>(null);
  const [sharingSuccess, setSharingSuccess] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjErro, setCnpjErro] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingQty, setPendingQty] = useState<Record<string, string>>({});

  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<"nome" | "documento" | null>(null);

  const searchClients = async (query: string) => {
    if (query.length < 2) {
      setClientSuggestions([]);
      return;
    }
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .or(`nome.ilike.%${query}%,cpf_cnpj.ilike.%${query}%`)
      .limit(5);
    
    if (data) {
      setClientSuggestions(data);
    }
  };

  const selectClient = (client: any) => {
    setClientForm((prev: any) => ({
      ...prev,
      nome: client.nome || "",
      documento: client.cpf_cnpj || "",
      telefone: client.telefone || "",
      cep: client.cep || "",
      endereco: client.endereco || "",
      numero: client.numero || "",
      bairro: client.bairro || "",
      cidade: client.cidade || "",
      uf: client.uf || "",
    }));
    setActiveSuggestionField(null);
  };

  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nome: "", cpf_cnpj: "", telefone: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "", status: "Ativo" });
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [newClientCnpjLoading, setNewClientCnpjLoading] = useState(false);
  const [newClientCnpjErro, setNewClientCnpjErro] = useState("");

  const buscarCnpjNovoCliente = async () => {
    const cnpjLimpo = newClientForm.cpf_cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) { setNewClientCnpjErro("Digite um CNPJ válido com 14 dígitos."); return; }
    setNewClientCnpjErro("");
    setNewClientCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!res.ok) { setNewClientCnpjErro("CNPJ não encontrado na Receita Federal."); return; }
      const data = await res.json();
      
      const tel = data.ddd_telefone_1
        ? data.ddd_telefone_1.replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3")
        : newClientForm.telefone;
      const cepFmt = data.cep ? data.cep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") : "";
      const tipoLogradouro = data.descricao_tipo_de_logradouro
        ? data.descricao_tipo_de_logradouro + " "
        : "";
      const cidade = data.municipio
        ? data.municipio.charAt(0) + data.municipio.slice(1).toLowerCase()
        : newClientForm.cidade;
        
      setNewClientForm((prev: any) => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        telefone: tel,
        cep: cepFmt,
        endereco: tipoLogradouro + (data.logradouro || ""),
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        cidade,
        uf: data.uf || prev.uf,
      }));
    } catch {
      setNewClientCnpjErro("Erro ao consultar o CNPJ. Tente novamente.");
    } finally {
      setNewClientCnpjLoading(false);
    }
  };

  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.nome.trim()) { alert("Preencha o nome do cliente."); return; }
    setSavingNewClient(true);
    try {
      const { data, error } = await supabase.from("clientes").insert([{
        nome: newClientForm.nome,
        cpf_cnpj: newClientForm.cpf_cnpj || null,
        telefone: newClientForm.telefone || null,
        cep: newClientForm.cep || null,
        endereco: newClientForm.endereco || null,
        numero: newClientForm.numero || null,
        bairro: newClientForm.bairro || null,
        cidade: newClientForm.cidade || null,
        uf: newClientForm.uf || null,
        status: "Ativo"
      }]).select().single();
      if (error) throw error;
      
      if (vendedorInfo?.id) {
        const savedStr = localStorage.getItem(`novos_clientes_${vendedorInfo.id}`);
        let savedIds = [];
        try { savedIds = savedStr ? JSON.parse(savedStr) : []; } catch(e){}
        savedIds.push(data.id);
        localStorage.setItem(`novos_clientes_${vendedorInfo.id}`, JSON.stringify([...new Set(savedIds)]));
      }
      
      setClientForm((prev: any) => ({
        ...prev,
        nome: data.nome || "",
        documento: data.cpf_cnpj || "",
        telefone: data.telefone || "",
        cep: data.cep || "",
        endereco: data.endereco || "",
        numero: data.numero || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
      }));
      
      setIsNewClientModalOpen(false);
      setNewClientForm({ nome: "", cpf_cnpj: "", telefone: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "", status: "Ativo" });
    } catch (err: any) {
      alert("Erro ao cadastrar cliente: " + err.message);
    } finally {
      setSavingNewClient(false);
    }
  };

  const dynamicCategories = Array.from(new Set(produtos.map((p) => p.categoria))).filter(
    Boolean,
  ) as string[];
  const categorias = dynamicCategories;

  const toggleCategory = (cat: string) => {
    setSelectedCategory(cat);
  };

  const getCartQuantity = (id: string) => {
    const item = cart.find((i) => i.id === id);
    return item ? item.q : 0;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let aplicaAcrescimo = false;
        let acrescimoPercentual = 20;
        let vendedorId = null;
        if (session) {
          const { data: vData, error } = await supabase
            .from("vendedores")
            .select("id, status, nome, acrescimo_catalogo, acrescimo_catalogo_percentual, tipo_comissao, valor_comissao, avatar_url")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (error || !vData) {
            console.error("Vendedor não encontrado ou erro:", error);
            setVendedorInfo({ id: "error", nome: "Erro ao carregar perfil" });
            alert("Não foi possível carregar seu perfil de parceiro. Você será redirecionado.");
            navigate({ to: "/parceiro/dashboard" });
            return;
          }

          if (vData) {
            vendedorId = vData.id;
            
            // Fetch today's sales
            const hoje = new Date().toISOString().split('T')[0];
            const { data: vendasHoje } = await supabase
              .from('vendas')
              .select('valor_total')
              .eq('vendedor_id', vData.id)
              .neq('tipo', 'DAV')
              .gte('created_at', `${hoje}T00:00:00.000Z`);
              
            let totalVendasHoje = 0;
            if (vendasHoje) {
              totalVendasHoje = vendasHoje.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
            }
            
            setVendedorInfo({ id: vData.id, nome: vData.nome, tipo_comissao: vData.tipo_comissao, valor_comissao: vData.valor_comissao, vendas_hoje: totalVendasHoje, avatar_url: vData.avatar_url });
            aplicaAcrescimo = vData.acrescimo_catalogo;
            if (
              vData.acrescimo_catalogo_percentual !== null &&
              vData.acrescimo_catalogo_percentual !== undefined
            ) {
              acrescimoPercentual = Number(vData.acrescimo_catalogo_percentual);
            }
            if (vData.status === "Aguardando Aprovação") {
              navigate({ to: "/parceiro/dashboard" });
              return;
            }
          }
        } else {
          navigate({ to: "/parceiro/login" });
          return;
        }

        let customPricesMap: Record<string, number> = {};
        if (vendedorId) {
          const { data: precos } = await supabase
            .from("parceiro_precos")
            .select("produto_id, preco_personalizado")
            .eq("vendedor_id", vendedorId);
          if (precos) {
            precos.forEach((p) => {
              customPricesMap[p.produto_id] = Number(p.preco_personalizado);
            });
          }
        }

        const { data } = await supabase
          .from("produtos")
          .select("*")
          .eq("status", "Ativo")
          .order("nome");
        if (data) {
          const multiplier = 1 + acrescimoPercentual / 100;
          const produtosComPreco = data.map((p: any) => {
            let finalPrice = aplicaAcrescimo ? p.valor * multiplier : p.valor;
            if (customPricesMap[p.id] !== undefined) {
              finalPrice = customPricesMap[p.id];
            }
            return {
              ...p,
              valor: finalPrice,
            };
          });
          setProdutos(produtosComPreco);

          // Verifica se veio um produto mágico pela URL (formato antigo)
          const dataForMagic = produtosComPreco;
          const params = new URLSearchParams(window.location.search);

          const eParam = params.get("e");
          const cnjParam = params.get("cnpj");
          const cepParam = params.get("cep");
          const endParam = params.get("end");
          const numParam = params.get("num");
          const bairroParam = params.get("bairro");
          const cidParam = params.get("cid");
          const ufParam = params.get("uf");
          const telParam = params.get("tel");

          if (eParam || cnjParam) {
            setClientForm((prev: any) => ({
              ...prev,
              nome: eParam || "",
              documento: cnjParam || "",
              cep: cepParam || "",
              endereco: endParam || "",
              numero: numParam || "",
              bairro: bairroParam || "",
              cidade: cidParam || "",
              uf: ufParam || "",
              telefone: telParam || "",
            }));
          }

          const produtoIdMagic = params.get("produto");
          if (produtoIdMagic) {
            const magicProduct = dataForMagic.find((p: any) => p.id === produtoIdMagic);
            if (magicProduct) {
              setCart([
                {
                  id: magicProduct.id,
                  p: magicProduct.nome,
                  q: 1,
                  u: Number(magicProduct.valor),
                  t: Number(magicProduct.valor),
                  emoji: magicProduct.emoji,
                  imagem: magicProduct.imagem,
                },
              ]);
              // Limpa a URL para não adicionar de novo num refresh
              window.history.replaceState({}, "", "/parceiro/pdv");
            }
          }

          // Novo formato do Carrinho via Catálogo
          const cartMagic = params.get("c");
          if (cartMagic) {
            const parsedCart: any[] = [];
            const items = cartMagic.split(",");
            items.forEach((item) => {
              const [id, qStr] = item.split(":");
              const qty = parseInt(qStr) || 1;
              const prod = dataForMagic.find((p: any) => p.id === id);
              if (prod) {
                parsedCart.push({
                  id: prod.id,
                  p: prod.nome,
                  q: qty,
                  u: Number(prod.valor),
                  t: qty * Number(prod.valor),
                  emoji: prod.emoji,
                  imagem: prod.imagem,
                });
              }
            });
            if (parsedCart.length > 0) {
              setCart(parsedCart);
              window.history.replaceState({}, "", "/parceiro/pdv");
            }
          }
        }
      } catch (err: any) {
        console.error("Erro na inicialização do PDV:", err);
        setInitError(err.message || "Ocorreu um erro ao carregar o PDV.");
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  const addToCart = (produto: any, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === produto.id);
      if (existing) {
        return prev.map((i) =>
          i.id === produto.id ? { ...i, q: i.q + qty, t: (i.q + qty) * i.u } : i,
        );
      }
      return [
        ...prev,
        {
          id: produto.id,
          p: produto.nome,
          q: qty,
          u: Number(produto.valor),
          t: Number(produto.valor) * qty,
          emoji: produto.emoji,
          imagem: produto.imagem,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((i) => {
        if (i.id === id) {
          const currentQ = typeof i.q === "number" ? i.q : 0;
          const newQ = currentQ + delta;
          if (newQ <= 0) return null;
          return { ...i, q: newQ, t: newQ * i.u };
        }
        return i;
      });
      return updated.filter((i) => i !== null) as typeof prev;
    });
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

  const rawSubtotal = cart.reduce((s, i) => s + i.t, 0);
  const subtotal =
    descontoPercentual > 0 ? rawSubtotal * (1 - descontoPercentual / 100) : rawSubtotal;
  const descontoAplicado = rawSubtotal - subtotal;

  const buscarCnpj = async () => {
    const cnpjLimpo = clientForm.documento.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setCnpjErro("Digite um CNPJ válido com 14 dígitos.");
      return;
    }
    setCnpjErro("");
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!res.ok) {
        setCnpjErro("CNPJ não encontrado na Receita Federal.");
        return;
      }
      const data = await res.json();
      const tel = data.ddd_telefone_1
        ? data.ddd_telefone_1.replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3")
        : clientForm.telefone;
      const cepFmt = data.cep ? data.cep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") : "";
      const tipoLogradouro = data.descricao_tipo_de_logradouro
        ? data.descricao_tipo_de_logradouro + " "
        : "";
      const cidade = data.municipio
        ? data.municipio.charAt(0) + data.municipio.slice(1).toLowerCase()
        : clientForm.cidade;
      setClientForm((prev: any) => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        telefone: tel,
        cep: cepFmt,
        endereco: tipoLogradouro + (data.logradouro || ""),
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        cidade,
        uf: data.uf || prev.uf,
      }));
    } catch {
      setCnpjErro("Erro ao consultar o CNPJ. Tente novamente.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleOpenClientModal = () => {
    if (cart.length === 0 || !vendedorInfo) return;
    setIsClientModalOpen(true);
  };

  const salvarRascunho = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!clientForm.nome) {
      alert("Por favor, preencha o nome do cliente para salvar.");
      return;
    }

    setIsClientModalOpen(false);
    setLoading(true);

    try {
      // 1. Cria ou busca o cliente
      let finalClienteId = null;

      if (clientForm.documento && clientForm.documento.trim() !== "") {
        const { data: existingClient } = await supabase
          .from("clientes")
          .select("id")
          .eq("cpf_cnpj", clientForm.documento.trim())
          .maybeSingle();
        if (existingClient) finalClienteId = existingClient.id;
      }

      if (!finalClienteId) {
        const payload: any = { nome: clientForm.nome };
        if (clientForm.documento?.trim()) payload.cpf_cnpj = clientForm.documento.trim();
        if (clientForm.telefone?.trim()) payload.telefone = clientForm.telefone.trim();
        if (clientForm.cep?.trim()) payload.cep = clientForm.cep.trim();
        if (clientForm.endereco?.trim()) payload.endereco = clientForm.endereco.trim();
        if (clientForm.numero?.trim()) payload.numero = clientForm.numero.trim();
        if (clientForm.bairro?.trim()) payload.bairro = clientForm.bairro.trim();
        if (clientForm.cidade?.trim()) payload.cidade = clientForm.cidade.trim();
        if (clientForm.uf?.trim()) payload.uf = clientForm.uf.trim();
        payload.status = "Ativo";

        const { data: clienteData, error: clienteError } = await supabase
          .from("clientes")
          .insert([payload])
          .select()
          .maybeSingle();

        if (clienteData) {
          finalClienteId = clienteData.id;
        } else if (clienteError) {
          alert("Não foi possível salvar o cliente: " + clienteError.message);
          setLoading(false);
          return;
        }
      }

      // 2. Cria o DAV como Rascunho (não vai para o admin)
      const { data: vendaData, error: vendaError } = await supabase
        .from("vendas")
        .insert([{
          tipo: "DAV",
          status_aprovacao: "Rascunho",
          status: "Rascunho",
          subtotal: rawSubtotal,
          valor_total: subtotal,
          vendedor_id: vendedorInfo?.id,
          cliente_id: finalClienteId,
          desconto_valor: descontoAplicado,
          desconto_percentual: descontoPercentual,
          condicao_pagamento:
            clientForm.pagamento === "Boleto a Prazo"
              ? clientForm.condicaoBoleto || "Boleto a Prazo"
              : clientForm.pagamento,
        }])
        .select()
        .single();

      if (vendaError) throw vendaError;

      // 3. Insere os itens
      const itensToInsert = cart.map((i) => ({
        venda_id: vendaData.id,
        produto_id: i.id,
        quantidade: i.q,
        valor_unitario: i.u,
        subtotal: i.t,
      }));

      const { error: itensError } = await supabase.from("vendas_itens").insert(itensToInsert);
      if (itensError) throw itensError;

      // 4. Limpa o carrinho e redireciona para Meus Carrinhos
      esvaziarCarrinho();
      navigate({ to: "/parceiro/catalogo" });
    } catch (err: any) {
      alert("Erro ao salvar rascunho: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOrder = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    if (!clientForm.nome) {
      alert("Por favor, preencha o nome do cliente.");
      return;
    }

    setIsClientModalOpen(false);
    setLoading(true);

    try {
      // 1. Cria ou busca o cliente
      let finalClienteId = null;

      if (clientForm.documento && clientForm.documento.trim() !== "") {
        const { data: existingClient } = await supabase
          .from("clientes")
          .select("id")
          .eq("cpf_cnpj", clientForm.documento.trim())
          .maybeSingle();

        if (existingClient) {
          finalClienteId = existingClient.id;
        }
      }

      if (!finalClienteId) {
        const payload: any = { nome: clientForm.nome };
        if (clientForm.documento && clientForm.documento.trim() !== "") {
          payload.cpf_cnpj = clientForm.documento.trim();
        }
        if (clientForm.telefone && clientForm.telefone.trim() !== "") {
          payload.telefone = clientForm.telefone.trim();
        }
        if (clientForm.cep && clientForm.cep.trim() !== "") {
          payload.cep = clientForm.cep.trim();
        }
        if (clientForm.endereco && clientForm.endereco.trim() !== "") {
          payload.endereco = clientForm.endereco.trim();
        }
        if (clientForm.numero && clientForm.numero.trim() !== "") {
          payload.numero = clientForm.numero.trim();
        }
        if (clientForm.bairro && clientForm.bairro.trim() !== "") {
          payload.bairro = clientForm.bairro.trim();
        }
        if (clientForm.cidade && clientForm.cidade.trim() !== "") {
          payload.cidade = clientForm.cidade.trim();
        }
        if (clientForm.uf && clientForm.uf.trim() !== "") {
          payload.uf = clientForm.uf.trim();
        }
        payload.status = "Ativo";

        const { data: clienteData, error: clienteError } = await supabase
          .from("clientes")
          .insert([payload])
          .select()
          .maybeSingle();

        if (clienteData) {
          finalClienteId = clienteData.id;
        } else if (clienteError) {
          console.error("Erro ao criar cliente pelo parceiro:", clienteError);
          alert("Não foi possível salvar o cliente: " + clienteError.message);
          setLoading(false);
          return;
        }
      }

      // 2. Cria a venda pendente
      const { data: vendaData, error: vendaError } = await supabase
        .from("vendas")
        .insert([
          {
            tipo: "PDV",
            status_aprovacao: "Pendente",
            status: "Pendente",
            subtotal: rawSubtotal,
            valor_total: subtotal,
            vendedor_id: vendedorInfo?.id,
            cliente_id: finalClienteId,
            desconto_valor: descontoAplicado,
            desconto_percentual: descontoPercentual,
            condicao_pagamento:
              clientForm.pagamento === "Boleto a Prazo"
                ? clientForm.condicaoBoleto || "Boleto a Prazo"
                : clientForm.pagamento,
          },
        ])
        .select()
        .single();

      if (vendaError) throw vendaError;

      // Insere os itens
      const itensToInsert = cart.map((i) => ({
        venda_id: vendaData.id,
        produto_id: i.id,
        quantidade: i.q,
        valor_unitario: i.u,
        subtotal: i.t,
      }));

      const { error: itensError } = await supabase.from("vendas_itens").insert(itensToInsert);
      if (itensError) throw itensError;

      setDavGeradoId(vendaData.id);
      setDavGeradoNumero(vendaData.numero_venda);

      // 4. Dispara a notificação para o dono
      await supabase.from("notificacoes").insert([
        {
          tipo: "venda",
          titulo: `Novo pedido pendente`,
          mensagem: `Um parceiro enviou um novo pedido (Cliente: ${clientForm.nome}) no valor de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subtotal)} para aprovação.`,
        },
      ]);

      setIsSuccessModalOpen(true);
    } catch (err: any) {
      alert("Erro ao enviar venda: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const esvaziarCarrinho = () => {
    setCart([]);
    setClientForm({
      nome: "",
      documento: "",
      telefone: "",
      cep: "",
      endereco: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      pagamento: "Dinheiro / Pix",
      condicaoBoleto: "",
      frete: "Retirada",
      observacoes: "",
    });
  };

  const closeSuccessModal = () => {
    setIsSuccessModalOpen(false);
    esvaziarCarrinho();
    navigate({ to: "/parceiro/dashboard" });
  };

  const handleShareWhatsApp = async () => {
    if (!davGeradoId) return;
    setSharingSuccess(true);
    try {
      const orderObj = {
        id: davGeradoId,
        numero_venda: davGeradoNumero || undefined,
        tipo: "PDV",
        created_at: new Date().toISOString(),
        subtotal: rawSubtotal,
        valor_total: subtotal,
        desconto_valor: descontoAplicado,
        desconto_percentual: descontoPercentual,
        cliente: {
          nome: clientForm.nome,
          cpf_cnpj: clientForm.documento,
          telefone: clientForm.telefone,
          endereco: `${clientForm.endereco || ""}${clientForm.numero ? `, ${clientForm.numero}` : ""}`,
        },
        condicao_pagamento:
          clientForm.pagamento === "Boleto a Prazo"
            ? clientForm.condicaoBoleto || "Boleto a Prazo"
            : clientForm.pagamento,
        vendedor_nome: vendedorInfo?.nome,
      };

      const itemsList = cart.map((i) => ({
        produto_nome: i.p,
        codigo: i.c,
        quantidade: i.q,
        valor_unitario: i.u,
        subtotal: i.t,
      }));

      await shareOrderWhatsApp(orderObj, itemsList);
    } finally {
      setSharingSuccess(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-brand" />
        <p className="text-slate-600 font-medium animate-pulse">Iniciando PDV...</p>
      </div>
    );
  }

  if (initError)
    return <div className="text-center py-10 text-red-600 font-bold">Erro: {initError}</div>;

  if (!vendedorInfo)
    return <div className="text-center py-10">Verificando perfil de vendedor...</div>;

  // Filter products by search and category
  const filteredProducts = produtos.filter((p) => {
    const matchesSearch =
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codigo && p.codigo.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedCategory === "Todos") return matchesSearch;

    const prodCat = (p.categoria || "").toLowerCase();
    const selCat = selectedCategory.toLowerCase();

    let matchesCategory = prodCat === selCat;

    // Fuzzy matching para as categorias fixas no plural
    if (selCat === "vasos" && prodCat.includes("vaso")) matchesCategory = true;
    if (selCat === "pratos" && prodCat.includes("prato")) matchesCategory = true;
    if (selCat === "cuias" && prodCat.includes("cuia")) matchesCategory = true;
    if (selCat === "floreiras" && prodCat.includes("floreira")) matchesCategory = true;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-48 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="bg-gradient-brand px-4 pt-10 pb-12 lg:sticky lg:top-0 z-10 rounded-b-3xl shadow-md relative text-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <GardenPrimeLogo horizontal size="small" className="brightness-0 invert" />
          </div>
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-slate-200 rounded-full overflow-hidden shrink-0 border-2 border-white/20">
              <img src={vendedorInfo?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${vendedorInfo?.nome}&backgroundColor=e2e8f0`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">{vendedorInfo.nome.split(" ")[0]}</p>
              <p className="text-xs text-white/90 font-medium">Vendas de hoje: R$ {(vendedorInfo.vendas_hoje || 0).toFixed(2).replace(".", ",")}</p>
              <p className="text-xs text-white/90 font-medium">
                 Comissão: {vendedorInfo.tipo_comissao === "Fixo" ? `R$ ${vendedorInfo.valor_comissao?.toFixed(2)}` : `${vendedorInfo.valor_comissao}%`}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white h-8 px-3 text-xs"
            onClick={() => setIsNewClientModalOpen(true)}
          >
            Cadastrar cliente
          </Button>
        </div>
        
        {/* Search bar overlapping */}
        <div className="absolute -bottom-6 left-4 right-4 z-20">
          <div className="relative flex items-center bg-white rounded-2xl shadow-lg border border-slate-100">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Buscar produto ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-14 pl-12 pr-20 rounded-2xl bg-transparent border-0 shadow-none text-slate-800 focus-visible:ring-0 text-base"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
               <Mic className="w-5 h-5 text-brand" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-10 pb-2">
        <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand">Cliente</p>
            {clientForm.nome ? (
              <>
                <h2 className="text-sm font-bold text-slate-800 leading-tight line-clamp-1">
                  {clientForm.nome}
                </h2>
                {clientForm.documento && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    CNPJ: {clientForm.documento}
                  </p>
                )}
              </>
            ) : (
              <h2 className="text-sm font-bold text-slate-400 leading-tight">Nenhum cliente</h2>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsClientModalOpen(true)}
            className="h-8 px-3 rounded-lg text-xs font-bold text-brand hover:bg-brand/10"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            {clientForm.nome ? "Trocar" : "Selecionar"}
          </Button>
        </div>
      </div>



      <div className="p-4 space-y-6">
        {/* Categories Tabs */}
        <div>
          <h3 className="font-bold text-lg text-slate-900 mb-3">Categorias</h3>
          <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar bg-slate-50 py-1">
            <button
              onClick={() => toggleCategory("Todos")}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors ${selectedCategory === "Todos" ? "bg-emerald-700 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              Todos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors ${selectedCategory === cat ? "bg-emerald-700 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Vertical Product List */}
        <div className="space-y-3">
          {filteredProducts.map((p) => {
            const qtd = getCartQuantity(p.id);
            return (
              <div
                key={p.id}
                className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-stretch gap-3"
              >
                <div className="h-20 w-20 bg-slate-50 rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
                  {p.imagem ? (
                    <img
                      src={p.imagem}
                      alt={p.nome}
                      className="h-full w-full object-cover mix-blend-multiply"
                    />
                  ) : (
                    <span className="text-3xl opacity-50">{p.emoji || "🪴"}</span>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                  <div>
                    <p className="text-[13px] font-bold text-slate-900 leading-tight mb-1 line-clamp-2">{p.nome}</p>
                    <p className="text-[11px] text-slate-600 mb-0.5">Código: {p.codigo || "N/A"}</p>
                    <p className="text-[11px] text-slate-600">Estoque: {p.estoque || 0} und</p>
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-1">
                    R$ {Number(p.valor).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                
                <div className="flex flex-col justify-between shrink-0 w-[90px]">
                  <div className="flex items-center bg-emerald-700 rounded-lg overflow-hidden h-[30px] mb-2">
                    <button
                      onClick={() => {
                        if (qtd === 0) return;
                        updateQuantity(p.id, -1);
                      }}
                      className="w-7 h-full text-white flex items-center justify-center hover:bg-emerald-800"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      className="w-full text-center text-sm font-bold text-slate-900 bg-white h-full outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={qtd > 0 ? qtd : (pendingQty[p.id] ?? "1")}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        if (qtd > 0) {
                          setQuantity(p.id, valStr);
                          if (valStr === "" || parseInt(valStr) <= 0) removeFromCart(p.id);
                        } else {
                          setPendingQty((prev) => ({ ...prev, [p.id]: valStr }));
                        }
                      }}
                      onBlur={(e) => {
                        if (qtd > 0 && (e.target.value === "" || parseInt(e.target.value) <= 0))
                          removeFromCart(p.id);
                      }}
                    />
                    <button
                      onClick={() => {
                        if (qtd === 0) {
                          const pending = parseInt(pendingQty[p.id] ?? "1");
                          addToCart(p, isNaN(pending) || pending <= 0 ? 1 : pending + 1);
                        } else {
                          updateQuantity(p.id, 1);
                        }
                      }}
                      className="w-7 h-full text-white flex items-center justify-center hover:bg-emerald-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (qtd === 0) {
                        const pending = parseInt(pendingQty[p.id] ?? "1");
                        addToCart(p, isNaN(pending) || pending <= 0 ? 1 : pending);
                        setPendingQty((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                      }
                    }}
                    className="bg-emerald-700 text-white text-[13px] font-bold w-full h-[30px] rounded-lg shadow-sm hover:bg-emerald-800 active:scale-95 transition-transform flex items-center justify-center"
                  >
                    {qtd > 0 ? "Adicionado" : "Adicionar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumo Flutuante (Floating Summary) */}
      <div className="fixed bottom-[100px] lg:bottom-10 left-0 right-0 px-4 z-40 pointer-events-none pb-safe max-w-4xl lg:max-w-md mx-auto w-full">
        <div className="pointer-events-auto">
            <div className="animate-in slide-in-from-bottom-5 fade-in duration-300">
              <Sheet>
                <SheetTrigger asChild>
                  <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-black/20 p-3 pl-6 pr-3 flex items-center justify-between cursor-pointer ring-1 ring-black/10">
                    <div>
                      <p className="font-bold text-sm text-slate-800 flex items-center gap-2">
                        Resumo do Pedido
                        {vendedorInfo && (
                          <span className="text-[10px] font-bold bg-[#12794C]/10 text-[#12794C] px-2 py-0.5 rounded-full border border-[#12794C]/20">
                            Comissão: {vendedorInfo.tipo_comissao === "Fixo" ? `R$ ${vendedorInfo.valor_comissao?.toFixed(2)}` : `${vendedorInfo.valor_comissao}%`}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {cart.length} itens | Total <span className="font-bold text-slate-900">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                      </p>
                    </div>
                    <button className="bg-[#12794C] text-white px-6 py-3 rounded-full font-bold text-sm flex items-center gap-1 shadow-md active:scale-95 transition-transform pointer-events-none">
                      Finalizar <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 flex flex-col pointer-events-auto">
                  <SheetHeader className="p-4 border-b text-left">
                    <div className="flex justify-between items-center">
                      <SheetTitle className="flex items-center gap-2 text-lg">
                        <ShoppingCart className="w-5 h-5" /> Seu Carrinho
                      </SheetTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={esvaziarCarrinho}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 text-xs"
                      >
                        Esvaziar
                      </Button>
                    </div>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map((i) => (
                      <div key={i.id} className="flex gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm relative">
                        <button
                          onClick={() => removeFromCart(i.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-white border shadow-sm rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-50 z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                          {i.imagem ? <img src={i.imagem} alt={i.p} className="w-full h-full object-cover" /> : i.emoji}
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-0.5">
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{i.p}</p>
                            <p className="text-[10px] text-slate-500 mt-1">R$ {i.u.toFixed(2).replace(".", ",")} un</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                              <button onClick={() => updateQuantity(i.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm"><Minus className="w-3 h-3" /></button>
                              <span className="text-xs font-bold w-4 text-center">{i.q}</span>
                              <button onClick={() => updateQuantity(i.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm"><Plus className="w-3 h-3" /></button>
                            </div>
                            <p className="text-sm font-black text-slate-900">R$ {i.t.toFixed(2).replace(".", ",")}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t bg-slate-50 rounded-t-[32px] -mt-4 relative z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-between items-center mb-4 px-2">
                      <span className="text-sm font-semibold text-slate-600">Subtotal</span>
                      <span className="font-bold text-lg text-slate-800">R$ {rawSubtotal.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <Button
                      onClick={() => {
                        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                        handleOpenClientModal();
                      }}
                      className="w-full h-14 bg-gradient-brand text-white font-bold text-base shadow-lg shadow-brand/25 rounded-2xl"
                    >
                      Avançar para Pagamento
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
        </div>
      </div>

      {/* Modal de Sucesso */}
      <Dialog open={isSuccessModalOpen} onOpenChange={closeSuccessModal}>
        <DialogContent className="w-[90vw] sm:max-w-[425px] rounded-2xl text-center">
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl">Pedido Enviado!</DialogTitle>
            <DialogDescription className="text-center text-base">
              A venda foi registrada com sucesso e está aguardando a aprovação da loja para liberar
              sua comissão.
            </DialogDescription>
          </div>
          <div className="pt-2 flex flex-col gap-2.5 w-full">
            {davGeradoId && (
              <>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-sm sm:text-base font-bold shadow-md rounded-xl flex items-center justify-center gap-2"
                  onClick={handleShareWhatsApp}
                  disabled={sharingSuccess}
                >
                  {sharingSuccess ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <WhatsAppIcon className="w-5 h-5 shrink-0" />
                  )}
                  <span>Enviar PDF no WhatsApp</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    onClick={() => openOrderPdf(davGeradoId)}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Ver / Imprimir PDF</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    onClick={() => {
                      const orderObj = {
                        id: davGeradoId,
                        numero_venda: davGeradoNumero || undefined,
                        tipo: "PDV",
                        created_at: new Date().toISOString(),
                        subtotal: rawSubtotal,
                        valor_total: subtotal,
                        desconto_valor: descontoAplicado,
                        desconto_percentual: descontoPercentual,
                        cliente: {
                          nome: clientForm.nome,
                          cpf_cnpj: clientForm.documento,
                          telefone: clientForm.telefone,
                          endereco: `${clientForm.endereco || ""}${clientForm.numero ? `, ${clientForm.numero}` : ""}`,
                        },
                        condicao_pagamento:
                          clientForm.pagamento === "Boleto a Prazo"
                            ? clientForm.condicaoBoleto || "Boleto a Prazo"
                            : clientForm.pagamento,
                        vendedor_nome: vendedorInfo?.nome,
                      };
                      const itemsList = cart.map((i) => ({
                        produto_nome: i.p,
                        codigo: i.c,
                        quantidade: i.q,
                        valor_unitario: i.u,
                        subtotal: i.t,
                      }));
                      downloadOrderPdf(orderObj, itemsList);
                    }}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Baixar PDF</span>
                  </Button>
                </div>
              </>
            )}
            <Button
              variant="outline"
              className="w-full border-slate-200 text-slate-600 hover:bg-slate-100 h-10 text-xs font-semibold rounded-xl mt-1"
              onClick={closeSuccessModal}
            >
              Voltar ao Painel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal do Cliente */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl p-5 sm:p-6">
          <form onSubmit={submitOrder}>
            <DialogHeader>
              <DialogTitle>Finalizar Geração de Orçamento / Pedido</DialogTitle>
              <DialogDescription>
                Preencha os dados abaixo. Eles sairão no PDF oficial e serão enviados à loja.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-brand text-sm border-b pb-1">Dados do Cliente</h3>
                <div className="grid gap-2 relative">
                  <label className="text-sm font-medium">Nome / Empresa *</label>
                  <Input
                    required
                    placeholder="Ex: João Silva ou Construtora X"
                    value={clientForm.nome}
                    onFocus={() => { if(clientForm.nome.length >= 2) setActiveSuggestionField("nome"); }}
                    onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientForm({ ...clientForm, nome: val });
                      searchClients(val);
                      setActiveSuggestionField("nome");
                    }}
                  />
                  {activeSuggestionField === "nome" && clientSuggestions.length > 0 && (
                    <div className="absolute top-[100%] left-0 right-0 z-[100] mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {clientSuggestions.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-0"
                          onClick={() => selectClient(c)}
                        >
                          <div className="bg-zinc-800 rounded-full p-1.5 shrink-0">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-medium text-zinc-100">{c.nome}</p>
                            {(c.cpf_cnpj || c.telefone) && (
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                {[c.cpf_cnpj, c.telefone].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-2 relative">
                  <label className="text-sm font-medium">CPF / CNPJ</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Apenas números"
                      value={clientForm.documento}
                      onFocus={() => { if(clientForm.documento.length >= 2) setActiveSuggestionField("documento"); }}
                      onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCnpjErro("");
                        setClientForm({ ...clientForm, documento: val });
                        searchClients(val);
                        setActiveSuggestionField("documento");
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={buscarCnpj}
                      disabled={cnpjLoading}
                      title="Buscar dados pelo CNPJ"
                      className="shrink-0"
                    >
                      {cnpjLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {activeSuggestionField === "documento" && clientSuggestions.length > 0 && (
                    <div className="absolute top-[100%] left-0 right-0 z-[100] mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {clientSuggestions.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-0"
                          onClick={() => selectClient(c)}
                        >
                          <div className="bg-zinc-800 rounded-full p-1.5 shrink-0">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-medium text-zinc-100">{c.nome}</p>
                            {(c.cpf_cnpj || c.telefone) && (
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                {[c.cpf_cnpj, c.telefone].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-red-500 font-medium -mt-1">Aperte na lupa para puxar os dados</p>
                  {cnpjErro && <p className="text-xs text-destructive">{cnpjErro}</p>}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Telefone / WhatsApp</label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={clientForm.telefone}
                    onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">CEP</label>
                    <Input
                      placeholder="00000-000"
                      value={clientForm.cep}
                      onChange={(e) => setClientForm({ ...clientForm, cep: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Endereço (Rua)</label>
                    <Input
                      placeholder="Rua Exemplo"
                      value={clientForm.endereco}
                      onChange={(e) => setClientForm({ ...clientForm, endereco: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Número</label>
                    <Input
                      placeholder="123"
                      value={clientForm.numero}
                      onChange={(e) => setClientForm({ ...clientForm, numero: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Bairro</label>
                    <Input
                      placeholder="Centro"
                      value={clientForm.bairro}
                      onChange={(e) => setClientForm({ ...clientForm, bairro: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Cidade</label>
                    <Input
                      placeholder="Sua Cidade"
                      value={clientForm.cidade}
                      onChange={(e) => setClientForm({ ...clientForm, cidade: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Estado (UF)</label>
                    <Input
                      placeholder="SP"
                      value={clientForm.uf}
                      onChange={(e) => setClientForm({ ...clientForm, uf: e.target.value })}
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-2">
                <h3 className="font-semibold text-brand text-sm border-b pb-1">Condições</h3>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Forma de Pagamento</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={clientForm.pagamento}
                    onChange={(e) => {
                      setClientForm({ ...clientForm, pagamento: e.target.value });
                    }}
                  >
                    <option>Dinheiro / Pix</option>
                    <option>Cartão de Crédito</option>
                    <option>Cartão de Débito</option>
                    <option>Boleto a Prazo</option>
                  </select>
                  {clientForm.pagamento === "Boleto a Prazo" && (
                    <Input
                      placeholder="Ex: 30/60/90 Dias"
                      value={clientForm.condicaoBoleto}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, condicaoBoleto: e.target.value })
                      }
                      className="mt-1"
                    />
                  )}
                  <div className="mt-2">
                    <label className="text-sm font-medium">Aplicar Desconto (%)</label>
                    <div className="flex items-center mt-1 border rounded-md px-3 bg-white focus-within:ring-1 focus-within:ring-brand">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={descontoPercentual}
                        onChange={(e) => setDescontoPercentual(parseFloat(e.target.value) || 0)}
                        className="flex h-10 w-full outline-none bg-transparent text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="Ex: 5"
                      />
                      <span className="text-muted-foreground font-semibold">%</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Forma do Frete</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={clientForm.frete}
                    onChange={(e) => setClientForm({ ...clientForm, frete: e.target.value })}
                  >
                    <option>Retirada</option>
                    <option>FOB (Por conta do cliente)</option>
                    <option>CIF (Por conta da loja)</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input
                    placeholder="Anotações extras..."
                    value={clientForm.observacoes}
                    onChange={(e) => setClientForm({ ...clientForm, observacoes: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border-t -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 mt-4 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] rounded-b-2xl">
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Total a Pagar
                </p>
                {descontoPercentual > 0 ? (
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground line-through">
                      R$ {rawSubtotal.toFixed(2).replace(".", ",")}
                    </span>
                    <p className="text-xl font-extrabold text-brand font-display">
                      R$ {subtotal.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                ) : (
                  <p className="text-xl font-extrabold text-brand font-display">
                    R$ {subtotal.toFixed(2).replace(".", ",")}
                  </p>
                )}
              </div>
              <div className="flex flex-col w-full sm:w-auto gap-2">
                <div className="flex gap-2 w-full">
                  <Button size="sm" type="button" variant="outline" className="flex-1 text-xs px-2" onClick={() => setIsClientModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    className="flex-1 text-xs px-2 border-emerald-700 text-emerald-700 hover:bg-emerald-50"
                    onClick={salvarRascunho}
                    disabled={loading}
                  >
                    Salvar Carrinho
                  </Button>
                </div>
                <Button size="sm" type="submit" disabled={loading} className="w-full text-xs bg-emerald-700 hover:bg-emerald-800 text-white">
                  {loading ? "Processando..." : "Gerar Pedido"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl p-5 sm:p-6">
          <form onSubmit={handleSaveNewClient}>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente rapidamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Nome / Empresa *</label>
                <Input required placeholder="Ex: João Silva ou Construtora X" value={newClientForm.nome} onChange={e => setNewClientForm({...newClientForm, nome: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">CPF / CNPJ</label>
                <div className="flex gap-2">
                  <Input placeholder="Apenas números" value={newClientForm.cpf_cnpj} onChange={e => { setNewClientCnpjErro(""); setNewClientForm({...newClientForm, cpf_cnpj: e.target.value}); }} />
                  <Button type="button" variant="outline" size="icon" onClick={buscarCnpjNovoCliente} disabled={newClientCnpjLoading}>
                    {newClientCnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-red-500 font-medium -mt-1">Aperte na lupa para puxar os dados</p>
                {newClientCnpjErro && <p className="text-xs text-destructive">{newClientCnpjErro}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Telefone / WhatsApp</label>
                <Input placeholder="(00) 00000-0000" value={newClientForm.telefone} onChange={e => setNewClientForm({...newClientForm, telefone: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">CEP</label>
                  <Input placeholder="00000-000" value={newClientForm.cep} onChange={e => setNewClientForm({...newClientForm, cep: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Endereço (Rua)</label>
                  <Input placeholder="Rua Exemplo" value={newClientForm.endereco} onChange={e => setNewClientForm({...newClientForm, endereco: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Número</label>
                  <Input placeholder="123" value={newClientForm.numero} onChange={e => setNewClientForm({...newClientForm, numero: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Bairro</label>
                  <Input placeholder="Centro" value={newClientForm.bairro} onChange={e => setNewClientForm({...newClientForm, bairro: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input placeholder="Sua Cidade" value={newClientForm.cidade} onChange={e => setNewClientForm({...newClientForm, cidade: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Estado (UF)</label>
                  <Input placeholder="SP" maxLength={2} value={newClientForm.uf} onChange={e => setNewClientForm({...newClientForm, uf: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border-t -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 mt-4 p-4 sm:p-5 flex justify-end gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] rounded-b-2xl">
              <Button type="button" variant="outline" onClick={() => setIsNewClientModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingNewClient} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                {savingNewClient ? "Salvando..." : "Salvar Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
