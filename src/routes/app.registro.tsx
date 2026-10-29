import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShoppingCart,
  UserPlus,
  Map,
  Wallet,
  Boxes,
  Receipt,
  ArrowRight,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export const Route = createFileRoute("/app/registro")({
  head: () => ({ meta: [{ title: "Registro Rapido - GARDEN PRIME ERP" }] }),
  component: RegistroRapido,
});

function RegistroRapido() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [openProduto, setOpenProduto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<any>(null);
  const [rotas, setRotas] = useState<any[]>([]);
  const [openRota, setOpenRota] = useState(false);
  const [rotaSelecionada, setRotaSelecionada] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Campos dos formularios
  const [clienteNome, setClienteNome] = useState("");
  const [qtd, setQtd] = useState("1");
  const [valorVenda, setValorVenda] = useState("");
  const [descFinanca, setDescFinanca] = useState("");
  const [valorFinanca, setValorFinanca] = useState("");
  const [tipoFinanca, setTipoFinanca] = useState("receita");
  const [statusFinanca, setStatusFinanca] = useState("paga");
  const [clienteNomeCad, setClienteNomeCad] = useState("");
  const [clienteTelCad, setClienteTelCad] = useState("");
  const [clienteCpfCad, setClienteCpfCad] = useState("");
  const [qtdEstoque, setQtdEstoque] = useState("");
  const [acaoEstoque, setAcaoEstoque] = useState("entrada");
  const [motorista, setMotorista] = useState("");
  const [pedidoRef, setPedidoRef] = useState("");
  const [statusEntrega, setStatusEntrega] = useState("pendente");
  const [fornecedor, setFornecedor] = useState("");
  const [qtdCompra, setQtdCompra] = useState("1");
  const [custoCompra, setCustoCompra] = useState("");
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    supabase
      .from("produtos")
      .select("id, nome, codigo, categoria, valor, estoque, status")
      .eq("status", "Ativo")
      .then(({ data }) => {
        if (data) setProdutos(data);
      });
    supabase
      .from("rotas")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setRotas(data);
      });
  }, []);

  const handleSalvar = async (actionId: string) => {
    setSaving(true);
    try {
      if (actionId === "venda") {
        if (!produtoSelecionado) throw new Error("Selecione um produto.");
        const { data: venda } = await supabase
          .from("vendas")
          .insert([
            {
              tipo: "PDV",
              status: "Pago",
              valor_total: Number(valorVenda) || produtoSelecionado.preco_venda * Number(qtd),
            },
          ])
          .select()
          .single();
        if (venda) {
          await supabase.from("vendas_itens").insert([
            {
              venda_id: venda.id,
              produto_id: produtoSelecionado.id,
              quantidade: Number(qtd),
              valor_unitario: produtoSelecionado.preco_venda,
              subtotal: produtoSelecionado.preco_venda * Number(qtd),
            },
          ]);
          await supabase
            .from("produtos")
            .update({ estoque: Math.max(0, (produtoSelecionado.estoque || 0) - Number(qtd)) })
            .eq("id", produtoSelecionado.id);
        }
        toast.success("Venda registrada com sucesso!");
      } else if (actionId === "financas") {
        if (!descFinanca || !valorFinanca) throw new Error("Preencha descricao e valor.");
        const table = tipoFinanca === "receita" ? "contas_receber" : "contas_pagar";
        await supabase.from(table).insert([
          {
            descricao: descFinanca,
            valor: Number(valorFinanca),
            status: statusFinanca === "paga" ? "Pago" : "Pendente",
            vencimento: new Date().toISOString().split("T")[0],
          },
        ]);
        toast.success("Lancamento financeiro salvo!");
      } else if (actionId === "cliente") {
        if (!clienteNomeCad) throw new Error("Preencha o nome do cliente.");
        await supabase
          .from("clientes")
          .insert([{ nome: clienteNomeCad, telefone: clienteTelCad, cpf_cnpj: clienteCpfCad }]);
        toast.success("Cliente cadastrado com sucesso!");
      } else if (actionId === "estoque") {
        if (!produtoSelecionado || !qtdEstoque) throw new Error("Selecione produto e quantidade.");
        const delta = acaoEstoque === "entrada" ? Number(qtdEstoque) : -Number(qtdEstoque);
        await supabase.from("movimentacoes_estoque").insert([
          {
            produto_id: produtoSelecionado.id,
            tipo: acaoEstoque === "entrada" ? "Entrada" : "Saida",
            quantidade: Number(qtdEstoque),
            motivo: "Registro Rapido",
          },
        ]);
        await supabase
          .from("produtos")
          .update({ estoque: Math.max(0, (produtoSelecionado.estoque || 0) + delta) })
          .eq("id", produtoSelecionado.id);
        toast.success("Estoque atualizado com sucesso!");
      } else if (actionId === "entregas") {
        if (!motorista) throw new Error("Preencha o motorista/entregador.");
        await supabase
          .from("rotas")
          .insert([{ motorista, status: statusEntrega, pedidos: pedidoRef ? [pedidoRef] : [] }]);
        toast.success("Entrega registrada com sucesso!");
      } else if (actionId === "compra") {
        if (!fornecedor || !produtoSelecionado) throw new Error("Preencha fornecedor e produto.");
        await supabase.from("contas_pagar").insert([
          {
            descricao: `Compra: ${produtoSelecionado.nome} de ${fornecedor}`,
            valor: Number(custoCompra),
            status: "Pendente",
            vencimento: new Date().toISOString().split("T")[0],
          },
        ]);
        await supabase.from("movimentacoes_estoque").insert([
          {
            produto_id: produtoSelecionado.id,
            tipo: "Entrada",
            quantidade: Number(qtdCompra),
            motivo: `Compra de ${fornecedor}`,
          },
        ]);
        await supabase
          .from("produtos")
          .update({ estoque: (produtoSelecionado.estoque || 0) + Number(qtdCompra) })
          .eq("id", produtoSelecionado.id);
        toast.success("Compra registrada com sucesso!");
      }
      drawerCloseRef.current?.click();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const actions = [
    {
      id: "venda",
      title: "Nova Venda",
      description: "Ir para o PDV ou criar um pedido",
      icon: ShoppingCart,
      to: "/app/pdv",
      color: "bg-blue-500",
      lightColor: "bg-blue-500/10 text-blue-500",
    },
    {
      id: "financas",
      title: "Financas",
      description: "Lancar receitas ou despesas",
      icon: Wallet,
      to: "/app/financeiro",
      color: "bg-emerald-500",
      lightColor: "bg-emerald-500/10 text-emerald-500",
    },
    {
      id: "cliente",
      title: "Novo Cliente",
      description: "Cadastrar cliente no sistema",
      icon: UserPlus,
      to: "/app/cliente-novo",
      color: "bg-purple-500",
      lightColor: "bg-purple-500/10 text-purple-500",
    },
    {
      id: "estoque",
      title: "Estoque",
      description: "Registrar entradas ou saidas",
      icon: Boxes,
      to: "/app/estoque",
      color: "bg-amber-500",
      lightColor: "bg-amber-500/10 text-amber-500",
    },
    {
      id: "entregas",
      title: "Entregas",
      description: "Gerenciar rotas e status",
      icon: Map,
      to: "/app/logistica",
      color: "bg-rose-500",
      lightColor: "bg-rose-500/10 text-rose-500",
    },
    {
      id: "compra",
      title: "Nova Compra",
      description: "Registrar compra com fornecedor",
      icon: Receipt,
      to: "/app/compra-nova",
      color: "bg-cyan-500",
      lightColor: "bg-cyan-500/10 text-cyan-500",
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Registro Rapido"
        subtitle="Acoes frequentes otimizadas para uso rapido pelo celular."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <Drawer key={idx}>
              <DrawerTrigger asChild>
                <div className="block group outline-none cursor-pointer">
                  <Card className="shadow-sm hover:shadow-md transition-all active:scale-[0.98] border-transparent hover:border-primary/20">
                    <CardContent className="p-6 flex items-center gap-5">
                      <div
                        className={`p-4 rounded-2xl flex-shrink-0 ${action.lightColor} group-hover:scale-110 transition-transform`}
                      >
                        <Icon className="w-8 h-8" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-foreground mb-1">
                          {action.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-tight">
                          {action.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </DrawerTrigger>
              <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                  <DrawerHeader>
                    <DrawerTitle>{action.title}</DrawerTitle>
                    <DrawerDescription>
                      Registro rapido simplificado para celular.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4 pb-0 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
                    {/* VENDA */}
                    {action.id === "venda" && (
                      <>
                        <div className="grid gap-2">
                          <Label>Cliente (opcional)</Label>
                          <Input
                            placeholder="Nome do cliente ou Consumidor Final"
                            value={clienteNome}
                            onChange={(e) => setClienteNome(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Produto</Label>
                          <Popover open={openProduto} onOpenChange={setOpenProduto}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                {produtoSelecionado
                                  ? produtoSelecionado.nome
                                  : "Selecione um produto..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[--radix-popover-trigger-width] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {produtos.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.nome}
                                        onSelect={() => {
                                          setProdutoSelecionado(p);
                                          setOpenProduto(false);
                                          setValorVenda((p.preco_venda * 1).toFixed(2));
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            produtoSelecionado?.id === p.id
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {p.nome} - R$ {Number(p.preco_venda).toFixed(2)}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={qtd}
                              onChange={(e) => setQtd(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Valor Total (R$)</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={valorVenda}
                              onChange={(e) => setValorVenda(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* FINANCAS */}
                    {action.id === "financas" && (
                      <>
                        <div className="grid gap-2">
                          <Label>Descricao</Label>
                          <Input
                            placeholder="Ex: Venda balcao, Conta de luz..."
                            value={descFinanca}
                            onChange={(e) => setDescFinanca(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Valor (R$)</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={valorFinanca}
                              onChange={(e) => setValorFinanca(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Tipo</Label>
                            <Select value={tipoFinanca} onValueChange={setTipoFinanca}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="receita">Receita (+)</SelectItem>
                                <SelectItem value="despesa">Despesa (-)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Status</Label>
                          <Select value={statusFinanca} onValueChange={setStatusFinanca}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paga">Pago / Recebido</SelectItem>
                              <SelectItem value="pendente">Pendente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* CLIENTE */}
                    {action.id === "cliente" && (
                      <>
                        <div className="grid gap-2">
                          <Label>Nome do Cliente</Label>
                          <Input
                            placeholder="Nome completo"
                            value={clienteNomeCad}
                            onChange={(e) => setClienteNomeCad(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>WhatsApp / Telefone</Label>
                          <Input
                            placeholder="(00) 00000-0000"
                            value={clienteTelCad}
                            onChange={(e) => setClienteTelCad(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>CPF / CNPJ</Label>
                          <Input
                            placeholder="000.000.000-00"
                            value={clienteCpfCad}
                            onChange={(e) => setClienteCpfCad(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {/* ESTOQUE */}
                    {action.id === "estoque" && (
                      <>
                        <div className="grid gap-2">
                          <Label>Produto</Label>
                          <Popover open={openProduto} onOpenChange={setOpenProduto}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                {produtoSelecionado
                                  ? produtoSelecionado.nome
                                  : "Selecione um produto..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[--radix-popover-trigger-width] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {produtos.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.nome}
                                        onSelect={() => {
                                          setProdutoSelecionado(p);
                                          setOpenProduto(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            produtoSelecionado?.id === p.id
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {p.nome} - Estoque: {p.estoque}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={qtdEstoque}
                              onChange={(e) => setQtdEstoque(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Acao</Label>
                            <Select value={acaoEstoque} onValueChange={setAcaoEstoque}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="entrada">Entrada (+)</SelectItem>
                                <SelectItem value="saida">Baixa (-)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* ENTREGAS */}
                    {action.id === "entregas" && (
                      <>
                        <div className="grid gap-2">
                          <Label>Rota (Opcional)</Label>
                          <Popover open={openRota} onOpenChange={setOpenRota}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                {rotaSelecionada
                                  ? rotaSelecionada.motorista ||
                                    `Rota #${rotaSelecionada.id?.toString().slice(0, 4)}`
                                  : "Selecione uma rota..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[--radix-popover-trigger-width] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Buscar rota..." />
                                <CommandList>
                                  <CommandEmpty>Nenhuma rota encontrada.</CommandEmpty>
                                  <CommandGroup>
                                    {rotas.map((r) => (
                                      <CommandItem
                                        key={r.id}
                                        value={r.motorista || r.id}
                                        onSelect={() => {
                                          setRotaSelecionada(r);
                                          setOpenRota(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            rotaSelecionada?.id === r.id
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {r.motorista
                                          ? `Motorista: ${r.motorista}`
                                          : `Rota #${r.id?.toString().slice(0, 4)}`}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="grid gap-2">
                          <Label>Pedido / Cliente</Label>
                          <Input
                            placeholder="Referencia da venda..."
                            value={pedidoRef}
                            onChange={(e) => setPedidoRef(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Motorista / Entregador</Label>
                          <Input
                            placeholder="Nome do responsavel"
                            value={motorista}
                            onChange={(e) => setMotorista(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Status da Entrega</Label>
                          <Select value={statusEntrega} onValueChange={setStatusEntrega}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="em_rota">Em Rota</SelectItem>
                              <SelectItem value="entregue">Entregue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* COMPRA */}
                    {action.id === "compra" && (
                      <>
                        <div className="grid gap-2">
                          <Label>Fornecedor</Label>
                          <Input
                            placeholder="Nome da empresa..."
                            value={fornecedor}
                            onChange={(e) => setFornecedor(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Produto</Label>
                          <Popover open={openProduto} onOpenChange={setOpenProduto}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                {produtoSelecionado
                                  ? produtoSelecionado.nome
                                  : "Selecione um produto..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[--radix-popover-trigger-width] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {produtos.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.nome}
                                        onSelect={() => {
                                          setProdutoSelecionado(p);
                                          setOpenProduto(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            produtoSelecionado?.id === p.id
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {p.nome}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={qtdCompra}
                              onChange={(e) => setQtdCompra(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Custo Total (R$)</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={custoCompra}
                              onChange={(e) => setCustoCompra(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <DrawerFooter>
                    <Button
                      className="w-full bg-gradient-brand"
                      onClick={() => handleSalvar(action.id)}
                      disabled={saving}
                    >
                      {saving ? "Salvando..." : "Salvar Registro"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate({ to: action.to })}
                    >
                      Abrir Tela Completa <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <DrawerClose asChild>
                      <Button ref={drawerCloseRef} variant="ghost">
                        Cancelar
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          );
        })}
      </div>
    </div>
  );
}
