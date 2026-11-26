import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  CheckSquare,
  FileInput,
  Loader2,
  RefreshCw,
  Search,
  Square,
} from "lucide-react";

export interface ImportedOrderInfo {
  id: string;
  numero_venda: number | null;
  numero: number | null;
  tipo: string;
  status: string;
  valor_total: number;
  created_at: string;
  cliente_nome: string;
}

export interface ImportedProductAgg {
  quantidade: number;
  subtotal: number;
  pedidos: { numero: string; quantidade: number }[];
}

export interface ImportedOrdersResult {
  orders: ImportedOrderInfo[];
  productMap: Record<string, ImportedProductAgg>;
}

interface RawOrderRow {
  id: string;
  numero_venda: number | null;
  numero: number | null;
  tipo: string | null;
  status: string | null;
  status_aprovacao: string | null;
  valor_total: number | null;
  created_at: string;
  clientes: { nome: string | null } | { nome: string | null }[] | null;
}

interface ImportarPedidosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelectedIds?: string[];
  onImport: (result: ImportedOrdersResult) => void;
}

function getOrderNumber(order: {
  numero_venda?: number | null;
  numero?: number | null;
}): number | null {
  const raw = order.numero_venda ?? order.numero;
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getOrderLabel(order: {
  id: string;
  numero_venda?: number | null;
  numero?: number | null;
}): string {
  const num = getOrderNumber(order);
  return num !== null ? String(num) : order.id.slice(0, 6).toUpperCase();
}

function getClientName(clientes: RawOrderRow["clientes"]): string {
  if (!clientes) return "Venda Avulsa";
  if (Array.isArray(clientes)) return clientes[0]?.nome || "Venda Avulsa";
  return clientes.nome || "Venda Avulsa";
}

function isCancelledStatus(status: string | null | undefined): boolean {
  return status === "Cancelado" || status === "Rejeitado";
}

export function ImportarPedidosModal({
  open,
  onOpenChange,
  initialSelectedIds = [],
  onImport,
}: ImportarPedidosModalProps) {
  const [orders, setOrders] = useState<RawOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [importing, setImporting] = useState(false);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("Todos");
  const [ignoreCancelled, setIgnoreCancelled] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const initialSelectedIdsRef = useRef<string[]>(initialSelectedIds);
  initialSelectedIdsRef.current = initialSelectedIds;

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const PAGE_SIZE = 1000;
      const allOrders: RawOrderRow[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("vendas")
          .select(
            "id, numero_venda, numero, tipo, status, status_aprovacao, valor_total, created_at, clientes(nome)",
          )
          .or("status_aprovacao.neq.Pendente,status_aprovacao.is.null")
          .order("numero_venda", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const batch = (data as RawOrderRow[]) || [];
        allOrders.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const nonDraftOrders = allOrders.filter(
        (o) => o.status_aprovacao !== "Rascunho" && o.status !== "Rascunho",
      );
      setOrders(nonDraftOrders);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar lista de pedidos: " + (err?.message || "Erro desconhecido"));
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIdsRef.current);
      setRangeFrom("");
      setRangeTo("");
      setSearchTerm("");
      fetchOrders();
    }
  }, [open]);

  const parsedRange = useMemo(() => {
    const fStr = rangeFrom.trim();
    const tStr = rangeTo.trim();
    if (!fStr && !tStr) return null;

    const n1 = fStr ? Number(fStr) : Number(tStr);
    const n2 = tStr ? Number(tStr) : Number(fStr);
    if (!Number.isFinite(n1) || !Number.isFinite(n2) || n1 < 0 || n2 < 0) {
      return null;
    }

    return {
      min: Math.min(n1, n2),
      max: Math.max(n1, n2),
    };
  }, [rangeFrom, rangeTo]);

  const rangeAnalysis = useMemo(() => {
    if (!parsedRange) return { matchedIds: [] as string[], skippedCancelled: 0 };

    const matchedIds: string[] = [];
    let skippedCancelled = 0;

    for (const o of orders) {
      const num = getOrderNumber(o);
      if (num === null || num < parsedRange.min || num > parsedRange.max) continue;
      if (tipoFilter !== "Todos" && o.tipo !== tipoFilter) continue;

      if (ignoreCancelled && isCancelledStatus(o.status)) {
        skippedCancelled++;
        continue;
      }
      matchedIds.push(o.id);
    }

    return { matchedIds, skippedCancelled };
  }, [orders, parsedRange, tipoFilter, ignoreCancelled]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (ignoreCancelled && isCancelledStatus(o.status)) return false;
      if (tipoFilter !== "Todos" && o.tipo !== tipoFilter) return false;
      if (!query) return true;

      const label = getOrderLabel(o).toLowerCase();
      const clientName = getClientName(o.clientes).toLowerCase();
      const status = (o.status || "").toLowerCase();
      return label.includes(query) || clientName.includes(query) || status.includes(query);
    });
  }, [orders, searchTerm, tipoFilter, ignoreCancelled]);

  const handleApplyRange = () => {
    if (!parsedRange) {
      toast.error("Informe um número inicial e/ou final válido para o intervalo.");
      return;
    }
    if (rangeAnalysis.matchedIds.length === 0) {
      toast.warning(
        rangeAnalysis.skippedCancelled > 0
          ? `Nenhum pedido válido encontrado entre #${parsedRange.min} e #${parsedRange.max} (${rangeAnalysis.skippedCancelled} cancelado/rejeitado ignorado).`
          : `Nenhum pedido encontrado entre #${parsedRange.min} e #${parsedRange.max}.`,
      );
      return;
    }

    setSelectedIds(rangeAnalysis.matchedIds);
    const skippedNote =
      rangeAnalysis.skippedCancelled > 0
        ? ` (${rangeAnalysis.skippedCancelled} cancelado/rejeitado ignorado)`
        : "";
    toast.success(
      `${rangeAnalysis.matchedIds.length} pedido(s) selecionado(s) na faixa #${parsedRange.min} a #${parsedRange.max}${skippedNote}.`,
    );
  };

  const toggleOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const allVisibleSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.includes(o.id));

  const handleToggleSelectAllVisible = () => {
    const visibleIds = filteredOrders.map((o) => o.id);
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleConfirmImport = async () => {
    let targetIds = selectedIds;
    if (targetIds.length === 0 && parsedRange && rangeAnalysis.matchedIds.length > 0) {
      targetIds = rangeAnalysis.matchedIds;
    }

    if (targetIds.length === 0) {
      toast.error("Selecione ao menos um pedido ou informe um intervalo válido.");
      return;
    }

    setImporting(true);
    try {
      const selectedOrdersList: ImportedOrderInfo[] = orders
        .filter((o) => targetIds.includes(o.id))
        .map((o) => ({
          id: o.id,
          numero_venda: o.numero_venda,
          numero: o.numero,
          tipo: o.tipo || "VENDA",
          status: o.status || "",
          valor_total: Number(o.valor_total || 0),
          created_at: o.created_at,
          cliente_nome: getClientName(o.clientes),
        }))
        .sort((a, b) => (getOrderNumber(a) ?? 0) - (getOrderNumber(b) ?? 0));

      const orderLabelById = new Map<string, string>();
      for (const ord of selectedOrdersList) {
        orderLabelById.set(ord.id, getOrderLabel(ord));
      }

      const CHUNK_SIZE = 80;
      const PAGE_SIZE = 1000;
      const allItems: any[] = [];

      for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
        const chunkIds = targetIds.slice(i, i + CHUNK_SIZE);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("vendas_itens")
            .select("venda_id, produto_id, quantidade, valor_unitario, subtotal")
            .in("venda_id", chunkIds)
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          const batch = data || [];
          allItems.push(...batch);
          if (batch.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
      }

      const productMap: Record<string, ImportedProductAgg> = {};
      const perProductOrderQty: Record<string, Record<string, number>> = {};

      for (const item of allItems) {
        if (!item.produto_id) continue;
        const qty = Number(item.quantidade || 0);
        const sub = Number(
          item.subtotal !== null && item.subtotal !== undefined
            ? item.subtotal
            : qty * Number(item.valor_unitario || 0),
        );
        const orderLabel = orderLabelById.get(item.venda_id) || "?";

        if (!productMap[item.produto_id]) {
          productMap[item.produto_id] = {
            quantidade: 0,
            subtotal: 0,
            pedidos: [],
          };
          perProductOrderQty[item.produto_id] = {};
        }

        productMap[item.produto_id].quantidade += qty;
        productMap[item.produto_id].subtotal += sub;
        perProductOrderQty[item.produto_id][orderLabel] =
          (perProductOrderQty[item.produto_id][orderLabel] || 0) + qty;
      }

      for (const prodId of Object.keys(productMap)) {
        const orderEntries = Object.entries(perProductOrderQty[prodId])
          .map(([numero, quantidade]) => ({ numero, quantidade }))
          .sort((a, b) => Number(a.numero) - Number(b.numero));
        productMap[prodId].pedidos = orderEntries;
      }

      const distinctCount = Object.keys(productMap).length;
      if (distinctCount === 0) {
        toast.warning("Os pedidos selecionados não possuem itens vinculados.");
      } else {
        toast.success(
          `${selectedOrdersList.length} pedido(s) importado(s) — ${distinctCount} produto(s) consolidados.`,
        );
      }

      onImport({ orders: selectedOrdersList, productMap });
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao importar itens dos pedidos: " + (err?.message || "Erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadgeClass = (status: string | null) => {
    if (status === "Pago" || status === "Faturado" || status === "Entregue") {
      return "bg-success/15 text-success border-0";
    }
    if (status === "Cancelado" || status === "Rejeitado") {
      return "bg-destructive/15 text-destructive border-0";
    }
    return "bg-warning/15 text-warning border-0";
  };

  const effectiveImportCount =
    selectedIds.length > 0 ? selectedIds.length : rangeAnalysis.matchedIds.length;

  return (
    <Dialog open={open} onOpenChange={(val) => !importing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden print:hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileInput className="h-5 w-5 text-primary" />
            Importar Pedidos da Aba Vendas
          </DialogTitle>
          <DialogDescription>
            Informe um intervalo de números (ex.: <strong>150 a 161</strong>) ou marque os pedidos
            na lista abaixo para filtrar e somar somente os produtos desses pedidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Seleção rápida por intervalo */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">
                Seleção rápida por intervalo de pedidos
              </span>
              {parsedRange && (
                <Badge variant="secondary" className="font-bold">
                  {rangeAnalysis.matchedIds.length} pedido(s) encontrado(s) entre #{parsedRange.min}{" "}
                  e #{parsedRange.max}
                  {rangeAnalysis.skippedCancelled > 0
                    ? ` (${rangeAnalysis.skippedCancelled} cancelado/rejeitado)`
                    : ""}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2.5">
              <div className="space-y-1 flex-1 min-w-[120px]">
                <Label htmlFor="range-from" className="text-xs font-semibold">
                  Do pedido Nº
                </Label>
                <Input
                  id="range-from"
                  type="number"
                  min={0}
                  placeholder="Ex: 150"
                  className="font-bold bg-background"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyRange();
                    }
                  }}
                />
              </div>

              <div className="pb-2 text-muted-foreground hidden sm:block">
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="space-y-1 flex-1 min-w-[120px]">
                <Label htmlFor="range-to" className="text-xs font-semibold">
                  Até pedido Nº
                </Label>
                <Input
                  id="range-to"
                  type="number"
                  min={0}
                  placeholder="Ex: 161"
                  className="font-bold bg-background"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyRange();
                    }
                  }}
                />
              </div>

              <Button
                type="button"
                variant={parsedRange ? "default" : "outline"}
                className="font-bold shrink-0"
                onClick={handleApplyRange}
                disabled={loadingOrders || !parsedRange}
              >
                Selecionar Faixa
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dica: preencha os dois números para selecionar toda a faixa, ou deixe &quot;Até&quot;
              vazio para buscar apenas um pedido. Depois você ainda pode ajustar marcando ou
              desmarcando itens abaixo.
            </p>
          </div>

          {/* Barra de busca e filtros da lista */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nº do pedido ou cliente..."
                className="pl-9 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[140px] h-9 font-semibold">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os tipos</SelectItem>
                <SelectItem value="VENDA">VENDA</SelectItem>
                <SelectItem value="PDV">PDV</SelectItem>
                <SelectItem value="DAV">DAV</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={fetchOrders}
              disabled={loadingOrders}
              title="Atualizar lista de pedidos"
            >
              <RefreshCw className={`h-4 w-4 ${loadingOrders ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-muted-foreground">
              <Checkbox
                checked={ignoreCancelled}
                onCheckedChange={(checked) => setIgnoreCancelled(checked === true)}
              />
              Ignorar pedidos Cancelados e Rejeitados
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-semibold"
                onClick={handleToggleSelectAllVisible}
                disabled={filteredOrders.length === 0}
              >
                {allVisibleSelected ? (
                  <>
                    <Square className="h-3.5 w-3.5 mr-1" /> Desmarcar visíveis
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 mr-1" /> Selecionar visíveis
                  </>
                )}
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-semibold text-destructive hover:text-destructive"
                  onClick={() => setSelectedIds([])}
                >
                  Limpar ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Lista de pedidos */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[290px] overflow-y-auto divide-y">
              {loadingOrders ? (
                <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando pedidos...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum pedido encontrado com os filtros atuais.
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const checked = selectedIds.includes(order.id);
                  const cancelled = isCancelledStatus(order.status);
                  const label = getOrderLabel(order);
                  const clientName = getClientName(order.clientes);

                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleOrder(order.id)}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                        checked ? "bg-primary/8 hover:bg-primary/12" : "hover:bg-muted/50"
                      } ${cancelled ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOrder(order.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-mono font-bold text-foreground shrink-0">
                          #{label}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {order.tipo || "VENDA"}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-foreground">{clientName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-xs sm:text-sm whitespace-nowrap">
                          R${" "}
                          {Number(order.valor_total || 0)
                            .toFixed(2)
                            .replace(".", ",")}
                        </span>
                        <Badge className={`text-[10px] ${getStatusBadgeClass(order.status)}`}>
                          {order.status || "—"}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row items-center justify-between gap-3 sm:justify-between">
          <div className="text-xs font-semibold text-muted-foreground">
            {selectedIds.length > 0 ? (
              <span className="text-primary font-bold">
                {selectedIds.length} pedido(s) selecionado(s)
              </span>
            ) : parsedRange && rangeAnalysis.matchedIds.length > 0 ? (
              <span className="text-primary font-bold">
                Faixa #{parsedRange.min} a #{parsedRange.max} ({rangeAnalysis.matchedIds.length}{" "}
                pedido(s)) pronta para importar
              </span>
            ) : (
              "Nenhum pedido selecionado"
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-gradient-brand text-primary-foreground font-bold"
              onClick={handleConfirmImport}
              disabled={importing || effectiveImportCount === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileInput className="mr-2 h-4 w-4" />
                  {selectedIds.length > 0
                    ? `Importar ${selectedIds.length} Pedido(s)`
                    : parsedRange && rangeAnalysis.matchedIds.length > 0
                      ? `Importar Faixa (${rangeAnalysis.matchedIds.length})`
                      : "Importar Pedidos"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
