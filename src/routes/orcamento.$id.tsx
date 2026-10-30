import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import { Printer, ArrowLeft, Loader2, FileText, Calendar, Clock, Handshake, Package, User } from "lucide-react";
import { WhatsAppIcon, shareOrderWhatsApp, openOrderPdf } from "@/lib/order-pdf";
import { formatarVencimentosResumo, formatarDataBr, calcularVencimentosPadrao } from "@/lib/utils";

export const Route = createFileRoute("/orcamento/$id")({
  head: () => ({ meta: [{ title: "Orçamento (DAV) - Impressão" }] }),
  component: ImprimirDAV,
});

function ImprimirDAV() {
  const { id } = Route.useParams();
  const [dav, setDav] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const { data: conf } = await supabase.from("configuracoes").select("*").eq("id", 1).single();
      if (conf) setConfig(conf);

      let { data: d } = await supabase.from("davs").select("*").eq("id", id).single();

      let itemsData: any[] = [];

      if (d) {
        if (d.cliente_id) {
          const { data: cli } = await supabase.from("clientes").select("*").eq("id", d.cliente_id).single();
          if (cli) {
            d.bairro = cli.bairro;
            d.cidade = cli.cidade;
            d.uf = cli.uf;
            d.email = cli.email;
            if (!d.cliente_endereco) {
              d.cliente_endereco = [
                cli.endereco,
                cli.numero ? `Nº ${cli.numero}` : null,
                cli.bairro,
                cli.cidade && cli.uf ? `${cli.cidade}/${cli.uf}` : cli.cidade || cli.uf || null,
                cli.cep ? `CEP: ${cli.cep}` : null,
              ]
                .filter(Boolean)
                .join(", ");
            }
          }
        }
        setDav(d);
        const { data: i } = await supabase
          .from("dav_items")
          .select("*, produto:produtos(nome, codigo, imagem)")
          .eq("dav_id", id);
        if (i) {
          itemsData = i.map((item) => ({
            codigo: item.codigo || item.produto?.codigo,
            produto: item.produto?.nome || item.produto || "Produto sem nome",
            imagem: item.produto?.imagem,
            qtd: item.qtd || item.quantidade,
            valor_unitario: item.valor_unitario,
            total: item.total || item.subtotal,
          }));
        }
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
            bairro: cli?.bairro || null,
            cidade: cli?.cidade || null,
            uf: cli?.uf || null,
            email: cli?.email || null,
            condicao_pagamento: v.condicao_pagamento || v.metodo_pagamento,
            subtotal: v.subtotal || v.valor_total,
            desconto_valor: v.desconto_valor || 0,
            desconto_percentual: v.desconto_percentual || 0,
            frete_valor: v.frete_valor || 0,
            total: v.valor_total,
            vendedor: v.vendedor?.nome || "",
            emissor_nome: "GARDEN PLUS LTDA",
            isVenda: v.tipo !== "DAV",
            rawVenda: v,
          };
          setDav(d);

          const { data: vi } = await supabase
            .from("vendas_itens")
            .select("*, produto:produtos(nome, codigo, imagem)")
            .eq("venda_id", id);

          if (vi) {
            itemsData = vi.map((item) => ({
              codigo: item.produto?.codigo || item.codigo,
              produto: item.produto?.nome || item.produto_nome || "Produto sem nome",
              imagem: item.produto?.imagem,
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

  const validadeStr = dav.validade
    ? new Date(dav.validade).toLocaleDateString("pt-BR")
    : (() => {
        const d = new Date(dav.created_at);
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString("pt-BR");
      })();

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
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Botões Superiores */}
      <div className="no-print flex gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur pb-4 z-10 border-b border-slate-100">
        <button
          onClick={handleVoltar}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => {
            if (dav) {
              openOrderPdf(dav, itens);
            } else {
              window.print();
            }
          }}
          className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 bg-brand text-white hover:bg-brand-dark rounded-lg text-sm font-bold transition-colors"
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
          className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-bold transition-colors ml-auto"
        >
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
          <span>WhatsApp</span>
        </button>
      </div>

      {/* ── PDF LAYOUT INÍCIO ── */}
      <div className="p-4 sm:p-6 print:p-0 bg-white">
        
        {/* 1. CABEÇALHO CLARO */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-5 sm:gap-6">
            {/* Logos Garden Prime e Logo 02 (embaixo) */}
            <div className="flex flex-col items-center justify-center gap-2 shrink-0">
              <img src="/garden-prime-pdf.png" alt="Garden Prime" className="h-14 sm:h-16 w-auto object-contain max-w-[220px]" />
              <img
                src="/logo-02.png"
                alt="Logo 02"
                className="h-14 sm:h-16 w-auto object-contain max-w-[200px]"
              />
            </div>
            <div className="w-px h-28 bg-[#C5A059] mx-1 sm:mx-2 hidden sm:block"></div>
            <div className="text-[10px] sm:text-xs text-black font-extrabold space-y-1">
              <p>
                <span className="font-black">CNPJ:</span> {config?.cnpj || "50.387.381/0001-81"} |{" "}
                <span className="font-black">Inscr. Estadual:</span> {config?.inscricao_estadual || "266031100110"}
              </p>
              <p>
                {config?.tipo_logradouro ? config.tipo_logradouro + " " : ""}
                {config?.endereco || "MATEUS RODRIGUES DA COSTA"}{config?.numero ? ", " + config.numero : ""}
                {config?.complemento ? " " + config.complemento : ""}{config?.bairro ? ", " + config.bairro : ""}
                {", " + (config?.municipio || "Charqueada") + " - " + (config?.uf || "SP")}
              </p>
              <p>
                <span className="font-black">{config?.celular || config?.telefone || "(19) 99930-8784"}</span> |{" "}
                <span className="font-black">{config?.email_contato || "garden-plus@hotmail.com"}</span>
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-right transform -rotate-2">
            <p className="font-serif italic font-black text-[#C5A059] text-xl leading-tight">
              Mais verde<br />para um futuro<br />melhor!
            </p>
          </div>
        </div>

        {/* 2. BLOCO ESCURO (TÍTULO) */}
        <div className="bg-[#112321] text-white rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4 mb-6 shadow-sm">
          {/* Título e DAV */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 border-2 border-[#C5A059] rounded-lg text-[#C5A059] flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-white leading-tight">
                {dav.isVenda ? "PEDIDO DE VENDA" : "ORÇAMENTO"}
              </h1>
              <p className="text-xs text-white font-black leading-tight">
                DAV Nº: {dav.numero !== undefined && dav.numero !== null ? String(dav.numero).padStart(3, "0") : (dav.id ? dav.id.substring(0, 6) : "001")}
              </p>
            </div>
          </div>

          {/* Divisor */}
          <div className="w-px h-8 bg-white/20 shrink-0 hidden sm:block"></div>

          {/* Emissão */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-[#C5A059] shrink-0 stroke-[2.5]" />
            <div className="text-xs leading-tight">
              <p className="text-[10px] text-[#E5C378] font-black leading-none mb-1">Emissão</p>
              <p className="text-[11px] sm:text-xs text-white font-black whitespace-nowrap leading-none">
                {dataDAV} às {horaDAV}
              </p>
            </div>
          </div>

          {/* Divisor */}
          <div className="w-px h-8 bg-white/20 shrink-0 hidden sm:block"></div>

          {/* Validade */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#C5A059] shrink-0 stroke-[2.5]" />
            <div className="text-xs leading-tight">
              <p className="text-[10px] text-[#E5C378] font-black leading-none mb-1">Validade</p>
              <p className="text-[11px] sm:text-xs text-white font-black whitespace-nowrap leading-none">
                {validadeStr}
              </p>
            </div>
          </div>

          {/* Condições Comerciais */}
          <div className="bg-black text-white rounded-lg px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs flex flex-col justify-center shrink-0 ml-auto sm:ml-0 min-w-[210px]">
            <p className="font-black text-[10px] sm:text-[11px] tracking-wider uppercase mb-1 leading-none text-white">
              CONDIÇÕES COMERCIAIS
            </p>
            <p className="text-[10px] sm:text-[11px] text-white font-black leading-tight">
              Pagamento: {dav.condicao_pagamento || "Dinheiro / Pix"}
            </p>
            {(() => {
              const vencList = Array.isArray(dav.vencimentos) && dav.vencimentos.length > 0
                ? dav.vencimentos
                : (dav.condicao_pagamento && dav.condicao_pagamento.trim() !== ""
                    ? calcularVencimentosPadrao(dav.condicao_pagamento, dav.emissao || dav.created_at, dav.total || dav.valor_total)
                    : []);

              if (vencList.length > 1) {
                return (
                  <div className="text-[10px] sm:text-[11px] text-white font-black leading-tight my-1">
                    <span className="block mb-0.5">Vencimentos:</span>
                    <div className="bg-white text-slate-800 font-black px-2 py-1 rounded text-[10px] tracking-wider font-mono border border-slate-300 shadow-2xs space-y-0.5">
                      {vencList.map((v: any, idx: number) => {
                        const d = typeof v === "object" && v !== null ? v.data : v;
                        return (
                          <div key={idx} className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-600 font-bold">{idx + 1}ª:</span>
                            <span className="font-black text-slate-900">{formatarDataBr(d)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (vencList.length === 1) {
                const d = typeof vencList[0] === "object" && vencList[0] !== null ? vencList[0].data : vencList[0];
                return (
                  <div className="text-[10px] sm:text-[11px] text-white font-black leading-tight flex items-center gap-1.5 my-1">
                    <span>Vencimento:</span>
                    <span className="bg-white text-slate-800 font-black px-2 py-0.5 rounded text-[10px] tracking-wider font-mono border border-slate-300 shadow-2xs">
                      {formatarDataBr(d)}
                    </span>
                  </div>
                );
              }

              return (
                <div className="text-[10px] sm:text-[11px] text-white font-black leading-tight flex items-center gap-1.5 my-1">
                  <span>Vencimento:</span>
                  <span className="bg-white text-slate-800 font-black px-2 py-0.5 rounded text-[10px] tracking-wider font-mono border border-slate-300 shadow-2xs">
                    ___ / ___ / ______
                  </span>
                </div>
              );
            })()}
            <p className="text-[10px] sm:text-[11px] text-white font-black leading-tight">
              Frete: Retirada | Prazo: Imediato
            </p>
          </div>
        </div>

        {/* 3. DADOS DO CLIENTE */}
        <div className="bg-white p-2 flex flex-wrap justify-between gap-6 mb-6 shadow-xs">
          <div className="flex-1 min-w-[250px]">
            <h2 className="font-black text-sm mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#B89547] flex items-center justify-center text-white shrink-0">
                <User className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="tracking-wide">
                <span className="text-[#B89547] font-black">DADOS</span>{" "}
                <span className="text-black font-black">DO CLIENTE</span>
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex sm:col-span-2 print:col-span-2">
                <span className="w-20 font-black text-black shrink-0">Nome:</span>
                <span className="flex-1 break-words font-black text-black">{dav.cliente_nome || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-black text-black shrink-0">CNPJ/CPF:</span>
                <span className="flex-1 break-words font-black text-black">{dav.cliente_cnpj || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-black text-black shrink-0">Telefone:</span>
                <span className="flex-1 break-words font-black text-black">{dav.cliente_telefone || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-black text-black shrink-0">E-mail:</span>
                <span className="flex-1 break-words font-black text-black">{dav.rawVenda?.cliente?.email || dav.email || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-black text-black shrink-0">Bairro:</span>
                <span className="flex-1 break-words font-black text-black">{dav.rawVenda?.cliente?.bairro || dav.bairro || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-black text-black shrink-0">Cidade:</span>
                <span className="flex-1 break-words font-black text-black">{dav.rawVenda?.cliente?.cidade || dav.cidade || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-black text-black shrink-0">UF:</span>
                <span className="flex-1 break-words font-black text-black">{dav.rawVenda?.cliente?.uf || dav.uf || "-"}</span>
              </div>
              <div className="flex sm:col-span-2 print:col-span-2">
                <span className="w-20 font-black text-black shrink-0">Endereço:</span>
                <span className="flex-1 break-words whitespace-normal font-black text-black">{dav.rawVenda?.cliente?.endereco || dav.cliente_endereco || "-"}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#FAF7EE] border-2 border-[#EAE3D2] rounded-xl p-4 text-center w-full sm:w-[200px] flex flex-col justify-center items-center shrink-0">
             <Handshake className="w-8 h-8 text-[#A57F33] mb-1.5 stroke-[2.2]" />
             <p className="text-[#A57F33] font-black text-xs mb-1">Obrigado pela sua confiança!</p>
             <p className="text-[9px] text-black font-extrabold leading-tight">Estamos à disposição para lhe atender sempre!</p>
          </div>
        </div>

        {/* 4. PRODUTOS */}
        <div className="mb-6">
          <h2 className="font-black text-sm mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#B89547] shrink-0" strokeWidth={2.5} />
            <span className="text-black tracking-wider uppercase font-black">PRODUTOS</span>
          </h2>
          
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#112321] text-white">
                <tr>
                  <th className="p-3 text-left pl-4 font-black text-xs uppercase tracking-wider">Código</th>
                  <th className="p-3 text-left font-black text-xs uppercase tracking-wider">Produto</th>
                  <th className="p-3 text-center font-black text-xs uppercase tracking-wider">Qtd</th>
                  <th className="p-3 text-right font-black text-xs uppercase tracking-wider">Vlr. Unit.</th>
                  <th className="p-3 text-right pr-4 font-black text-xs uppercase tracking-wider">Vlr. Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const imgUrl = it.imagem || it.produto?.imagem || it.produtos?.imagem || (it.rawVenda || it).produto?.imagem;
                  const desc = it.descricao || (it.rawVenda || it).produto?.descricao;
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFBFA]"}>
                      <td className="p-3 pl-2">
                        <div className="flex items-center gap-3">
                          {imgUrl ? (
                            <div className="w-10 h-10 rounded-md border border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                              <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <span className="font-black text-black text-xs">{it.codigo || "-"}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-black text-black text-xs">{it.produto}</p>
                        {desc && (
                          <p className="text-[10px] text-black font-extrabold max-w-[240px] sm:max-w-md truncate mt-0.5">{desc}</p>
                        )}
                      </td>
                      <td className="p-3 text-center font-black text-black text-xs">{it.qtd}</td>
                      <td className="p-3 text-right text-black font-black text-xs whitespace-nowrap">
                        R$ {Number(it.valor_unitario || 0).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="p-3 pr-4 text-right font-black text-black text-xs whitespace-nowrap">
                        R$ {Number(it.total || 0).toFixed(2).replace(".", ",")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. SUBTOTAL / TOTAL */}
        <div className="flex justify-end mb-8">
          <div className="bg-[#FAF7EE] border-2 border-[#EBE4D5] rounded-xl p-3 flex items-center gap-3 min-w-[270px] shadow-xs">
            {/* Ícone de Moeda/Cifrão à esquerda */}
            <div className="w-8 h-8 rounded-full border-2 border-[#1B382F] flex items-center justify-center text-[#1B382F] shrink-0 ml-1">
              <span className="font-black text-sm leading-none">$</span>
            </div>
            {/* Linhas de Valores à direita */}
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex justify-between items-center px-1 text-xs">
                <span className="text-black font-black">Subtotal</span>
                <span className="text-black font-black text-sm">
                  R$ {Number(dav.subtotal || dav.total || 0).toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="bg-[#A37E36] text-white rounded-lg px-3.5 py-2 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider">Total</span>
                <span className="text-base font-black">
                  R$ {Number(dav.total || 0).toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. ASSINATURAS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 items-end mb-8 text-xs">
          <div>
            <div className="border-b-2 border-black mb-2"></div>
            <p className="text-center font-black text-black flex items-center justify-center gap-1">
              <span className="text-[#C5A059]">👤</span> ASSINATURA DO VENDEDOR
            </p>
          </div>
          <div>
            <div className="border-b-2 border-black mb-2"></div>
            <p className="text-center font-black text-black flex items-center justify-center gap-1">
              <span className="text-[#C5A059]">👤</span> ASSINATURA DO CLIENTE
            </p>
          </div>
          <div className="flex justify-end">
            <div className="bg-[#FAF9F5] border-2 border-[#EBE4D5] rounded-lg p-3 flex gap-3 items-center w-full max-w-[210px]">
              <div className="text-[#C5A059] text-xl">📄</div>
              <p className="text-[8px] text-black font-extrabold leading-tight">
                Este documento não possui valor fiscal, é apenas um Documento Auxiliar de Venda.
              </p>
            </div>
          </div>
        </div>

        {/* 7. RODAPÉ */}
        <div className="bg-[#171F1E] text-white rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 mt-auto">
           <div className="flex items-center gap-4 sm:gap-8 text-[9px] sm:text-xs font-black">
             <div className="flex items-center gap-2"><span className="text-[#C5A059]">🛡️</span> Qualidade em cada detalhe</div>
             <div className="flex items-center gap-2"><span className="text-[#C5A059]">🚚</span> Entrega rápida e segura</div>
             <div className="flex items-center gap-2"><span className="text-[#C5A059]">🌱</span> Produtos selecionados</div>
           </div>
           <div className="flex items-center gap-3">
             <GardenPrimeLogo size="small" />
             <img src="/logo-02.png" alt="Logo 02" className="h-6 w-auto object-contain brightness-0 invert" />
           </div>
        </div>

      </div>
    </div>
  );

}
