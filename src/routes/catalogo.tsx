import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingCart, Trash2, Search, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import { ColorDock } from "@/components/color-dock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo — Garden Prime" }] }),
  component: PublicCatalogo,
});

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

function PublicCatalogo() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todas");
  const [openCategoria, setOpenCategoria] = useState(false);
  const [cart, setCart] = useState<{ produto: any; qtd: number }[]>([]);
  const [partner, setPartner] = useState<any>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [empresaData, setEmpresaData] = useState({
    nome: "",
    cnpj: "",
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    telefone: "",
  });

  const addToCart = (produto: any) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.produto.id === produto.id);
      if (exists) {
        return prev.map((i) => (i.produto.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i));
      }
      return [...prev, { produto, qtd: 1 }];
    });
  };

  const updateQuantity = (produtoId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.produto.id === produtoId) {
          const newQtd = i.qtd + delta;
          if (newQtd <= 0) return i;
          return { ...i, qtd: newQtd };
        }
        return i;
      }),
    );
  };

  const setQuantity = (produtoId: string, newQ: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.produto.id === produtoId) {
          if (newQ <= 0) return i;
          return { ...i, qtd: newQ };
        }
        return i;
      }),
    );
  };

  const removeFromCart = (produtoId: string) => {
    setCart((prev) => prev.filter((i) => i.produto.id !== produtoId));
  };

  useEffect(() => {
    const fetchProdutos = async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");

      const params = new URLSearchParams(window.location.search);
      const p = params.get("p");
      const v = params.get("v");
      const identifier = v || p;

      let partnerData = null;

      if (identifier) {
        // Busca o parceiro pelo ID (formato antigo) ou pelo Nome (novo formato)
        let query = supabase
          .from("vendedores")
          .select("id, nome, telefone, acrescimo_catalogo, acrescimo_catalogo_percentual")
          .eq("status", "Ativo");

        if (identifier.length === 8 && /^[0-9a-fA-F-]+$/.test(identifier)) {
          query = query.ilike("id", `${identifier}%`);
        } else {
          query = query.ilike("nome", `${identifier}%`);
        }

        const { data: parceiros } = await query.limit(1);
        if (parceiros && parceiros.length > 0) {
          partnerData = parceiros[0];
          setPartner(partnerData);
        }
      }

      if (data) {
        let customPricesMap: Record<string, number> = {};
        if (partnerData) {
          const { data: precos } = await supabase
            .from("parceiro_precos")
            .select("produto_id, preco_personalizado")
            .eq("vendedor_id", partnerData.id);
          if (precos) {
            precos.forEach((p) => {
              customPricesMap[p.produto_id] = Number(p.preco_personalizado);
            });
          }
        }

        if (partnerData?.acrescimo_catalogo || Object.keys(customPricesMap).length > 0) {
          const percentual =
            partnerData?.acrescimo_catalogo_percentual !== null &&
            partnerData?.acrescimo_catalogo_percentual !== undefined
              ? Number(partnerData.acrescimo_catalogo_percentual)
              : 20;
          const multiplier = 1 + percentual / 100;

          const produtosComPreco = data.map((prod: any) => {
            let finalPrice = partnerData?.acrescimo_catalogo ? prod.valor * multiplier : prod.valor;
            if (customPricesMap[prod.id] !== undefined) {
              finalPrice = customPricesMap[prod.id];
            }
            return {
              ...prod,
              valor: finalPrice,
            };
          });
          setProdutos(produtosComPreco);
        } else {
          setProdutos(data);
        }
      }

      setLoading(false);
    };
    fetchProdutos();
  }, []);

  const categorias = Array.from(new Set(produtos.map((p) => p.categoria)))
    .filter(Boolean)
    .sort((a, b) => {
      if ((a as string).toLowerCase() === "jardinagem") return -1;
      if ((b as string).toLowerCase() === "jardinagem") return 1;
      return 0;
    }) as string[];

  const filtrados = produtos.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.codigo && p.codigo.toLowerCase().includes(busca.toLowerCase()));
    const matchCategoria = categoriaAtiva === "Todas" || p.categoria === categoriaAtiva;
    return matchBusca && matchCategoria;
  });

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

  const handleOpenModal = () => {
    if (cart.length === 0) return;
    setModalOpen(true);
  };

  const finalizeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!empresaData.nome || !empresaData.cnpj) {
      alert("Preencha os campos obrigatórios (Nome da Empresa e CNPJ).");
      return;
    }

    let mensagem = `Olá! Gostaria de fazer o pedido dos seguintes itens do catálogo:\n\n`;

    mensagem += `*DADOS DA EMPRESA:*\n`;
    mensagem += `Nome: ${empresaData.nome}\n`;
    mensagem += `CNPJ: ${empresaData.cnpj}\n`;
    if (empresaData.cep) mensagem += `CEP: ${empresaData.cep}\n`;
    if (empresaData.endereco)
      mensagem += `Endereço: ${empresaData.endereco}, ${empresaData.numero}\n`;
    if (empresaData.bairro) mensagem += `Bairro: ${empresaData.bairro}\n`;
    if (empresaData.cidade) mensagem += `Cidade/UF: ${empresaData.cidade}/${empresaData.uf}\n`;
    if (empresaData.telefone) mensagem += `Telefone: ${empresaData.telefone}\n`;
    mensagem += `\n`;

    cart.forEach((item) => {
      const p = item.produto;
      const totalItem = item.qtd * Number(p.valor);
      mensagem += `*${item.qtd}x ${p.nome}*\n`;
      mensagem += `Valor Un: R$ ${Number(p.valor).toFixed(2).replace(".", ",")} | Total: R$ ${totalItem.toFixed(2).replace(".", ",")}\n`;
      if (p.codigo) mensagem += `Ref: ${p.codigo}\n`;
      if (p.cores && p.cores.length > 0) mensagem += `Cores sugeridas: ${p.cores.join(", ")}\n`;
      mensagem += `\n`;
    });

    const total = cart.reduce((acc, item) => acc + item.qtd * Number(item.produto.valor), 0);
    mensagem += `*VALOR TOTAL: R$ ${total.toFixed(2).replace(".", ",")}*\n\n`;
    mensagem += `Qual o procedimento para finalização e pagamento?`;

    let telefoneDestino = "5519997141112"; // Telefone padrão do dono
    const companyParams = `&e=${encodeURIComponent(empresaData.nome)}&cnpj=${encodeURIComponent(empresaData.cnpj)}&cep=${encodeURIComponent(empresaData.cep)}&end=${encodeURIComponent(empresaData.endereco)}&num=${encodeURIComponent(empresaData.numero)}&bairro=${encodeURIComponent(empresaData.bairro)}&cid=${encodeURIComponent(empresaData.cidade)}&uf=${encodeURIComponent(empresaData.uf)}&tel=${encodeURIComponent(empresaData.telefone)}`;

    if (partner && partner.telefone) {
      const numLimpo = partner.telefone.replace(/\D/g, "");
      if (numLimpo.length >= 10) telefoneDestino = `55${numLimpo}`;

      const magicParams = cart.map((c) => `${c.produto.id}:${c.qtd}`).join(",");
      mensagem += `\n\n_Link do Pedido (Apenas Vendedor):_\n${window.location.origin}/parceiro/pdv?c=${magicParams}${companyParams}`;
    } else {
      const magicParams = cart.map((c) => `${c.produto.id}:${c.qtd}`).join(",");
      mensagem += `\n\n_Link do Pedido (Administrador):_\n${window.location.origin}/app/dav-novo?c=${magicParams}${companyParams}`;
    }

    const text = encodeURIComponent(mensagem);
    window.open(`https://wa.me/${telefoneDestino}?text=${text}`, "_blank");
    setModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 md:px-8 shadow-sm">
        <div className="flex items-center gap-4 sm:gap-8">
          <GardenPrimeLogo horizontal size="small" />
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <img src="/garden-plus.png" alt="Garden Plus" className="h-6 sm:h-8 object-contain" />
            <span className="font-bold text-slate-800 text-sm hidden sm:inline-block">
              Garden Plus
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 py-8">
        {partner && (
          <div className="mb-6 bg-brand/10 border border-brand/20 text-brand p-3 rounded-xl flex items-center justify-center text-sm font-medium animate-in fade-in slide-in-from-top-4">
            Você está comprando com o parceiro: <strong className="ml-1">{partner.nome}</strong>
          </div>
        )}

        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900">
            Catálogo de Produtos
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            Confira nossos vasos, suportes e acessórios e faça seu pedido diretamente pelo WhatsApp.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-6 relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por vasos, cores, modelos..."
            className="pl-10 h-12 bg-white shadow-sm text-base rounded-full"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {categorias.length > 0 && (
          <div className="flex justify-center mb-10 px-4">
            <Popover open={openCategoria} onOpenChange={setOpenCategoria}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full max-w-sm justify-between rounded-full bg-white shadow-sm h-12 text-base font-medium"
                >
                  {categoriaAtiva === "Todas" ? "Todas as Categorias" : categoriaAtiva}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] max-w-[350px] p-0 rounded-xl"
                align="center"
              >
                <Command>
                  <CommandInput placeholder="Buscar categoria..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Todas as Categorias"
                        onSelect={() => {
                          setCategoriaAtiva("Todas");
                          setOpenCategoria(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            categoriaAtiva === "Todas" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Todas as Categorias
                      </CommandItem>
                      {categorias.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => {
                            setCategoriaAtiva(c);
                            setOpenCategoria(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              categoriaAtiva === c ? "opacity-100" : "opacity-0",
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
        )}

        <div className="space-y-12">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando catálogo...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum produto encontrado com essa busca.
            </p>
          ) : (
            Array.from(new Set(filtrados.map((p) => p.categoria || "Outros")))
              .sort((a, b) => {
                if (a.toLowerCase() === "jardinagem") return -1;
                if (b.toLowerCase() === "jardinagem") return 1;
                return 0;
              })
              .map((cat) => {
              const produtosDaCategoria = filtrados.filter(
                (p) => (p.categoria || "Outros") === cat,
              );
              return (
                <div key={cat} className="space-y-5">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-800 border-b pb-2">
                    {cat}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {produtosDaCategoria.map((p, index) => (
                      <Card
                        key={p.id}
                        className="overflow-hidden shadow-card hover:shadow-elevated transition-all flex flex-col bg-white border-0 ring-1 ring-slate-900/5"
                      >
                        <div
                          className={`relative aspect-square overflow-hidden bg-gradient-to-br ${getGradient(index)} grid place-items-center text-7xl`}
                        >
                          {p.imagem ? (
                            <img
                              src={p.imagem}
                              alt={p.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            p.emoji || "🪴"
                          )}
                          {p.estoque < 10 && (
                            <Badge className="absolute top-3 left-3 bg-warning text-warning-foreground border-0 shadow-sm">
                              Últimas unidades
                            </Badge>
                          )}
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="font-display text-lg font-bold text-slate-800 leading-tight">
                            {p.nome}
                          </h3>
                          <p className="text-primary font-display text-2xl font-extrabold mt-2">
                            R$ {Number(p.valor).toFixed(2).replace(".", ",")}
                          </p>

                          <div className="py-3 text-xs text-slate-500 space-y-1.5 border-b mb-4 flex-1">
                            {p.numero && (
                              <p>
                                <span className="font-medium text-slate-700">Número:</span>{" "}
                                {p.numero}
                              </p>
                            )}
                            {p.dimensao && (
                              <p>
                                <span className="font-medium text-slate-700">Dimensões:</span>{" "}
                                {p.dimensao}
                              </p>
                            )}
                            {p.volume && (
                              <p>
                                <span className="font-medium text-slate-700">Volume:</span>{" "}
                                {p.volume} L
                              </p>
                            )}
                            {p.comprimento && (
                              <p>
                                <span className="font-medium text-slate-700">Comprimento:</span>{" "}
                                {p.comprimento} cm
                              </p>
                            )}
                            {p.cores && p.cores.length > 0 && (
                              <div className="mt-2">
                                <p className="font-medium text-slate-700 mb-1">
                                  Cores disponíveis:
                                </p>
                                <ColorDock colors={p.cores} />
                              </div>
                            )}
                          </div>

                          <div className="mt-auto">
                            {cart.find((c) => c.produto.id === p.id) ? (
                              <div className="flex items-center justify-between bg-slate-100 rounded-lg p-1.5 h-11 border border-slate-200">
                                <Button
                                  onClick={() => updateQuantity(p.id, -1)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 bg-white shadow-sm shrink-0 hover:bg-white text-lg font-medium"
                                >
                                  −
                                </Button>
                                <input
                                  type="number"
                                  min="1"
                                  value={cart.find((c) => c.produto.id === p.id)?.qtd || ""}
                                  onChange={(e) => setQuantity(p.id, parseInt(e.target.value) || 1)}
                                  className="w-full text-center font-bold bg-transparent border-0 outline-none p-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  onClick={() => updateQuantity(p.id, 1)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 bg-white shadow-sm shrink-0 hover:bg-white text-lg font-medium"
                                >
                                  +
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={() => addToCart(p)}
                                className="w-full bg-success text-success-foreground hover:bg-success/90 h-11 text-base font-semibold shadow-sm"
                              >
                                <ShoppingCart className="mr-2 h-5 w-5" />
                                Adicionar
                              </Button>
                            )}
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
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-40 flex items-center justify-between lg:px-12 animate-in slide-in-from-bottom-8">
          <div>
            <p className="text-sm text-muted-foreground font-medium">
              {cart.reduce((a, c) => a + c.qtd, 0)} itens no carrinho
            </p>
            <p className="text-xl font-bold text-slate-800">
              R${" "}
              {cart
                .reduce((a, c) => a + c.qtd * Number(c.produto.valor), 0)
                .toFixed(2)
                .replace(".", ",")}
            </p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button className="bg-success text-success-foreground hover:bg-success/90 h-12 px-6 shadow-md font-bold text-base rounded-full">
                <ShoppingCart className="mr-2 h-5 w-5" /> Ver Carrinho
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 border-l">
              <SheetHeader className="p-6 border-b bg-slate-50/50">
                <SheetTitle className="flex items-center gap-2 text-2xl font-display font-bold">
                  <ShoppingCart className="h-6 w-6 text-brand" /> Seu Carrinho
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.produto.id}
                    className="flex gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm relative group"
                  >
                    <button
                      onClick={() => removeFromCart(item.produto.id)}
                      className="absolute -top-2 -right-2 bg-destructive/10 text-destructive p-1.5 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center text-3xl shrink-0 overflow-hidden relative">
                      {item.produto.imagem ? (
                        <img
                          src={item.produto.imagem}
                          alt={item.produto.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        item.produto.emoji || "🪴"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">
                        {item.produto.nome}
                      </h4>
                      <p className="text-brand font-bold text-sm mb-3">
                        R$ {Number(item.produto.valor).toFixed(2).replace(".", ",")}
                      </p>

                      <div className="flex items-center bg-slate-100 rounded-lg p-1 w-max border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.produto.id, -1)}
                          className="h-7 w-7 bg-white rounded shadow-sm flex items-center justify-center font-medium hover:bg-slate-50"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.qtd || ""}
                          onChange={(e) =>
                            setQuantity(item.produto.id, parseInt(e.target.value) || 1)
                          }
                          className="w-10 text-center text-sm font-bold bg-transparent border-0 outline-none p-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => updateQuantity(item.produto.id, 1)}
                          className="h-7 w-7 bg-white rounded shadow-sm flex items-center justify-center font-medium hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-10">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-slate-500 font-medium text-lg">Total do Pedido</span>
                  <span className="text-2xl font-bold text-slate-900">
                    R${" "}
                    {cart
                      .reduce((a, c) => a + c.qtd * Number(c.produto.valor), 0)
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                </div>
                <Button
                  onClick={handleOpenModal}
                  className="w-full h-14 bg-success hover:bg-success/90 text-success-foreground text-lg shadow-md rounded-xl font-bold"
                >
                  <WhatsAppIcon className="mr-2 h-6 w-6" />
                  Continuar Pedido
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        {/* ... Dialog Content ... */}
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Dados da Empresa</DialogTitle>
            <DialogDescription>
              Preencha os dados da sua empresa para enviar o pedido.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={finalizeOrder}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="nome">
                  Nome da Empresa <span className="text-red-500">*</span>
                </label>
                <Input
                  id="nome"
                  required
                  value={empresaData.nome}
                  onChange={(e) => setEmpresaData({ ...empresaData, nome: e.target.value })}
                  placeholder="Sua Empresa"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="cnpj">
                  CNPJ <span className="text-red-500">*</span>
                </label>
                <Input
                  id="cnpj"
                  required
                  value={empresaData.cnpj}
                  onChange={(e) => setEmpresaData({ ...empresaData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="cep">
                    CEP
                  </label>
                  <Input
                    id="cep"
                    value={empresaData.cep}
                    onChange={(e) => setEmpresaData({ ...empresaData, cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="endereco">
                    Rua / Logradouro
                  </label>
                  <Input
                    id="endereco"
                    value={empresaData.endereco}
                    onChange={(e) => setEmpresaData({ ...empresaData, endereco: e.target.value })}
                    placeholder="Rua Exemplo"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="numero">
                    Número
                  </label>
                  <Input
                    id="numero"
                    value={empresaData.numero}
                    onChange={(e) => setEmpresaData({ ...empresaData, numero: e.target.value })}
                    placeholder="123"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="bairro">
                    Bairro
                  </label>
                  <Input
                    id="bairro"
                    value={empresaData.bairro}
                    onChange={(e) => setEmpresaData({ ...empresaData, bairro: e.target.value })}
                    placeholder="Centro"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="cidade">
                    Cidade
                  </label>
                  <Input
                    id="cidade"
                    value={empresaData.cidade}
                    onChange={(e) => setEmpresaData({ ...empresaData, cidade: e.target.value })}
                    placeholder="Sua Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="uf">
                    Estado (UF)
                  </label>
                  <Input
                    id="uf"
                    value={empresaData.uf}
                    onChange={(e) => setEmpresaData({ ...empresaData, uf: e.target.value })}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="telefone">
                  Telefone / WhatsApp
                </label>
                <Input
                  id="telefone"
                  value={empresaData.telefone}
                  onChange={(e) => setEmpresaData({ ...empresaData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                Enviar Pedido
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <footer className="bg-slate-900 text-slate-400 py-12 px-4 mt-20 pb-32 lg:pb-12">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-block bg-white p-2.5 rounded-xl shadow-xs">
              <GardenPrimeLogo size="small" />
            </div>
            <p className="font-bold text-white text-base mb-1 tracking-wide">GARDEN PRIME</p>
            <p className="text-slate-400 text-sm">
              CNPJ: 63.874.628/0001-36 • Insc. Estadual: 266.037.553.113
            </p>
            <p className="text-slate-400 text-sm">
              Rua Santa Teresinha, 86 - Paraisolândia, Charqueada - SP
            </p>
            <p className="text-slate-400 text-sm">
              Telefone: (19) 99714-1112 • E-mail: contatogardenprime@gmail.com
            </p>
          </div>
          <div className="md:text-right flex flex-col md:items-end justify-start">
            <div className="mb-4 inline-block bg-white p-2.5 rounded-xl shadow-xs">
              <img src="/garden-plus.png" alt="Garden Plus" className="h-8 object-contain" />
            </div>
            <p className="font-bold text-white text-base mb-1 tracking-wide">Garden Plus Ltda</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
          &copy; {new Date().getFullYear()} Garden Prime & Garden Plus. Todos os direitos
          reservados.
        </div>
      </footer>
    </div>
  );
}
