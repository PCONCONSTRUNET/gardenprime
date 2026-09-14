import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  ArrowLeft,
  Image as ImageIcon,
  Link as LinkIcon,
  UploadCloud,
  X,
  Plus,
  Scale,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/produto-novo")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => {
    return {
      id: search.id as string | undefined,
    };
  },
  head: () => ({ meta: [{ title: "Produto — GARDEN PRIME ERP" }] }),
  component: NovoProduto,
});

function NovoProduto() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isEditing = !!search.id;
  const [loading, setLoading] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(isEditing);

  const [produto, setProduto] = useState({
    codigo: "",
    nome: "",
    categoria: "Vasos Plásticos",
    estoque: 0,
    valor: 0,
    status: "Ativo",
    imagem: "",
    numero: "",
    dimensao: "",
    volume: "",
    comprimento: "",
    cores: [] as string[],
    ncm: "",
    cest: "",
    ipi_tipo_valor: "R$",
    ipi_valor: 0,
    ipi_cst: "",
    ipi_cenq: "",
    ipi_exc_fiscal: "",
    cst_nfe: "",
    csosn_nfe: "",
    cst_cfe: "",
    csosn_cfe: "",
    cst_pis: "",
    cst_cofins: "",
    tipo_item: "Embalagem",
    controle_estoque: "Nenhum",
    unidade_medida: "Unidade",
    fornecedor_preferencial: "",
    codigo_barras: "",
    descricao_complementar: "",
    referencia_extra: "",
    qtd_minima: 0,
    qtd_reserva: 0,
    peso_bruto: 0,
    peso_liquido: 0,
    custo_compra: 0,
    custo_medio: 0,
    preco_uss: 0,
    lucro_bruto_perc: 0,
    comissao_perc: 0,
    taxa_icms_iss_contrib: "Tributação Isenta",
    taxa_icms_iss_cfe_nfe_nao_contrib: "Venda à vista",
    pis_perc: 0,
    cofins_perc: 0,
    natureza_receita: "",
    irrf_perc: 0,
    mva_perc: 0,
    icms_efetivo_perc: 0,
    cfop_ecf: "5102",
    cfop_nf: "5102",
    indicador_trib: "",
    indicador_escala: "",
    aliquota_icms_destino_perc: 0,
    iat: "A-Arredondamento",
    ippt: "T-Terceiros",
    taxa_icms_partilha: "",
    taxa_fcp: "",
    fci: "",
    codigo_anp: "",
    cnpj_fabricante: "",
    motivo_desoneracao: "",
    conta_contabil: "",
    usa_cod_beneficio_tabela_cfop: false,
    cod_beneficio_nfe: "",
    cod_beneficio_entr: "",
    cod_beneficio_cfe: "",
    cod_beneficio_rbc: "",
    credito_presumido_tipo: "NF-e",
    credito_presumido_codigo: "",
    credito_presumido_aliquota: 0,
    credito_presumido_aliquota_uf: false,
    credito_presumido_uf_list: [] as { codigo: string; aliquota: number }[],
  });

  const [categoriasDB, setCategoriasDB] = useState<string[]>([
    "Vasos Plásticos",
    "Vasos Decorativos",
    "Vasos de Produção",
    "Floreiras",
    "Cuias",
    "Pratos",
    "Suportes",
    "Acessórios",
  ]);
  const [isNovaCategoria, setIsNovaCategoria] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [corInput, setCorInput] = useState("");

  const fetchCategorias = async () => {
    try {
      const { data } = await supabase.from("produtos").select("categoria");
      if (data) {
        const unicas = Array.from(new Set(data.map((p) => p.categoria))).filter(Boolean);
        const merged = Array.from(new Set([...categoriasDB, ...unicas]));
        setCategoriasDB(merged);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategorias();

    if (isEditing) {
      const fetchProduto = async () => {
        try {
          const { data, error } = await supabase
            .from("produtos")
            .select("*")
            .eq("id", search.id)
            .single();
          if (error) throw error;
          if (data) {
            setProduto({
              codigo: data.codigo || "",
              nome: data.nome || "",
              categoria: data.categoria || "Vasos Plásticos",
              estoque: data.estoque || 0,
              valor: data.valor || 0,
              status: data.status || "Ativo",
              imagem: data.imagem || "",
              numero: data.numero || "",
              dimensao: data.dimensao || "",
              volume: data.volume || "",
              comprimento: data.comprimento || "",
              cores: data.cores || [],
              ncm: data.ncm || "",
              cest: data.cest || "",
              ipi_tipo_valor: data.ipi_tipo_valor || "R$",
              ipi_valor: data.ipi_valor || 0,
              ipi_cst: data.ipi_cst || "",
              ipi_cenq: data.ipi_cenq || "",
              ipi_exc_fiscal: data.ipi_exc_fiscal || "",
              cst_nfe: data.cst_nfe || "",
              csosn_nfe: data.csosn_nfe || "",
              cst_cfe: data.cst_cfe || "",
              csosn_cfe: data.csosn_cfe || "",
              cst_pis: data.cst_pis || "",
              cst_cofins: data.cst_cofins || "",
              tipo_item: data.tipo_item || "Embalagem",
              controle_estoque: data.controle_estoque || "Nenhum",
              unidade_medida: data.unidade_medida || "Unidade",
              fornecedor_preferencial: data.fornecedor_preferencial || "",
              codigo_barras: data.codigo_barras || "",
              descricao_complementar: data.descricao_complementar || "",
              referencia_extra: data.referencia_extra || "",
              qtd_minima: data.qtd_minima || 0,
              qtd_reserva: data.qtd_reserva || 0,
              peso_bruto: data.peso_bruto || 0,
              peso_liquido: data.peso_liquido || 0,
              custo_compra: data.custo_compra || 0,
              custo_medio: data.custo_medio || 0,
              preco_uss: data.preco_uss || 0,
              lucro_bruto_perc: data.lucro_bruto_perc || 0,
              comissao_perc: data.comissao_perc || 0,
              taxa_icms_iss_contrib: data.taxa_icms_iss_contrib || "Tributação Isenta",
              taxa_icms_iss_cfe_nfe_nao_contrib: data.taxa_icms_iss_cfe_nfe_nao_contrib || "Venda à vista",
              pis_perc: data.pis_perc || 0,
              cofins_perc: data.cofins_perc || 0,
              natureza_receita: data.natureza_receita || "",
              irrf_perc: data.irrf_perc || 0,
              mva_perc: data.mva_perc || 0,
              icms_efetivo_perc: data.icms_efetivo_perc || 0,
              cfop_ecf: data.cfop_ecf || "5102",
              cfop_nf: data.cfop_nf || "5102",
              indicador_trib: data.indicador_trib || "",
              indicador_escala: data.indicador_escala || "",
              aliquota_icms_destino_perc: data.aliquota_icms_destino_perc || 0,
              iat: data.iat || "A-Arredondamento",
              ippt: data.ippt || "T-Terceiros",
              taxa_icms_partilha: data.taxa_icms_partilha || "",
              taxa_fcp: data.taxa_fcp || "",
              fci: data.fci || "",
              codigo_anp: data.codigo_anp || "",
              cnpj_fabricante: data.cnpj_fabricante || "",
              motivo_desoneracao: data.motivo_desoneracao || "",
              conta_contabil: data.conta_contabil || "",
              usa_cod_beneficio_tabela_cfop: data.usa_cod_beneficio_tabela_cfop || false,
              cod_beneficio_nfe: data.cod_beneficio_nfe || "",
              cod_beneficio_entr: data.cod_beneficio_entr || "",
              cod_beneficio_cfe: data.cod_beneficio_cfe || "",
              cod_beneficio_rbc: data.cod_beneficio_rbc || "",
              credito_presumido_tipo: data.credito_presumido_tipo || "NF-e",
              credito_presumido_codigo: data.credito_presumido_codigo || "",
              credito_presumido_aliquota: data.credito_presumido_aliquota || 0,
              credito_presumido_aliquota_uf: data.credito_presumido_aliquota_uf || false,
              credito_presumido_uf_list: data.credito_presumido_uf_list || [],
            });
          }
        } catch (err) {
          console.error(err);
          alert("Erro ao carregar os dados do produto.");
        } finally {
          setIsFetchingInfo(false);
        }
      };
      fetchProduto();
    }
  }, [isEditing, search.id]);

  const [imageUrlInput, setImageUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- IMAGE COMPRESSION LOGIC ----------
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas not supported");

          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/webp", 0.8);
          resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) return alert("Por favor, selecione uma imagem.");
      try {
        const compressed = await compressImage(file);
        setProduto((prev) => ({ ...prev, imagem: compressed }));
      } catch (err) {
        alert("Erro ao processar imagem.");
      }
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            try {
              const compressed = await compressImage(file);
              setProduto((prev) => ({ ...prev, imagem: compressed }));
            } catch (err) {
              alert("Erro ao processar imagem colada.");
            }
          }
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const handleAddUrl = () => {
    if (imageUrlInput.trim().startsWith("http")) {
      setProduto((prev) => ({ ...prev, imagem: imageUrlInput.trim() }));
      setImageUrlInput("");
    } else {
      alert("Insira uma URL válida começando com http:// ou https://");
    }
  };

  const removeImage = () => setProduto((prev) => ({ ...prev, imagem: "" }));

  const handleAddCor = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent) => {
    if (
      (e.type === "keydown" && (e as React.KeyboardEvent).key === "Enter") ||
      e.type === "click"
    ) {
      e.preventDefault();
      const cor = corInput.trim();
      if (cor && !produto.cores.includes(cor)) {
        setProduto((prev) => ({ ...prev, cores: [...prev.cores, cor] }));
        setCorInput("");
      }
    }
  };

  const removeCor = (corToRemove: string) => {
    setProduto((prev) => ({ ...prev, cores: prev.cores.filter((c) => c !== corToRemove) }));
  };

  // ---------- SAVE LOGIC ----------
  const handleSalvar = async () => {
    if (!produto.nome || !produto.codigo) {
      alert("Preencha o código e o nome do produto.");
      return;
    }

    const categoriaFinal = isNovaCategoria ? novaCategoria.trim() : produto.categoria;
    if (isNovaCategoria && !categoriaFinal) {
      alert("Digite o nome da nova categoria.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        codigo: produto.codigo,
        nome: produto.nome,
        categoria: categoriaFinal,
        estoque: produto.estoque,
        valor: produto.valor,
        status: produto.status,
        imagem: produto.imagem,
        numero: produto.numero || null,
        dimensao: produto.dimensao || null,
        volume: produto.volume || null,
        comprimento: produto.comprimento || null,
        cores: produto.cores,
        ncm: produto.ncm || null,
        cest: produto.cest || null,
        ipi_tipo_valor: produto.ipi_tipo_valor || "R$",
        ipi_valor: produto.ipi_valor || 0,
        ipi_cst: produto.ipi_cst || null,
        ipi_cenq: produto.ipi_cenq || null,
        ipi_exc_fiscal: produto.ipi_exc_fiscal || null,
        cst_nfe: produto.cst_nfe || null,
        csosn_nfe: produto.csosn_nfe || null,
        cst_cfe: produto.cst_cfe || null,
        csosn_cfe: produto.csosn_cfe || null,
        cst_pis: produto.cst_pis || null,
        cst_cofins: produto.cst_cofins || null,
        tipo_item: produto.tipo_item || null,
        controle_estoque: produto.controle_estoque || null,
        unidade_medida: produto.unidade_medida || null,
        fornecedor_preferencial: produto.fornecedor_preferencial || null,
        codigo_barras: produto.codigo_barras || null,
        descricao_complementar: produto.descricao_complementar || null,
        referencia_extra: produto.referencia_extra || null,
        qtd_minima: produto.qtd_minima || 0,
        qtd_reserva: produto.qtd_reserva || 0,
        peso_bruto: produto.peso_bruto || 0,
        peso_liquido: produto.peso_liquido || 0,
        custo_compra: produto.custo_compra || 0,
        custo_medio: produto.custo_medio || 0,
        preco_uss: produto.preco_uss || 0,
        lucro_bruto_perc: produto.lucro_bruto_perc || 0,
        comissao_perc: produto.comissao_perc || 0,
        taxa_icms_iss_contrib: produto.taxa_icms_iss_contrib || null,
        taxa_icms_iss_cfe_nfe_nao_contrib: produto.taxa_icms_iss_cfe_nfe_nao_contrib || null,
        pis_perc: produto.pis_perc || 0,
        cofins_perc: produto.cofins_perc || 0,
        natureza_receita: produto.natureza_receita || null,
        irrf_perc: produto.irrf_perc || 0,
        mva_perc: produto.mva_perc || 0,
        icms_efetivo_perc: produto.icms_efetivo_perc || 0,
        cfop_ecf: produto.cfop_ecf || null,
        cfop_nf: produto.cfop_nf || null,
        indicador_trib: produto.indicador_trib || null,
        indicador_escala: produto.indicador_escala || null,
        aliquota_icms_destino_perc: produto.aliquota_icms_destino_perc || 0,
        iat: produto.iat || null,
        ippt: produto.ippt || null,
        taxa_icms_partilha: produto.taxa_icms_partilha || null,
        taxa_fcp: produto.taxa_fcp || null,
        fci: produto.fci || null,
        codigo_anp: produto.codigo_anp || null,
        cnpj_fabricante: produto.cnpj_fabricante || null,
        motivo_desoneracao: produto.motivo_desoneracao || null,
        conta_contabil: produto.conta_contabil || null,
        usa_cod_beneficio_tabela_cfop: produto.usa_cod_beneficio_tabela_cfop,
        cod_beneficio_nfe: produto.cod_beneficio_nfe || null,
        cod_beneficio_entr: produto.cod_beneficio_entr || null,
        cod_beneficio_cfe: produto.cod_beneficio_cfe || null,
        cod_beneficio_rbc: produto.cod_beneficio_rbc || null,
        credito_presumido_tipo: produto.credito_presumido_tipo || null,
        credito_presumido_codigo: produto.credito_presumido_codigo || null,
        credito_presumido_aliquota: produto.credito_presumido_aliquota || 0,
        credito_presumido_aliquota_uf: produto.credito_presumido_aliquota_uf,
        credito_presumido_uf_list: produto.credito_presumido_uf_list || [],
      };

      if (isEditing) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", search.id);
        if (error) {
          if (error.code === "23505") throw new Error("Já existe um produto com este código!");
          throw error;
        }
      } else {
        const { error } = await supabase.from("produtos").insert([payload]);
        if (error) {
          if (error.code === "23505") throw new Error("Já existe um produto com este código!");
          throw error;
        }
      }

      navigate({ to: "/app/produtos" });
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar produto: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isFetchingInfo) {
    return <div className="p-8 text-center text-muted-foreground">Carregando produto...</div>;
  }

  return (
    <>
      <PageHeader
        title={isEditing ? "Editar Produto" : "Novo Produto"}
        subtitle={
          isEditing ? "Atualize as informações do item" : "Cadastre um novo item no sistema"
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/produtos">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button
              className="bg-gradient-brand text-primary-foreground"
              onClick={handleSalvar}
              disabled={loading}
            >
              <Save className="mr-2 h-4 w-4" /> {loading ? "Salvando..." : "Salvar Produto"}
            </Button>
          </>
        }
      />

      <Card className="shadow-card p-6 max-w-5xl mx-auto grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Coluna Esquerda: Dados do Produto */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold text-lg">Informações Básicas</h3>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Scale className="h-4 w-4" />
                    Fiscal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Scale className="h-5 w-5" /> Informações Tributárias
                    </DialogTitle>
                  </DialogHeader>
                  
                  <Tabs defaultValue="principal" className="mt-4">
                    <TabsList className="w-full justify-start overflow-x-auto">
                      <TabsTrigger value="principal">Principal</TabsTrigger>
                      <TabsTrigger value="adicionais">Tributos Adicionais</TabsTrigger>
                      <TabsTrigger value="beneficios">Benefícios Fiscais</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="principal" className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>NCM (Nomenclatura Comum do Mercosul)</Label>
                          <Input
                            value={produto.ncm}
                            onChange={(e) =>
                              setProduto({ ...produto, ncm: e.target.value.replace(/\D/g, "").slice(0, 8) })
                            }
                            placeholder="Ex: 39269090 (8 dígitos)"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CEST</Label>
                          <Input
                            value={produto.cest}
                            onChange={(e) => setProduto({ ...produto, cest: e.target.value })}
                            placeholder="Ex: 0100100"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                        <h4 className="font-medium text-sm text-primary">Situação Tributária</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>CST NFe</Label>
                            <Input
                              value={produto.cst_nfe}
                              onChange={(e) => setProduto({ ...produto, cst_nfe: e.target.value })}
                              placeholder="090"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CSOSN NFe</Label>
                            <Input
                              value={produto.csosn_nfe}
                              onChange={(e) => setProduto({ ...produto, csosn_nfe: e.target.value })}
                              placeholder="101"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CST CFe</Label>
                            <Input
                              value={produto.cst_cfe}
                              onChange={(e) => setProduto({ ...produto, cst_cfe: e.target.value })}
                              placeholder="090"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CSOSN CFe</Label>
                            <Input
                              value={produto.csosn_cfe}
                              onChange={(e) => setProduto({ ...produto, csosn_cfe: e.target.value })}
                              placeholder="102"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Taxa ICMS/ISS (Contrib)</Label>
                          <Input
                            value={produto.taxa_icms_iss_contrib}
                            onChange={(e) => setProduto({ ...produto, taxa_icms_iss_contrib: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Taxa ICMS/ISS CFe/NFe (Não Contrib)</Label>
                          <Input
                            value={produto.taxa_icms_iss_cfe_nfe_nao_contrib}
                            onChange={(e) => setProduto({ ...produto, taxa_icms_iss_cfe_nfe_nao_contrib: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                        <h4 className="font-medium text-sm text-primary">IPI</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                              value={produto.ipi_tipo_valor}
                              onChange={(e) => setProduto({ ...produto, ipi_tipo_valor: e.target.value })}
                            >
                              <option value="R$">Valor (R$)</option>
                              <option value="%">Percentual (%)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Valor</Label>
                            <Input
                              type="number" step="0.01" min="0"
                              value={produto.ipi_valor}
                              onChange={(e) => setProduto({ ...produto, ipi_valor: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CST IPI</Label>
                            <Input
                              value={produto.ipi_cst}
                              onChange={(e) => setProduto({ ...produto, ipi_cst: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CENQ</Label>
                            <Input
                              value={produto.ipi_cenq}
                              onChange={(e) => setProduto({ ...produto, ipi_cenq: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Exc. Fiscal</Label>
                            <Input
                              value={produto.ipi_exc_fiscal}
                              onChange={(e) => setProduto({ ...produto, ipi_exc_fiscal: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                        <h4 className="font-medium text-sm text-primary">PIS / COFINS</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>CST PIS</Label>
                            <Input
                              value={produto.cst_pis}
                              onChange={(e) => setProduto({ ...produto, cst_pis: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>% PIS</Label>
                            <Input
                              type="number" step="0.01" min="0"
                              value={produto.pis_perc}
                              onChange={(e) => setProduto({ ...produto, pis_perc: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CST COFINS</Label>
                            <Input
                              value={produto.cst_cofins}
                              onChange={(e) => setProduto({ ...produto, cst_cofins: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>% COFINS</Label>
                            <Input
                              type="number" step="0.01" min="0"
                              value={produto.cofins_perc}
                              onChange={(e) => setProduto({ ...produto, cofins_perc: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="adicionais" className="space-y-4 py-4">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Natureza da Receita</Label>
                          <Input value={produto.natureza_receita} onChange={(e) => setProduto({ ...produto, natureza_receita: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>% IRRF</Label>
                          <Input type="number" step="0.01" value={produto.irrf_perc} onChange={(e) => setProduto({ ...produto, irrf_perc: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>% MVA</Label>
                          <Input type="number" step="0.01" value={produto.mva_perc} onChange={(e) => setProduto({ ...produto, mva_perc: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>% ICMS Efetivo</Label>
                          <Input type="number" step="0.01" value={produto.icms_efetivo_perc} onChange={(e) => setProduto({ ...produto, icms_efetivo_perc: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>CFOP ECF</Label>
                          <Input value={produto.cfop_ecf} onChange={(e) => setProduto({ ...produto, cfop_ecf: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>CFOP NF</Label>
                          <Input value={produto.cfop_nf} onChange={(e) => setProduto({ ...produto, cfop_nf: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Indicador de Trib</Label>
                          <Input value={produto.indicador_trib} onChange={(e) => setProduto({ ...produto, indicador_trib: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Indicador de Escala</Label>
                          <Input value={produto.indicador_escala} onChange={(e) => setProduto({ ...produto, indicador_escala: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>% Alíq ICMS Destino</Label>
                          <Input type="number" step="0.01" value={produto.aliquota_icms_destino_perc} onChange={(e) => setProduto({ ...produto, aliquota_icms_destino_perc: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>IAT</Label>
                          <Input value={produto.iat} onChange={(e) => setProduto({ ...produto, iat: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>IPPT</Label>
                          <Input value={produto.ippt} onChange={(e) => setProduto({ ...produto, ippt: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Taxa ICMS Partilha</Label>
                          <Input value={produto.taxa_icms_partilha} onChange={(e) => setProduto({ ...produto, taxa_icms_partilha: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Taxa FCP</Label>
                          <Input value={produto.taxa_fcp} onChange={(e) => setProduto({ ...produto, taxa_fcp: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>FCI</Label>
                          <Input value={produto.fci} onChange={(e) => setProduto({ ...produto, fci: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Código ANP</Label>
                          <Input value={produto.codigo_anp} onChange={(e) => setProduto({ ...produto, codigo_anp: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>CNPJ Fabricante</Label>
                          <Input value={produto.cnpj_fabricante} onChange={(e) => setProduto({ ...produto, cnpj_fabricante: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Motivo desoneração</Label>
                          <Input value={produto.motivo_desoneracao} onChange={(e) => setProduto({ ...produto, motivo_desoneracao: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Conta</Label>
                          <Input value={produto.conta_contabil} onChange={(e) => setProduto({ ...produto, conta_contabil: e.target.value })} />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="beneficios" className="space-y-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="usa_cod_beneficio" 
                          checked={produto.usa_cod_beneficio_tabela_cfop}
                          onCheckedChange={(checked) => setProduto({ ...produto, usa_cod_beneficio_tabela_cfop: checked === true })}
                        />
                        <Label htmlFor="usa_cod_beneficio" className="cursor-pointer">Cód. Benefício e Crédito Presumido por Tabela (CFOP)</Label>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4 border rounded-md p-4">
                          <h4 className="font-medium text-sm text-primary">Código Benefício</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Label className="w-32">Cód. benefic. (NFe):</Label>
                              <Input className="flex-1" value={produto.cod_beneficio_nfe} onChange={(e) => setProduto({ ...produto, cod_beneficio_nfe: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="w-32">Cód. benefic. (Entr):</Label>
                              <Input className="flex-1" value={produto.cod_beneficio_entr} onChange={(e) => setProduto({ ...produto, cod_beneficio_entr: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="w-32">Cód. benefic. (CFe):</Label>
                              <Input className="flex-1" value={produto.cod_beneficio_cfe} onChange={(e) => setProduto({ ...produto, cod_beneficio_cfe: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="w-32">Cód. benefic. (RBC):</Label>
                              <Input className="flex-1" value={produto.cod_beneficio_rbc} onChange={(e) => setProduto({ ...produto, cod_beneficio_rbc: e.target.value })} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 border rounded-md p-4">
                          <h4 className="font-medium text-sm text-primary">Crédito Presumido</h4>
                          <div className="flex gap-4 items-center">
                            <Label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="credito_tipo" value="NF-e" checked={produto.credito_presumido_tipo === "NF-e"} onChange={() => setProduto({...produto, credito_presumido_tipo: "NF-e"})} /> NF-e
                            </Label>
                            <Label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="credito_tipo" value="NFC-e" checked={produto.credito_presumido_tipo === "NFC-e"} onChange={() => setProduto({...produto, credito_presumido_tipo: "NFC-e"})} /> NFC-e
                            </Label>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Alíquota</Label>
                              <Input type="number" step="0.01" value={produto.credito_presumido_aliquota} onChange={(e) => setProduto({ ...produto, credito_presumido_aliquota: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Código</Label>
                              <Input value={produto.credito_presumido_codigo} onChange={(e) => setProduto({ ...produto, credito_presumido_codigo: e.target.value })} />
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 pt-2">
                            <Checkbox 
                              id="credito_aliquota_uf" 
                              checked={produto.credito_presumido_aliquota_uf}
                              onCheckedChange={(checked) => setProduto({ ...produto, credito_presumido_aliquota_uf: checked === true })}
                            />
                            <Label htmlFor="credito_aliquota_uf" className="cursor-pointer">Alíquota por UF (NF-e)</Label>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <DialogFooter className="mt-6 border-t pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Concluir e Fechar
                      </Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSalvar} disabled={loading}>
                      {loading ? "Salvando..." : "Salvar Produto"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código (SKU)</Label>
                <Input
                  value={produto.codigo}
                  onChange={(e) => setProduto({ ...produto, codigo: e.target.value })}
                  placeholder="Ex: VPL017"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={produto.status}
                  onChange={(e) => setProduto({ ...produto, status: e.target.value })}
                >
                  <option>Ativo</option>
                  <option>Crítico</option>
                  <option>Inativo</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome do Produto / Modelo</Label>
              <Input
                value={produto.nome}
                onChange={(e) => setProduto({ ...produto, nome: e.target.value })}
                placeholder="Ex: Cuia C 13"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              {!isNovaCategoria ? (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={produto.categoria}
                  onChange={(e) => {
                    if (e.target.value === "NOVA_CATEGORIA") {
                      setIsNovaCategoria(true);
                    } else {
                      setProduto({ ...produto, categoria: e.target.value });
                    }
                  }}
                >
                  {categoriasDB.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="NOVA_CATEGORIA" className="font-bold text-primary">
                    + Adicionar Nova Categoria...
                  </option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Nome da nova categoria"
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsNovaCategoria(false);
                      setNovaCategoria("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            {/* NCM moved to Tributos section */}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Item</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  value={produto.tipo_item}
                  onChange={(e) => setProduto({ ...produto, tipo_item: e.target.value })}
                >
                  <option value="Mercadoria para Revenda">Mercadoria para Revenda</option>
                  <option value="Embalagem">Embalagem</option>
                  <option value="Matéria-Prima">Matéria-Prima</option>
                  <option value="Produto Acabado">Produto Acabado</option>
                  <option value="Serviço">Serviço</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Código de Barras</Label>
                <Input
                  value={produto.codigo_barras}
                  onChange={(e) => setProduto({ ...produto, codigo_barras: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Controle</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  value={produto.controle_estoque}
                  onChange={(e) => setProduto({ ...produto, controle_estoque: e.target.value })}
                >
                  <option value="Nenhum">Nenhum</option>
                  <option value="Serial">Serial</option>
                  <option value="Grade">Grade</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Unidade de Medida</Label>
                <Input
                  value={produto.unidade_medida}
                  onChange={(e) => setProduto({ ...produto, unidade_medida: e.target.value })}
                  placeholder="Ex: Unidade, Kg, L"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Fornecedor Preferencial</Label>
                <Input
                  value={produto.fornecedor_preferencial}
                  onChange={(e) => setProduto({ ...produto, fornecedor_preferencial: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="font-semibold text-sm border-b pb-1">Estoque e Pesos</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Estoque Inicial</Label>
                  <Input type="number" min="0" value={produto.estoque} onChange={(e) => setProduto({ ...produto, estoque: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Mínima</Label>
                  <Input type="number" min="0" value={produto.qtd_minima} onChange={(e) => setProduto({ ...produto, qtd_minima: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Reserva</Label>
                  <Input type="number" min="0" value={produto.qtd_reserva} onChange={(e) => setProduto({ ...produto, qtd_reserva: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Peso Bruto (Kg)</Label>
                  <Input type="number" step="0.001" min="0" value={produto.peso_bruto} onChange={(e) => setProduto({ ...produto, peso_bruto: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Peso Líq (Kg)</Label>
                  <Input type="number" step="0.001" min="0" value={produto.peso_liquido} onChange={(e) => setProduto({ ...produto, peso_liquido: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="font-semibold text-sm border-b pb-1">Custos e Margens</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Custo de Compra</Label>
                  <Input type="number" step="0.01" value={produto.custo_compra} onChange={(e) => setProduto({ ...produto, custo_compra: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Custo Médio</Label>
                  <Input type="number" step="0.01" value={produto.custo_medio} onChange={(e) => setProduto({ ...produto, custo_medio: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Valor de Venda (R$)</Label>
                  <Input type="number" step="0.01" value={produto.valor} onChange={(e) => setProduto({ ...produto, valor: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Preço em US$</Label>
                  <Input type="number" step="0.01" value={produto.preco_uss} onChange={(e) => setProduto({ ...produto, preco_uss: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>% Lucro Bruto</Label>
                  <Input type="number" step="0.01" value={produto.lucro_bruto_perc} onChange={(e) => setProduto({ ...produto, lucro_bruto_perc: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>% Comissão</Label>
                  <Input type="number" step="0.01" value={produto.comissao_perc} onChange={(e) => setProduto({ ...produto, comissao_perc: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-muted/30 p-4 rounded-xl border">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              🪴 Especificações do Catálogo Sura Vasos
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Número (Interno Sura Vasos)</Label>
                <Input
                  value={produto.numero}
                  onChange={(e) => setProduto({ ...produto, numero: e.target.value })}
                  placeholder="Ex: 0, 1, Violeta, Mini"
                />
              </div>
              <div className="space-y-2">
                <Label>Referência Extra</Label>
                <Input
                  value={produto.referencia_extra}
                  onChange={(e) => setProduto({ ...produto, referencia_extra: e.target.value })}
                  placeholder="Ex: REF-99"
                />
              </div>
              <div className="space-y-2 lg:col-span-1">
                <Label>Desc. Complementar</Label>
                <Input
                  value={produto.descricao_complementar}
                  onChange={(e) => setProduto({ ...produto, descricao_complementar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dimensões (cm) D x h x d</Label>
                <Input
                  value={produto.dimensao}
                  onChange={(e) => setProduto({ ...produto, dimensao: e.target.value })}
                  placeholder="Ex: 12,5 x 6,5 x 7,5"
                />
              </div>
              <div className="space-y-2">
                <Label>Volume (L)</Label>
                <Input
                  value={produto.volume}
                  onChange={(e) => setProduto({ ...produto, volume: e.target.value })}
                  placeholder="Ex: 0,5"
                />
              </div>
              <div className="space-y-2">
                <Label>Comprimento (Alças)</Label>
                <Input
                  value={produto.comprimento}
                  onChange={(e) => setProduto({ ...produto, comprimento: e.target.value })}
                  placeholder="Ex: 39 cm"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label>Cores Disponíveis</Label>
              <div className="flex gap-2">
                <Input
                  value={corInput}
                  onChange={(e) => setCorInput(e.target.value)}
                  onKeyDown={handleAddCor}
                  placeholder="Ex: Preto, Cerâmica (Pressione Enter para adicionar)"
                />
                <Button variant="secondary" onClick={handleAddCor}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {produto.cores.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    Nenhuma cor informada
                  </span>
                )}
                {produto.cores.map((cor) => (
                  <Badge
                    key={cor}
                    variant="secondary"
                    className="pl-3 pr-1 py-1 flex items-center gap-1 bg-white border shadow-sm"
                  >
                    {cor}
                    <button
                      onClick={() => removeCor(cor)}
                      className="hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Imagem do Produto */}
        <div className="space-y-4 border-l pl-6">
          <Label className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Foto do Produto
          </Label>

          {produto.imagem ? (
            <div className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-square">
              <img src={produto.imagem} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                <Button variant="destructive" size="sm" onClick={removeImage}>
                  <X className="h-4 w-4 mr-1.5" /> Remover Foto
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-muted/30 aspect-square text-center hover:bg-muted/50 transition-colors">
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-semibold">Clique ou Cole a foto</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Suporta Ctrl+V (Área de transferência)
              </p>
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Escolher Arquivo
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Ou por link</span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://exemplo.com/vaso.jpg"
                className="pl-8 text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleAddUrl}>
              Add
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            As imagens adicionadas por arquivo/colar são comprimidas automaticamente para economizar
            espaço.
          </p>
        </div>
      </Card>
    </>
  );
}
