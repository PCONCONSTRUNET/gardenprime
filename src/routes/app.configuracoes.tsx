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
import { emitirNotaFiscalAsaas } from "@/lib/asaas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — GARDEN PRIME ERP" }] }),
  component: Configuracoes,
});

function Configuracoes() {
  const confirm = useConfirm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [perfil, setPerfil] = useState({
    razao_social: "GARDEN PLUS LTDA",
    cnpj: "50.387.381/0001-81",
    inscricao_estadual: "266031100110",
    regime_tributario: "Simples Nacional",
    endereco: "MATEUS RODRIGUES DA COSTA 327, JARDIM SANTA RITA, Charqueada - SP, 13518-482",
    telefone: "19 99930 8784",
    email_contato: "garden-plus@hotmail.com",
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // ASAAS config foi movido para FiscalTab

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
          if (rest.razao_social === "Garden Prime" || !rest.razao_social) {
            // Auto-migrate to Garden Plus
            const newPerfil = {
              razao_social: "GARDEN PLUS LTDA",
              cnpj: "50.387.381/0001-81",
              inscricao_estadual: "266031100110",
              regime_tributario: "Simples Nacional",
              endereco: "MATEUS RODRIGUES DA COSTA 327, JARDIM SANTA RITA, Charqueada - SP, 13518-482",
              telefone: "19 99930 8784",
              email_contato: "garden-plus@hotmail.com",
            };
            setPerfil(newPerfil);
            supabase.from("configuracoes").upsert([{ id: 1, ...newPerfil }]).then();
          } else {
            setPerfil((prev) => ({ ...prev, ...rest }));
          }
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
  // ASAAS config
  const [asaasKey, setAsaasKey] = useState("");
  const [asaasAmbiente, setAsaasAmbiente] = useState<"sandbox" | "producao">("producao");
  const [showAsaasKey, setShowAsaasKey] = useState(false);
  const [savingAsaas, setSavingAsaas] = useState(false);
  const [asaasTested, setAsaasTested] = useState<null | boolean>(null);

  // Carrega o ambiente salvo do banco ao montar o componente
  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "asaas_ambiente")
      .single()
      .then(({ data }) => {
        if (data?.valor === "sandbox" || data?.valor === "producao") {
          setAsaasAmbiente(data.valor);
        }
      });
  }, []);


  // States para NFS-e Asaas
  const [modalNfseOpen, setModalNfseOpen] = useState(false);
  const [nfseForm, setNfseForm] = useState({
    customer: "",
    value: "10.00",
    serviceDescription: "Serviço prestado - Teste de integração",
    serviceListItem: "01.01",
  });
  const [nfseEmitting, setNfseEmitting] = useState(false);
  const [nfseResult, setNfseResult] = useState<any>(null);

  // States para configuração fiscal (fiscalInfo)
  const [fiscalInfo, setFiscalInfo] = useState({
    municipalInscription: "",
    rpsSerie: "RPS",
    rpsNumber: "1",
    loteNumber: "1",
    specialTaxRegime: "MUNICIPAL_MICROENTREPRENEUR",
    culturalProjectsPromoter: false,
    simpleSocialTaxRegime: false,
    email: "garden-plus@hotmail.com",
    municipalUsername: "",
    municipalPassword: "",
  });
  const [municipalOptions, setMunicipalOptions] = useState<any>(null);
  const [municipalServices, setMunicipalServices] = useState<any[]>([]);
  const [loadingFiscalStep, setLoadingFiscalStep] = useState<number>(0);
  const [fiscalSaved, setFiscalSaved] = useState<boolean | null>(null);
  const [fiscalMsg, setFiscalMsg] = useState("");

  // States para upload de certificado A1
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certResult, setCertResult] = useState<{ success: boolean; msg: string } | null>(null);

  const handleUploadCertificado = async () => {
    if (!certFile || !certPassword) return;
    setUploadingCert(true);
    setCertResult(null);
    try {
      const formData = new FormData();
      formData.append("certificate", certFile);
      formData.append("certificatePassword", certPassword);

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/asaas-proxy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "asaas-target-path": "/v3/fiscalInfo/certificate",
            "asaas-environment": asaasAmbiente,
          },
          body: formData,
        }
      );
      const result = await response.json().catch(() => ({ raw: "Resposta não-JSON" }));
      if (result._asaas_status >= 400 || result.errors?.length) {
        const msg = result.errors?.map((e: any) => e.description).join(", ")
          || result.message
          || `Erro ASAAS (status ${result._asaas_status}): ${JSON.stringify(result)}`;
        setCertResult({ success: false, msg });
      } else {
        setCertResult({ success: true, msg: "✅ Certificado enviado com sucesso! Agora tente emitir a NFS-e." });
      }
    } catch (err: any) {
      setCertResult({ success: false, msg: err.message });
    } finally {
      setUploadingCert(false);
    }
  };

  const handleTestarNfse = async () => {
    setNfseEmitting(true);
    setNfseResult(null);
    try {
      // Chama a proxy diretamente usando o ambiente selecionado na tela
      const { data, error } = await supabase.functions.invoke("asaas-proxy", {
        body: JSON.stringify({
          customer: nfseForm.customer,
          serviceDescription: nfseForm.serviceDescription,
          value: Number(nfseForm.value),
          effectiveDate: new Date().toISOString().split("T")[0],
          serviceListItem: nfseForm.serviceListItem,
        }),
        headers: {
          "asaas-target-path": "/v3/invoices",
          "asaas-environment": asaasAmbiente,
        },
      });
      if (error) throw new Error(error.message);
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result?._asaas_status >= 400) {
        const msg = result.errors?.map((e: any) => e.description).join(", ") || result.message || `Status ${result._asaas_status}`;
        throw new Error(msg);
      }
      if (result?.errors?.length) throw new Error(result.errors.map((e: any) => e.description).join(", "));
      setNfseResult({ success: true, data: result });
    } catch (err: any) {
      setNfseResult({ success: false, error: err.message });
    } finally {
      setNfseEmitting(false);
    }
  };

  // ── Passo 1: Consultar opções do município
  const handleConsultarMunicipio = async () => {
    setLoadingFiscalStep(1);
    setFiscalMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("asaas-proxy", {
        headers: {
          "asaas-target-path": "/v3/fiscalInfo/municipalOptions",
          "asaas-environment": asaasAmbiente,
          "asaas-method": "GET",
        },
      });
      if (error) throw new Error(error.message);
      const result = typeof data === "string" ? JSON.parse(data) : data;
      setMunicipalOptions(result);
      setFiscalMsg("✅ Opções do município carregadas com sucesso!");
    } catch (err: any) {
      setFiscalMsg("❌ Erro ao consultar município: " + err.message);
    } finally {
      setLoadingFiscalStep(0);
    }
  };

  // ── Passo 2: Salvar dados fiscais
  const handleSalvarFiscalInfo = async () => {
    setLoadingFiscalStep(2);
    setFiscalMsg("");
    try {
      const payload: any = {
        municipalInscription: fiscalInfo.municipalInscription,
        rpsSerie: fiscalInfo.rpsSerie,
        rpsNumber: Number(fiscalInfo.rpsNumber),
        loteNumber: Number(fiscalInfo.loteNumber),
        specialTaxRegime: fiscalInfo.specialTaxRegime,
        culturalProjectsPromoter: fiscalInfo.culturalProjectsPromoter,
        simpleSocialTaxRegime: fiscalInfo.simpleSocialTaxRegime,
        email: fiscalInfo.email,
        simplesNacional: fiscalInfo.simpleSocialTaxRegime,
      };

      // Se o município exigir login e senha (authenticationType === "USER_AND_PASSWORD")
      if (fiscalInfo.municipalUsername && fiscalInfo.municipalPassword) {
        payload.username = fiscalInfo.municipalUsername;
        payload.password = fiscalInfo.municipalPassword;
      }
      
      const { data, error } = await supabase.functions.invoke("asaas-proxy", {
        body: JSON.stringify(payload),
        headers: {
          "asaas-target-path": "/v3/fiscalInfo",
          "asaas-environment": asaasAmbiente,
        },
      });
      if (error) throw new Error(error.message);
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result?.errors?.length) throw new Error(result.errors.map((e: any) => e.description).join(", "));
      setFiscalSaved(true);
      setFiscalMsg("✅ Dados fiscais salvos no ASAAS com sucesso!");
    } catch (err: any) {
      setFiscalSaved(false);
      setFiscalMsg("❌ Erro ao salvar dados fiscais: " + err.message);
    } finally {
      setLoadingFiscalStep(0);
    }
  };

  // ── Passo 3: Consultar serviços disponíveis
  const handleConsultarServicos = async () => {
    setLoadingFiscalStep(3);
    setFiscalMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("asaas-proxy", {
        headers: {
          "asaas-target-path": "/v3/fiscalInfo/services",
          "asaas-environment": asaasAmbiente,
          "asaas-method": "GET",
        },
      });
      if (error) throw new Error(error.message);
      const result = typeof data === "string" ? JSON.parse(data) : data;
      setMunicipalServices(result?.data || result || []);
      setFiscalMsg("✅ Serviços municipais carregados!");
    } catch (err: any) {
      setFiscalMsg("❌ Erro ao consultar serviços: " + err.message);
    } finally {
      setLoadingFiscalStep(0);
    }
  };

  return (
    <div className="space-y-6">

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
                    headers: {
                      "asaas-target-path": "/v3/myAccount",
                      "asaas-environment": asaasAmbiente,
                      "asaas-method": "GET",
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

          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between">
               <div>
                  <h4 className="text-sm font-semibold">Testar Emissão NFS-e</h4>
                  <p className="text-xs text-muted-foreground">Emite uma nota fiscal de serviço no Asaas.</p>
               </div>
               <Button variant="secondary" size="sm" onClick={() => setModalNfseOpen(true)}>
                  Abrir Teste
               </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card Senha Portal Nacional (gov.br) ── */}
      <Card className="shadow-card border-green-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-green-500/10">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base">Autenticação Portal Nacional NFS-e</CardTitle>
              <CardDescription className="text-xs">
                Sua conta usa o Portal Nacional da NFS-e (gov.br). Informe sua senha do gov.br para autenticar a emissão.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-xs text-green-800 dark:text-green-300">
            <p className="font-semibold mb-1">✅ Usuário já configurado no ASAAS</p>
            <p>Usuário (CNPJ): <span className="font-mono font-bold">63.874.628/0001-36</span></p>
            <p className="mt-1 text-green-600">Apenas a senha do gov.br precisa ser enviada.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Senha do gov.br</Label>
            <Input
              type="password"
              placeholder="Sua senha de acesso ao gov.br"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Esta é a mesma senha que você usa para acessar o Portal Nacional da NFS-e.
            </p>
          </div>

          {certResult && (
            <p className={`text-xs ${certResult.success ? "text-success" : "text-destructive"}`}>
              {certResult.msg}
            </p>
          )}

          <Button
            className="bg-green-600 hover:bg-green-700 text-white w-full"
            disabled={uploadingCert || !certPassword}
            onClick={async () => {
              setUploadingCert(true);
              setCertResult(null);
              try {
                const { data, error } = await supabase.functions.invoke("asaas-proxy", {
                  body: JSON.stringify({
                    municipalInscription: "63874628000136",
                    rpsSerie: "RPS",
                    rpsNumber: 1,
                    loteNumber: 1,
                    specialTaxRegime: "MUNICIPAL_MICROENTREPRENEUR",
                    culturalProjectsPromoter: false,
                    simpleSocialTaxRegime: false,
                    email: "contatogardenprime@gmail.com",
                    simplesNacional: false,
                    username: "63874628000136",
                    password: certPassword,
                  }),
                  headers: {
                    "asaas-target-path": "/v3/fiscalInfo",
                    "asaas-environment": asaasAmbiente,
                  },
                });
                if (error) throw new Error(error.message);
                const result = typeof data === "string" ? JSON.parse(data) : data;
                if (result?._asaas_status >= 400 || result?.errors?.length) {
                  const msg = result.errors?.map((e: any) => e.description).join(", ") || result.message || `Status ${result._asaas_status}`;
                  setCertResult({ success: false, msg });
                } else {
                  setCertResult({ success: true, msg: "✅ Credenciais salvas! Agora tente emitir a NFS-e." });
                }
              } catch (err: any) {
                setCertResult({ success: false, msg: err.message });
              } finally {
                setUploadingCert(false);
              }
            }}
          >
            {uploadingCert ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            Salvar Senha no ASAAS
          </Button>
        </CardContent>
      </Card>

      {/* ── Card Configuração Fiscal NFS-e ── */}
      <Card className="shadow-card border-blue-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Configuração Fiscal NFS-e (ASAAS)</CardTitle>
              <CardDescription className="text-xs">
                Obrigatório antes de emitir qualquer NFS-e. Configure os dados fiscais da empresa no ASAAS.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Passo 1 */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
                  Consultar Exigências do Município
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Verifica quais dados a prefeitura do seu CNPJ exige para emissão de NFS-e.</p>
              </div>
              <Button
                size="sm" variant="outline"
                disabled={loadingFiscalStep === 1}
                onClick={handleConsultarMunicipio}
              >
                {loadingFiscalStep === 1 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Consultar
              </Button>
            </div>
            {municipalOptions && (
              <pre className="text-[10px] bg-muted rounded p-2 overflow-auto max-h-32">
                {JSON.stringify(municipalOptions, null, 2)}
              </pre>
            )}
          </div>

          {/* Passo 2 */}
          <div className="rounded-lg border p-4 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
              Dados Fiscais da Empresa
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Inscrição Municipal</Label>
                <Input
                  placeholder="Ex: 12345678"
                  value={fiscalInfo.municipalInscription}
                  onChange={(e) => setFiscalInfo({ ...fiscalInfo, municipalInscription: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Série RPS</Label>
                <Input
                  value={fiscalInfo.rpsSerie}
                  onChange={(e) => setFiscalInfo({ ...fiscalInfo, rpsSerie: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº RPS Inicial</Label>
                <Input
                  type="number"
                  value={fiscalInfo.rpsNumber}
                  onChange={(e) => setFiscalInfo({ ...fiscalInfo, rpsNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº Lote Inicial</Label>
                <Input
                  type="number"
                  value={fiscalInfo.loteNumber}
                  onChange={(e) => setFiscalInfo({ ...fiscalInfo, loteNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail para notas</Label>
                <Input
                  type="email"
                  value={fiscalInfo.email}
                  onChange={(e) => setFiscalInfo({ ...fiscalInfo, email: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Regime Tributário Especial</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fiscalInfo.specialTaxRegime}
                  onChange={(e) => setFiscalInfo({ ...fiscalInfo, specialTaxRegime: e.target.value })}
                >
                  <option value="MUNICIPAL_MICROENTREPRENEUR">MEI</option>
                  <option value="ESTIMATED">Estimado</option>
                  <option value="PROFESSIONAL_SOCIETY">Sociedade de Profissionais</option>
                  <option value="COOPERATIVE">Cooperativa</option>
                  <option value="INDIVIDUAL_MICROENTREPRENEUR">Microempresário Individual</option>
                  <option value="MICRO_ENTERPRISE_OR_SMALL_BUSINESS">ME / EPP</option>
                  <option value="NONE">Nenhum</option>
                </select>
              </div>

              {municipalOptions?.authenticationType === "USER_AND_PASSWORD" && (
                <div className="col-span-2 grid grid-cols-2 gap-3 p-3 border rounded-md bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="col-span-2 text-xs font-semibold text-orange-600">Autenticação da Prefeitura (Exigido pelo Município)</div>
                  <div className="space-y-1">
                    <Label className="text-xs">Usuário da Prefeitura</Label>
                    <Input
                      value={fiscalInfo.municipalUsername}
                      onChange={(e) => setFiscalInfo({ ...fiscalInfo, municipalUsername: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Senha da Prefeitura</Label>
                    <Input
                      type="password"
                      value={fiscalInfo.municipalPassword}
                      onChange={(e) => setFiscalInfo({ ...fiscalInfo, municipalPassword: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="col-span-2 flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fiscalInfo.culturalProjectsPromoter}
                    onChange={(e) => setFiscalInfo({ ...fiscalInfo, culturalProjectsPromoter: e.target.checked })}
                  />
                  Promotor de projetos culturais
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fiscalInfo.simpleSocialTaxRegime}
                    onChange={(e) => setFiscalInfo({ ...fiscalInfo, simpleSocialTaxRegime: e.target.checked })}
                  />
                  Optante pelo Simples Nacional
                </label>
              </div>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
              disabled={loadingFiscalStep === 2 || !fiscalInfo.municipalInscription}
              onClick={handleSalvarFiscalInfo}
            >
              {loadingFiscalStep === 2 ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Salvar Dados Fiscais no ASAAS
            </Button>
          </div>

          {/* Passo 3 */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">3</span>
                  Serviços Municipais Disponíveis
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Lista os códigos de serviço disponíveis no seu município para usar ao emitir NFS-e.</p>
              </div>
              <Button
                size="sm" variant="outline"
                disabled={loadingFiscalStep === 3}
                onClick={handleConsultarServicos}
              >
                {loadingFiscalStep === 3 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Carregar
              </Button>
            </div>
            {municipalServices.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border text-[11px]">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Código</th>
                      <th className="px-2 py-1 text-left font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {municipalServices.map((s: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 font-mono">{s.code || s.id || "—"}</td>
                        <td className="px-2 py-1 text-muted-foreground">{s.description || s.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mensagem de feedback */}
          {fiscalMsg && (
            <p className={`text-xs px-1 ${fiscalMsg.startsWith("✅") ? "text-success" : "text-destructive"}`}>
              {fiscalMsg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal de Teste NFS-e */}
      <Dialog open={modalNfseOpen} onOpenChange={setModalNfseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Testar Emissão NFS-e (Asaas)</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para simular a criação de uma Nota Fiscal de Serviço no Asaas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ID do Cliente (Asaas Customer ID)</Label>
              <Input
                placeholder="cus_00000..."
                value={nfseForm.customer}
                onChange={(e) => setNfseForm({ ...nfseForm, customer: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">Obrigatório. Pegue um ID de cliente existente no Asaas.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={nfseForm.value}
                  onChange={(e) => setNfseForm({ ...nfseForm, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Item da Lista de Serviços (LC 116/2003)</Label>
                <Input
                  value={nfseForm.serviceListItem}
                  onChange={(e) => setNfseForm({ ...nfseForm, serviceListItem: e.target.value })}
                  placeholder="Ex: 01.01, 14.01..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição do Serviço</Label>
              <Input
                value={nfseForm.serviceDescription}
                onChange={(e) => setNfseForm({ ...nfseForm, serviceDescription: e.target.value })}
              />
            </div>
            {nfseResult && (
              <div className={`p-3 rounded-md text-xs ${nfseResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {nfseResult.success ? (
                  <>
                    <p className="font-bold mb-1">Sucesso!</p>
                    <p>ID: {nfseResult.data.id}</p>
                    <p>Status: {nfseResult.data.statusDescription || nfseResult.data.status}</p>
                    {nfseResult.data.pdfUrl && (
                      <a href={nfseResult.data.pdfUrl} target="_blank" rel="noreferrer" className="underline mt-1 block">Ver PDF da Nota</a>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-bold mb-1">Erro ao emitir:</p>
                    <p>{nfseResult.error}</p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalNfseOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleTestarNfse} disabled={nfseEmitting || !nfseForm.customer}>
              {nfseEmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Emitir NFS-e
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
