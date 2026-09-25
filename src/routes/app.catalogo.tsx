import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Search, Heart, ShoppingCart, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ColorDock } from "@/components/color-dock";
import jsPDF from "jspdf";
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

export const Route = createFileRoute("/app/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo Digital — GARDEN PRIME ERP" }] }),
  component: Catalogo,
});

function Catalogo() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [vendedorSelecionado, setVendedorSelecionado] = useState("nenhum");
  const [precosPersonalizados, setPrecosPersonalizados] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [openCategoria, setOpenCategoria] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prodData } = await supabase
        .from("produtos")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");
      if (prodData) setProdutos(prodData);

      const { data: vendData } = await supabase
        .from("vendedores")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");
      if (vendData) setVendedores(vendData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchPrecos = async () => {
      if (vendedorSelecionado === "nenhum") {
        setPrecosPersonalizados({});
        return;
      }

      const { data } = await supabase
        .from("parceiro_precos")
        .select("produto_id, preco_personalizado")
        .eq("vendedor_id", vendedorSelecionado);

      if (data) {
        const precos: Record<string, number> = {};
        data.forEach((p) => {
          precos[p.produto_id] = Number(p.preco_personalizado);
        });
        setPrecosPersonalizados(precos);
      }
    };

    fetchPrecos();
  }, [vendedorSelecionado]);

  const handleShare = (nome: string) => {
    const text = encodeURIComponent(
      `Confira nosso produto: *${nome}* na Garden Prime!\nAcesse nosso catálogo: ${window.location.origin}/catalogo`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShareCatalog = () => {
    const text = encodeURIComponent(
      `Veja nosso catálogo completo de produtos Garden Prime: ${window.location.origin}/catalogo`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const getPrecoProduto = (produto: any) => {
    if (vendedorSelecionado !== "nenhum" && precosPersonalizados[produto.id] !== undefined) {
      return Number(precosPersonalizados[produto.id]);
    }
    return Number(produto.valor);
  };

  const filtrados = produtos.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.codigo && p.codigo.toLowerCase().includes(busca.toLowerCase()));
    const matchCategoria = categoria === "Todos" || p.categoria === categoria;
    return matchBusca && matchCategoria;
  });

  const gerarPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const cols = 3;
    const colWidth = (pageWidth - margin * 2) / cols;
    const imgSize = colWidth - 6;
    const cardHeight = imgSize + 28;
    const titleH = 16; // espaço reservado para o título da categoria

    // Fetch imagem como base64
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
            }),
        )
        .catch(() => null);

    // Pré-carrega todas as imagens em paralelo
    const imageCache: Record<string, string | null> = {};
    const [gardenPrimeLogo64, gardenPlusLogo64, ...loadedImages] = await Promise.all([
      toBase64("/garden-prime-logo.png"), // ou import se estivesse no escopo, mas podemos usar public path
      toBase64("/garden-plus.png"),
      ...filtrados.filter((p) => p.imagem).map((p) => toBase64(p.imagem)),
    ]);

    filtrados
      .filter((p) => p.imagem)
      .forEach((p, index) => {
        imageCache[p.id] = loadedImages[index];
      });

    // Helper: desenha título da categoria
    const drawTitle = (label: string, y: number) => {
      doc.setFontSize(13);
      doc.setTextColor(22, 163, 74);
      doc.text(label.toUpperCase(), margin, y);
    };

    // Cabeçalho com Logos e CNPJs
    let yPos = 15;

    // Garden Prime
    if (gardenPrimeLogo64) {
      doc.addImage(gardenPrimeLogo64, "PNG", margin, yPos, 45, 13);
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("GARDEN PLUS LTDA", margin, yPos + 19);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("CNPJ: 50.387.381/0001-81  •  Insc. Estadual: 266031100110", margin, yPos + 24);
    doc.text("MATEUS RODRIGUES DA COSTA 327, JARDIM SANTA RITA, Charqueada - SP", margin, yPos + 28.5);
    doc.text("Tel: (19) 99930-8784  •  garden-plus@hotmail.com", margin, yPos + 33);

    // Garden Plus (Canto direito: somente logo e nome, sem contatos)
    const rightColX = pageWidth - margin - 50;
    if (gardenPlusLogo64) {
      doc.addImage(gardenPlusLogo64, "PNG", rightColX, yPos, 38, 12);
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Garden Plus Ltda", rightColX, yPos + 19);

    // Título Principal
    yPos += 45;
    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text("Catálogo de Produtos", margin, yPos);
    yPos += 12;

    const categorias = Array.from(new Set(filtrados.map((p) => p.categoria || "Outros")))
      .sort((a, b) => {
        if (a.toLowerCase() === "jardinagem") return -1;
        if (b.toLowerCase() === "jardinagem") return 1;
        return 0;
      });

    for (const cat of categorias) {
      const prodsCat = filtrados.filter((p) => (p.categoria || "Outros") === cat);
      if (!prodsCat.length) continue;

      // ─── Fix 1: título orphan ────────────────────────────────────────────────
      // Só escreve o título se houver espaço para ele + pelo menos 1 linha de cards.
      // Se não couber, quebra página antes de escrever o título.
      if (yPos + titleH + cardHeight > pageHeight - 10) {
        doc.addPage();
        yPos = 15;
      }

      drawTitle(cat, yPos);
      yPos += titleH;

      let col = 0;
      let rowStartY = yPos;

      for (const p of prodsCat) {
        if (col === cols) {
          col = 0;
          rowStartY += cardHeight + 6;
        }

        // ─── Fix 2: continuação sem título ──────────────────────────────────────
        // Quando uma nova linha de cards não cabe, quebra página e re-escreve
        // o título com "(cont.)" para o leitor saber de qual categoria se trata.
        if (rowStartY + cardHeight > pageHeight - 10) {
          doc.addPage();
          rowStartY = 15;
          col = 0;
          drawTitle(`${cat} (cont.)`, rowStartY);
          rowStartY += titleH;
        }

        const xPos = margin + col * colWidth;

        // Borda do card
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(xPos, rowStartY, colWidth - 2, cardHeight, 2, 2, "FD");

        // Imagem ou placeholder
        const imgX = xPos + 3;
        const imgY = rowStartY + 3;
        const imgW = imgSize - 2;
        const imgH = imgSize - 2;

        if (p.imagem && imageCache[p.id]) {
          try {
            doc.addImage(imageCache[p.id]!, "JPEG", imgX, imgY, imgW, imgH);
          } catch {
            doc.setFillColor(230, 230, 230);
            doc.rect(imgX, imgY, imgW, imgH, "F");
            doc.setFontSize(6);
            doc.setTextColor(160, 160, 160);
            doc.text("Sem foto", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
          }
        } else {
          doc.setFillColor(230, 230, 230);
          doc.rect(imgX, imgY, imgW, imgH, "F");
          doc.setFontSize(6);
          doc.setTextColor(160, 160, 160);
          doc.text("Sem foto", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
        }

        // Nome do produto
        const textY = rowStartY + imgSize + 5;
        const maxChars = Math.floor((colWidth - 6) / 2.1);
        const nomeTrunc = p.nome.length > maxChars ? p.nome.slice(0, maxChars - 1) + "…" : p.nome;
        doc.setFontSize(6.5);
        doc.setTextColor(40, 40, 40);
        doc.text(nomeTrunc, xPos + 3, textY);

        // Código
        doc.setFontSize(5.5);
        doc.setTextColor(120, 120, 120);
        doc.text(`Cód: ${p.codigo || "-"}`, xPos + 3, textY + 5);

        // Preço
        const precoFinal = getPrecoProduto(p);
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text(`R$ ${precoFinal.toFixed(2).replace(".", ",")}`, xPos + 3, textY + 11);

        col++;
      }

      yPos = rowStartY + cardHeight + 12;
      if (yPos > pageHeight - 10) {
        doc.addPage();
        yPos = 15;
      }
    }

    doc.save("catalogo-garden-prime.pdf");
  };

  const categoriasUnicas = [
    "Todos",
    ...Array.from(new Set(produtos.map((p) => p.categoria)))
      .filter(Boolean)
      .sort((a, b) => {
        if ((a as string).toLowerCase() === "jardinagem") return -1;
        if ((b as string).toLowerCase() === "jardinagem") return 1;
        return 0;
      }),
  ] as string[];

  // Cores fixas para a vitrine para não precisar gravar background no banco
  const getGradient = (index: number) => {
    const gradients = [
      "from-emerald-100 to-green-200",
      "from-lime-100 to-emerald-200",
      "from-amber-100 to-orange-200",
      "from-green-100 to-teal-200",
      "from-pink-100 to-rose-200",
      "from-stone-100 to-stone-200",
      "from-slate-100 to-zinc-200",
    ];
    return gradients[index % gradients.length];
  };

  return (
    <>
      <PageHeader
        title="Catálogo Digital"
        subtitle="Compartilhe seus produtos pelo WhatsApp, link público ou QR Code"
        actions={
          <div className="flex gap-2">
            <Button onClick={gerarPDF} variant="outline" className="border-slate-200">
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
            <Button
              onClick={handleShareCatalog}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <WhatsAppIcon className="mr-2 h-4 w-4" />
              Compartilhar catálogo
            </Button>
          </div>
        }
      />

      <Card className="shadow-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar no catálogo…"
              className="pl-9 w-full"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Catálogo do Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Preços Padrão</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={openCategoria} onOpenChange={setOpenCategoria}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCategoria}
                className="w-full sm:w-[240px] justify-between"
              >
                {categoria}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full sm:w-[240px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar categoria..." />
                <CommandList>
                  <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                  <CommandGroup>
                    {categoriasUnicas.map((c) => (
                      <CommandItem
                        key={c}
                        value={c}
                        onSelect={() => {
                          setCategoria(c);
                          setOpenCategoria(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            categoria === c ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {c}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      <div className="space-y-10">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando catálogo...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum produto encontrado na busca.
          </p>
        ) : (
          Array.from(new Set(filtrados.map((p) => p.categoria || "Outros")))
            .sort((a, b) => {
              if (a.toLowerCase() === "jardinagem") return -1;
              if (b.toLowerCase() === "jardinagem") return 1;
              return 0;
            })
            .map((cat) => {
            const produtosDaCategoria = filtrados.filter((p) => (p.categoria || "Outros") === cat);
            return (
              <div key={cat} className="space-y-4">
                <h2 className="text-2xl font-display font-bold text-slate-800 border-b pb-2">
                  {cat}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {produtosDaCategoria.map((p, index) => (
                    <Card
                      key={p.id}
                      className="overflow-hidden shadow-card hover:shadow-elevated transition-all group"
                    >
                      <div
                        className={`relative aspect-square overflow-hidden bg-gradient-to-br ${getGradient(index)} grid place-items-center text-7xl`}
                      >
                        {p.imagem ? (
                          <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" />
                        ) : (
                          p.emoji || "🪴"
                        )}
                        <button className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 backdrop-blur hover:bg-white">
                          <Heart className="h-4 w-4 text-destructive" />
                        </button>
                        {p.estoque < 10 && (
                          <Badge className="absolute top-3 left-3 bg-warning text-warning-foreground border-0">
                            Últimas unidades
                          </Badge>
                        )}
                      </div>
                      <div className="p-4 flex flex-col h-full">
                        <h3 className="font-display text-base font-bold mt-0.5 truncate">
                          {p.nome}
                        </h3>

                        <div className="mt-2 flex items-baseline justify-between border-b pb-2 mb-2">
                          <p className="text-primary font-display text-xl font-extrabold">
                            R$ {getPrecoProduto(p).toFixed(2).replace(".", ",")}
                          </p>
                          <span className="text-xs text-muted-foreground">{p.estoque} disp.</span>
                        </div>

                        {/* Especificações Sura */}
                        <div className="py-1 text-xs text-muted-foreground space-y-1 border-b pb-3 mb-3 flex-1">
                          {p.numero && (
                            <p>
                              <span className="font-semibold text-foreground">Número:</span>{" "}
                              {p.numero}
                            </p>
                          )}
                          {p.dimensao && (
                            <p>
                              <span className="font-semibold text-foreground">Dimensões:</span>{" "}
                              {p.dimensao}
                            </p>
                          )}
                          {p.volume && (
                            <p>
                              <span className="font-semibold text-foreground">Volume:</span>{" "}
                              {p.volume} L
                            </p>
                          )}
                          {p.comprimento && (
                            <p>
                              <span className="font-semibold text-foreground">Comprimento:</span>{" "}
                              {p.comprimento} cm
                            </p>
                          )}
                          {p.cores && p.cores.length > 0 && (
                            <div className="pt-2">
                              <p className="font-semibold text-foreground mb-1">Cores:</p>
                              <ColorDock colors={p.cores} />
                            </div>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                          <Button
                            onClick={() => handleShare(p.nome)}
                            size="sm"
                            className="bg-success text-success-foreground hover:bg-success/90"
                          >
                            <WhatsAppIcon className="mr-1.5 h-3.5 w-3.5" />
                            WhatsApp
                          </Button>
                          <Button size="sm" variant="outline">
                            <ShoppingCart className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
