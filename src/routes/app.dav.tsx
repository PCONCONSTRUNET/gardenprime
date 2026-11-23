import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  FileText,
  Download,
  Printer,
  Trash2,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Ban,
  PackagePlus,
  ShoppingCart,
  Save,
  X,
  ArrowLeft,
  Minus,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import { downloadOrderPdf, openOrderPdf, shareOrderWhatsApp } from "@/lib/order-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { OrderProductPicker, type PickerProduct } from "@/components/order-product-picker";

export const Route = createFileRoute("/app/dav")({
  head: () => ({ meta: [{ title: "Orçamentos (DAV) — GARDEN PRIME ERP" }] }),
  component: DAVList,
});

function DAVList() {
  const confirm = useConfirm();
  const [davs, setDavs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting state
  type SortColumn = "numero" | "cliente_nome" | "created_at" | "total" | "status";
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // States for Details Dialog
  const [selectedDav, setSelectedDav] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [davItens, setDavItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  // Item editing states
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItens, setEditItens] = useState<any[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  const fetchDAVs = async () => {
    try {
      const { data, error } = await supabase
        .from("davs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDavs(data || []);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao buscar orçamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDAVs();
  }, []);

  // Fetch products for editing
  const fetchProdutos = async () => {
    if (produtos.length > 0) return;
    const { data } = await supabase
      .from("produtos")
      .select("id, nome, codigo, valor, estoque, imagem")
      .eq("status", "Ativo")
      .order("nome");
    if (data) setProdutos(data);
  };

  const handleOpenDetails = async (dav: any, autoEdit = false) => {
    let fullDav = { ...dav };
    if (dav.cliente_id) {
      try {
        const { data: cli } = await supabase.from("clientes").select("*").eq("id", dav.cliente_id).maybeSingle();
        if (cli) {
          fullDav.cliente = cli;
          fullDav.bairro = cli.bairro;
          fullDav.cidade = cli.cidade;
          fullDav.uf = cli.uf;
          fullDav.email = cli.email;
        }
      } catch (e) {}
    }
    setSelectedDav(fullDav);
    setOpenSheet(true);
    setIsEditingItems(false);
    setLoadingItens(true);
    try {
      const [{ data, error }] = await Promise.all([
        supabase
          .from("dav_items")
          .select("*, produtos(nome, codigo, imagem)")
          .eq("dav_id", dav.id),
        autoEdit ? fetchProdutos() : Promise.resolve(),
      ]);
      if (!error && data) {
        setDavItens(data);
        if (autoEdit) {
          setEditItens(data.map((i: any) => ({ ...i })));
          setRemovedIds([]);
          setNewItems([]);
          setIsEditingItems(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItens(false);
    }
  };

  // ─── Item editing ────────────────────────────────────────────────────────────

  const handleStartEditItems = async () => {
    await fetchProdutos();
    setEditItens(davItens.map((i) => ({ ...i })));
    setRemovedIds([]);
    setNewItems([]);
    setIsEditingItems(true);
  };

  const handleCancelEditItems = () => {
    setIsEditingItems(false);
    setEditItens([]);
    setRemovedIds([]);
    setNewItems([]);
  };

  const handleRemoveExistingItem = (itemId: string) => {
    setEditItens((prev) => prev.filter((i) => i.id !== itemId));
    setRemovedIds((prev) => [...prev, itemId]);
  };

  const handleChangeExistingQty = (itemId: string, delta: number) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const currentQ = typeof i.qtd === "number" ? i.qtd : parseInt(String(i.qtd)) || 1;
        const novaQtd = Math.max(1, currentQ + delta);
        const uVal =
          typeof i.valor_unitario === "number"
            ? i.valor_unitario
            : parseFloat(String(i.valor_unitario)) || 0;
        return { ...i, qtd: novaQtd, total: novaQtd * uVal };
      })
    );
  };

  const handleSetExistingQty = (itemId: string, val: string) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        if (val === "") {
          return { ...i, qtd: "", total: 0 };
        }
        const novaQtd = parseInt(val);
        if (isNaN(novaQtd) || novaQtd < 0) return i;
        const uVal =
          typeof i.valor_unitario === "number"
            ? i.valor_unitario
            : parseFloat(String(i.valor_unitario)) || 0;
        return { ...i, qtd: novaQtd, total: novaQtd * uVal };
      })
    );
  };

  const handleSetExistingUnitPrice = (itemId: string, val: string | number) => {
    setEditItens((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        if (val === "") {
          return { ...i, valor_unitario: "", total: 0 };
        }
        const newU = typeof val === "number" ? val : parseFloat(val);
        if (isNaN(newU) || newU < 0) return i;
        const qVal = typeof i.qtd === "number" ? i.qtd : parseInt(String(i.qtd)) || 0;
        return { ...i, valor_unitario: newU, total: qVal * newU };
      })
    );
  };

  const handleRemoveNewItem = (idx: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeNewItemQty = (idx: number, delta: number) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const currentQ =
          typeof item.quantidade === "number"
            ? item.quantidade
            : parseInt(String(item.quantidade)) || 1;
        const novaQtd = Math.max(1, currentQ + delta);
        const uVal =
          typeof item.valor_unitario === "number"
            ? item.valor_unitario
            : parseFloat(String(item.valor_unitario)) || 0;
        return { ...item, quantidade: novaQtd, subtotal: novaQtd * uVal };
      })
    );
  };

  const handleSetNewItemQty = (idx: number, val: string) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (val === "") {
          return { ...item, quantidade: "", subtotal: 0 };
        }
        const novaQtd = parseInt(val);
        if (isNaN(novaQtd) || novaQtd < 0) return item;
        const uVal =
          typeof item.valor_unitario === "number"
            ? item.valor_unitario
            : parseFloat(String(item.valor_unitario)) || 0;
        return { ...item, quantidade: novaQtd, subtotal: novaQtd * uVal };
      })
    );
  };

  const handleSetNewItemUnitPrice = (idx: number, val: string | number) => {
    setNewItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (val === "") {
          return { ...item, valor_unitario: "", subtotal: 0 };
        }
        const newU = typeof val === "number" ? val : parseFloat(val);
        if (isNaN(newU) || newU < 0) return item;
        const qVal =
          typeof item.quantidade === "number"
            ? item.quantidade
            : parseInt(String(item.quantidade)) || 0;
        return { ...item, valor_unitario: newU, subtotal: qVal * newU };
      })
    );
  };

  const handleQuickAddProduct = (prod: PickerProduct, quantidade: number) => {
    const qtdSafe = Math.max(1, Number(quantidade) || 1);
    const unitVal = Number(prod.valor || 0);

    setNewItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.produto_id === prod.id);
      if (existingIdx >= 0) {
        return prev.map((item, idx) => {
          if (idx !== existingIdx) return item;
          const nextQty = (Number(item.quantidade) || 0) + qtdSafe;
          const uVal = Number(item.valor_unitario) || 0;
          return { ...item, quantidade: nextQty, subtotal: nextQty * uVal };
        });
      }
      return [
        ...prev,
        {
          produto_id: prod.id,
          codigo: prod.codigo ?? null,
          nome: prod.nome,
          imagem: prod.imagem,
          quantidade: qtdSafe,
          valor_unitario: unitVal,
          subtotal: unitVal * qtdSafe,
        },
      ];
    });
  };

  const handleSaveItems = async () => {
    setSavingItems(true);
    try {
      const davId = selectedDav.id;

      // 1. Remove itens marcados
      for (const itemId of removedIds) {
        await supabase.from("dav_items").delete().eq("id", itemId);
      }

      // 2. Atualizar itens existentes (qtd, valor_unitario, total)
      for (const item of editItens) {
        const qtd = Math.max(1, parseInt(String(item.qtd)) || 1);
        const valorUnit = Math.max(0, parseFloat(String(item.valor_unitario)) || 0);
        const total = qtd * valorUnit;
        await supabase
          .from("dav_items")
          .update({
            qtd,
            valor_unitario: valorUnit,
            total,
          })
          .eq("id", item.id);
      }

      // 3. Inserir novos itens
      for (const item of newItems) {
        const qtd = Math.max(1, parseInt(String(item.quantidade)) || 1);
        const valorUnit = Math.max(0, parseFloat(String(item.valor_unitario)) || 0);
        await supabase.from("dav_items").insert({
          dav_id: davId,
          produto_id: item.produto_id,
          produto: item.nome,
          qtd,
          valor_unitario: valorUnit,
          total: qtd * valorUnit,
        });
      }

      // 4. Recalcular total
      const { data: allItens } = await supabase
        .from("dav_items")
        .select("total")
        .eq("dav_id", davId);

      const novoTotal = (allItens || []).reduce(
        (acc: number, i: any) => acc + Number(i.total),
        0
      );

      await supabase.from("davs").update({ total: novoTotal }).eq("id", davId);

      // 5. Recarregar itens
      const { data: updatedItens } = await supabase
        .from("dav_items")
        .select("*, produtos(nome, codigo, imagem)")
        .eq("dav_id", davId);

      setDavItens(updatedItens || []);
      setSelectedDav((prev: any) => ({ ...prev, total: novoTotal }));
      setDavs((prev) =>
        prev.map((d) => (d.id === davId ? { ...d, total: novoTotal } : d))
      );

      setIsEditingItems(false);
      setEditItens([]);
      setRemovedIds([]);
      setNewItems([]);
    } catch (err: any) {
      alert("Erro ao salvar itens: " + err.message);
    } finally {
      setSavingItems(false);
    }
  };

  // ─── Existing handlers ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (
      !(await confirm({
        description:
          "Tem certeza que deseja excluir permanentemente este orçamento? Essa ação não pode ser desfeita.",
        variant: "destructive",
      }))
    )
      return;
    try {
      await supabase.from("dav_items").delete().eq("dav_id", id);
      const { error } = await supabase.from("davs").delete().eq("id", id);
      if (error) throw error;
      if (selectedDav?.id === id) {
        setOpenSheet(false);
        setSelectedDav(null);
      }
      fetchDAVs();
    } catch (err: any) {
      alert("Erro ao deletar: " + err.message);
    }
  };

  const handleCancelDav = async (dav: any) => {
    if (
      !(await confirm({
        description: "Tem certeza que deseja cancelar este orçamento?",
        variant: "destructive",
      }))
    )
      return;

    try {
      const { error } = await supabase
        .from("davs")
        .update({ status: "Cancelado" })
        .eq("id", dav.id);
      if (error) throw error;

      if (selectedDav?.id === dav.id) {
        setSelectedDav((prev: any) => (prev ? { ...prev, status: "Cancelado" } : null));
      }
      fetchDAVs();
    } catch (err: any) {
      alert("Erro ao cancelar orçamento: " + err.message);
    }
  };

  const handleShareWhatsApp = async (dav: any) => {
    try {
      const { data: itens } = await supabase.from("dav_items").select("*").eq("dav_id", dav.id);
      
      const mappedDav = {
        ...dav,
        cliente: dav.clientes || null,
        cliente_nome: dav.cliente_nome || dav.clientes?.nome,
        valor_total: dav.total || dav.valor_total,
      };

      await shareOrderWhatsApp(mappedDav, itens || []);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao compartilhar no WhatsApp: " + (err.message || err));
    }
  };

  const getTone = (status: string) => {
    if (status === "Aprovado") return "bg-success/15 text-success border-0";
    if (status === "Rejeitado" || status === "Cancelado")
      return "bg-destructive/10 text-destructive border-0";
    return "bg-info/15 text-info border-0";
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedDavs = useMemo(() => {
    let filtered = [...davs];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((v) => {
        const name = (v.cliente_nome || "").toLowerCase();
        const cnpj = (v.cliente_cnpj || "").toLowerCase();
        const numero = String(v.numero || v.id).toLowerCase();
        return name.includes(lower) || cnpj.includes(lower) || numero.includes(lower);
      });
    }

    return filtered.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (sortColumn === "numero") {
        valA = valA || a.id;
        valB = valB || b.id;
      } else if (sortColumn === "created_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortColumn === "total") {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else if (sortColumn === "cliente_nome") {
        valA = (valA || "").toLowerCase();
        valB = (valB || "").toLowerCase();
      } else if (sortColumn === "status") {
        valA = (valA || "Aberto").toLowerCase();
        valB = (valB || "Aberto").toLowerCase();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [davs, sortColumn, sortDirection, searchTerm]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-1 h-3 w-3 inline-block opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline-block" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline-block" />
    );
  };

  // Preview total while editing
  const editTotal = [
    ...editItens.map((i) => Number(i.total)),
    ...newItems.map((i) => i.subtotal),
  ].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Orçamentos (DAV)"
        subtitle="Documentos Auxiliares de Venda"
        actions={
          <Button className="bg-gradient-brand text-primary-foreground" asChild>
            <Link to="/app/dav-novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo DAV
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome, CNPJ/CPF ou número..."
            className="pl-8 bg-card"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("numero")}
              >
                Nº <SortIcon column="numero" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("cliente_nome")}
              >
                Cliente <SortIcon column="cliente_nome" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("created_at")}
              >
                Data <SortIcon column="created_at" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("total")}
              >
                Valor <SortIcon column="total" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon column="status" />
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Carregando DAVs...
                </TableCell>
              </TableRow>
            ) : davs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum orçamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sortedDavs.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenDetails(v)}
                >
                  <TableCell className="font-mono text-xs">
                    {v.numero
                      ? String(v.numero).padStart(3, "0")
                      : v.id.substring(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell className="font-semibold">{v.cliente_nome || "—"}</TableCell>
                  <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-semibold">
                    R${" "}
                    {Number(v.total || 0)
                      .toFixed(2)
                      .replace(".", ",")}
                  </TableCell>
                  <TableCell>
                    <Badge className={getTone(v.status || "Aberto")}>{v.status || "Aberto"}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      title="Enviar WhatsApp"
                      onClick={() => handleShareWhatsApp(v)}
                    >
                      <svg
                        className="h-5 w-5 text-green-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      title="Editar Orçamento"
                      onClick={() => handleOpenDetails(v, true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      title="Imprimir PDF"
                      onClick={() => openOrderPdf(v)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    {v.status !== "Cancelado" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        title="Cancelar Orçamento"
                        onClick={() => handleCancelDav(v)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Excluir Orçamento"
                      onClick={() => handleDelete(v.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={openSheet}
        onOpenChange={(o) => {
          setOpenSheet(o);
          if (!o) handleCancelEditItems();
        }}
      >
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !max-w-none !rounded-none !border-0 !p-0 flex flex-col bg-slate-50/95 overflow-hidden [&>button.absolute]:hidden">
          {/* ── Top Header Bar ──────────────────────────────────────────── */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-slate-600 hover:text-slate-900 rounded-xl shrink-0"
                onClick={() => setOpenSheet(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <DialogHeader className="text-left space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Orçamento DAV Nº{" "}
                    {selectedDav?.numero
                      ? String(selectedDav.numero).padStart(3, "0")
                      : selectedDav?.id?.substring(0, 8).toUpperCase()}
                  </DialogTitle>
                  <Badge className={getTone(selectedDav?.status || "Aberto")}>
                    {selectedDav?.status || "Aberto"}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 truncate">
                  {selectedDav?.cliente_nome || "Cliente não informado"} •{" "}
                  {selectedDav ? new Date(selectedDav.created_at).toLocaleDateString("pt-BR") : ""}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-slate-200 text-xs font-semibold gap-1.5"
                onClick={() => openOrderPdf(selectedDav, davItens)}
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden md:inline">Imprimir PDF</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-slate-200 text-xs font-semibold gap-1.5"
                onClick={() => downloadOrderPdf(selectedDav, davItens)}
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden md:inline">Baixar PDF</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold gap-1.5"
                onClick={() => handleShareWhatsApp(selectedDav)}
              >
                <svg
                  className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
                <span className="hidden md:inline">WhatsApp</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-900"
                onClick={() => setOpenSheet(false)}
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Main Full-Screen 2-Column Workspace ────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 items-start">
              {/* ── LEFT WIDE COLUMN: Produtos + Catálogo ───────────────── */}
              <div className="space-y-5 min-w-0">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          Produtos do Orçamento
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {isEditingItems
                            ? `${editItens.length + newItems.length} item(ns) no orçamento`
                            : `${davItens.length} item(ns) registrados`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditingItems ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-semibold rounded-xl"
                            onClick={handleCancelEditItems}
                            disabled={savingItems}
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar Edição
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 bg-gradient-brand text-primary-foreground text-xs font-bold rounded-xl px-4"
                            onClick={handleSaveItems}
                            disabled={savingItems}
                          >
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            {savingItems ? "Salvando..." : "Salvar Alterações"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs font-semibold gap-1.5 rounded-xl border-brand/30 text-brand hover:bg-brand/5"
                          onClick={handleStartEditItems}
                          disabled={loadingItens}
                        >
                          <PackagePlus className="h-3.5 w-3.5" /> Editar Produtos / Adicionar Itens
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditingItems ? (
                    <div className="space-y-3">
                      {editItens.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white border border-slate-200 text-lg">
                              {item.produtos?.imagem ? (
                                <img
                                  src={item.produtos.imagem}
                                  alt={item.produto}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="opacity-50">📦</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-slate-900 truncate">
                                {item.produto || "Produto"}
                              </div>
                              {(item.produtos?.codigo || item.codigo) && (
                                <div className="text-[11px] font-medium text-slate-400">
                                  Cód: {item.produtos?.codigo || item.codigo}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap shrink-0">
                            {/* Stepper Qtd */}
                            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200/70 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleChangeExistingQty(item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-xs hover:bg-slate-50 text-slate-700"
                                title="Diminuir"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.qtd === "" ? "" : item.qtd}
                                onChange={(e) => handleSetExistingQty(item.id, e.target.value)}
                                onBlur={() => {
                                  if (item.qtd === "" || parseInt(String(item.qtd)) <= 0) {
                                    handleSetExistingQty(item.id, "1");
                                  }
                                }}
                                className="w-12 text-center text-xs font-black text-slate-800 bg-transparent border-0 outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Quantidade"
                              />
                              <button
                                type="button"
                                onClick={() => handleChangeExistingQty(item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-xs hover:bg-slate-50 text-slate-700"
                                title="Aumentar"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Valor Unitário */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 focus-within:border-brand rounded-lg px-2 py-1">
                              <span className="text-[11px] font-bold text-slate-500">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.valor_unitario === "" ? "" : item.valor_unitario}
                                onChange={(e) => handleSetExistingUnitPrice(item.id, e.target.value)}
                                onBlur={() => {
                                  if (
                                    item.valor_unitario === "" ||
                                    isNaN(Number(item.valor_unitario))
                                  ) {
                                    handleSetExistingUnitPrice(item.id, "0");
                                  }
                                }}
                                className="w-16 text-xs font-bold text-slate-800 bg-transparent outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Valor unitário"
                              />
                              <span className="text-[10px] font-semibold text-slate-400">un</span>
                            </div>

                            <div className="min-w-[84px] text-right font-black text-sm text-slate-900">
                              R${" "}
                              {Number(item.total || 0).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => handleRemoveExistingItem(item.id)}
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Novos itens adicionados */}
                      {newItems.map((item, idx) => (
                        <div
                          key={`new-${idx}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white border border-emerald-200 text-lg">
                              {item.imagem ? (
                                <img
                                  src={item.imagem}
                                  alt={item.nome}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="opacity-50">📦</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-emerald-400 text-emerald-700 bg-white px-1.5 py-0 h-4 shrink-0"
                                >
                                  novo
                                </Badge>
                                <span className="font-bold text-sm text-slate-900 truncate">
                                  {item.nome}
                                </span>
                              </div>
                              {item.codigo && (
                                <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                                  Cód: {item.codigo}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap shrink-0">
                            {/* Stepper Qtd */}
                            <div className="flex items-center gap-0.5 bg-white border border-emerald-200 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleChangeNewItemQty(idx, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-50 rounded-md shadow-xs hover:bg-slate-100 text-slate-700"
                                title="Diminuir"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade === "" ? "" : item.quantidade}
                                onChange={(e) => handleSetNewItemQty(idx, e.target.value)}
                                onBlur={() => {
                                  if (
                                    item.quantidade === "" ||
                                    parseInt(String(item.quantidade)) <= 0
                                  ) {
                                    handleSetNewItemQty(idx, "1");
                                  }
                                }}
                                className="w-12 text-center text-xs font-black text-slate-800 bg-transparent border-0 outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Quantidade"
                              />
                              <button
                                type="button"
                                onClick={() => handleChangeNewItemQty(idx, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-50 rounded-md shadow-xs hover:bg-slate-100 text-slate-700"
                                title="Aumentar"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Valor Unitário */}
                            <div className="flex items-center gap-1 bg-white border border-emerald-200 focus-within:border-emerald-600 rounded-lg px-2 py-1">
                              <span className="text-[11px] font-bold text-slate-500">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.valor_unitario === "" ? "" : item.valor_unitario}
                                onChange={(e) => handleSetNewItemUnitPrice(idx, e.target.value)}
                                onBlur={() => {
                                  if (
                                    item.valor_unitario === "" ||
                                    isNaN(Number(item.valor_unitario))
                                  ) {
                                    handleSetNewItemUnitPrice(idx, "0");
                                  }
                                }}
                                className="w-16 text-xs font-bold text-slate-800 bg-transparent outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Valor unitário"
                              />
                              <span className="text-[10px] font-semibold text-slate-400">un</span>
                            </div>

                            <div className="min-w-[84px] text-right font-black text-sm text-emerald-700">
                              R${" "}
                              {Number(item.subtotal || 0).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => handleRemoveNewItem(idx)}
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {editItens.length === 0 && newItems.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                          Nenhum item no orçamento. Utilize o catálogo abaixo para adicionar produtos.
                        </div>
                      )}
                    </div>
                  ) : loadingItens ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Carregando itens do orçamento...
                    </div>
                  ) : davItens.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-slate-200 rounded-xl">
                      Nenhum item encontrado neste orçamento.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                      {davItens.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center gap-3 p-3.5 bg-white hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-xl bg-slate-100 border border-slate-200/60 overflow-hidden relative flex items-center justify-center text-lg shrink-0">
                              {item.produtos?.imagem ? (
                                <img
                                  src={item.produtos.imagem}
                                  alt={item.produto}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                "📦"
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-900 truncate">
                                {item.produto || "Produto Desconhecido"}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                {(item.produtos?.codigo || item.codigo) && (
                                  <span className="font-medium text-slate-400">
                                    Cód: {item.produtos?.codigo || item.codigo} •
                                  </span>
                                )}
                                <span>
                                  {item.qtd}x R${" "}
                                  {Number(item.valor_unitario).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-bold text-sm sm:text-base text-slate-900 shrink-0">
                            R${" "}
                            {Number(item.total).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Catálogo rápido de produtos no modo edição */}
                {isEditingItems && (
                  <OrderProductPicker
                    produtos={produtos}
                    onAddProduct={handleQuickAddProduct}
                  />
                )}
              </div>

              {/* ── RIGHT SIDEBAR: Resumo, Cliente & Ações ────────────────── */}
              <div className="space-y-4 lg:sticky lg:top-0">
                {/* Card Total */}
                <div className="rounded-2xl bg-slate-900 text-white p-5 shadow-md space-y-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-300 font-semibold">
                    <span>{isEditingItems ? "Novo Total Estimado" : "Total do Orçamento"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white">
                      {isEditingItems ? editItens.length + newItems.length : davItens.length} itens
                    </span>
                  </div>
                  <div className="text-3xl font-black tracking-tight">
                    R${" "}
                    {(isEditingItems ? editTotal : Number(selectedDav?.total || 0)).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 }
                    )}
                  </div>
                  {isEditingItems && (
                    <div className="pt-2 flex flex-col gap-2">
                      <Button
                        className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl"
                        onClick={handleSaveItems}
                        disabled={savingItems}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {savingItems ? "Salvando Alterações..." : "Salvar Alterações"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full h-9 text-slate-200 hover:text-white hover:bg-white/10 rounded-xl text-xs"
                        onClick={handleCancelEditItems}
                        disabled={savingItems}
                      >
                        Descartar Edição
                      </Button>
                    </div>
                  )}
                </div>

                {/* Card Dados do Cliente & Orçamento */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Resumo & Cliente
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                        Cliente
                      </span>
                      <span className="font-semibold text-slate-900">
                        {selectedDav?.cliente_nome || "—"}
                      </span>
                    </div>
                    {(selectedDav?.cliente?.cnpj_cpf || selectedDav?.cliente_cnpj) && (
                      <div>
                        <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                          CNPJ / CPF
                        </span>
                        <span className="font-medium text-slate-800">
                          {selectedDav?.cliente?.cnpj_cpf || selectedDav?.cliente_cnpj}
                        </span>
                      </div>
                    )}
                    {selectedDav?.cliente?.telefone && (
                      <div>
                        <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                          Telefone
                        </span>
                        <span className="font-medium text-slate-800">
                          {selectedDav.cliente.telefone}
                        </span>
                      </div>
                    )}
                    {(selectedDav?.cidade || selectedDav?.uf) && (
                      <div>
                        <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                          Cidade / UF
                        </span>
                        <span className="font-medium text-slate-800">
                          {[selectedDav?.cidade, selectedDav?.uf].filter(Boolean).join(" / ")}
                        </span>
                      </div>
                    )}
                    {selectedDav?.cliente?.cep && (
                      <div>
                        <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                          CEP
                        </span>
                        <span className="font-medium text-slate-800">
                          {selectedDav.cliente.cep}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                        Data
                      </span>
                      <span className="font-medium text-slate-800">
                        {selectedDav
                          ? new Date(selectedDav.created_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">
                        Emissor
                      </span>
                      <span className="font-medium text-slate-800">
                        {selectedDav?.emissor_nome || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Ações */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Ações do Orçamento
                  </h4>
                  <Button
                    className="w-full h-10 rounded-xl font-semibold text-xs"
                    variant="outline"
                    asChild
                  >
                    <Link to="/app/dav-novo" search={{ id: selectedDav?.id }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Editar Cadastro Completo
                    </Link>
                  </Button>

                  {selectedDav?.status !== "Cancelado" && (
                    <Button
                      className="w-full h-10 rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold text-xs"
                      variant="outline"
                      onClick={() => handleCancelDav(selectedDav)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-2 text-amber-600" /> Cancelar Orçamento
                    </Button>
                  )}

                  <Button
                    className="w-full h-9 rounded-xl text-destructive hover:bg-destructive/10 font-semibold text-xs"
                    variant="ghost"
                    onClick={() => handleDelete(selectedDav?.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir Orçamento Definitivamente
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
