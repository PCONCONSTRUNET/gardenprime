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
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
            <h3 className="font-semibold text-lg border-b pb-2">Informações Básicas</h3>
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
                <Label>Estoque Inicial</Label>
                <Input
                  type="number"
                  min="0"
                  value={produto.estoque}
                  onChange={(e) => setProduto({ ...produto, estoque: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Unitário (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={produto.valor}
                  onChange={(e) => setProduto({ ...produto, valor: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-muted/30 p-4 rounded-xl border">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              🪴 Especificações do Catálogo Sura Vasos
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número / Referência</Label>
                <Input
                  value={produto.numero}
                  onChange={(e) => setProduto({ ...produto, numero: e.target.value })}
                  placeholder="Ex: 0, 1, Violeta, Mini"
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

          {/* Seção de Tributação */}
          <div className="space-y-4 bg-muted/10 p-4 rounded-xl border border-border/60 mt-6">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              ⚖️ Informações Tributárias
            </h3>
            
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

            <div className="space-y-4 border rounded-md p-4 bg-background">
              <h4 className="font-medium text-sm text-primary">Situação Tributária - NFe (Contribuinte)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CST NFe</Label>
                  <Input
                    value={produto.cst_nfe}
                    onChange={(e) => setProduto({ ...produto, cst_nfe: e.target.value })}
                    placeholder="Ex: 090"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CSOSN NFe</Label>
                  <Input
                    value={produto.csosn_nfe}
                    onChange={(e) => setProduto({ ...produto, csosn_nfe: e.target.value })}
                    placeholder="Ex: 101"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-md p-4 bg-background">
              <h4 className="font-medium text-sm text-primary">Situação Tributária - CFe e NFe (Não Contribuinte)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CST CFe</Label>
                  <Input
                    value={produto.cst_cfe}
                    onChange={(e) => setProduto({ ...produto, cst_cfe: e.target.value })}
                    placeholder="Ex: 090"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CSOSN CFe</Label>
                  <Input
                    value={produto.csosn_cfe}
                    onChange={(e) => setProduto({ ...produto, csosn_cfe: e.target.value })}
                    placeholder="Ex: 102"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-md p-4 bg-background">
              <h4 className="font-medium text-sm text-primary">IPI</h4>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    type="number"
                    step="0.01"
                    min="0"
                    value={produto.ipi_valor}
                    onChange={(e) => setProduto({ ...produto, ipi_valor: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CST IPI</Label>
                  <Input
                    value={produto.ipi_cst}
                    onChange={(e) => setProduto({ ...produto, ipi_cst: e.target.value })}
                    placeholder="Ex: 99"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CENQ</Label>
                  <Input
                    value={produto.ipi_cenq}
                    onChange={(e) => setProduto({ ...produto, ipi_cenq: e.target.value })}
                    placeholder="Ex: 001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exc. Fiscal</Label>
                  <Input
                    value={produto.ipi_exc_fiscal}
                    onChange={(e) => setProduto({ ...produto, ipi_exc_fiscal: e.target.value })}
                    placeholder=""
                  />
                </div>
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
