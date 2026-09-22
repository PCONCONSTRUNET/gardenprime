import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/contexts/ConfirmContext";

interface MesclarClientesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: any[];
  onSuccess: () => void;
}

export function MesclarClientesModal({
  open,
  onOpenChange,
  clientes,
  onSuccess,
}: MesclarClientesModalProps) {
  const [origemId, setOrigemId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);

  const [openOrigem, setOpenOrigem] = useState(false);
  const [openDestino, setOpenDestino] = useState(false);
  
  const confirm = useConfirm();

  const handleMerge = async () => {
    if (!origemId || !destinoId) {
      alert("Selecione os dois clientes.");
      return;
    }
    if (origemId === destinoId) {
      alert("Selecione clientes diferentes.");
      return;
    }

    const origem = clientes.find((c) => c.id === origemId);
    const destino = clientes.find((c) => c.id === destinoId);

    const isConfirmed = await confirm({
      title: "Confirmar Mesclagem",
      description: `Todo o histórico de vendas, DAVs e cobranças do cliente "${origem?.nome}" será transferido para "${destino?.nome}". O cadastro "${origem?.nome}" será EXCLUÍDO definitivamente.\n\nDeseja continuar?`,
      variant: "destructive",
    });

    if (!isConfirmed) return;

    setIsMerging(true);
    try {
      // 1. Vendas
      const { error: errVendas } = await supabase
        .from("vendas")
        .update({ cliente_id: destinoId })
        .eq("cliente_id", origemId);
      if (errVendas) throw new Error("Erro ao atualizar Vendas: " + errVendas.message);

      // 2. DAVs
      const { error: errDavs } = await supabase
        .from("davs")
        .update({ cliente_id: destinoId })
        .eq("cliente_id", origemId);
      if (errDavs) throw new Error("Erro ao atualizar Orçamentos (DAVs): " + errDavs.message);

      // 3. Contas a Receber
      const { error: errContas } = await supabase
        .from("contas_receber")
        .update({ cliente_id: destinoId })
        .eq("cliente_id", origemId);
      if (errContas) throw new Error("Erro ao atualizar Contas a Receber: " + errContas.message);

      // 4. Asaas Cobranças
      const { error: errAsaas } = await supabase
        .from("asaas_cobrancas")
        .update({ cliente_id: destinoId })
        .eq("cliente_id", origemId);
      if (errAsaas) throw new Error("Erro ao atualizar Cobranças Asaas: " + errAsaas.message);

      // 5. Excluir cliente duplicado
      const { error: errDel } = await supabase
        .from("clientes")
        .delete()
        .eq("id", origemId);
      if (errDel) throw new Error("As vendas foram transferidas, mas houve erro ao excluir o cliente duplicado: " + errDel.message);

      alert("Clientes mesclados com sucesso!");
      onSuccess();
      onOpenChange(false);
      setOrigemId("");
      setDestinoId("");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro desconhecido ao mesclar clientes.");
    } finally {
      setIsMerging(false);
    }
  };

  const getClientLabel = (id: string) => {
    const c = clientes.find((x) => x.id === id);
    if (!c) return "Selecione...";
    return `${c.nome} ${c.cpf_cnpj ? `(${c.cpf_cnpj})` : ""}`;
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isMerging && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Mesclar Clientes
          </DialogTitle>
          <DialogDescription>
            Transfira todo o histórico (Vendas, Orçamentos, Contas) de um cliente duplicado para o cadastro oficial. O cliente duplicado será apagado no final.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-destructive">
              1. Cliente Duplicado (Será Excluído)
            </label>
            <Popover open={openOrigem} onOpenChange={setOpenOrigem}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between border-destructive/50 hover:bg-destructive/10 text-left h-auto py-2"
                >
                  <span className="truncate">{getClientLabel(origemId)}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente duplicado..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {clientes.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.nome} ${c.cpf_cnpj || ""} ${c.id}`}
                          onSelect={() => {
                            setOrigemId(c.id);
                            setOpenOrigem(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              origemId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="truncate">
                            <span className="font-semibold">{c.nome}</span>
                            {c.cpf_cnpj && <span className="ml-2 text-xs text-muted-foreground">{c.cpf_cnpj}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-success">
              2. Cliente Oficial (Receberá o Histórico)
            </label>
            <Popover open={openDestino} onOpenChange={setOpenDestino}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between border-success/50 hover:bg-success/10 text-left h-auto py-2"
                >
                  <span className="truncate">{getClientLabel(destinoId)}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente oficial..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {clientes.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.nome} ${c.cpf_cnpj || ""} ${c.id}`}
                          onSelect={() => {
                            setDestinoId(c.id);
                            setOpenDestino(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              destinoId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="truncate">
                            <span className="font-semibold">{c.nome}</span>
                            {c.cpf_cnpj && <span className="ml-2 text-xs text-muted-foreground">{c.cpf_cnpj}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleMerge}
            disabled={isMerging || !origemId || !destinoId || origemId === destinoId}
          >
            {isMerging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mesclando...
              </>
            ) : (
              "Confirmar Mesclagem"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
