import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import { Printer, ArrowLeft, Loader2, FileText, Calendar, Clock, Handshake, Package, User } from "lucide-react";
import { WhatsAppIcon, shareOrderWhatsApp } from "@/lib/order-pdf";
import {
  formatClientAddressLine,
  formatUnidadeMedida,
  formatarDataBr,
  calcularVencimentosPadrao,
  calcularValorParcela,
} from "@/lib/utils";

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

      const rawParam = String(id || "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawParam);
      const isDavNum = /^[dD]\d+$/.test(rawParam);
      const isVendaNum = /^(?:[vV])?\d+$/.test(rawParam);
      const numericVal = parseInt(rawParam.replace(/^[dDvV]/, ""), 10);

      let d: any = null;
      let v: any = null;

      if (isUuid) {
        const resDav = await supabase.from("davs").select("*").eq("id", rawParam).maybeSingle();
        d = resDav.data;
        if (!d) {
          const resVenda = await supabase
            .from("vendas")
            .select("*, cliente:clientes(*), vendedor:vendedores(nome)")
            .eq("id", rawParam)
            .maybeSingle();
          v = resVenda.data;
        }
      } else if (isDavNum && !isNaN(numericVal)) {
        const resDav = await supabase.from("davs").select("*").eq("numero", numericVal).maybeSingle();
        d = resDav.data;
        if (!d) {
          const resVenda = await supabase
            .from("vendas")
            .select("*, cliente:clientes(*), vendedor:vendedores(nome)")
            .eq("numero_venda", numericVal)
            .maybeSingle();
          v = resVenda.data;
        }
      } else if (isVendaNum && !isNaN(numericVal)) {
        const resVenda = await supabase
          .from("vendas")
          .select("*, cliente:clientes(*), vendedor:vendedores(nome)")
          .eq("numero_venda", numericVal)
          .maybeSingle();
        v = resVenda.data;
        if (!v) {
          const resDav = await supabase.from("davs").select("*").eq("numero", numericVal).maybeSingle();
          d = resDav.data;
        }
      }

      let itemsData: any[] = [];

      if (d) {
        let cli: any = null;
        if (d.cliente_id) {
          const { data } = await supabase.from("clientes").select("*").eq("id", d.cliente_id).maybeSingle();
          cli = data;
        } else if (d.cliente_cnpj) {
          const { data } = await supabase.from("clientes").select("*").eq("cpf_cnpj", d.cliente_cnpj).limit(1).maybeSingle();
          cli = data;
        }
        if (cli) {
          d.bairro = cli.bairro || d.bairro;
          d.cidade = cli.cidade || d.cidade;
          d.uf = cli.uf || d.uf;
          d.cep = cli.cep || d.cep;
          d.cliente_numero = cli.numero || d.cliente_numero;
          d.email = cli.email || d.cliente_email || d.email;
          d.cliente_endereco = formatClientAddressLine(d.cliente_endereco || cli.endereco, d.cliente_numero);
        } else {
          d.cliente_endereco = formatClientAddressLine(d.cliente_endereco, d.cliente_numero);
        }
        setDav(d);
        const { data: i } = await supabase
          .from("dav_items")
          .select("*, produto:produtos(nome, codigo, unidade_medida, imagem)")
          .eq("dav_id", d.id);
        if (i) {
          itemsData = i.map((item) => ({
            codigo: item.codigo || item.produto?.codigo,
            unidade_medida: formatUnidadeMedida(item.produto?.unidade_medida || item.unidade_medida),
            produto: item.produto?.nome || item.produto || "Produto sem nome",
            imagem: item.produto?.imagem,
            qtd: item.qtd || item.quantidade,
            valor_unitario: item.valor_unitario,
            total: item.total || item.subtotal,
          }));
        }
      } else if (v) {
        const cli = v.cliente;
        const enderecoFormatado = formatClientAddressLine(cli?.endereco, cli?.numero);

        d = {
          id: v.id,
          numero: v.numero_venda || v.numero,
          created_at: v.created_at,
          cliente_nome: cli?.nome,
          cliente_cnpj: cli?.cpf_cnpj,
          cliente_telefone: cli?.telefone,
          cliente_endereco: enderecoFormatado === "-" ? null : enderecoFormatado,
          bairro: cli?.bairro || null,
          cidade: cli?.cidade || null,
          uf: cli?.uf || null,
          cep: cli?.cep || null,
          email: cli?.email || null,
          condicao_pagamento: v.condicao_pagamento || v.metodo_pagamento,
          vencimentos: v.vencimentos || null,
          subtotal: v.subtotal || v.valor_total,
          desconto_valor: v.desconto_valor || 0,
          desconto_percentual: v.desconto_percentual || 0,
          frete_valor: v.frete_valor || 0,
          frete_tipo: v.frete_tipo || "Retirada",
          prazo_entrega: v.prazo_entrega || "Imediato",
          observacoes: v.observacoes || null,
          total: v.valor_total,
          vendedor: v.vendedor?.nome || "",
          emissor_nome: "GARDEN PLUS LTDA",
          isVenda: v.tipo !== "DAV",
          rawVenda: v,
        };
        setDav(d);

        const { data: vi } = await supabase
          .from("vendas_itens")
          .select("*, produto:produtos(nome, codigo, unidade_medida, imagem)")
          .eq("venda_id", v.id);

        if (vi) {
          itemsData = vi.map((item) => ({
            codigo: item.produto?.codigo || item.codigo,
            unidade_medida: formatUnidadeMedida(item.produto?.unidade_medida || item.unidade_medida),
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

  const clienteEmail = dav.rawVenda?.cliente?.email || dav.cliente_email || dav.email || "-";
  const clienteBairro = dav.rawVenda?.cliente?.bairro || dav.bairro || "-";
  const clienteCidade = dav.rawVenda?.cliente?.cidade || dav.cidade || "-";
  const clienteUf = dav.rawVenda?.cliente?.uf || dav.uf || "-";
  const clienteCep = dav.rawVenda?.cliente?.cep || dav.cep || "-";
  const clienteEndereco = formatClientAddressLine(
    dav.cliente_endereco || dav.rawVenda?.cliente?.endereco,
    dav.rawVenda?.cliente?.numero || dav.cliente_numero,
  );
  const freteInfo = dav.frete_tipo || "Retirada";
  const prazoInfo = dav.prazo_entrega || "Imediato";
  const totalDoc = Number(dav.total || dav.valor_total || dav.subtotal || 0);
  const vencList =
    Array.isArray(dav.vencimentos) && dav.vencimentos.length > 0
      ? dav.vencimentos
      : dav.condicao_pagamento && dav.condicao_pagamento.trim() !== ""
        ? calcularVencimentosPadrao(dav.condicao_pagamento, dav.emissao || dav.created_at, totalDoc)
        : [];

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
      className="bg-white min-h-screen text-black p-4 sm:p-6 print:p-0 font-sans"
      style={{ maxWidth: "850px", margin: "0 auto", WebkitFontSmoothing: "auto" }}
    >
      <style>{`
        @media print {
          @page { margin: 8mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; -webkit-font-smoothing: auto; }
          .no-print { display: none !important; }
          .dav-table thead { display: table-header-group; }
          .dav-table tr, .no-break { break-inside: avoid; page-break-inside: avoid; }
        }
        .dados-cliente-bold, .dados-cliente-bold * {
          font-weight: 900 !important;
        }
      `}</style>

      {/* Botões Superiores */}
      <div className="no-print flex gap-4 mb-5 sticky top-0 bg-white/90 backdrop-blur pb-3 pt-1 z-10 border-b border-slate-100">
        <button
          onClick={handleVoltar}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => window.print()}
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

      {/* ── PDF LAYOUT ORIGINAL OTIMIZADO ── */}
      <div className="p-2 sm:p-4 print:p-0 bg-white">
        {/* 1. CABEÇALHO CLARO */}
        <div className="flex justify-between items-center mb-3.5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex flex-col items-center justify-center gap-1.5 shrink-0">
              <img src="/garden-prime-pdf.png" alt="Garden Prime" className="h-12 sm:h-14 w-auto object-contain max-w-[200px]" />
              <img
                src="/logo-02.png"
                alt="Logo 02"
                className="h-12 sm:h-14 w-auto object-contain max-w-[180px]"
              />
            </div>
            <div className="w-px h-24 bg-[#C5A059] mx-1 hidden sm:block print:block"></div>
            <div className="text-[10px] sm:text-xs text-black font-extrabold space-y-0.5">
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
          <div className="hidden sm:block print:block text-right transform -rotate-2">
            <p className="font-serif italic font-black text-[#C5A059] text-lg leading-tight">
              Mais verde<br />para um futuro<br />melhor!
            </p>
          </div>
        </div>

        {/* 2. BLOCO ESCURO (MAIS FINO E COMPACTO) */}
        <div className="bg-[#112321] text-white rounded-xl px-4 py-2 sm:px-5 sm:py-2.5 flex flex-wrap sm:flex-nowrap print:flex-nowrap items-center justify-between gap-3 mb-3.5 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 border-2 border-[#C5A059] rounded-lg text-[#C5A059] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-white leading-tight">
                {dav.isVenda ? "PEDIDO DE VENDA" : "ORÇAMENTO"}
              </h1>
              <p className="text-[11px] text-white font-black leading-tight mt-0.5">
                DAV Nº: {dav.numero !== undefined && dav.numero !== null ? String(dav.numero).padStart(3, "0") : (dav.id ? dav.id.substring(0, 6) : "001")}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-white/20 shrink-0 hidden sm:block print:block"></div>

          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="w-4 h-4 text-[#C5A059] shrink-0 stroke-[2.5]" />
            <div className="text-xs leading-tight">
              <p className="text-[10px] text-[#E5C378] font-black leading-none mb-0.5">Emissão</p>
              <p className="text-[11px] text-white font-black whitespace-nowrap leading-none">
                {dataDAV} às {horaDAV}
              </p>
            </div>
          </div>

          <div className="bg-black text-white rounded-lg px-3 py-1.5 text-[10px] flex flex-col justify-center shrink-0 w-full sm:w-[295px] print:w-[290px] box-border">
            <p className="font-black text-[10px] tracking-wider uppercase mb-0.5 leading-none text-[#E5C378]">
              CONDIÇÕES COMERCIAIS
            </p>
            <p className="text-[10px] text-white font-black leading-tight break-words whitespace-normal">
              Pagamento: {dav.condicao_pagamento || "Dinheiro / Pix"}
            </p>
            {dav.vendedor && (
              <p className="text-[10px] text-[#E5C378] font-black leading-tight mt-0.5 break-words whitespace-normal">
                Vendedor: {dav.vendedor}
              </p>
            )}
            {vencList.length > 1 ? (
              <div className="text-[10px] text-white font-black leading-tight my-1 w-full">
                <div
                  className={`bg-white text-slate-900 font-bold px-2 py-1 rounded border border-slate-300 w-full box-border ${
                    vencList.length > 2 ? "grid grid-cols-2 gap-x-2 gap-y-0.5" : "space-y-0.5"
                  }`}
                >
                  {vencList.map((v: any, idx: number) => {
                    const d = typeof v === "object" && v !== null ? v.data : v;
                    const valParcela = calcularValorParcela(v, idx, vencList.length, totalDoc);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-1 text-[10px] font-black">
                        <span className="text-slate-800 font-black whitespace-nowrap">
                          {idx + 1}ª: {formatarDataBr(d)}
                        </span>
                        {valParcela > 0 && (
                          <span className="font-black text-black whitespace-nowrap">
                            R$ {valParcela.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : vencList.length === 1 ? (
              <div className="text-[10px] text-white font-black leading-tight my-1 w-full flex items-center gap-1.5">
                <span className="text-slate-300 shrink-0">Venc.:</span>
                <div className="bg-white text-black font-black px-2 py-0.5 rounded text-[10px] border border-slate-300 flex items-center justify-between gap-2 flex-1">
                  <span className="whitespace-nowrap">
                    {formatarDataBr(typeof vencList[0] === "object" && vencList[0] !== null ? vencList[0].data : vencList[0])}
                  </span>
                  {calcularValorParcela(vencList[0], 0, 1, totalDoc) > 0 && (
                    <span className="whitespace-nowrap">
                      R$ {calcularValorParcela(vencList[0], 0, 1, totalDoc).toFixed(2).replace(".", ",")}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-white font-black leading-tight flex items-center gap-1.5 my-1">
                <span className="text-slate-300">Venc.:</span>
                <span className="bg-white text-slate-700 font-black px-2 py-0.5 rounded text-[10px] tracking-widest font-mono border border-slate-300">
                  ___ / ___ / ______
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-[10px] leading-tight mt-0.5">
              <span className="flex items-center gap-1 text-[#E5C378] font-black">
                <Clock className="w-3 h-3 text-[#C5A059] shrink-0 stroke-[2.5]" />
                Validade: {validadeStr}
              </span>
              <span className="text-white font-black whitespace-nowrap">
                {freteInfo} | {prazoInfo}
              </span>
            </div>
          </div>
        </div>

        {/* 3. DADOS DO CLIENTE (ENDEREÇO E CAMPOS ORGANIZADOS EM 2 COLUNAS COMPACTAS) */}
        <div className="bg-[#F8F9FA] border border-slate-200 rounded-xl p-3 flex flex-wrap sm:flex-nowrap print:flex-nowrap justify-between gap-4 mb-4 dados-cliente-bold">
          <div className="flex-1 min-w-[250px]">
            <h2 className="font-display font-black text-xs mb-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#A57F33] flex items-center justify-center text-white shrink-0">
                <User className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="tracking-wide font-black">
                <span className="text-[#9A7424] font-black">DADOS</span>{" "}
                <span className="text-black font-black">DO CLIENTE</span>
              </span>
            </h2>
            <div className="grid grid-cols-12 gap-x-4 gap-y-1 text-[11px] font-black text-black leading-snug">
              <div className="col-span-12 sm:col-span-7 print:col-span-7 space-y-1">
                <div className="flex gap-1.5">
                  <span className="w-[62px] text-black shrink-0">Cliente:</span>
                  <span className="flex-1 break-words text-black">{dav.cliente_nome || "-"}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-[62px] text-black shrink-0">Endereço:</span>
                  <span className="flex-1 break-words whitespace-normal text-black">{clienteEndereco}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-[62px] text-black shrink-0">CEP:</span>
                  <span className="flex-1 text-black">{clienteCep}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-[62px] text-black shrink-0">Telefone:</span>
                  <span className="flex-1 text-black">{dav.cliente_telefone || "-"}</span>
                </div>
              </div>

              <div className="col-span-12 sm:col-span-5 print:col-span-5 space-y-1">
                <div className="flex gap-1.5">
                  <span className="w-[68px] text-black shrink-0">CPF/CNPJ:</span>
                  <span className="flex-1 break-words text-black">{dav.cliente_cnpj || "-"}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-[68px] text-black shrink-0">Bairro:</span>
                  <span className="flex-1 break-words text-black">{clienteBairro}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-[68px] text-black shrink-0">Cidade/UF:</span>
                  <span className="flex-1 break-words text-black">
                    {clienteCidade}{clienteUf && clienteUf !== "-" ? ` / ${clienteUf}` : ""}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-[68px] text-black shrink-0">E-mail:</span>
                  <span className="flex-1 break-all text-black">{clienteEmail}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FAF7EE] border border-[#EAE3D2] rounded-xl p-2.5 text-center w-full sm:w-[165px] print:w-[160px] flex flex-col justify-center items-center shrink-0">
            <Handshake className="w-6 h-6 text-[#A57F33] mb-1 stroke-[2.2]" />
            <p className="text-[#A57F33] font-black text-[11px] mb-0.5 leading-tight">Obrigado pela sua confiança!</p>
            <p className="text-[8.5px] text-black font-extrabold leading-tight">Estamos à disposição para lhe atender sempre!</p>
          </div>
        </div>

        {/* 4. PRODUTOS (ORIGINAL COM FOTOS) */}
        <div className="mb-5">
          <h2 className="font-black text-sm mb-2 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#B89547] shrink-0" strokeWidth={2.5} />
            <span className="text-black tracking-wider uppercase font-black">PRODUTOS</span>
          </h2>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="dav-table w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#112321] text-white">
                <tr>
                  <th className="p-2.5 text-left pl-3 font-black text-xs uppercase tracking-wider">Código</th>
                  <th className="p-2.5 text-left font-black text-xs uppercase tracking-wider">Produto</th>
                  <th className="p-2.5 text-center font-black text-xs uppercase tracking-wider">Qtd</th>
                  <th className="p-2.5 text-right font-black text-xs uppercase tracking-wider">Vlr. Unit.</th>
                  <th className="p-2.5 text-right pr-3 font-black text-xs uppercase tracking-wider">Vlr. Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const imgUrl =
                    it.imagem ||
                    it.produto?.imagem ||
                    it.produtos?.imagem ||
                    (it.rawVenda || it).produto?.imagem;
                  const desc = it.descricao || (it.rawVenda || it).produto?.descricao;
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFBFA]"}>
                      <td className="p-2.5 pl-2">
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
                      <td className="p-2.5 whitespace-normal">
                        <p className="font-black text-black text-xs">{it.produto}</p>
                        {desc && (
                          <p className="text-[10px] text-black font-extrabold max-w-[240px] sm:max-w-md truncate mt-0.5">
                            {desc}
                          </p>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-black text-black text-xs">{it.qtd}</td>
                      <td className="p-2.5 text-right text-black font-black text-xs whitespace-nowrap">
                        R$ {Number(it.valor_unitario || 0).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="p-2.5 pr-3 text-right font-black text-black text-xs whitespace-nowrap">
                        R$ {Number(it.total || 0).toFixed(2).replace(".", ",")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. TOTAL (ORIGINAL) */}
        <div className="flex justify-end mb-6 no-break">
          <div className="bg-[#FAF7EE] border-2 border-[#EBE4D5] rounded-xl p-2.5 flex items-center gap-3 min-w-[260px] shadow-xs">
            <div className="w-8 h-8 rounded-full border-2 border-[#1B382F] flex items-center justify-center text-[#1B382F] shrink-0 ml-1">
              <span className="font-black text-sm leading-none">$</span>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="bg-[#A37E36] text-white rounded-lg px-3.5 py-2 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider">Total</span>
                <span className="text-base font-black">
                  R$ {Number(dav.total || dav.subtotal || 0).toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. ASSINATURAS + CAIXA DE DATA DA ENTREGA */}
        <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-4 items-end mb-6 text-xs no-break">
          <div className="sm:col-span-4 print:col-span-4 pb-1">
            <div className="border-b-2 border-black mb-1.5 mt-8"></div>
            <p className="text-center text-[10px] font-black text-black flex items-center justify-center gap-1">
              <span className="text-[#C5A059]">👤</span> ASSINATURA DO VENDEDOR {dav.vendedor ? `(${dav.vendedor})` : ""}
            </p>
          </div>
          <div className="sm:col-span-5 print:col-span-5 border-2 border-slate-800 rounded-lg p-2.5 bg-white">
            <div className="flex items-center justify-between gap-2 mb-5">
              <span className="text-[10px] font-black text-black">Data da Entrega:</span>
              <span className="border border-black rounded px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider bg-white">
                ___ / ___ / ______
              </span>
            </div>
            <div className="border-b-2 border-black mb-1.5"></div>
            <p className="text-center text-[10px] font-black text-black flex items-center justify-center gap-1">
              <span className="text-[#C5A059]">👤</span> ASSINATURA DO CLIENTE / RECEBEDOR
            </p>
          </div>
          <div className="sm:col-span-3 print:col-span-3 flex justify-end">
            <div className="bg-[#FAF9F5] border-2 border-[#EBE4D5] rounded-lg p-2.5 flex gap-2 items-center w-full">
              <div className="text-[#C5A059] text-lg shrink-0">📄</div>
              <p className="text-[8px] text-black font-extrabold leading-tight">
                Este documento não possui valor fiscal, é apenas um Documento Auxiliar de Venda.
              </p>
            </div>
          </div>
        </div>

        {/* 7. RODAPÉ ESCURO (ORIGINAL) */}
        <div className="bg-[#171F1E] text-white rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4 mt-auto no-break">
          <div className="flex items-center gap-4 sm:gap-7 text-[9px] sm:text-xs font-black">
            <div className="flex items-center gap-1.5"><span className="text-[#C5A059]">🛡️</span> Qualidade em cada detalhe</div>
            <div className="flex items-center gap-1.5"><span className="text-[#C5A059]">🚚</span> Entrega rápida e segura</div>
            <div className="flex items-center gap-1.5"><span className="text-[#C5A059]">🌱</span> Produtos selecionados</div>
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
