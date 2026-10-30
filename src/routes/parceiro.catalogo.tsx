import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  ShoppingCart,
  FileText,
  Share2,
  Check,
  Eye,
  Plus,
  Minus,
  Sparkles,
  Layers,
  ArrowRight,
  Maximize2,
  X,
  Package,
  Info,
  CheckCircle2,
  Tablet,
} from "lucide-react";
import { ColorDock } from "@/components/color-dock";
import jsPDF from "jspdf";
import { cn, sortCategorias, getCategoryPriority, limparDescricaoComplementar, loadCategoryOrderFromDb } from "@/lib/utils";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

export const Route = createFileRoute("/parceiro/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo Digital — GARDEN PRIME" }] }),
  component: ParceiroCatalogoPage,
});

function ParceiroCatalogoPage() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendedor, setVendedor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todas");
  const [modoApresentacao, setModoApresentacao] = useState(true); // Oculta estoque bruto para o cliente
  const [selectedProduto, setSelectedProduto] = useState<any | null>(null);
  const [modalQtd, setModalQtd] = useState<number | string>(1);
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Carrinho sincronizado com o PDV do parceiro
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pdv_cart_parceiro");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao ler carrinho:", e);
      }
    }
    return [];
  });

  // Salva no localStorage quando o carrinho mudar
  const salvarCarrinho = (novoCart: any[]) => {
    setCart(novoCart);
    if (typeof window !== "undefined") {
      localStorage.setItem("pdv_cart_parceiro", JSON.stringify(novoCart));
    }
  };

  useEffect(() => {
    const carregarCatalogo = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate({ to: "/parceiro/login" });
          return;
        }

        // 1. Dados do vendedor
        const { data: vData } = await supabase
          .from("vendedores")
          .select("id, status, nome, telefone, acrescimo_catalogo, acrescimo_catalogo_percentual, avatar_url")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setVendedor(vData || null);

        // 2. Preços personalizados do vendedor
        let customPricesMap: Record<string, number> = {};
        if (vData?.id) {
          const { data: precos } = await supabase
            .from("parceiro_precos")
            .select("produto_id, preco_personalizado")
            .eq("vendedor_id", vData.id);
          if (precos) {
            precos.forEach((p) => {
              customPricesMap[p.produto_id] = Number(p.preco_personalizado);
            });
          }
        }

        await loadCategoryOrderFromDb();

        // 3. Produtos ativos (com cache de 5 minutos no sessionStorage para economizar Egress)
        const CACHE_KEY = "gp_parceiro_catalogo_prod_v2";
        const CACHE_TIME = "gp_parceiro_catalogo_time_v2";
        let prods: any[] | null = null;
        try {
          const cached = sessionStorage.getItem(CACHE_KEY);
          const time = sessionStorage.getItem(CACHE_TIME);
          if (cached && time && Date.now() - Number(time) < 5 * 60 * 1000) {
            prods = JSON.parse(cached);
          }
        } catch {}

        if (!prods) {
          const res = await supabase
            .from("produtos")
            .select("id, codigo, nome, categoria, imagem, emoji, valor, cores, descricao, descricao_complementar, estoque, status, dimensao, volume")
            .eq("status", "Ativo")
            .order("nome");
          prods = res.data;
          if (prods && prods.length > 0) {
            try {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(prods));
              sessionStorage.setItem(CACHE_TIME, String(Date.now()));
            } catch {}
          }
        }

        if (prods && prods.length > 0) {
          const percentual =
            vData?.acrescimo_catalogo_percentual !== null &&
            vData?.acrescimo_catalogo_percentual !== undefined
              ? Number(vData.acrescimo_catalogo_percentual)
              : 20;
          const multiplier = 1 + percentual / 100;

          const produtosComPreco = prods.map((prod: any) => {
            let finalPrice = vData?.acrescimo_catalogo ? Number(prod.valor) * multiplier : Number(prod.valor);
            if (customPricesMap[prod.id] !== undefined) {
              finalPrice = customPricesMap[prod.id];
            }
            return {
              ...prod,
              valorFinal: finalPrice,
            };
          });
          setProdutos(produtosComPreco);
        }
      } catch (err) {
        console.error("Erro ao carregar catálogo:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarCatalogo();
  }, [navigate]);

  // Categorias disponíveis (Terra -> Substrato -> Casca/Adubo -> Mogi -> Jardinagem -> Pedra -> Intermediários -> Vasos -> Ferragens/Suportes)
  const categorias = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    const lista = Array.from(set).sort(sortCategorias);
    return ["Todas", ...lista];
  }, [produtos]);

  // Produtos filtrados ordenados pela prioridade de categoria
  const produtosFiltrados = useMemo(() => {
    const res = produtos.filter((p) => {
      const termo = busca.toLowerCase().trim();
      const matchBusca =
        !termo ||
        p.nome?.toLowerCase().includes(termo) ||
        (p.codigo && p.codigo.toLowerCase().includes(termo)) ||
        (p.categoria && p.categoria.toLowerCase().includes(termo));
      const matchCategoria = categoriaAtiva === "Todas" || p.categoria === categoriaAtiva;
      return matchBusca && matchCategoria;
    });

    return res.sort((a, b) => {
      const pCatA = getCategoryPriority(a.categoria);
      const pCatB = getCategoryPriority(b.categoria);
      if (pCatA !== pCatB) return pCatA - pCatB;
      if ((a.categoria || "") !== (b.categoria || "")) {
        return (a.categoria || "").localeCompare(b.categoria || "", "pt-BR");
      }
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });
  }, [produtos, busca, categoriaAtiva]);

  // Quantidade de um produto já presente no carrinho
  const getQtdNoCarrinho = (produtoId: string) => {
    const item = cart.find((i) => i.id === produtoId);
    return item ? item.q : 0;
  };

  // Atualizar quantidade direta de um item no carrinho
  const handleSetQtdCarrinho = (produto: any, quantidade: number) => {
    const preco = Number(produto.valorFinal || produto.valor);
    if (quantidade <= 0) {
      salvarCarrinho(cart.filter((i) => i.id !== produto.id));
      return;
    }
    const existingIndex = cart.findIndex((i) => i.id === produto.id);
    let novoCart: any[];
    if (existingIndex >= 0) {
      novoCart = cart.map((item, idx) =>
        idx === existingIndex
          ? { ...item, q: quantidade, t: quantidade * preco }
          : item
      );
    } else {
      novoCart = [
        ...cart,
        {
          id: produto.id,
          p: produto.nome,
          q: quantidade,
          u: preco,
          t: quantidade * preco,
          emoji: produto.emoji,
          imagem: produto.imagem,
        },
      ];
    }
    salvarCarrinho(novoCart);
  };

  // Adicionar ao pedido
  const handleAdicionarAoPedido = (produto: any, quantidade: number = 1) => {
    const preco = Number(produto.valorFinal || produto.valor);
    const existingIndex = cart.findIndex((i) => i.id === produto.id);

    let novoCart: any[];
    if (existingIndex >= 0) {
      novoCart = cart.map((item, idx) => {
        if (idx === existingIndex) {
          const novaQtd = item.q + quantidade;
          return {
            ...item,
            q: novaQtd,
            t: novaQtd * preco,
          };
        }
        return item;
      });
    } else {
      novoCart = [
        ...cart,
        {
          id: produto.id,
          p: produto.nome,
          q: quantidade,
          u: preco,
          t: quantidade * preco,
          emoji: produto.emoji,
          imagem: produto.imagem,
        },
      ];
    }

    salvarCarrinho(novoCart);
  };

  // Remover do pedido
  const handleRemoverDoPedido = (produtoId: string) => {
    const existingIndex = cart.findIndex((i) => i.id === produtoId);
    if (existingIndex < 0) return;

    const item = cart[existingIndex];
    let novoCart: any[];
    if (item.q > 1) {
      novoCart = cart.map((i, idx) =>
        idx === existingIndex
          ? { ...i, q: i.q - 1, t: (i.q - 1) * i.u }
          : i
      );
    } else {
      novoCart = cart.filter((i) => i.id !== produtoId);
    }
    salvarCarrinho(novoCart);
  };

  // Totais do carrinho
  const totalItensCarrinho = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.q || 0), 0);
  }, [cart]);

  const valorTotalCarrinho = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.t || 0), 0);
  }, [cart]);

  // Compartilhar link público do catálogo com o cliente
  const linkPublico = useMemo(() => {
    if (typeof window === "undefined") return "";
    const ident = vendedor?.id || "";
    return `${window.location.origin}/catalogo?v=${ident}`;
  }, [vendedor]);

  const handleCopiarLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(linkPublico);
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 2500);
    }
  };

  const handleShareCatalogoWhatsApp = () => {
    const texto = encodeURIComponent(
      `Olá! Acesse nosso catálogo digital de produtos Garden Prime através deste link:\n${linkPublico}\n\nFico à disposição para tirar qualquer dúvida e anotar seu pedido!`
    );
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  const handleShareProdutoWhatsApp = (produto: any) => {
    const preco = Number(produto.valorFinal || produto.valor).toFixed(2).replace(".", ",");
    let texto = `*${produto.nome}* - Garden Prime\n`;
    if (produto.codigo) texto += `Ref: ${produto.codigo}\n`;
    if (produto.dimensao) texto += `Dimensões: ${produto.dimensao}\n`;
    if (produto.volume) texto += `Volume: ${produto.volume}L\n`;
    texto += `Preço: R$ ${preco}\n\n`;
    texto += `Veja mais no nosso catálogo: ${linkPublico}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  // Gerador de PDF em formato visual bonito
  const gerarPDFCatalogo = async () => {
    setGerandoPdf(true);
    try {
      const { data: config } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const cols = 3;
      const colWidth = (pageWidth - margin * 2) / cols;
      const imgSize = colWidth - 6;
      const cardHeight = imgSize + 48;
      const titleH = 14;

      const toBase64 = (url: string): Promise<string | null> =>
        fetch(url)
          .then((r) => r.blob())
          .then(
            (blob) =>
              new Promise<string | null>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
              })
          )
          .catch(() => null);

      const [gardenPrimeLogo64, ...loadedImages] = await Promise.all([
        toBase64("/garden-prime-logo.png"),
        ...produtosFiltrados.filter((p) => p.imagem).map((p) => toBase64(p.imagem)),
      ]);

      const imageCache: Record<string, string | null> = {};
      produtosFiltrados
        .filter((p) => p.imagem)
        .forEach((p, idx) => {
          imageCache[p.id] = loadedImages[idx];
        });

      let yPos = 14;

      // Cabeçalho
      if (gardenPrimeLogo64) {
        doc.addImage(gardenPrimeLogo64, "PNG", margin, yPos, 44, 12);
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(config?.nome_fantasia || "GARDEN PRIME", margin, yPos + 18);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      if (vendedor?.nome) {
        doc.text(`Consultor / Vendedor: ${vendedor.nome}`, margin, yPos + 22.5);
      }

      yPos += 30;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 163, 74);
      doc.text("Catálogo Digital de Produtos", margin, yPos);
      yPos += 10;

      const categoriasPDF = Array.from(new Set(produtosFiltrados.map((p) => p.categoria || "Geral"))).sort(sortCategorias);

      for (const cat of categoriasPDF) {
        const prodsCat = produtosFiltrados.filter((p) => (p.categoria || "Geral") === cat);
        if (!prodsCat.length) continue;

        if (yPos + titleH + cardHeight > pageHeight - 10) {
          doc.addPage();
          yPos = 15;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 163, 74);
        doc.text(cat.toUpperCase(), margin, yPos);
        yPos += 8;

        let col = 0;
        let rowStartY = yPos;

        for (const p of prodsCat) {
          if (col >= cols) {
            col = 0;
            rowStartY += cardHeight + 6;
            yPos = rowStartY;

            if (rowStartY + cardHeight > pageHeight - 10) {
              doc.addPage();
              yPos = 15;
              rowStartY = 15;
            }
          }

          const xPos = margin + col * colWidth;
          const imgX = xPos + 3;
          const imgY = rowStartY + 2;
          const imgW = imgSize;
          const imgH = imgSize;

          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(xPos, rowStartY, colWidth - 3, cardHeight, 2, 2, "FD");

          if (p.imagem && imageCache[p.id]) {
            try {
              doc.addImage(imageCache[p.id]!, "JPEG", imgX, imgY, imgW, imgH);
            } catch {
              doc.setFillColor(241, 245, 249);
              doc.rect(imgX, imgY, imgW, imgH, "F");
            }
          } else {
            doc.setFillColor(241, 245, 249);
            doc.rect(imgX, imgY, imgW, imgH, "F");
          }

          const textX = xPos + 4;
          const textW = colWidth - 10;
          let textY = rowStartY + imgSize + 6;
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          const nomeLines = (doc.splitTextToSize(p.nome || "", textW) as string[]).slice(0, 2);
          doc.text(nomeLines, textX, textY);
          textY += nomeLines.length * 3.2 + 1.3;

          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`Cód: ${p.codigo || "-"}`, textX, textY);
          textY += 3.8;

          const descTxt = limparDescricaoComplementar(p.descricao_complementar) || p.descricao || "";
          if (descTxt) {
            doc.setFontSize(6);
            doc.setTextColor(70, 70, 70);
            let descLines = doc.splitTextToSize(String(descTxt), textW) as string[];
            if (descLines.length > 4) {
              descLines = descLines.slice(0, 4);
              descLines[3] = descLines[3].replace(/.{0,2}$/, "") + "...";
            }
            doc.text(descLines, textX, textY);
          }

          const preco = Number(p.valorFinal || p.valor);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(22, 163, 74);
          doc.text(`R$ ${preco.toFixed(2).replace(".", ",")}`, textX, rowStartY + cardHeight - 3);

          col++;
        }

        yPos = rowStartY + cardHeight + 12;
        if (yPos > pageHeight - 10) {
          doc.addPage();
          yPos = 15;
        }
      }

      doc.save(`catalogo-gardenprime-${vendedor?.nome ? vendedor.nome.toLowerCase().replace(/\s+/g, "-") : "vendedor"}.pdf`);
    } catch (err: any) {
      alert("Erro ao gerar PDF: " + err.message);
    } finally {
      setGerandoPdf(false);
    }
  };

  // Cores gradientes para cartões sem imagem
  const getGradient = (index: number) => {
    const gradients = [
      "from-emerald-500/15 to-teal-500/25",
      "from-teal-500/15 to-emerald-500/25",
      "from-amber-500/15 to-emerald-500/25",
      "from-green-500/15 to-lime-500/25",
      "from-stone-500/15 to-emerald-500/25",
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── BARRA SUPERIOR: Apresentação & Ações Rápidas ── */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Vitrine Digital • Tablet & Celular
            </span>
            {vendedor?.nome && (
              <span className="text-xs text-slate-500 hidden sm:inline-block">
                Consultor: <strong>{vendedor.nome}</strong>
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-slate-900 mt-1.5">
            Catálogo de Produtos
          </h1>
          <p className="text-sm text-slate-500">
            Apresente a linha completa da Garden Prime aos seus clientes com fotos e dimensões.
          </p>
        </div>

        {/* Controles e Ações */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Switch Modo Apresentação */}
          <div
            onClick={() => setModoApresentacao(!modoApresentacao)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-2xl border cursor-pointer select-none transition-all",
              modoApresentacao
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            )}
            title="Oculta quantidades exatas de estoque para uma apresentação limpa ao cliente"
          >
            <Tablet className="w-4 h-4 text-emerald-700 shrink-0" />
            <div className="text-left text-xs">
              <span className="font-bold block">Modo Cliente</span>
              <span className="text-[10px] text-slate-500">
                {modoApresentacao ? "Estoque simplificado" : "Estoque visível"}
              </span>
            </div>
            <Switch
              checked={modoApresentacao}
              onCheckedChange={setModoApresentacao}
              className="ml-1 data-[state=checked]:bg-emerald-700"
            />
          </div>

          {/* Botão Gerar PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={gerarPDFCatalogo}
            disabled={gerandoPdf}
            className="rounded-2xl h-11 px-3.5 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all gap-1.5"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Baixar</span> PDF
          </Button>

          {/* Botão Compartilhar WhatsApp */}
          <Button
            size="sm"
            onClick={handleShareCatalogoWhatsApp}
            className="rounded-2xl h-11 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold transition-all shadow-sm gap-2"
          >
            <WhatsAppIcon className="w-4 h-4" />
            <span>Compartilhar</span>
          </Button>

          {/* Botão Copiar Link */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopiarLink}
            className="rounded-2xl h-11 px-3 border-slate-200 font-medium text-slate-600 hover:bg-slate-50"
            title="Copiar link público do catálogo do parceiro"
          >
            {copiadoLink ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline ml-1">{copiadoLink ? "Copiado!" : "Link"}</span>
          </Button>
        </div>
      </div>

      {/* ── BARRA DE PESQUISA & FILTROS POR CATEGORIA ── */}
      <div className="space-y-3">
        {/* Campo de Busca Grande */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Pesquise por nome do vaso, código de referência, categoria..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-14 pl-12 pr-12 rounded-2xl bg-white border-0 shadow-sm ring-1 ring-slate-900/5 text-base placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-600"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Pílulas de Categoria (Scroll horizontal com toque suave no tablet) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categorias.map((cat) => {
            const count =
              cat === "Todas"
                ? produtos.length
                : produtos.filter((p) => p.categoria === cat).length;
            const ativa = categoriaAtiva === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={cn(
                  "px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 active:scale-95 shadow-sm",
                  ativa
                    ? "bg-[#12794C] text-white shadow-emerald-900/20"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-100"
                )}
              >
                <span>{cat}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px]",
                    ativa ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── GRID DE PRODUTOS PARA APRESENTAÇÃO NO TABLET ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-4 h-96 shadow-sm border border-slate-100 animate-pulse flex flex-col gap-3"
            >
              <div className="aspect-square bg-slate-100 rounded-2xl w-full" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="mt-auto h-8 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 max-w-md mx-auto space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-3xl">
            🪴
          </div>
          <h3 className="text-lg font-bold text-slate-800">Nenhum produto encontrado</h3>
          <p className="text-sm text-slate-500">
            Tente pesquisar com outro termo ou selecione a categoria "Todas".
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setBusca("");
              setCategoriaAtiva("Todas");
            }}
            className="rounded-xl mt-2"
          >
            Limpar Filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5">
          {produtosFiltrados.map((prod, index) => {
            const preco = Number(prod.valorFinal || prod.valor);
            const qtdCarrinho = getQtdNoCarrinho(prod.id);
            const estoque = Number(prod.estoque || 0);

            return (
              <Card
                key={prod.id}
                className="group relative bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-200/80 transition-all duration-300 flex flex-col"
              >
                {/* ── IMAGEM DO PRODUTO (Aspect Square para tablet) ── */}
                <div
                  onClick={() => {
                    setSelectedProduto(prod);
                    setModalQtd(qtdCarrinho > 0 ? qtdCarrinho : 1);
                  }}
                  className={cn(
                    "relative aspect-square w-full overflow-hidden bg-slate-50 cursor-pointer flex items-center justify-center",
                    !prod.imagem && `bg-gradient-to-br ${getGradient(index)}`
                  )}
                >
                  {prod.imagem ? (
                    <img
                      src={prod.imagem}
                      alt={prod.nome}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-6xl drop-shadow select-none group-hover:scale-110 transition-transform">
                      {prod.emoji || "🪴"}
                    </span>
                  )}

                  {/* Badges superiores */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none">
                    {prod.categoria ? (
                      <Badge className="bg-white/90 backdrop-blur-md text-slate-800 border-0 text-[10px] font-bold shadow-sm px-2 py-0.5 truncate max-w-[65%]">
                        {prod.categoria}
                      </Badge>
                    ) : <span />}

                    {modoApresentacao ? (
                      <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-bold shadow-sm px-2 py-0.5 shrink-0">
                        Disponível
                      </Badge>
                    ) : (
                      <Badge
                        className={cn(
                          "border-0 text-[10px] font-bold shadow-sm px-2 py-0.5 shrink-0",
                          estoque > 5
                            ? "bg-emerald-600 text-white"
                            : estoque > 0
                            ? "bg-amber-500 text-white"
                            : "bg-rose-500 text-white"
                        )}
                      >
                        {estoque > 0 ? `${estoque} un.` : "Sem estoque"}
                      </Badge>
                    )}
                  </div>

                  {/* Indicador de Quantidade já no Pedido */}
                  {qtdCarrinho > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-[#12794C] text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 animate-in zoom-in-75">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {qtdCarrinho} no pedido
                    </div>
                  )}

                  {/* Botão de Zoom / Abrir detalhes */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduto(prod);
                      setModalQtd(qtdCarrinho > 0 ? qtdCarrinho : 1);
                    }}
                    className="absolute bottom-2.5 left-2.5 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    title="Ver detalhes em tela cheia"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* ── CONTEÚDO DO CARD ── */}
                <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2 sm:gap-2.5">
                  <div>
                    {/* Código do produto */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1">
                      <span>Cód: {prod.codigo || "—"}</span>
                      {prod.numero && <span>Nº {prod.numero}</span>}
                    </div>

                    {/* Nome do produto */}
                    <h3
                      onClick={() => {
                        setSelectedProduto(prod);
                        setModalQtd(qtdCarrinho > 0 ? qtdCarrinho : 1);
                      }}
                      className="font-display font-bold text-slate-900 text-sm md:text-base leading-snug line-clamp-2 cursor-pointer hover:text-emerald-700 transition-colors"
                      title={prod.nome}
                    >
                      {prod.nome}
                    </h3>

                    {/* Descrição Complementar */}
                    {limparDescricaoComplementar(prod.descricao_complementar) && (
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-2">
                        {limparDescricaoComplementar(prod.descricao_complementar)}
                      </p>
                    )}

                    {/* Especificações Compactas (Dimensão / Litros) */}
                    {(prod.dimensao || prod.volume || prod.comprimento) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {prod.dimensao && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium">
                            {prod.dimensao}
                          </span>
                        )}
                        {prod.volume && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium">
                            {prod.volume} L
                          </span>
                        )}
                        {prod.comprimento && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium">
                            {prod.comprimento} cm
                          </span>
                        )}
                      </div>
                    )}

                    {/* Paleta de Cores Disponíveis */}
                    {prod.cores && prod.cores.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Cores ({prod.cores.length})
                          </span>
                        </div>
                        <ColorDock colors={prod.cores} />
                      </div>
                    )}
                  </div>

                  {/* Preço e Botões de Ação */}
                  <div className="pt-2 border-t border-slate-100 mt-auto space-y-2">
                    <div className="flex items-baseline justify-between gap-1">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                          Preço Un.
                        </span>
                        <span className="text-base sm:text-lg md:text-xl font-black text-[#12794C] truncate block">
                          R$ {preco.toFixed(2).replace(".", ",")}
                        </span>
                      </div>

                      {/* Botão de WhatsApp rápido por produto */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareProdutoWhatsApp(prod);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors shrink-0"
                        title="Enviar este produto no WhatsApp"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Controle de Adição ao Pedido (100% responsivo, sem transbordar) */}
                    {qtdCarrinho > 0 ? (
                      <div className="flex items-center justify-between border border-emerald-600/30 rounded-xl bg-emerald-50/80 p-0.5 h-8 sm:h-8.5 w-full shadow-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoverDoPedido(prod.id);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-emerald-800 hover:bg-emerald-200/60 rounded-lg active:scale-95 transition-all text-xs font-bold shrink-0"
                          title="Diminuir ou remover"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center justify-center gap-1 min-w-0 px-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={qtdCarrinho}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                handleSetQtdCarrinho(prod, val);
                              }
                            }}
                            className="w-8 sm:w-10 text-center font-extrabold text-xs text-emerald-950 bg-white/70 border border-emerald-600/20 rounded outline-none p-0 focus:ring-1 focus:ring-emerald-600 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[10px] text-emerald-700 font-bold truncate">un</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdicionarAoPedido(prod, 1);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-white bg-[#12794C] hover:bg-emerald-800 rounded-lg active:scale-95 transition-all text-xs font-bold shadow-sm shrink-0"
                          title="Aumentar quantidade"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdicionarAoPedido(prod, 1);
                        }}
                        className="w-full h-8 sm:h-8.5 rounded-xl bg-[#12794C] hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Adicionar</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── MODAL DE DETALHES COMPLETOS (APRESENTAÇÃO EM TELA CHEIA) ── */}
      <Dialog open={!!selectedProduto} onOpenChange={(open) => !open && setSelectedProduto(null)}>
        <DialogContent className="w-[94vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-0 shadow-2xl">
          {selectedProduto && (
            <div>
              {/* Imagem em destaque */}
              <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                {selectedProduto.imagem ? (
                  <img
                    src={selectedProduto.imagem}
                    alt={selectedProduto.nome}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-8xl select-none">{selectedProduto.emoji || "🪴"}</div>
                )}
                <button
                  onClick={() => setSelectedProduto(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {selectedProduto.categoria && (
                  <Badge className="absolute bottom-4 left-4 bg-white/90 backdrop-blur text-slate-900 border-0 text-xs font-bold px-3 py-1">
                    {selectedProduto.categoria}
                  </Badge>
                )}
              </div>

              <div className="p-5 sm:p-6 space-y-5 sm:space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                    <span>Código: {selectedProduto.codigo || "Sem código"}</span>
                    <span>Status: Ativo</span>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
                    {selectedProduto.nome}
                  </DialogTitle>
                  <p className="text-2xl font-black text-[#12794C] mt-2">
                    R${" "}
                    {Number(selectedProduto.valorFinal || selectedProduto.valor)
                      .toFixed(2)
                      .replace(".", ",")}
                  </p>
                </div>

                {/* Especificações Técnicas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Número</span>
                    <strong className="text-slate-800 text-sm">
                      {selectedProduto.numero || "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Dimensões</span>
                    <strong className="text-slate-800 text-sm">
                      {selectedProduto.dimensao || "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Volume</span>
                    <strong className="text-slate-800 text-sm">
                      {selectedProduto.volume ? `${selectedProduto.volume} L` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Comprimento</span>
                    <strong className="text-slate-800 text-sm">
                      {selectedProduto.comprimento ? `${selectedProduto.comprimento} cm` : "—"}
                    </strong>
                  </div>
                </div>

                {/* Cores Disponíveis */}
                {selectedProduto.cores && selectedProduto.cores.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">
                      Cores Disponíveis
                    </span>
                    <div className="flex flex-wrap gap-2 items-center">
                      <ColorDock colors={selectedProduto.cores} />
                      <span className="text-xs text-slate-600 font-medium ml-2">
                        {selectedProduto.cores.join(", ")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Descrição Complementar se houver */}
                {limparDescricaoComplementar(selectedProduto.descricao_complementar) && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">
                      Descrição do Produto
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {limparDescricaoComplementar(selectedProduto.descricao_complementar)}
                    </p>
                  </div>
                )}

                {/* Ações do Modal */}
                {(() => {
                  const qtdConfirmada = Math.max(1, Number(modalQtd) || 1);
                  return (
                    <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                      {/* Stepper no Modal */}
                      <div className="flex items-center border border-slate-200 rounded-2xl bg-slate-50 p-1 justify-between shrink-0 h-12 w-full md:w-auto gap-2">
                        <button
                          type="button"
                          onClick={() => setModalQtd((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-white rounded-xl active:scale-95 font-bold transition-all shrink-0"
                          title="Diminuir quantidade"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <div className="flex-1 md:w-28 flex items-center justify-center relative">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={modalQtd}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                setModalQtd("");
                              } else {
                                const parsed = parseInt(val, 10);
                                if (!isNaN(parsed)) {
                                  setModalQtd(Math.max(1, parsed));
                                }
                              }
                            }}
                            onBlur={() => {
                              if (modalQtd === "" || Number(modalQtd) < 1) {
                                setModalQtd(1);
                              }
                            }}
                            placeholder="1"
                            className="w-full h-10 text-center text-base sm:text-lg font-black text-slate-900 bg-white border border-slate-200/90 rounded-xl shadow-xs focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2.5 text-[11px] font-bold text-slate-400 pointer-events-none select-none">
                            un
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setModalQtd((prev) => (Number(prev) || 1) + 1)}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-white rounded-xl active:scale-95 font-bold transition-all shrink-0"
                          title="Aumentar quantidade"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Botão Adicionar ao Pedido */}
                      <Button
                        onClick={() => {
                          handleAdicionarAoPedido(selectedProduto, qtdConfirmada);
                          setSelectedProduto(null);
                        }}
                        className="flex-1 min-w-0 h-12 rounded-2xl bg-[#12794C] hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all px-4"
                      >
                        <ShoppingCart className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          Adicionar ao Pedido • R${" "}
                          {(
                            Number(selectedProduto.valorFinal || selectedProduto.valor) * qtdConfirmada
                          )
                            .toFixed(2)
                            .replace(".", ",")}
                        </span>
                      </Button>

                      {/* Botão WhatsApp */}
                      <Button
                        variant="outline"
                        onClick={() => handleShareProdutoWhatsApp(selectedProduto)}
                        className="h-12 px-4 rounded-2xl border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 gap-2 shrink-0 font-semibold w-full md:w-auto"
                      >
                        <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>WhatsApp</span>
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── BARRA FLUTUANTE DE RESUMO DO PEDIDO ── */}
      {totalItensCarrinho > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-40 bg-[#0A4D2E] text-white p-4 rounded-3xl shadow-2xl border border-emerald-600/40 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-emerald-200/80 font-medium truncate">
                {totalItensCarrinho} {totalItensCarrinho === 1 ? "item" : "itens"} no pedido • Boleto: <span className="text-white font-bold">{valorTotalCarrinho <= 1000 ? "28 dias" : "28, 35, 42 dias"}</span>
              </p>
              <p className="text-lg font-black text-white leading-tight">
                R$ {valorTotalCarrinho.toFixed(2).replace(".", ",")}
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate({ to: "/parceiro/pdv" })}
            className="h-11 px-5 rounded-2xl bg-[#12794C] hover:bg-emerald-600 text-white font-bold text-xs shrink-0 flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <span>Ir para Venda</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
