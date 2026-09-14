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
import { Plus, Calculator, Trash2, Check, X, Pencil, Search, Ban, Zap, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import { downloadOrderPdf } from "@/lib/order-pdf";
import { AsaasCobrancaModal } from "@/components/asaas-cobranca-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/vendas")({
  head: () => ({ meta: [{ title: "Vendas — GARDEN PRIME ERP" }] }),
  component: Vendas,
});

function Vendas() {
  const confirm = useConfirm();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // States for Details Sheet
  const [selectedVenda, setSelectedVenda] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [vendaItens, setVendaItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [newTotalValue, setNewTotalValue] = useState("");

  // ASAAS Modal
  const [openAsaas, setOpenAsaas] = useState(false);
  const [asaasCliente, setAsaasCliente] = useState<any>(null);

  const fetchVendas = async () => {
    try {
      // Usando junção (join) com clientes para pegar todos os dados do cliente
      const { data, error } = await supabase
        .from("vendas")
        .select(`*, clientes (*)`)
        .or("status_aprovacao.neq.Pendente,status_aprovacao.is.null")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVendas(data || []);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao buscar vendas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendas();
  }, []);

  const filteredVendas = vendas.filter((v) => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    const name = (v.clientes?.nome || "").toLowerCase();
    const cnpj = (v.clientes?.cpf_cnpj || "").toLowerCase();
    const numero = String(v.numero_venda || v.numero || v.id).toLowerCase();
    return name.includes(lower) || cnpj.includes(lower) || numero.includes(lower);
  });

  const handleOpenDetails = async (venda: any) => {
    setSelectedVenda(venda);
    setOpenSheet(true);
    setIsEditingTotal(false);
    setLoadingItens(true);
    try {
      const { data, error } = await supabase
        .from("vendas_itens")
        .select("*, produtos(nome, codigo, imagem)")
        .eq("venda_id", venda.id);
      if (!error && data) setVendaItens(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItens(false);
    }
  };

  const handleShareWhatsApp = async (venda: any) => {
    try {
      const { data: itens } = await supabase
        .from("vendas_itens")
        .select("*, produtos(nome)")
        .eq("venda_id", venda.id);

      let msg = `*${venda.tipo === "DAV" ? "ORÇAMENTO" : "PEDIDO"} - GARDEN PRIME*\n`;
      msg += `Nº: ${venda.numero_venda}\n`;
      msg += `Data: ${new Date(venda.created_at).toLocaleDateString()}\n\n`;
      msg += `*ITENS:*\n`;

      if (itens) {
        itens.forEach((item) => {
          msg += `• ${item.quantidade}x ${item.produtos?.nome || "Produto"} - R$ ${Number(item.subtotal).toFixed(2).replace(".", ",")}\n`;
        });
      }

      msg += `\n*TOTAL: R$ ${Number(venda.valor_total).toFixed(2).replace(".", ",")}*\n\n`;

      const linkPdf = `${window.location.origin}/orcamento/${venda.id}`;
      msg += `📄 *Acesse o documento formal em PDF aqui:*\n${linkPdf}`;

      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar mensagem do WhatsApp");
    }
  };

  const handleDelete = async (venda: any) => {
    const isDav = venda.tipo === "DAV";
    if (
      !(await confirm({
        description: `Tem certeza que deseja excluir est${isDav ? "e orçamento" : "a venda"}? ${["Faturado", "Pago", "Entregue"].includes(venda.status) ? "Os itens retornarão ao estoque." : ""}`,
        variant: "destructive",
      }))
    )
      return;
    try {
      // Se a venda já foi processada/faturada/paga (baixou estoque), precisa retornar o estoque
      if (["Faturado", "Pago", "Entregue"].includes(venda.status)) {
        const { data: itens } = await supabase
          .from("vendas_itens")
          .select("produto_id, quantidade")
          .eq("venda_id", venda.id);
        if (itens) {
          for (const item of itens) {
            const { data: prod } = await supabase
              .from("produtos")
              .select("estoque")
              .eq("id", item.produto_id)
              .single();
            if (prod) {
              await supabase
                .from("produtos")
                .update({ estoque: prod.estoque + item.quantidade })
                .eq("id", item.produto_id);
            }
          }
        }
      }

      // Deleta os itens da venda primeiro para integridade referencial
      await supabase.from("vendas_itens").delete().eq("venda_id", venda.id);
      const { error } = await supabase.from("vendas").delete().eq("id", venda.id);
      if (error) throw error;
      if (selectedVenda?.id === venda.id) {
        setOpenSheet(false);
        setSelectedVenda(null);
      }
      fetchVendas();
    } catch (err: any) {
      alert("Erro ao deletar: " + err.message);
    }
  };

  const handleCancelDav = async (venda: any) => {
    if (
      !(await confirm({
        description: "Tem certeza que deseja cancelar este orçamento?",
        variant: "destructive",
      }))
    )
      return;

    try {
      const { error } = await supabase
        .from("vendas")
        .update({ status: "Cancelado", status_aprovacao: "Cancelado" })
        .eq("id", venda.id);
      if (error) throw error;

      if (selectedVenda?.id === venda.id) {
        setSelectedVenda((prev: any) =>
          prev ? { ...prev, status: "Cancelado", status_aprovacao: "Cancelado" } : null,
        );
      }
      fetchVendas();
    } catch (err: any) {
      alert("Erro ao cancelar orçamento: " + err.message);
    }
  };

  const getTone = (status: string) => {
    if (status === "Pago" || status === "Faturado") return "bg-success/15 text-success border-0";
    if (status === "Aguardando Pagamento" || status === "Aprovado")
      return "bg-warning/15 text-warning border-0";
    if (status === "Rejeitado" || status === "Cancelado")
      return "bg-destructive/10 text-destructive border-0 font-semibold";
    return "bg-info/15 text-info border-0 font-semibold"; // Orçamento ou Em separação
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("vendas").update({ status: newStatus }).eq("id", id);
      if (error) throw error;

      setSelectedVenda((prev: any) => ({ ...prev, status: newStatus }));
      setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v)));
    } catch (err: any) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const handleEditTotal = () => {
    setNewTotalValue(selectedVenda?.valor_total?.toString() || "0");
    setIsEditingTotal(true);
  };

  const handleSaveTotal = async () => {
    const val = parseFloat(newTotalValue);
    if (isNaN(val) || val < 0) {
      alert("Valor inválido");
      return;
    }
    try {
      const { error: err1 } = await supabase
        .from("vendas")
        .update({ valor_total: val })
        .eq("id", selectedVenda.id);
      if (err1) throw err1;

      // Also update contas_receber if it exists
      const { error: err2 } = await supabase
        .from("contas_receber")
        .update({ valor: val })
        .eq("venda_id", selectedVenda.id);
      if (err2) throw err2;

      setSelectedVenda((prev: any) => ({ ...prev, valor_total: val }));
      setVendas((prev) =>
        prev.map((v) => (v.id === selectedVenda.id ? { ...v, valor_total: val } : v)),
      );
      setIsEditingTotal(false);
    } catch (err: any) {
      alert("Erro ao atualizar valor: " + err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Pedidos, orçamentos e faturamento"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/venda-nova">
                <Calculator className="mr-2 h-4 w-4" />
                Novo Orçamento (DAV)
              </Link>
            </Button>
            <Button className="bg-gradient-brand text-primary-foreground" asChild>
              <Link to="/app/venda-nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova Venda
              </Link>
            </Button>
          </>
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
              <TableHead>Nº</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando operações...
                </TableCell>
              </TableRow>
            ) : filteredVendas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma venda ou orçamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredVendas.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenDetails(v)}
                >
                  <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{v.tipo}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {v.cliente_id ? v.clientes?.nome || "Cliente Removido" : "Venda Avulsa"}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground max-w-[120px] truncate"
                    title={
                      v.metodo_pagamento ||
                      "Dinheiro / Pix" + (v.condicao_pagamento ? ` - ${v.condicao_pagamento}` : "")
                    }
                  >
                    <span className="font-semibold text-foreground">
                      {v.metodo_pagamento || "Não info."}
                    </span>
                    {v.condicao_pagamento &&
                      v.condicao_pagamento !== "Dinheiro / Pix" &&
                      v.condicao_pagamento !== "Cartão de Crédito" &&
                      v.condicao_pagamento !== "Cartão de Débito" && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          - {v.condicao_pagamento}
                        </span>
                      )}
                  </TableCell>
                  <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(v.valor_total).toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell>
                    <Badge className={getTone(v.status)}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {v.tipo === "DAV" && v.status !== "Cancelado" && (
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
                      title={v.tipo === "DAV" ? "Excluir Orçamento" : "Excluir Venda / Pedido"}
                      onClick={() => handleDelete(v)}
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
            <SheetTitle>Detalhes da Operação</SheetTitle>
            <SheetDescription>
              {selectedVenda?.tipo === "DAV" ? "Orçamento" : "Venda"} Nº{" "}
              {selectedVenda?.numero_venda}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Cliente
                </span>
                <span className="font-medium">
                  {selectedVenda?.clientes?.nome || "Cliente Removido"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Data
                </span>
                <span className="font-medium">
                  {selectedVenda ? new Date(selectedVenda.created_at).toLocaleDateString() : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Status
                </span>
                <Select
                  value={selectedVenda?.status || ""}
                  onValueChange={(val) => handleStatusChange(selectedVenda.id, val)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Aguardando Pagamento">Aguardando Pagamento</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Faturado">Faturado</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">
                  Total
                </span>
                {isEditingTotal ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newTotalValue}
                      onChange={(e) => setNewTotalValue(e.target.value)}
                      className="w-24 border-b border-dashed border-slate-400 outline-none bg-transparent font-semibold"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-success"
                      onClick={handleSaveTotal}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      onClick={() => setIsEditingTotal(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">
                      R${" "}
                      {Number(selectedVenda?.valor_total || 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-40 hover:opacity-100"
                      onClick={handleEditTotal}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Ações / Botões Movidos para o Topo */}
            <div className="flex flex-col gap-3 pt-6 border-t pb-2">
              {/* Botão ASAAS (Oculto a pedido) */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handleShareWhatsApp(selectedVenda)}
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
                <Button
                  className="flex-1 bg-slate-900"
                  onClick={() => downloadOrderPdf(
                    {
                      ...selectedVenda,
                      cliente: selectedVenda?.clientes || selectedVenda?.cliente,
                      condicao_pagamento: selectedVenda?.metodo_pagamento || selectedVenda?.condicao_pagamento,
                      total: selectedVenda?.valor_total ?? selectedVenda?.total,
                      subtotal: selectedVenda?.subtotal ?? selectedVenda?.valor_total,
                    },
                    vendaItens
                  )}
                >
                  <Download className="h-4 w-4 mr-2" /> Baixar PDF
                </Button>
              </div>
              <Button
                variant="secondary"
                className="w-full font-bold border border-slate-200"
                onClick={() => {
                  const itemsMagic = vendaItens
                    .map((i) => `${i.produto_id}:${i.quantidade}`)
                    .join(",");
                  window.location.href = `/app/pdv?c=${itemsMagic}`;
                }}
              >
                Clonar Pedido
              </Button>

              <div className="pt-2 border-t flex flex-col gap-2">
                {selectedVenda?.tipo === "DAV" ? (
                  <>
                    {selectedVenda.status !== "Cancelado" && (
                      <Button
                        variant="outline"
                        className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                        onClick={() => handleCancelDav(selectedVenda)}
                      >
                        <Ban className="h-4 w-4 mr-2 text-amber-600" />
                        Cancelar Orçamento
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:bg-destructive/10 font-semibold text-xs"
                      onClick={() => handleDelete(selectedVenda)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Orçamento Definitivamente
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 font-semibold"
                    onClick={() => handleDelete(selectedVenda)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Venda / Pedido
                  </Button>
                )}
              </div>
            </div>

            {/* SEÇÃO PRODUTOS */}

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4 flex items-center justify-between">
                <span>Produtos</span>
                <Badge variant="outline">{vendaItens.length} itens</Badge>
              </h4>
              {loadingItens ? (
                <p className="text-sm text-muted-foreground">Carregando itens...</p>
              ) : vendaItens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {vendaItens.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-lg">
                          {item.produtos?.imagem ? (
                            <img
                              src={item.produtos.imagem}
                              alt={item.produtos.nome}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="opacity-50">📦</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">
                            {item.produtos?.nome || "Produto Desconhecido"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.quantidade}x R${" "}
                            {Number(item.valor_unitario).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-medium text-sm">
                        R${" "}
                        {Number(item.subtotal).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* Modal ASAAS */}
      {openAsaas && (
        <AsaasCobrancaModal
          open={openAsaas}
          onClose={() => setOpenAsaas(false)}
          cliente={asaasCliente}
          valor={Number(selectedVenda?.valor_total || 0)}
          descricao={`Venda #${selectedVenda?.numero_venda} — ${asaasCliente?.nome || ""}`}
          vencimentoSugerido={new Date().toISOString().split("T")[0]}
          metodoPagamentoSugerido={selectedVenda?.metodo_pagamento}
          venda_id={selectedVenda?.id}
          onSuccess={() => fetchVendas()}
        />
      )}
    </>
  );
}
