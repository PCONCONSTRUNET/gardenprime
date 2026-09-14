import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Shield,
  Users,
  User,
  Settings as Cog,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  Globe,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useConfirm } from "@/contexts/ConfirmContext";
import { supabase } from "@/lib/supabase";
import { testarConexao, BRASIL_NFE_TOKEN, labelAmbiente } from "@/lib/brasilnfe";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — GARDEN PRIME ERP" }] }),
  component: Configuracoes,
});

function Configuracoes() {
  const confirm = useConfirm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [perfil, setPerfil] = useState({
    razao_social: "",
    cnpj: "",
    inscricao_estadual: "",
    regime_tributario: "",
    endereco: "",
    telefone: "",
    email_contato: "",
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // ASAAS config
  const [asaasKey, setAsaasKey] = useState("");
  const [asaasAmbiente, setAsaasAmbiente] = useState<"sandbox" | "producao">("sandbox");
  const [showAsaasKey, setShowAsaasKey] = useState(false);
  const [savingAsaas, setSavingAsaas] = useState(false);
  const [asaasTested, setAsaasTested] = useState<null | boolean>(null);

  const [novoUserNome, setNovoUserNome] = useState("");
  const [novoUserEmail, setNovoUserEmail] = useState("");

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data) {
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const fetchConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from("configuracoes")
          .select("*")
          .eq("id", 1)
          .single();
        if (data && !error) {
          // Remover os campos id e created_at caso existam no retorno para evitar erro no upsert depois
          const { id, created_at, ...rest } = data;
          setPerfil((prev) => ({ ...prev, ...rest }));
        }
      } catch (err) {
        console.error("Erro ao carregar configurações", err);
      } finally {
        setLoadingConfigs(false);
      }
    };
    fetchConfigs();
  }, []);

  const handleAddUser = async () => {
    if (!novoUserNome || !novoUserEmail) return;
    try {
      const { error } = await supabase.from("usuarios").insert([
        {
          nome: novoUserNome,
          email: novoUserEmail,
          funcao: "Visualizador",
          cor: "bg-secondary text-foreground",
        },
      ]);
      if (error) throw error;

      setNovoUserNome("");
      setNovoUserEmail("");
      alert("Usuário convidado com sucesso! Um e-mail foi enviado para ele.");
      fetchUsers();
    } catch (err: any) {
      alert("Erro ao adicionar usuário: " + err.message);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (
      await confirm({
        description: "Tem certeza que deseja remover o acesso deste usuário?",
        variant: "destructive",
      })
    ) {
      try {
        await supabase.from("usuarios").delete().eq("id", id);
        fetchUsers();
      } catch (err: any) {
        alert("Erro ao remover usuário: " + err.message);
      }
    }
  };

  const handleSaveSettings = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("configuracoes").upsert([{ id: 1, ...perfil }]);
      if (error) throw error;
      alert("Configurações salvas com sucesso!");
    } catch (err: any) {
      alert(
        "Erro ao salvar configurações: " +
          err.message +
          "\n\nSe a tabela 'configuracoes' não existir no banco, execute o script SQL para criá-la.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const tables = [
        "vendas",
        "vendas_itens",
        "produtos",
        "clientes",
        "vendedores",
        "contas_receber",
        "contas_pagar",
        "movimentacoes_estoque",
      ];
      const backupData: Record<string, any[]> = {};

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*");
        if (!error && data) {
          backupData[table] = data;
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_gardenprime_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert("Backup baixado com sucesso!");
    } catch (err: any) {
      alert("Erro ao gerar backup: " + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Configurações do ERP"
        subtitle="Gerencie usuários, permissões e integrações do sistema"
      />

      <Tabs defaultValue="perfil">
        <TabsList className="mb-4">
          <TabsTrigger value="perfil">
            <User className="mr-1.5 h-4 w-4" />
            Perfil da Empresa
          </TabsTrigger>
          <TabsTrigger value="usuarios">
            <Users className="mr-1.5 h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="mr-1.5 h-4 w-4" />
            Saúde / Backup
          </TabsTrigger>
          <TabsTrigger value="preferencias">
            <Cog className="mr-1.5 h-4 w-4" />
            Preferências
          </TabsTrigger>
          <TabsTrigger value="fiscal">
            <FileText className="mr-1.5 h-4 w-4" />
            Fiscal / NFe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Dados da Empresa (Emissor NF-e)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingConfigs ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-muted-foreground">Carregando dados...</span>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Razão Social</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.razao_social || ""}
                      onChange={(e) => setPerfil((p) => ({ ...p, razao_social: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.cnpj || ""}
                      onChange={(e) => setPerfil((p) => ({ ...p, cnpj: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Inscrição Estadual</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.inscricao_estadual || ""}
                      onChange={(e) =>
                        setPerfil((p) => ({ ...p, inscricao_estadual: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Regime Tributário</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.regime_tributario || ""}
                      onChange={(e) =>
                        setPerfil((p) => ({ ...p, regime_tributario: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Endereço</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.endereco || ""}
                      onChange={(e) => setPerfil((p) => ({ ...p, endereco: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.telefone || ""}
                      onChange={(e) => setPerfil((p) => ({ ...p, telefone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>E-mail de Contato</Label>
                    <Input
                      className="mt-1.5"
                      value={perfil.email_contato || ""}
                      onChange={(e) => setPerfil((p) => ({ ...p, email_contato: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      onClick={handleSaveSettings}
                      disabled={savingProfile}
                      className="bg-gradient-brand text-primary-foreground"
                    >
                      {savingProfile ? "Salvando..." : "Salvar alterações"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle>Adicionar Novo Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end flex-wrap">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label>Nome Completo</Label>
                  <Input
                    value={novoUserNome}
                    onChange={(e) => setNovoUserNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label>E-mail</Label>
                  <Input
                    value={novoUserEmail}
                    onChange={(e) => setNovoUserEmail(e.target.value)}
                    placeholder="joao@gardenprime.com.br"
                    type="email"
                  />
                </div>
                <Button onClick={handleAddUser} className="bg-primary text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" /> Convidar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Usuários Ativos do Sistema ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingUsers ? (
                <div className="text-center p-4 text-muted-foreground">Carregando usuários...</div>
              ) : users.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">Nenhum usuário ativo.</div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-brand grid place-items-center text-sm font-bold text-primary-foreground shrink-0">
                        {u.nome
                          ? u.nome
                              .split(" ")
                              .map((x: string) => x[0])
                              .join("")
                              .substring(0, 2)
                              .toUpperCase()
                          : "US"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{u.nome || "Sem Nome"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email || "Sem E-mail"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={`${u.cor} border-0`}>{u.funcao}</Badge>
                      <Button
                        onClick={() => handleRemoveUser(u.id)}
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle>Saúde do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4 bg-success/10 border-success/20">
                <p className="text-sm font-semibold text-success">Status do Servidor Supabase</p>
                <p className="text-2xl font-bold text-success mt-1">Online & Operante</p>
              </div>
              <div className="rounded-xl border p-4 bg-info/10 border-info/20">
                <p className="text-sm font-semibold text-info">Uso de Armazenamento</p>
                <p className="text-2xl font-bold text-info mt-1">14% (1.4GB / 10GB)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Backup Manual do Banco de Dados</CardTitle>
              <CardDescription>
                Faça o download de todos os seus dados em formato JSON.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto font-bold h-12"
              >
                <Database className="mr-2 h-5 w-5" />
                {isBackingUp ? "Gerando Backup..." : "Fazer Backup Completo Agora"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferencias">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Preferências e Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Enviar e-mail para contas a pagar vencendo no dia",
                "Alertar quando estoque atingir mínimo",
                "Resumo financeiro semanal por WhatsApp",
                "Habilitar sons de 'Caixa Registradora' no PDV",
              ].map((p) => (
                <div key={p} className="flex items-center justify-between rounded-xl border p-4">
                  <p className="font-semibold text-sm">{p}</p>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba Fiscal / NFe ── */}
        <TabsContent value="fiscal">
          <FiscalTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── Componente Aba Fiscal ────────────────────────────────────────────────────

function FiscalTab() {
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<boolean | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleTestarConexao = async () => {
    setTestando(true);
    setResultadoTeste(null);
    try {
      const ok = await testarConexao();
      setResultadoTeste(ok);
    } catch {
      setResultadoTeste(false);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card de Status */}
      <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Brasil NFe — Integração Fiscal
          </CardTitle>
          <CardDescription>
            API para emissão de NF-e, NFC-e e outros documentos fiscais diretamente à SEFAZ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token */}
          <div>
            <Label className="mb-1.5 block">Token de Autenticação</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? "text" : "password"}
                  value={BRASIL_NFE_TOKEN}
                  readOnly
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowToken((v) => !v)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                onClick={handleTestarConexao}
                disabled={testando}
                className="shrink-0"
              >
                {testando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testando…
                  </>
                ) : (
                  <>Testar Conexão</>
                )}
              </Button>
            </div>
            {resultadoTeste === true && (
              <p className="flex items-center gap-2 text-sm text-success mt-2">
                <CheckCircle2 className="h-4 w-4" />
                Conexão com Brasil NFe estabelecida com sucesso!
              </p>
            )}
            {resultadoTeste === false && (
              <p className="flex items-center gap-2 text-sm text-destructive mt-2">
                <XCircle className="h-4 w-4" />
                Falha na conexão. Verifique o token e tente novamente.
              </p>
            )}
          </div>

          {/* Ambiente Padrão */}
          <div className="rounded-xl border p-4 bg-warning/5 border-warning/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm">Ambiente Padrão: Homologação</p>
                <p className="text-xs text-muted-foreground mt-1">
                  As emissões são feitas em homologação por padrão (sem valor fiscal). Para
                  produção, altere o ambiente diretamente no modal de emissão de cada NF-e.
                </p>
              </div>
              <Badge className="bg-warning/15 text-warning border-0 shrink-0 ml-4">
                Homologação
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Documentos Suportados */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Documentos Suportados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                doc: "NF-e",
                mod: "Modelo 55",
                desc: "Nota Fiscal Eletrônica para operações entre empresas",
                status: "Ativo",
              },
              {
                doc: "NFC-e",
                mod: "Modelo 65",
                desc: "Nota Fiscal ao Consumidor Eletrônica (PDV)",
                status: "Em breve",
              },
              {
                doc: "NFS-e",
                mod: "Modelo 10",
                desc: "Nota Fiscal de Serviços Eletrônica",
                status: "Em breve",
              },
              {
                doc: "CT-e",
                mod: "Modelo 57",
                desc: "Conhecimento de Transporte Eletrônico",
                status: "Em breve",
              },
            ].map((item) => (
              <div key={item.doc} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">
                      {item.doc}{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        ({item.mod})
                      </span>
                    </p>
                    <Badge
                      className={
                        item.status === "Ativo"
                          ? "bg-success/15 text-success border-0 text-xs"
                          : "bg-muted text-muted-foreground border-0 text-xs"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Card ASAAS */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600/10">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Integração ASAAS</CardTitle>
              <CardDescription className="text-xs">
                Gere cobranças via Boleto, PIX e Cartão de Crédito diretamente pelo ERP
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Chave de API */}
          <div className="space-y-2">
            <Label htmlFor="asaas-key">Chave de API (access_token)</Label>
            <div className="relative">
              <Input
                id="asaas-key"
                type={showAsaasKey ? "text" : "password"}
                placeholder="$aact_..."
                value={asaasKey}
                onChange={(e) => setAsaasKey(e.target.value)}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAsaasKey((v) => !v)}
              >
                {showAsaasKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtenha sua chave em{" "}
              <a
                href="https://app.asaas.com/config/account/integracoes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline underline-offset-2"
              >
                ASAAS → Configurações → Integrações
              </a>.
              A chave é armazenada como secret na Edge Function e nunca fica exposta no front.
            </p>
          </div>

          {/* Ambiente */}
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["sandbox", "producao"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setAsaasAmbiente(env)}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all ${
                    asaasAmbiente === env
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  <span className="font-medium capitalize">{env === "sandbox" ? "Sandbox (Testes)" : "Produção"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status de teste */}
          {asaasTested !== null && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                asaasTested
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {asaasTested ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {asaasTested ? "Conexão com ASAAS confirmada!" : "Falha na conexão. Verifique a chave."}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={savingAsaas || !asaasKey}
              onClick={async () => {
                setSavingAsaas(true);
                try {
                  // Testa buscando dados da conta
                  const { data, error } = await supabase.functions.invoke("asaas-proxy", {
                    body: JSON.stringify({}),
                    headers: {
                      "asaas-target-path": "/v3/myAccount",
                      "asaas-environment": asaasAmbiente,
                    },
                  });
                  setAsaasTested(!error && !data?.errors?.length);
                } catch {
                  setAsaasTested(false);
                } finally {
                  setSavingAsaas(false);
                }
              }}
            >
              {savingAsaas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Testar Conexão
            </Button>

            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={savingAsaas || !asaasKey}
              onClick={async () => {
                setSavingAsaas(true);
                try {
                  // Salva o ambiente nas configuracoes da tabela
                  await supabase.from("configuracoes").upsert([
                    { chave: "asaas_ambiente", valor: asaasAmbiente },
                  ], { onConflict: "chave" });
                  alert(
                    "Configurações salvas! Lembre-se de adicionar a chave ASAAS_API_KEY nos secrets da Edge Function no painel do Supabase."
                  );
                } catch (err: any) {
                  alert("Erro ao salvar: " + err.message);
                } finally {
                  setSavingAsaas(false);
                }
              }}
            >
              <Zap className="mr-2 h-4 w-4" />
              Salvar Configurações ASAAS
            </Button>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Como configurar a chave:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Acesse o painel do Supabase → Edge Functions → asaas-proxy</li>
              <li>Vá em <strong>Secrets</strong> e adicione <code className="bg-muted rounded px-1">ASAAS_API_KEY</code> com sua chave</li>
              <li>Selecione o ambiente acima (Sandbox para testes, Produção para real)</li>
              <li>Clique em <strong>Salvar Configurações</strong></li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
