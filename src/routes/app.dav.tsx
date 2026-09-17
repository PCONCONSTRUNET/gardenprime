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
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import { downloadOrderPdf, openOrderPdf } from "@/lib/order-pdf";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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

  // States for Details Sheet
  const [selectedDav, setSelectedDav] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [davItens, setDavItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

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

  const handleOpenDetails = async (dav: any) => {
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
    setLoadingItens(true);
    try {
      const { data, error } = await supabase
        .from("dav_items")
        .select("*, produtos(nome, codigo, imagem)")
        .eq("dav_id", dav.id);
      if (!error && data) setDavItens(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItens(false);
    }
  };

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
      // Deleta itens primeiro para integridade referencial
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

      let msg = `*ORÇAMENTO - GARDEN PRIME*\n`;
      msg += `Nº: ${dav.numero ? String(dav.numero).padStart(3, "0") : dav.id.substring(0, 8).toUpperCase()}\n`;
      msg += `Data: ${new Date(dav.created_at).toLocaleDateString()}\n`;
      msg += `Cliente: ${dav.cliente_nome}\n\n`;
      msg += `*ITENS DO ORÇAMENTO:*\n`;

      if (itens) {
        itens.forEach((item: any) => {
          msg += `• ${item.qtd}x ${item.produto} - R$ ${Number(item.total).toFixed(2).replace(".", ",")}\n`;
        });
      }

      msg += `\n*TOTAL: R$ ${Number(dav.total).toFixed(2).replace(".", ",")}*\n\n`;

      const linkPdf = `${window.location.origin}/orcamento/${dav.id}`;
      msg += `📄 *Acesse o documento formal em PDF aqui:*\n${linkPdf}`;

      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar mensagem do WhatsApp");
    }
  };

  const getTone = (status: string) => {
    if (status === "Aprovado") return "bg-success/15 text-success border-0";
    if (status === "Rejeitado" || status === "Cancelado")
      return "bg-destructive/10 text-destructive border-0";
    return "bg-info/15 text-info border-0"; // Orçamento Aberto
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
                  <TableCell className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
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
                      className="h-8 w-8 text-primary"
                      title="Baixar PDF"
                      onClick={() => downloadOrderPdf(v)}
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

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Orçamento</SheetTitle>
            <SheetDescription>DAV Nº {selectedDav?.numero_venda}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Cliente
                </span>
                <span className="font-medium">{selectedDav?.cliente_nome || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Data
                </span>
                <span className="font-medium">
                  {selectedDav ? new Date(selectedDav.created_at).toLocaleDateString() : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Emissor
                </span>
                <span className="font-medium">{selectedDav?.emissor_nome || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Total
                </span>
                <span className="font-bold text-base">
                  R${" "}
                  {Number(selectedDav?.total || 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4 flex items-center justify-between">
                <span>Produtos do Orçamento</span>
                <Badge variant="outline">{davItens.length} itens</Badge>
              </h4>
              {loadingItens ? (
                <p className="text-sm text-muted-foreground">Carregando itens...</p>
              ) : davItens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {davItens.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-muted overflow-hidden relative flex items-center justify-center text-lg flex-shrink-0">
                          {item.produtos?.imagem ? (
                            <img
                              src={item.produtos.imagem}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            "📦"
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">
                            {item.produto || "Produto Desconhecido"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.qtd}x R${" "}
                            {Number(item.valor_unitario).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-medium text-sm">
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

            <div className="flex gap-3 pt-6 border-t">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => handleShareWhatsApp(selectedDav)}
              >
                <svg
                  className="mr-2 h-4 w-4 text-green-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
                Enviar WhatsApp
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                onClick={() => openOrderPdf(selectedDav?.id)}
              >
                <Printer className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                Imprimir PDF
              </Button>
              <Button
                variant="outline"
                className="h-10 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                onClick={() => downloadOrderPdf(selectedDav, davItens)}
              >
                <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                Baixar PDF
              </Button>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/app/dav-novo" search={{ id: selectedDav?.id }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar Orçamento
                </Link>
              </Button>

              {selectedDav?.status !== "Cancelado" && (
                <Button
                  className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                  variant="outline"
                  onClick={() => handleCancelDav(selectedDav)}
                >
                  <Ban className="h-4 w-4 mr-2 text-amber-600" /> Cancelar Orçamento
                </Button>
              )}

              <Button
                className="w-full text-destructive hover:bg-destructive/10 font-semibold text-xs"
                variant="ghost"
                onClick={() => handleDelete(selectedDav?.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir Orçamento Definitivamente
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
