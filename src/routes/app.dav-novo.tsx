import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Save, Plus, Trash2, Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/dav-novo")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: search.id as string | undefined,
  }),
  head: () => ({ meta: [{ title: "Novo DAV — GARDEN PRIME ERP" }] }),
  component: NovoDAV,
});

function NovoDAV() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isEditing = !!search.id;
  const [loading, setLoading] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(isEditing);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);

  const [cliente, setCliente] = useState({
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
  const [emissor, setEmissor] = useState({
    nome: "GARDEN PRIME",
    cnpj: "",
    endereco: "",
    telefone: "",
  });
  const [condicoes, setCondicoes] = useState({
    vendedor: "",
    pagamento: "Dinheiro / Pix",
    frete: "Retirada",
    prazo: "Imediato",
  });
  const [observacoes, setObservacoes] = useState("");

  const [itens, setItens] = useState<
    {
      id: number;
      produto_id?: string;
      codigo: string;
      produto: string;
      qtd: number;
      vlrUnit: number;
      openSearch: boolean;
      imagem?: string;
    }[]
  >([]);
  const [descontoValor, setDescontoValor] = useState(0);
  const [freteValor, setFreteValor] = useState(0);
  const [produtos, setProdutos] = useState<any[]>([]);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientesBuscaLista, setClientesBuscaLista] = useState<any[]>([]);

  const handleSearchClients = async (q: string) => {
    setClientSearch(q);
    if (!q) {
      setClientesBuscaLista([]);
      return;
    }
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, cpf_cnpj, telefone, endereco, numero, bairro, cidade, uf, cep")
      .ilike("nome", `%${q}%`)
      .limit(10);
    setClientesBuscaLista(data || []);
  };

  const handleBuscarCNPJ = async () => {
    const cnpjNumeros = cliente.cnpj.replace(/\D/g, "");
    if (cnpjNumeros.length !== 14) {
      alert("Por favor, insira um CNPJ válido com 14 dígitos.");
      return;
    }

    setLoadingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNumeros}`);
      if (!response.ok) {
        throw new Error("CNPJ não encontrado ou erro na API");
      }
      const data = await response.json();

      setCliente((prev) => ({
        ...prev,
        nome: data.razao_social || data.nome_fantasia || prev.nome,
        cep: data.cep ? data.cep.toString().replace(/^(\d{5})(\d{3})$/, "$1-$2") : prev.cep,
        endereco: data.logradouro || prev.endereco,
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        telefone: data.ddd_telefone_1 || prev.telefone,
      }));
    } catch (error: any) {
      alert(error.message || "Erro ao buscar CNPJ");
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const addItem = () =>
    setItens([
      ...itens,
      {
        id: Date.now(),
        codigo: "",
        produto: "",
        qtd: 1,
        vlrUnit: 0,
        openSearch: false,
        imagem: "",
      },
    ]);

  const removeItem = (id: number) => setItens(itens.filter((i) => i.id !== id));

  const updateItem = (id: number, field: string, value: string | number) => {
    setItens(itens.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from("configuracoes")
          .select("*")
          .eq("id", 1)
          .single();
        if (data && !error) {
          setEmissor({
            nome: data.razao_social || "GARDEN PRIME",
            cnpj: data.cnpj || "",
            endereco: data.endereco || "",
            telefone: data.telefone || "",
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configuracoes:", err);
      }
    };
    fetchConfigs();

    // Se estiver editando, carrega os dados existentes do DAV
    if (isEditing && search.id) {
      const fetchDav = async () => {
        try {
          const { data: dav, error: davError } = await supabase
            .from("davs")
            .select("*")
            .eq("id", search.id)
            .single();
          if (davError) throw davError;

          if (dav) {
            setCliente({
              nome: dav.cliente_nome || "",
              cnpj: dav.cliente_cnpj || "",
              cep: "",
              endereco: dav.cliente_endereco || "",
              numero: "",
              bairro: "",
              cidade: "",
              uf: "",
              telefone: dav.cliente_telefone || "",
            });
            setEmissor({
              nome: dav.emissor_nome || "GARDEN PRIME",
              cnpj: dav.emissor_cnpj || "",
              endereco: dav.emissor_endereco || "",
              telefone: dav.emissor_telefone || "",
            });
            setCondicoes({
              vendedor: dav.vendedor || "",
              pagamento: dav.condicao_pagamento || "Dinheiro / Pix",
              frete: dav.frete_tipo || "Retirada",
              prazo: dav.prazo_entrega || "Imediato",
            });
            setDescontoValor(dav.desconto_valor || 0);
            setFreteValor(dav.frete_valor || 0);
            setObservacoes(dav.observacoes || "");
          }

          // Carrega os itens do DAV
          const { data: davItens, error: itensError } = await supabase
            .from("dav_items")
            .select("*, produtos(imagem)")
            .eq("dav_id", search.id);
          if (itensError) throw itensError;

          if (davItens && davItens.length > 0) {
            setItens(
              davItens.map((i: any, idx: number) => ({
                id: Date.now() + idx,
                produto_id: i.produto_id || undefined,
                codigo: i.codigo || "",
                produto: i.produto || "",
                qtd: i.qtd,
                vlrUnit: Number(i.valor_unitario),
                openSearch: false,
                imagem: i.produtos?.imagem || "",
              })),
            );
          } else {
            setItens([
              {
                id: Date.now(),
                codigo: "",
                produto: "",
                qtd: 1,
                vlrUnit: 0,
                openSearch: false,
                imagem: "",
              },
            ]);
          }
        } catch (err: any) {
          console.error(err);
          alert("Erro ao carregar orçamento: " + err.message);
        } finally {
          setIsFetchingInfo(false);
        }
      };
      fetchDav();
      return;
    }

    const fetchProdutos = async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");
      if (data) setProdutos(data);
    };
    fetchProdutos();

    const loadCartFromURL = async () => {
      const params = new URLSearchParams(window.location.search);
      const cartMagic = params.get("c");

      const eParam = params.get("e");
      const cnjParam = params.get("cnpj");
      const cepParam = params.get("cep");
      const endParam = params.get("end");
      const numParam = params.get("num");
      const bairroParam = params.get("bairro");
      const cidParam = params.get("cid");
      const ufParam = params.get("uf");
      const telParam = params.get("tel");

      if (eParam || cnjParam) {
        setCliente((prev) => ({
          ...prev,
          nome: eParam || "",
          cnpj: cnjParam || "",
          cep: cepParam || "",
          endereco: endParam || "",
          numero: numParam || "",
          bairro: bairroParam || "",
          cidade: cidParam || "",
          uf: ufParam || "",
          telefone: telParam || "",
        }));
      }

      if (!cartMagic) {
        if (itens.length === 0) {
          setItens([
            { id: Date.now(), codigo: "", produto: "", qtd: 1, vlrUnit: 0, openSearch: false },
          ]);
        }
        return;
      }

      const { data: produtosData } = await supabase
        .from("produtos")
        .select("*")
        .eq("status", "Ativo")
        .order("nome");
      if (produtosData) {
        setProdutos(produtosData);
        const parsedItens: any[] = [];
        const items = cartMagic.split(",");
        items.forEach((item, index) => {
          const [id, qStr] = item.split(":");
          const qty = parseInt(qStr) || 1;
          const prod = produtosData.find((p) => p.id === id);
          if (prod) {
            parsedItens.push({
              id: Date.now() + index,
              produto_id: prod.id,
              codigo: prod.codigo || "",
              produto: prod.nome,
              qtd: qty,
              vlrUnit: Number(prod.valor),
              openSearch: false,
              imagem: prod.imagem,
            });
          }
        });
        if (parsedItens.length > 0) {
          setItens(parsedItens);
          window.history.replaceState({}, "", "/app/dav-novo");
        } else if (itens.length === 0) {
          setItens([
            {
              id: Date.now(),
              codigo: "",
              produto: "",
              qtd: 1,
              vlrUnit: 0,
              openSearch: false,
              imagem: "",
            },
          ]);
        }
      }
    };
    loadCartFromURL();
  }, []);

  const subtotal = itens.reduce((acc, item) => acc + item.qtd * item.vlrUnit, 0);
  const total = Math.max(0, subtotal - descontoValor) + freteValor;

  const handleSalvar = async () => {
    if (!cliente.nome) {
      alert("Preencha o nome do cliente.");
      return;
    }
    if (itens.length === 0 || !itens[0].produto) {
      alert("Adicione pelo menos um produto.");
      return;
    }

    setLoading(true);
    try {
      let cliente_id = null;
      if (cliente.nome) {
        let query = supabase.from("clientes").select("id").limit(1);
        if (cliente.cnpj) query = query.eq("cpf_cnpj", cliente.cnpj);
        else query = query.eq("nome", cliente.nome);

        const { data: existingClient } = await query;
        if (existingClient && existingClient.length > 0) {
          cliente_id = existingClient[0].id;
        } else {
          const { data: newClient } = await supabase
            .from("clientes")
            .insert({
              nome: cliente.nome,
              cpf_cnpj: cliente.cnpj,
              telefone: cliente.telefone,
              cep: cliente.cep,
              endereco: cliente.endereco,
              numero: cliente.numero,
              bairro: cliente.bairro,
              cidade: cliente.cidade,
              uf: cliente.uf,
              status: "Ativo",
            })
            .select("id")
            .single();
          if (newClient) cliente_id = newClient.id;
        }
      }

      const davPayload = {
        cliente_id: cliente_id,
        cliente_nome: cliente.nome,
        cliente_cnpj: cliente.cnpj,
        cliente_endereco: cliente.endereco,
        cliente_telefone: cliente.telefone,
        emissor_nome: emissor.nome,
        emissor_cnpj: emissor.cnpj,
        emissor_endereco: emissor.endereco,
        emissor_telefone: emissor.telefone,
        vendedor: condicoes.vendedor,
        condicao_pagamento: condicoes.pagamento,
        frete_tipo: condicoes.frete,
        prazo_entrega: condicoes.prazo,
        subtotal: subtotal,
        desconto_percentual: 0,
        desconto_valor: descontoValor,
        frete_valor: freteValor,
        total: total,
        observacoes: observacoes,
      };

      let davId: string;

      if (isEditing && search.id) {
        // EDITAR: atualiza o DAV existente
        const { error: updateError } = await supabase
          .from("davs")
          .update(davPayload)
          .eq("id", search.id);
        if (updateError) throw updateError;
        davId = search.id;

        // Remove os itens antigos e insere os novos
        await supabase.from("dav_items").delete().eq("dav_id", davId);
      } else {
        // NOVO: insere o DAV
        const { data: dav, error: davError } = await supabase
          .from("davs")
          .insert({
            ...davPayload,
            validade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select("id")
          .single();
        if (davError) throw davError;
        davId = dav.id;
      }

      // Salvar os itens
      const itensToInsert = itens.map((i) => ({
        dav_id: davId,
        produto_id: i.produto_id || null,
        codigo: i.codigo,
        produto: i.produto,
        qtd: i.qtd,
        valor_unitario: i.vlrUnit,
        total: i.qtd * i.vlrUnit,
      }));

      const { error: itemsError } = await supabase.from("dav_items").insert(itensToInsert);
      if (itemsError) throw itemsError;

      // Sucesso! Redirecionar para a visualização do DAV
      navigate({ to: "/app/dav" });
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar o DAV: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isFetchingInfo) {
    return <div className="p-8 text-center text-muted-foreground">Carregando orçamento...</div>;
  }

  return (
    <>
      <PageHeader
        title={isEditing ? "Editar Orçamento (DAV)" : "Novo Orçamento (DAV)"}
        subtitle={
          isEditing
            ? "Atualize os dados do orçamento"
            : "Preencha os dados para gerar um Documento Auxiliar de Venda"
        }
        actions={
          <Button
            className="bg-gradient-brand text-primary-foreground"
            onClick={handleSalvar}
            disabled={loading}
          >
            <Save className="mr-2 h-4 w-4" />{" "}
            {loading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar DAV"}
          </Button>
        }
      />

      <Card className="shadow-card p-6 max-w-5xl mx-auto space-y-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold">Dados do Cliente (Comprador)</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsClientModalOpen(true)}
              >
                <Search className="mr-1 h-3 w-3" /> Buscar
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nome / Razão Social</Label>
              <Input
                value={cliente.nome}
                onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                placeholder="Ex: Jardim Verde Ltda"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <div className="flex gap-2">
                <Input
                  value={cliente.cnpj}
                  onChange={(e) => setCliente({ ...cliente, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={handleBuscarCNPJ}
                  disabled={loadingCNPJ}
                  title="Buscar dados do CNPJ"
                >
                  {loadingCNPJ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={cliente.cep}
                onChange={(e) => setCliente({ ...cliente, cep: e.target.value })}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-2">
              <Label>Rua / Logradouro</Label>
              <Input
                value={cliente.endereco}
                onChange={(e) => setCliente({ ...cliente, endereco: e.target.value })}
                placeholder="Rua Exemplo"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={cliente.numero}
                  onChange={(e) => setCliente({ ...cliente, numero: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={cliente.bairro}
                  onChange={(e) => setCliente({ ...cliente, bairro: e.target.value })}
                  placeholder="Centro"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={cliente.cidade}
                  onChange={(e) => setCliente({ ...cliente, cidade: e.target.value })}
                  placeholder="Sua Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  value={cliente.uf}
                  onChange={(e) => setCliente({ ...cliente, uf: e.target.value })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={cliente.telefone}
                onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Dados do Emissor (Fornecedor)</h3>
            <div className="space-y-2">
              <Label>Nome / Razão Social</Label>
              <Input
                value={emissor.nome}
                onChange={(e) => setEmissor({ ...emissor, nome: e.target.value })}
                placeholder="Ex: Garden Prime"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <Input
                value={emissor.cnpj}
                onChange={(e) => setEmissor({ ...emissor, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço Completo</Label>
              <Input
                value={emissor.endereco}
                onChange={(e) => setEmissor({ ...emissor, endereco: e.target.value })}
                placeholder="Endereço da Empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={emissor.telefone}
                onChange={(e) => setEmissor({ ...emissor, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Condições Comerciais</h3>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Input
                value={condicoes.vendedor}
                onChange={(e) => setCondicoes({ ...condicoes, vendedor: e.target.value })}
                placeholder="Nome do vendedor"
              />
            </div>
            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <Input
                value={condicoes.pagamento}
                onChange={(e) => setCondicoes({ ...condicoes, pagamento: e.target.value })}
                placeholder="Ex: Pix, Dinheiro, Cartão"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Frete</Label>
              <Input
                value={condicoes.frete}
                onChange={(e) => setCondicoes({ ...condicoes, frete: e.target.value })}
                placeholder="Ex: Retirada, Entrega"
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo de Entrega</Label>
              <Input
                value={condicoes.prazo}
                onChange={(e) => setCondicoes({ ...condicoes, prazo: e.target.value })}
                placeholder="Ex: Imediato"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold">Produtos</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pr-0"></TableHead>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-24 text-right">Qtd</TableHead>
                  <TableHead className="w-32 text-right">Vlr Unit. (R$)</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="w-12 pr-0">
                      <div className="h-8 w-8 rounded bg-muted overflow-hidden relative flex items-center justify-center text-xs">
                        {i.imagem ? (
                          <img src={i.imagem} alt="" className="object-cover w-full h-full" />
                        ) : (
                          "📦"
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        value={i.codigo}
                        onChange={(e) => updateItem(i.id, "codigo", e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <Popover
                        open={i.openSearch}
                        onOpenChange={(open) =>
                          setItens((prev) =>
                            prev.map((it) => (it.id === i.id ? { ...it, openSearch: open } : it)),
                          )
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "h-8 w-full justify-between font-normal px-2 text-sm",
                              !i.produto && "text-muted-foreground",
                            )}
                          >
                            <span className="truncate">{i.produto || "Buscar produto..."}</span>
                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Pesquisar por nome..." />
                            <CommandList>
                              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                              <CommandGroup>
                                {produtos.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.codigo || ""} ${p.nome} ${p.id}`}
                                    onSelect={() => {
                                      setItens((prev) =>
                                        prev.map((it) =>
                                          it.id === i.id
                                            ? {
                                                ...it,
                                                produto_id: p.id,
                                                codigo: p.codigo || "",
                                                produto: p.nome,
                                                vlrUnit: Number(p.valor),
                                                openSearch: false,
                                                imagem: p.imagem,
                                              }
                                            : it,
                                        ),
                                      );
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        i.produto === p.nome ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{p.nome}</span>
                                      <span className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                        {p.imagem && (
                                          <img
                                            src={p.imagem}
                                            className="h-5 w-5 rounded object-cover"
                                          />
                                        )}
                                        <span>
                                          {p.codigo ? `Cód: ${p.codigo} · ` : ""}R${" "}
                                          {Number(p.valor).toFixed(2)}
                                        </span>
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-right"
                        type="number"
                        min="1"
                        value={i.qtd}
                        onChange={(e) => updateItem(i.id, "qtd", Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-right"
                        type="number"
                        step="0.01"
                        min="0"
                        value={i.vlrUnit}
                        onChange={(e) => updateItem(i.id, "vlrUnit", Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium pt-3">
                      {(i.qtd * i.vlrUnit).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(i.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6 pt-4 border-t">
          <div className="flex-1 space-y-2">
            <Label>Observações do Pedido</Label>
            <Input
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações para o cliente ou para a entrega..."
            />
          </div>

          <div className="w-full md:w-64 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Desconto (R$)</span>
              <Input
                className="w-24 h-8 text-right text-destructive font-semibold"
                type="number"
                min="0"
                step="0.01"
                value={descontoValor}
                onChange={(e) => setDescontoValor(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Frete (R$)</span>
              <Input
                className="w-24 h-8 text-right"
                type="number"
                min="0"
                step="0.01"
                value={freteValor}
                onChange={(e) => setFreteValor(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between items-center border-t pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buscar Cliente</DialogTitle>
            <DialogDescription>Selecione um cliente já cadastrado no sistema.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              placeholder="Buscar por nome..."
              value={clientSearch}
              onChange={(e) => handleSearchClients(e.target.value)}
              className="mb-4"
            />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {clientesBuscaLista.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => {
                    setCliente({
                      nome: c.nome,
                      cnpj: c.cpf_cnpj || "",
                      cep: c.cep || "",
                      endereco: c.endereco || "",
                      numero: c.numero || "",
                      bairro: c.bairro || "",
                      cidade: c.cidade || "",
                      uf: c.uf || "",
                      telefone: c.telefone || "",
                    });
                    setIsClientModalOpen(false);
                    setClientSearch("");
                    setClientesBuscaLista([]);
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{c.nome}</span>
                    {c.cpf_cnpj && (
                      <span className="text-xs text-muted-foreground">{c.cpf_cnpj}</span>
                    )}
                  </div>
                </Button>
              ))}
              {clientSearch && clientesBuscaLista.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente encontrado.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
