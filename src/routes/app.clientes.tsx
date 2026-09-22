import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, History, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { MesclarClientesModal } from "@/components/mesclar-clientes-modal";
import { Users } from "lucide-react";

export const Route = createFileRoute("/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — GARDEN PRIME ERP" }] }),
  component: Clientes,
});

function Clientes() {
  const confirm = useConfirm();
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [clientVendas, setClientVendas] = useState<any[]>([]);
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [openMesclar, setOpenMesclar] = useState(false);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClientes(data || []);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao buscar clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleOpenDetails = async (c: any) => {
    setSelectedCliente(c);
    setOpenSheet(true);
    setLoadingVendas(true);
    try {
      const { data, error } = await supabase
        .from("vendas")
        .select("*")
        .eq("cliente_id", c.id)
        .order("created_at", { ascending: false });
      if (!error && data) setClientVendas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVendas(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !(await confirm({
        description: "Tem certeza que deseja excluir este cliente?",
        variant: "destructive",
      }))
    )
      return;
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      fetchClientes();
    } catch (err: any) {
      alert("Erro ao deletar: " + err.message);
    }
  };

  const ativos = clientes.filter((c) => c.status === "Ativo" || c.status === "Premium").length;
  const inativos = clientes.filter((c) => c.status === "Inativo").length;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${clientes.length} clientes cadastrados`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={() => setOpenMesclar(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              Mesclar Duplicados
            </Button>
            <Button asChild className="bg-gradient-brand text-primary-foreground">
              <Link to="/app/cliente-novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {[
          ["Total", clientes.length, "text-primary"],
          ["Ativos", ativos, "text-success"],
          ["Inativos", inativos, "text-destructive"],
        ].map(([l, v, c]) => (
          <Card key={String(l)} className="shadow-card">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{l}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${c}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente…" className="pl-9" />
          </div>
          <Button variant="outline" size="sm">
            Cidade
          </Button>
          <Button variant="outline" size="sm">
            Status
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Cidade / UF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Última Compra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando clientes...
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenDetails(c)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-brand grid place-items-center text-xs font-bold text-primary-foreground">
                          {c.nome
                            .split(" ")
                            .map((x: string) => x[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <span className="font-semibold">{c.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {c.cpf_cnpj || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.telefone || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          c.status === "Premium"
                            ? "bg-info/15 text-info hover:bg-info/20 border-0"
                            : c.status === "Ativo"
                              ? "bg-success/15 text-success hover:bg-success/20 border-0"
                              : "bg-muted text-muted-foreground border-0"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          asChild
                        >
                          <Link to="/app/cliente-novo" search={{ id: c.id }}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle>Detalhes do Cliente</SheetTitle>
                <SheetDescription>
                  {selectedCliente?.nome} - {selectedCliente?.cpf_cnpj || "Sem documento"}
                </SheetDescription>
              </div>
              {selectedCliente && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/cliente-novo" search={{ id: selectedCliente.id }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Link>
                </Button>
              )}
            </div>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Telefone</span>
                <span className="font-medium">{selectedCliente?.telefone || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Cidade/UF</span>
                <span className="font-medium">
                  {selectedCliente?.cidade
                    ? `${selectedCliente.cidade}${selectedCliente.uf ? "/" + selectedCliente.uf : ""}`
                    : "-"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block">Endereço</span>
                <span className="font-medium">{selectedCliente?.endereco || "-"}</span>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4">Histórico de Compras</h4>
              {loadingVendas ? (
                <p className="text-sm text-muted-foreground">Carregando movimentações...</p>
              ) : clientVendas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma compra registrada para este cliente.
                </p>
              ) : (
                <div className="space-y-4">
                  {clientVendas.map((v) => (
                    <div
                      key={v.id}
                      className="flex justify-between items-center p-3 rounded-lg border border-border/50"
                    >
                      <div>
                        <div className="font-semibold text-sm">
                          Pedido #{v.numero_venda || v.numero || v.id?.toString().slice(0, 5)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">
                          R${" "}
                          {Number(v.total || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <Badge variant="outline" className="text-[10px] mt-1">
                          {v.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MesclarClientesModal
        open={openMesclar}
        onOpenChange={setOpenMesclar}
        clientes={clientes}
        onSuccess={() => fetchClientes()}
      />
    </>
  );
}
