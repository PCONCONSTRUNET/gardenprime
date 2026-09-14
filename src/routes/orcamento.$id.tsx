import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { WhatsAppIcon, shareOrderWhatsApp } from "@/lib/order-pdf";

export const Route = createFileRoute("/orcamento/$id")({
  head: () => ({ meta: [{ title: "Orçamento (DAV) - Impressão" }] }),
  component: ImprimirDAV,
});

function ImprimirDAV() {
  const { id } = Route.useParams();
  const [dav, setDav] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    async function loadData() {
      let { data: d } = await supabase.from("davs").select("*").eq("id", id).single();

      let itemsData: any[] = [];

      if (d) {
        setDav(d);
        const { data: i } = await supabase.from("dav_items").select("*").eq("dav_id", id);
        if (i) itemsData = i;
      } else {
        // Tenta buscar na tabela de vendas (Vendas ou DAVs antigos)
        const { data: v } = await supabase
          .from("vendas")
          .select("*, cliente:clientes(*), vendedor:vendedores(nome)")
          .eq("id", id)
          .single();

        if (v) {
          const cli = v.cliente;
          const enderecoPartes = [
            cli?.endereco,
            cli?.numero ? `Nº ${cli.numero}` : null,
            cli?.bairro,
            cli?.cidade && cli?.uf ? `${cli.cidade}/${cli.uf}` : cli?.cidade || cli?.uf || null,
            cli?.cep ? `CEP: ${cli.cep}` : null,
          ]
            .filter(Boolean)
            .join(", ");

          d = {
            id: v.id,
            numero: v.numero_venda || v.numero,
            created_at: v.created_at,
            cliente_nome: cli?.nome,
            cliente_cnpj: cli?.cpf_cnpj,
            cliente_telefone: cli?.telefone,
            cliente_endereco: enderecoPartes || null,
            condicao_pagamento: v.metodo_pagamento,
            subtotal: v.subtotal || v.valor_total,
            desconto_valor: v.desconto_valor || 0,
            desconto_percentual: v.desconto_percentual || 0,
            frete_valor: v.frete_valor || 0,
            total: v.valor_total,
            vendedor: v.vendedor?.nome || "",
            emissor_nome: "GARDEN PRIME",
            isVenda: v.tipo !== "DAV",
            rawVenda: v,
          };
          setDav(d);

          const { data: vi } = await supabase
            .from("vendas_itens")
            .select("*, produto:produtos(nome, codigo)")
            .eq("venda_id", id);

          if (vi) {
            itemsData = vi.map((item) => ({
              codigo: item.produto?.codigo,
              produto: item.produto?.nome || "Produto sem nome",
              qtd: item.quantidade,
              valor_unitario: item.valor_unitario,
              total: item.subtotal,
            }));
            const sumItens = itemsData.reduce((acc, it) => acc + Number(it.total || 0), 0);
            if (sumItens > 0 && (!d.subtotal || Number(d.subtotal) === 0)) {
              d.subtotal = sumItens;
              setDav({ ...d });
            }
          }
        }
      }

      setItens(itemsData);

      if (d) {
        setTimeout(() => window.print(), 800);
      }
    }
    loadData();
  }, [id]);

  if (!dav) return <div className="p-8 text-center font-sans">Carregando documento...</div>;

  const dataDAV = new Date(dav.created_at).toLocaleDateString("pt-BR");
  const horaDAV = new Date(dav.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const validadeStr = dav.validade ? new Date(dav.validade).toLocaleDateString("pt-BR") : null;

  const handleVoltar = () => {
    // 1. Se foi aberto em uma nova aba com window.open e possui opener
    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    } catch {}

    // 2. Se há histórico anterior nesta mesma aba
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }

    // 3. Tenta fechar a aba diretamente (funciona em abas criadas por script)
    try {
      window.close();
    } catch {}

    // 4. Fallback imediato garantido: se a janela não fechou e não navegou, redireciona
    setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/orcamento")) {
        const ref = document.referrer;
        if (ref && (ref.includes("/parceiro") || ref.includes("/app"))) {
          window.location.href = ref;
        } else {
          window.location.href = "/parceiro/vendas";
        }
      }
    }, 200);
  };

  
  return (
    <div
      className="bg-white min-h-screen text-black p-4 sm:p-8 print:p-0 font-sans"
      style={{ maxWidth: "850px", margin: "0 auto" }}
    >
      <style>{`
        @media print {
          @page { margin: 8mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Botões Superiores */}
      <div className="no-print flex gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur pb-4 z-10 border-b border-slate-100">
        <button
          onClick={handleVoltar}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => window.print()}
          className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 bg-brand text-white hover:bg-brand-dark rounded-lg text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
        </button>
        <button
          onClick={async () => {
            setSharing(true);
            try {
              await shareOrderWhatsApp(dav, itens);
            } finally {
              setSharing(false);
            }
          }}
          disabled={sharing}
          className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-medium transition-colors ml-auto"
        >
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
          <span>WhatsApp</span>
        </button>
      </div>

      {/* ── PDF LAYOUT INÍCIO ── */}
      <div className="print:shadow-none shadow-sm border border-slate-100 print:border-none p-4 sm:p-6 rounded-xl bg-white">
        
        {/* 1. CABEÇALHO CLARO */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-6">
            <GardenPrimeLogo horizontal size="large" />
            <div className="w-px h-16 bg-[#C5A059] mx-2 hidden sm:block"></div>
            <div className="text-[10px] sm:text-xs text-slate-700 space-y-1">
              <p>CNPJ: 63.874.628/0001-36 | Inscr. Estadual: 266.037.553.113</p>
              <p>Rua Santa Teresinha, 86 - Paraisolândia, Charqueada - SP</p>
              <p>(19) 99714-1112 | contato@gardenprime.com.br</p>
            </div>
          </div>
          <div className="hidden sm:block text-right transform -rotate-2">
            <p className="font-serif italic text-[#C5A059] text-xl leading-tight">
              Mais verde<br />para um futuro<br />melhor!
            </p>
          </div>
        </div>

        {/* 2. BLOCO ESCURO (TÍTULO) */}
        <div className="bg-[#171F1E] text-white rounded-lg p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2 border border-[#C5A059] rounded-md text-[#C5A059]">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-wider">{dav.isVenda ? "PEDIDO DE VENDA" : "ORÇAMENTO"}</h1>
              <p className="text-sm font-light">DAV Nº: {dav.numero || dav.id.substring(0,6)}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-stretch gap-6">
            <div className="text-xs">
              <p className="text-[#C5A059] mb-1">Emissão</p>
              <p>{dataDAV} às {horaDAV}</p>
            </div>
            <div className="w-px bg-white/20"></div>
            <div className="text-xs">
              <p className="text-[#C5A059] mb-1">Validade</p>
              <p>{validadeStr || "--/--/----"}</p>
            </div>
            <div className="bg-[#B89547] text-white rounded-md p-2 px-3 text-xs flex flex-col justify-center">
              <p className="font-bold mb-1">CONDIÇÕES COMERCIAIS</p>
              <p>Pagamento: {dav.condicao_pagamento || "Não informado"}</p>
              <p>Frete: Retirada | Prazo: Imediato</p>
            </div>
          </div>
        </div>

        {/* 3. DADOS DO CLIENTE */}
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-5 flex flex-wrap justify-between gap-6 mb-6">
          <div className="flex-1 min-w-[250px]">
            <h2 className="text-[#C5A059] font-bold text-sm mb-3 flex items-center gap-2">
              <span className="text-[#B89547] text-lg">👤</span> DADOS DO CLIENTE
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex"><span className="w-20 font-semibold text-slate-600">Nome:</span> <span>{dav.cliente_nome || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">Bairro:</span> <span>{dav.rawVenda?.cliente?.bairro || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">CNPJ/CPF:</span> <span>{dav.cliente_cnpj || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">Cidade:</span> <span>{dav.rawVenda?.cliente?.cidade || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">Telefone:</span> <span>{dav.cliente_telefone || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">UF:</span> <span>{dav.rawVenda?.cliente?.uf || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">Endereço:</span> <span className="flex-1 truncate">{dav.rawVenda?.cliente?.endereco || "-"}</span></div>
              <div className="flex"><span className="w-20 font-semibold text-slate-600">E-mail:</span> <span>{dav.rawVenda?.cliente?.email || "-"}</span></div>
            </div>
          </div>
          
          <div className="bg-[#FAF9F5] border border-[#EBE4D5] rounded-md p-4 text-center max-w-[180px] flex flex-col justify-center items-center">
             <div className="text-[#C5A059] text-2xl mb-1">🤝</div>
             <p className="text-[#C5A059] font-bold text-sm mb-2">Obrigado pela sua confiança!</p>
             <p className="text-[9px] text-slate-500 leading-tight">Estamos à disposição para lhe atender sempre!</p>
          </div>
        </div>

        {/* 4. PRODUTOS */}
        <div className="mb-4">
          <h2 className="text-[#C5A059] font-bold text-sm mb-3 flex items-center gap-2">
            <span className="text-[#B89547] text-lg">📦</span> PRODUTOS
          </h2>
          
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#171F1E] text-white">
                <tr>
                  <th className="p-3 text-center w-16">Código</th>
                  <th className="p-3 w-16"></th>
                  <th className="p-3">Produto</th>
                  <th className="p-3 text-center">Qtd</th>
                  <th className="p-3 text-right">Vlr. Unit.</th>
                  <th className="p-3 text-right">Vlr. Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-3 text-center font-medium text-slate-600">{it.codigo || "-"}</td>
                    <td className="p-2">
                      <div className="w-10 h-10 rounded border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                        {it.produto?.imagem || it.produtos?.imagem ? (
                          <img src={it.produto?.imagem || it.produtos?.imagem} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-300 text-[10px]">Sem img</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{it.produto}</p>
                      <p className="text-[9px] text-slate-500 max-w-[200px] sm:max-w-sm truncate">{(it.rawVenda || it).produto?.descricao || "Sem descrição"}</p>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700">{it.qtd}</td>
                    <td className="p-3 text-right text-slate-600">R$ {Number(it.valor_unitario || 0).toFixed(2).replace(".", ",")}</td>
                    <td className="p-3 text-right font-bold text-slate-800">R$ {Number(it.total || 0).toFixed(2).replace(".", ",")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. SUBTOTAL / TOTAL */}
        <div className="flex justify-end mb-10">
          <div className="w-64">
            <div className="flex justify-between items-center p-3 bg-slate-100 rounded-t-lg">
              <span className="text-slate-600 text-xs font-semibold">Subtotal</span>
              <span className="text-slate-800 text-sm font-bold">R$ {Number(dav.subtotal || dav.total || 0).toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#B89547] text-white rounded-b-lg">
              <span className="text-xs font-bold">Total</span>
              <span className="text-base font-black">R$ {Number(dav.total || 0).toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        </div>

        {/* 6. ASSINATURAS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 items-end mb-8 text-xs">
          <div>
            <div className="border-b border-slate-300 mb-2"></div>
            <p className="text-center font-bold text-slate-600 flex items-center justify-center gap-1">
              <span className="text-[#C5A059]">👤</span> ASSINATURA DO VENDEDOR
            </p>
          </div>
          <div>
            <div className="border-b border-slate-300 mb-2"></div>
            <p className="text-center font-bold text-slate-600 flex items-center justify-center gap-1">
              <span className="text-[#C5A059]">👤</span> ASSINATURA DO CLIENTE
            </p>
          </div>
          <div className="flex justify-end">
            <div className="bg-[#FAF9F5] border border-[#EBE4D5] rounded-lg p-3 flex gap-3 items-center w-full max-w-[200px]">
              <div className="text-[#C5A059] text-xl">📄</div>
              <p className="text-[8px] text-slate-500 leading-tight">
                Este documento não possui valor fiscal, é apenas um Documento Auxiliar de Venda.
              </p>
            </div>
          </div>
        </div>

        {/* 7. RODAPÉ */}
        <div className="bg-[#171F1E] text-white rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 mt-auto">
           <div className="flex items-center gap-4 sm:gap-8 text-[9px] sm:text-xs">
             <div className="flex items-center gap-2"><span className="text-[#C5A059]">🛡️</span> Qualidade em cada detalhe</div>
             <div className="flex items-center gap-2"><span className="text-[#C5A059]">🚚</span> Entrega rápida e segura</div>
             <div className="flex items-center gap-2"><span className="text-[#C5A059]">🌱</span> Produtos selecionados</div>
           </div>
           <GardenPrimeLogo size="small" />
        </div>

      </div>
    </div>
  );

}
