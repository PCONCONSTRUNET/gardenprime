import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import {
  Users, Plus, Search, X, Save, ArrowLeft, Loader2, Phone, MapPin, ChevronRight, Edit,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/parceiro/clientes")({
  head: () => ({ meta: [{ title: "Clientes — GARDEN PRIME" }] }),
  component: ParceiroClientes,
});

function ParceiroClientes() {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [clientes, setClientes] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjErro, setCnpjErro] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [vendedorId, setVendedorId] = useState<string | null>(null);

  const emptyForm = {
    nome: "", cpf_cnpj: "", telefone: "", cep: "", endereco: "",
    numero: "", bairro: "", cidade: "", uf: "", status: "Ativo",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const fetchClientes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/parceiro/login" }); return; }

      const { data: vendedor } = await supabase
        .from("vendedores").select("id").eq("user_id", session.user.id).single();

      if (vendedor) {
        setVendedorId(vendedor.id);
        const { data: vendas } = await supabase
          .from("vendas").select("cliente_id")
          .eq("vendedor_id", vendedor.id).not("cliente_id", "is", null);

        let ids: string[] = [];
        if (vendas && vendas.length > 0) {
          ids = vendas.map((v: any) => v.cliente_id);
        }

        const savedStr = localStorage.getItem(`novos_clientes_${vendedor.id}`);
        if (savedStr) {
          try {
            const savedIds = JSON.parse(savedStr);
            if (Array.isArray(savedIds)) ids = [...ids, ...savedIds];
          } catch(e) {}
        }
        
        ids = [...new Set(ids)];

        if (ids.length > 0) {
          const { data } = await supabase.from("clientes").select("*").in("id", ids).order("nome");
          if (data) setClientes(data);
        } else {
          setClientes([]);
        }
      }
      setLoadingList(false);
    };
    fetchClientes();
  }, [navigate]);

  const formatCpfCnpj = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5").substring(0, 18);
  };

  const formatTelefone = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3").substring(0, 15);
  };

  const formatCep = (v: string) => {
    v = v.replace(/\D/g, "");
    return v.replace(/(\d{5})(\d{3})/, "$1-$2").substring(0, 9);
  };

  const buscarCnpj = async () => {
    const cnpjLimpo = form.cpf_cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) { setCnpjErro("Digite um CNPJ válido com 14 dígitos."); return; }
    setCnpjErro("");
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!res.ok) { setCnpjErro("CNPJ não encontrado na Receita Federal."); return; }
      const data = await res.json();
      const telefone = data.ddd_telefone_1 ? formatTelefone(data.ddd_telefone_1) : form.telefone;
      const cepLimpo = data.cep ? data.cep.replace(/\D/g, "") : "";
      const tipoLogradouro = data.descricao_tipo_de_logradouro ? data.descricao_tipo_de_logradouro + " " : "";
      setForm((prev) => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        telefone,
        cep: formatCep(cepLimpo),
        endereco: tipoLogradouro + (data.logradouro || ""),
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio ? data.municipio.charAt(0) + data.municipio.slice(1).toLowerCase() : prev.cidade,
        uf: data.uf || prev.uf,
      }));
    } catch {
      setCnpjErro("Erro ao consultar CNPJ. Tente novamente.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { alert("Preencha o nome do cliente."); return; }
    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome, cpf_cnpj: form.cpf_cnpj || null, telefone: form.telefone || null,
        cep: form.cep || null, endereco: form.endereco || null, numero: form.numero || null,
        bairro: form.bairro || null, cidade: form.cidade || null, uf: form.uf || null,
        status: form.status,
      };

      let resultData;

      if (view === "edit" && form.id) {
        const { data, error } = await supabase.from("clientes").update(payload).eq("id", form.id).select().single();
        if (error) throw error;
        resultData = data;
        setClientes((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      } else {
        const { data, error } = await supabase.from("clientes").insert([payload]).select().single();
        if (error) throw error;
        resultData = data;

        if (vendedorId) {
          const savedStr = localStorage.getItem(`novos_clientes_${vendedorId}`);
          let savedIds = [];
          try { savedIds = savedStr ? JSON.parse(savedStr) : []; } catch(e){}
          savedIds.push(data.id);
          localStorage.setItem(`novos_clientes_${vendedorId}`, JSON.stringify([...new Set(savedIds)]));
        }

        setClientes((prev) => [data, ...prev]);
      }

      setForm(emptyForm);
      setView("list");
    } catch (err: any) {
      alert("Erro ao salvar cliente: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = clientes.filter((c) =>
    !searchTerm || (c.nome || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── FORM VIEW ───
  if (view === "new" || view === "edit") {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-display">
              {view === "edit" ? "Editar Cliente" : "Novo Cliente"}
            </h1>
            <p className="text-xs text-slate-500">
              {view === "edit" ? "Atualize os dados abaixo" : "Preencha os dados abaixo"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Nome / Razão Social *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Jardim Verde Ltda"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">CPF / CNPJ</Label>
            <div className="flex gap-2">
              <Input
                value={form.cpf_cnpj}
                onChange={(e) => { setCnpjErro(""); setForm({ ...form, cpf_cnpj: formatCpfCnpj(e.target.value) }); }}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="h-12 rounded-xl flex-1"
              />
              <button
                type="button"
                onClick={buscarCnpj}
                disabled={cnpjLoading}
                title="Buscar pelo CNPJ"
                className="w-12 h-12 shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition-colors disabled:opacity-60"
              >
                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {cnpjErro && <p className="text-xs text-rose-500">{cnpjErro}</p>}
            <p className="text-[11px] text-slate-400">Clique na lupa para preencher automaticamente via CNPJ</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: formatTelefone(e.target.value) })}
              placeholder="(00) 00000-0000"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="border-t border-dashed border-slate-200 pt-4 space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Endereço (Opcional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label className="text-sm font-semibold text-slate-700">CEP</Label>
                <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: formatCep(e.target.value) })} placeholder="00000-000" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-sm font-semibold text-slate-700">Logradouro</Label>
                <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Ex: Rua das Flores" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">Número</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="123" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Centro" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="São Paulo" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">UF</Label>
                <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} placeholder="SP" maxLength={2} className="h-11 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        <Button
          className="w-full h-12 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base rounded-xl shadow-md"
          onClick={handleSalvar}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {saving ? "Salvando..." : view === "edit" ? "Salvar Alterações" : "Salvar Cliente"}
        </Button>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Clientes dos seus pedidos</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setCnpjErro(""); setView("new"); }}
          className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-12 pl-10 pr-10 rounded-xl bg-white shadow-sm border-0 ring-1 ring-slate-900/5"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loadingList ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 h-20 animate-pulse ring-1 ring-slate-900/5">
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">👤</div>
          <p className="font-semibold text-slate-700">{searchTerm ? "Nenhum resultado" : "Nenhum cliente ainda"}</p>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            {searchTerm ? "Tente buscar por outro nome." : "Clique em \"Novo\" para cadastrar o primeiro cliente."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCliente(c)}
              className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold text-base flex items-center justify-center shrink-0">
                  {(c.nome || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate">{c.nome}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.telefone && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.telefone}
                      </span>
                    )}
                    {c.cidade && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {c.cidade}{c.uf ? `/${c.uf}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* ─── CLIENTE DETALHES SHEET ─── */}
      <Sheet open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-5 pb-4 border-b bg-white rounded-t-3xl shrink-0 relative">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-left font-display">Ficha do Cliente</SheetTitle>
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-700 border-emerald-700 hover:bg-emerald-50 h-8 gap-1.5 px-3 rounded-lg"
                onClick={() => {
                  setForm(selectedCliente);
                  setView("edit");
                  setSelectedCliente(null);
                }}
              >
                <Edit className="w-3.5 h-3.5" /> Editar
              </Button>
            </div>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {selectedCliente && (
              <>
                <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-900/5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 font-bold text-2xl flex items-center justify-center shrink-0">
                    {(selectedCliente.nome || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-lg text-slate-800 leading-tight">
                      {selectedCliente.nome}
                    </h2>
                    {selectedCliente.cpf_cnpj && (
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedCliente.cpf_cnpj.length > 14 ? "CNPJ" : "CPF"}: {selectedCliente.cpf_cnpj}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-900/5 space-y-4">
                  <h3 className="font-semibold text-slate-800 border-b pb-2">Contato</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefone</p>
                        <p className="text-slate-700">{selectedCliente.telefone || "Não informado"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-900/5 space-y-4">
                  <h3 className="font-semibold text-slate-800 border-b pb-2">Endereço</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Local</p>
                        <p className="text-slate-700">
                          {selectedCliente.endereco || "Não informado"}
                          {selectedCliente.numero && `, ${selectedCliente.numero}`}
                        </p>
                        {(selectedCliente.bairro || selectedCliente.cidade || selectedCliente.uf || selectedCliente.cep) && (
                          <p className="text-slate-600 mt-1 text-sm">
                            {selectedCliente.bairro && `${selectedCliente.bairro} - `}
                            {selectedCliente.cidade && `${selectedCliente.cidade}`}
                            {selectedCliente.uf && `/${selectedCliente.uf}`}
                            {selectedCliente.cep && ` (CEP: ${selectedCliente.cep})`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
