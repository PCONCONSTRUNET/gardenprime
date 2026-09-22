import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, ArrowLeft, Plus, Trash2, ShoppingCart, Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/venda-nova")({
  head: () => ({ meta: [{ title: "Nova Venda — GARDEN PRIME ERP" }] }),
  component: NovaVenda,
});

function NovaVenda() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

  // Form State
  const [clienteId, setClienteId] = useState("");
  const [openCliente, setOpenCliente] = useState(false);
  const [tipo] = useState("VENDA");
  const [status, setStatus] = useState("Pago");

  // Cart State
  const [itens, setItens] = useState<any[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [openProduto, setOpenProduto] = useState(false);
  const [descontoValor, setDescontoValor] = useState(0);
  const [freteValor, setFreteValor] = useState(0);

  // States for new client modal
  const [openModalCliente, setOpenModalCliente] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome: "",
    cpf_cnpj: "",
    telefone: "",
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [loadingCliente, setLoadingCliente] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from("clientes").select("*").order("nome");
      const { data: p } = await supabase
        .from("produtos")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");
      if (c) setClientes(c);
      if (p) setProdutos(p);
    };
    fetchData();
  }, []);

  const handleAddItem = () => {
    if (!produtoSelecionado || quantidade <= 0) return;
    const prod = produtos.find((p) => p.id === produtoSelecionado);
    if (!prod) return;

    if (tipo === "VENDA" && prod.estoque < quantidade) {
      alert(`Estoque insuficiente! Você tem apenas ${prod.estoque} unidades de ${prod.nome}.`);
      return;
    }

    const novoItem = {
      produto_id: prod.id,
      nome: prod.nome,
      valor_unitario: Number(prod.valor),
      quantidade: quantidade,
      subtotal: Number(prod.valor) * quantidade,
      imagem: prod.imagem,
    };

    setItens([...itens, novoItem]);
    setProdutoSelecionado("");
    setQuantidade(1);
  };

  const handleRemoveItem = (index: number) => {
    const novosItens = [...itens];
    novosItens.splice(index, 1);
    setItens(novosItens);
  };

  const handleUpdateValorUnitario = (index: number, novoValor: number) => {
    const novosItens = [...itens];
    novosItens[index].valor_unitario = novoValor;
    novosItens[index].subtotal = novoValor * novosItens[index].quantidade;
    setItens(novosItens);
  };

  const valorTotal = itens.reduce((acc, item) => acc + item.subtotal, 0);

  const handleSalvar = async () => {
    if (itens.length === 0) {
      alert("Adicione pelo menos um item.");
      return;
    }

    // Se não tiver cliente selecionado, abre o modal de novo cliente
    if (!clienteId) {
      setOpenModalCliente(true);
      return;
    }

    await executarSalvamentoVenda(clienteId);
  };

  const handleSalvarNovoCliente = async () => {
    if (!novoCliente.nome) {
      alert("O nome da empresa/cliente é obrigatório!");
      return;
    }

    setLoadingCliente(true);
    try {
      // Verificação de duplicidade
      let query = supabase.from("clientes").select("id, nome").limit(1);
      if (novoCliente.cpf_cnpj) {
        query = query.eq("cpf_cnpj", novoCliente.cpf_cnpj);
      } else {
        query = query.eq("nome", novoCliente.nome);
      }

      const { data: existingClient, error: searchError } = await query;
      if (searchError) throw searchError;

      if (existingClient && existingClient.length > 0) {
        alert(
          `Já existe um cliente cadastrado com este ${
            novoCliente.cpf_cnpj ? "CNPJ/CPF" : "Nome"
          }.`
        );
        setLoadingCliente(false);
        return;
      }

      const payload = {
        nome: novoCliente.nome,
        cpf_cnpj: novoCliente.cpf_cnpj,
        telefone: novoCliente.telefone,
        cep: novoCliente.cep,
        endereco: novoCliente.endereco,
        numero: novoCliente.numero,
        bairro: novoCliente.bairro,
        cidade: novoCliente.cidade,
        uf: novoCliente.uf,
        status: "Ativo",
      };

      const { data, error } = await supabase.from("clientes").insert([payload]).select().single();
      if (error) throw error;

      setClienteId(data.id);
      setOpenModalCliente(false);

      // Procede com a gravação do DAV/Venda com o novo cliente
      await executarSalvamentoVenda(data.id);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao criar novo cliente: " + err.message);
    } finally {
      setLoadingCliente(false);
    }
  };

  const executarSalvamentoVenda = async (idDoCliente: string) => {
    setLoading(true);
    try {
      const subtotal = itens.reduce((acc, i) => acc + i.subtotal, 0);
      const totalVenda = subtotal - descontoValor + freteValor;

      // Pega o último número gerado para evitar pulos
      let nextNumero = 1;
      const { data: maxVenda } = await supabase
        .from("vendas")
        .select("numero")
        .not("numero", "is", null)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxVenda && maxVenda.numero) {
        nextNumero = Number(maxVenda.numero) + 1;
      }

      // 1. Criar a Venda/DAV
      const { data: vendaData, error: vendaError } = await supabase
        .from("vendas")
        .insert([
          {
            cliente_id: idDoCliente,
            tipo: tipo,
            status: status,
            subtotal: subtotal,
            desconto_valor: descontoValor,
            frete_valor: freteValor,
            valor_total: totalVenda,
            numero: nextNumero,
          },
        ])
        .select()
        .single();

      if (vendaError) throw vendaError;
      const vendaId = vendaData.id;

      // 2. Inserir os Itens
      const itensToInsert = itens.map((i) => ({
        venda_id: vendaId,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        subtotal: i.subtotal,
      }));

      const { error: itensError } = await supabase.from("vendas_itens").insert(itensToInsert);
      if (itensError) throw itensError;

      // 3. Dar baixa no estoque e gerar financeiro (Somente se for VENDA e não Orçamento)
      if (tipo === "VENDA") {
        for (const item of itens) {
          const prod = produtos.find((p) => p.id === item.produto_id);
          const novoEstoque = prod.estoque - item.quantidade;
          await supabase
            .from("produtos")
            .update({ estoque: novoEstoque })
            .eq("id", item.produto_id);
        }

        // Criar Conta a Receber
        const vencimento = new Date();
        vencimento.setDate(vencimento.getDate() + 30); // 30 dias de prazo
        await supabase.from("contas_receber").insert([
          {
            venda_id: vendaId,
            cliente_id: idDoCliente,
            descricao: `Venda #${vendaData.numero_venda}`,
            valor: totalVenda,
            vencimento: vencimento.toISOString().split("T")[0],
            status: status === "Pago" ? "Recebido" : "Pendente",
            data_pagamento: status === "Pago" ? new Date().toISOString().split("T")[0] : null,
          },
        ]);
      }

      alert("Venda finalizada com sucesso!");
      navigate({ to: "/app/vendas" });
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Status padrão fixo para VENDA

  return (
    <>
      <PageHeader
        title="Nova Venda"
        subtitle="Preencha os dados e adicione os itens"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/vendas">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button
              className="bg-gradient-brand text-primary-foreground"
              onClick={handleSalvar}
              disabled={loading || itens.length === 0}
            >
              <Save className="mr-2 h-4 w-4" /> {loading ? "Processando..." : "Finalizar Venda"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Lado Esquerdo - Formulário Principal */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-card p-6 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand" /> Dados da Operação
            </h3>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <>
                  <option value="Pago">Pago / Finalizado</option>
                  <option value="Aguardando Pagamento">Aguardando Pagamento</option>
                  <option value="Em Separação">Em Separação</option>
                </>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Cliente</Label>
              <Popover open={openCliente} onOpenChange={setOpenCliente}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCliente}
                    className="w-full justify-between h-10 font-normal px-3"
                  >
                    {clienteId
                      ? (() => {
                          const c = clientes.find((cl) => cl.id === clienteId);
                          return c ? `${c.nome} (${c.cidade || "S/ Cidade"})` : "Selecione um cliente...";
                        })()
                      : "Selecione um cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nome, CNPJ, telefone..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clientes.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.nome} ${c.cpf_cnpj || ""} ${c.telefone || ""}`}
                            onSelect={() => {
                              setClienteId(c.id === clienteId ? "" : c.id);
                              setOpenCliente(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                clienteId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{c.nome}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.cpf_cnpj ? `CNPJ: ${c.cpf_cnpj}` : "Sem documento"} • {c.telefone ? `Tel: ${c.telefone}` : "Sem telefone"} • {c.cidade || "S/ Cidade"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          {/* Adicionar Itens */}
          <Card className="shadow-card p-6 space-y-4">
            <h3 className="font-semibold text-lg">Itens do Pedido</h3>
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1 flex flex-col justify-end">
                <Label>Produto</Label>
                <Popover open={openProduto} onOpenChange={setOpenProduto}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openProduto}
                      className="w-full justify-between h-10 font-normal px-3"
                    >
                      {produtoSelecionado
                        ? (() => {
                            const p = produtos.find((p) => p.id === produtoSelecionado);
                            return p
                              ? `${p.nome} - R$ ${Number(p.valor).toFixed(2)} (Estoque: ${p.estoque})`
                              : "Selecionar produto...";
                          })()
                        : "Selecionar ou buscar produto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar produto por nome..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {produtos.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.codigo || ""} ${p.nome} ${p.id}`}
                              onSelect={() => {
                                setProdutoSelecionado(p.id === produtoSelecionado ? "" : p.id);
                                setOpenProduto(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  produtoSelecionado === p.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {p.nome} - R$ {Number(p.valor).toFixed(2)} (Estoque: {p.estoque})
                                </span>
                                {p.imagem && (
                                  <img
                                    src={p.imagem}
                                    className="h-5 w-5 rounded object-cover mt-1"
                                  />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 w-24">
                <Label>Qtd</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                />
              </div>
              <Button type="button" onClick={handleAddItem} variant="secondary">
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>

            <div className="border rounded-md mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Unitário</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        Nenhum item adicionado ao carrinho.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-lg">
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
                        </TableCell>
                        <TableCell className="font-semibold">{item.nome}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            R$
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.valor_unitario}
                              onChange={(e) =>
                                handleUpdateValorUnitario(index, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 text-right bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-brand p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          R$ {item.subtotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Lado Direito - Resumo */}
        <div className="space-y-6">
          <Card className="shadow-card p-6 bg-accent/30 border-brand/20">
            <h3 className="font-semibold text-lg mb-4">Resumo</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({itens.length} itens)</span>
                <span className="font-semibold">R$ {valorTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Descontos</span>
                <div className="flex items-center gap-1 font-semibold text-destructive">
                  <span>- R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={descontoValor}
                    onChange={(e) => setDescontoValor(parseFloat(e.target.value) || 0)}
                    className="w-20 text-right bg-transparent border-b border-dashed border-destructive/50 outline-none focus:border-destructive p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div className="h-px w-full bg-border my-2" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Total</span>
                <span className="font-display text-2xl font-bold text-brand">
                  R$ {Math.max(0, valorTotal - descontoValor).toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal para criar novo cliente on-the-fly */}
      <Dialog open={openModalCliente} onOpenChange={setOpenModalCliente}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Preencher Dados do Cliente</DialogTitle>
            <DialogDescription>
              Você não selecionou um cliente. Preencha os dados abaixo para cadastrar e emitir o{" "}
              Pedido automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome / Empresa *</Label>
              <Input
                value={novoCliente.nome}
                onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                placeholder="Nome completo ou Razão Social"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input
                value={novoCliente.cpf_cnpj}
                onChange={(e) => setNovoCliente({ ...novoCliente, cpf_cnpj: e.target.value })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={novoCliente.telefone}
                onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={novoCliente.cep}
                  onChange={(e) => setNovoCliente({ ...novoCliente, cep: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
              <div className="space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input
                  value={novoCliente.endereco}
                  onChange={(e) => setNovoCliente({ ...novoCliente, endereco: e.target.value })}
                  placeholder="Rua Exemplo"
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={novoCliente.numero}
                  onChange={(e) => setNovoCliente({ ...novoCliente, numero: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={novoCliente.bairro}
                  onChange={(e) => setNovoCliente({ ...novoCliente, bairro: e.target.value })}
                  placeholder="Centro"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={novoCliente.cidade}
                  onChange={(e) => setNovoCliente({ ...novoCliente, cidade: e.target.value })}
                  placeholder="Sua Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  value={novoCliente.uf}
                  onChange={(e) => setNovoCliente({ ...novoCliente, uf: e.target.value })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenModalCliente(false)}
              disabled={loadingCliente}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarNovoCliente}
              disabled={loadingCliente}
              className="bg-gradient-brand text-primary-foreground"
            >
              {loadingCliente ? "Emitindo..." : "Confirmar e Emitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
