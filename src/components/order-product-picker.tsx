import { useMemo, useState } from "react";
import { Plus, Search, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface PickerProduct {
  id: string;
  nome: string;
  codigo?: string | number | null;
  valor: number;
  estoque?: number | null;
  imagem?: string | null;
  emoji?: string | null;
}

interface OrderProductPickerProps {
  produtos: PickerProduct[];
  onAddProduct: (produto: PickerProduct, quantidade: number) => void;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Seletor rápido em tela cheia para adicionar produtos durante a edição de pedidos e orçamentos.
 */
export function OrderProductPicker({ produtos, onAddProduct }: OrderProductPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const filteredProducts = useMemo(() => {
    const query = normalizeText(searchTerm);
    const codeQuery = String(codeSearch || "").trim().toLowerCase();

    const hasExactCode =
      codeQuery.length > 0 &&
      produtos.some((p) => {
        const pCode = p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";
        return pCode === codeQuery || (/^\d+$/.test(codeQuery) && /^\d+$/.test(pCode) && Number(pCode) === Number(codeQuery));
      });

    return produtos.filter((p) => {
      const pName = normalizeText(p.nome || "");
      const pCode = p.codigo !== undefined && p.codigo !== null ? String(p.codigo).trim().toLowerCase() : "";

      let matchSearch = true;
      if (query) {
        const terms = query.split(/\s+/).filter(Boolean);
        matchSearch = terms.every((t) => pName.includes(t) || pCode.includes(t));
      }

      let matchCode = true;
      if (codeQuery) {
        if (hasExactCode) {
          matchCode =
            pCode === codeQuery ||
            (/^\d+$/.test(codeQuery) && /^\d+$/.test(pCode) && Number(pCode) === Number(codeQuery));
        } else {
          matchCode = pCode.startsWith(codeQuery) || pName.includes(`codigo ${codeQuery}`);
        }
      }

      return matchSearch && matchCode;
    });
  }, [produtos, searchTerm, codeSearch]);

  const handleAdd = (prod: PickerProduct) => {
    const qty = Math.max(1, Number(qtyMap[prod.id]) || 1);
    onAddProduct(prod, qty);
    setQtyMap((prev) => ({ ...prev, [prod.id]: 1 }));
  };

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-50/30 dark:bg-emerald-950/15 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          Catálogo Rápido — Adicionar Produtos ao Pedido
        </p>
        <Badge variant="outline" className="text-[11px] bg-background">
          {filteredProducts.length} produtos
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-background font-medium"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary stroke-[2.5]" />
          <Input
            placeholder="Buscar por código..."
            value={codeSearch}
            onChange={(e) => setCodeSearch(e.target.value)}
            className="pl-9 h-10 bg-background font-bold placeholder:font-bold border-primary/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-6 text-center text-sm text-muted-foreground bg-background/70 rounded-xl border border-dashed">
            Nenhum produto encontrado para essa busca.
          </div>
        ) : (
          filteredProducts.slice(0, 60).map((p) => {
            const qtyVal = qtyMap[p.id] ?? 1;
            return (
              <div
                key={p.id}
                className="flex flex-col justify-between gap-2.5 p-2.5 rounded-xl border bg-background hover:border-emerald-500/50 transition-colors shadow-2xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-11 w-11 rounded-lg bg-accent border overflow-hidden shrink-0 flex items-center justify-center text-lg">
                    {p.imagem ? (
                      <img src={p.imagem} alt={p.nome} className="h-full w-full object-cover" />
                    ) : (
                      <span>{p.emoji || "📦"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.codigo && (
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-muted text-foreground">
                          #{p.codigo}
                        </span>
                      )}
                      {p.estoque !== undefined && p.estoque !== null && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Est: {p.estoque}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-foreground leading-snug line-clamp-2 mt-0.5" title={p.nome}>
                      {p.nome}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50">
                  <span className="text-xs font-extrabold text-primary whitespace-nowrap">
                    R$ {Number(p.valor || 0).toFixed(2).replace(".", ",")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="1"
                      value={qtyVal}
                      onChange={(e) =>
                        setQtyMap((prev) => ({ ...prev, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))
                      }
                      className="h-7 w-14 text-center text-xs font-bold px-1"
                      title="Quantidade a adicionar"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-bold bg-gradient-brand text-primary-foreground"
                      onClick={() => handleAdd(p)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
