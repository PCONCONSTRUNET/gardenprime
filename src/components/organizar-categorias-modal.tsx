import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  GripVertical,
  RotateCcw,
  Save,
  Search,
  CheckCircle2,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import {
  getCustomCategoryOrder,
  loadCategoryOrderFromDb,
  saveCategoryOrderToDb,
  sortCategorias,
} from "@/lib/utils";

interface OrganizarCategoriasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoriasDisponiveis: string[];
  onSaveSuccess?: (novaOrdem: string[]) => void;
}

export function OrganizarCategoriasModal({
  open,
  onOpenChange,
  categoriasDisponiveis,
  onSaveSuccess,
}: OrganizarCategoriasModalProps) {
  const [lista, setLista] = useState<string[]>([]);
  const [filtro, setFiltro] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Inicializa a lista ordenando com a ordem salva atual ou ordem inteligente
  useEffect(() => {
    if (!open) {
      setSavedSuccess(false);
      return;
    }

    const init = async () => {
      await loadCategoryOrderFromDb();
      const currentOrder = getCustomCategoryOrder();

      // Garante que todas as categorias disponíveis existam na lista
      const setCats = new Set<string>();
      const combined: string[] = [];

      // Primeiro adiciona as que já estão na ordem salva e ainda existem
      currentOrder.forEach((c) => {
        if (categoriasDisponiveis.includes(c) && !setCats.has(c)) {
          setCats.add(c);
          combined.push(c);
        }
      });

      // Depois adiciona novas categorias ainda não configuradas usando a ordenação padrão
      const pendentes = categoriasDisponiveis
        .filter((c) => !setCats.has(c))
        .sort(sortCategorias);

      pendentes.forEach((c) => combined.push(c));

      setLista(combined);
    };

    init();
  }, [open, categoriasDisponiveis]);

  const moverItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= lista.length) return;
    const nova = [...lista];
    const [removido] = nova.splice(fromIndex, 1);
    nova.splice(toIndex, 0, removido);
    setLista(nova);
  };

  const moverParaTopo = (index: number) => {
    moverItem(index, 0);
  };

  const moverParaFim = (index: number) => {
    moverItem(index, lista.length - 1);
  };

  const restaurarPadrao = () => {
    // Restaura para a ordem padrão inteligente do sistema
    const ordenada = [...categoriasDisponiveis].sort((a, b) => sortCategorias(a, b, []));
    setLista(ordenada);
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const res = await saveCategoryOrderToDb(lista);
      if (res.success) {
        setSavedSuccess(true);
        if (onSaveSuccess) {
          onSaveSuccess(lista);
        }
        setTimeout(() => {
          onOpenChange(false);
        }, 1200);
      } else {
        alert("Atenção: A ordem foi salva localmente nesta máquina. Detalhe do banco: " + (res.error || ""));
        if (onSaveSuccess) onSaveSuccess(lista);
        onOpenChange(false);
      }
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moverItem(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const listaFiltrada = lista.map((cat, idx) => ({ cat, originalIndex: idx })).filter(item =>
    item.cat.toLowerCase().includes(filtro.toLowerCase().trim())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Organizar Ordem das Categorias
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Defina a ordem exata de exibição de cada categoria no catálogo digital, no sistema e nos relatórios em PDF.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Barra de Busca e Ações Rápidas */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-3 pb-2">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Localizar categoria..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={restaurarPadrao}
              className="text-xs text-slate-600 hover:text-slate-900 h-9"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Ordem Padrão (Terra / Substrato / Vasos)
            </Button>
          </div>
        </div>

        {/* Lista de Categorias Reordenáveis */}
        <div className="flex-1 overflow-y-auto pr-1 my-2 border rounded-xl divide-y bg-slate-50/60 max-h-[50vh]">
          {listaFiltrada.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhuma categoria encontrada com esse termo.
            </div>
          ) : (
            listaFiltrada.map(({ cat, originalIndex }) => {
              const pos = originalIndex + 1;
              const isFirst = originalIndex === 0;
              const isLast = originalIndex === lista.length - 1;
              const isDragging = draggedIndex === originalIndex;

              return (
                <div
                  key={cat}
                  draggable
                  onDragStart={() => handleDragStart(originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between p-3 transition-colors bg-white hover:bg-slate-50 ${
                    isDragging ? "opacity-40 bg-emerald-50 border-emerald-300" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs w-9 justify-center font-bold ${
                        pos === 1
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : pos === 2
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : pos === 3
                          ? "bg-orange-100 text-orange-800 border-orange-300"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      #{pos}
                    </Badge>
                    <span className="font-semibold text-slate-800 text-sm">{cat}</span>
                  </div>

                  {/* Botões de Ação de Posição */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      disabled={isFirst}
                      onClick={() => moverParaTopo(originalIndex)}
                      title="Mover para o 1º Lugar (Topo)"
                    >
                      <ChevronsUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      disabled={isFirst}
                      onClick={() => moverItem(originalIndex, originalIndex - 1)}
                      title="Subir uma posição"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      disabled={isLast}
                      onClick={() => moverItem(originalIndex, originalIndex + 1)}
                      title="Descer uma posição"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      disabled={isLast}
                      onClick={() => moverParaFim(originalIndex)}
                      title="Mover para o final"
                    >
                      <ChevronsDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>Total de categorias:</span>
            <span className="font-bold text-slate-800">{lista.length}</span>
            {savedSuccess && (
              <span className="text-emerald-600 font-bold ml-2 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso para todo o sistema!
              </span>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando Ordem...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Ordem Geral
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

