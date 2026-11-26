import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { WhatsAppIcon, shareOrderWhatsApp } from "@/lib/order-pdf";
import {
  formatBrDecimal,
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
    second: "2-digit",
  });

  const validadeStr = dav.validade
    ? new Date(dav.validade).toLocaleDateString("pt-BR")
    : (() => {
        const d = new Date(dav.created_at);
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString("pt-BR");
      })();

  const numDocDisplay =
    dav.numero !== undefined && dav.numero !== null
      ? String(dav.numero).padStart(6, "0")
      : dav.id
        ? dav.id.substring(0, 6).toUpperCase()
        : "000001";

  const razaoSocial = config?.razao_social || "GARDEN PLUS LTDA";
  const nomeFantasia = config?.nome_fantasia || "GARDEN PRIME";
  const empresaEndereco = [
    [config?.tipo_logradouro, config?.endereco || "MATEUS RODRIGUES DA COSTA"]
      .filter(Boolean)
      .join(" "),
    config?.numero,
    config?.complemento,
    config?.bairro,
  ]
    .filter(Boolean)
    .join(", ");
  const empresaCepCidadeUf = [
    config?.cep,
    `${config?.municipio || "Charqueada"} - ${config?.uf || "SP"}`,
  ]
    .filter(Boolean)
    .join(" - ");
  const empresaFone = config?.celular || config?.telefone || "(19) 99930-8784";
  const empresaEmail = config?.email_contato || "garden-plus@hotmail.com";

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
  const pagInfo = dav.condicao_pagamento || "Não informado";

  const totalDoc = Number(dav.total || dav.valor_total || dav.subtotal || 0);
  const subtotalDoc = Number(dav.subtotal || totalDoc);
  const descontoDoc = Number(dav.desconto_valor || 0);
  const freteDoc = Number(dav.frete_valor || 0);

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
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .dav-table thead { display: table-header-group; }
          .dav-table tr, .no-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Botões Superiores */}
      <div className="no-print flex gap-4 mb-5 sticky top-0 bg-white/95 backdrop-blur pb-3 pt-1 z-10 border-b border-slate-200">
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

      {/* ── PDF LAYOUT COMPACTO (ESTILO DAV) ── */}
      <div className="bg-white text-black text-[11px] leading-snug">
        {/* 1. CABEÇALHO EMPRESARIAL E DADOS DO DOCUMENTO */}
        <div className="border border-black">
          <div className="border-b border-black px-3 py-2 text-center">
            <h1 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
              DOCUMENTO AUXILIAR DE VENDA - {dav.isVenda ? "PEDIDO DE VENDA" : "ORÇAMENTO"}
            </h1>
            <p className="text-[10px] font-bold uppercase leading-tight mt-0.5">
              NÃO É DOCUMENTO FISCAL - NÃO É VÁLIDO COMO RECIBO E COMO GARANTIA DE MERCADORIA - NÃO COMPROVA PAGAMENTO
            </p>
          </div>

          <div className="border-b border-black px-3 py-2 flex flex-wrap sm:flex-nowrap justify-between items-start gap-3">
            <div className="space-y-0.5">
              <p className="font-bold text-xs uppercase">
                {razaoSocial} - {nomeFantasia}
              </p>
              <p>
                CNPJ: {config?.cnpj || "50.387.381/0001-81"} - Insc. Estadual:{" "}
                {config?.inscricao_estadual || "266031100110"}
              </p>
              <p>{empresaEndereco}</p>
              <p>{empresaCepCidadeUf}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col justify-between gap-3 ml-auto">
              <p className="font-semibold">Página 1/1</p>
              <div>
                <p>Fone: {empresaFone}</p>
                <p className="text-[10px]">{empresaEmail}</p>
              </div>
            </div>
          </div>

          <div className="px-3 py-1.5 flex flex-wrap sm:flex-nowrap justify-between items-center gap-3">
            <div className="space-y-0.5">
              <p>
                <span className="font-semibold">Tipo:</span>{" "}
                {dav.isVenda ? "Pedido de Venda" : "Orçamento (DAV)"}
              </p>
              <p>
                <span className="font-semibold">Vendedor:</span>{" "}
                {dav.vendedor ? String(dav.vendedor).toUpperCase() : "DIRETO"}
              </p>
              <p>
                <span className="font-semibold">Validade:</span> {validadeStr}
              </p>
            </div>
            <div className="text-right space-y-0.5 shrink-0 ml-auto">
              <p className="text-xs font-bold">
                {dav.isVenda ? "DAV / Pedido:" : "DAV:"}
                <span className="font-mono text-sm font-extrabold ml-2">{numDocDisplay}</span>
              </p>
              <p className="font-semibold">
                Data: {dataDAV}
                <span className="ml-3">Hora: {horaDAV}</span>
              </p>
            </div>
          </div>
        </div>

        {/* 2. IDENTIFICAÇÃO DO SOLICITANTE (DADOS DO CLIENTE COMPACTOS) */}
        <div className="border border-black mt-1.5 px-3 py-2">
          <h2 className="font-bold text-xs mb-1.5">Identificação do Solicitante</h2>
          <div className="grid grid-cols-12 gap-x-4 gap-y-0.5">
            <div className="col-span-12 sm:col-span-7 print:col-span-7 space-y-0.5">
              <div className="flex gap-1.5">
                <span className="font-bold w-[62px] shrink-0">Cliente:</span>
                <span className="font-semibold break-words">{dav.cliente_nome || "-"}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[62px] shrink-0">Endereço:</span>
                <span className="break-words">{clienteEndereco}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[62px] shrink-0">CEP:</span>
                <span>{clienteCep}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[62px] shrink-0">Telefone:</span>
                <span>{dav.cliente_telefone || "-"}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[62px] shrink-0">E-mail:</span>
                <span className="break-all">{clienteEmail}</span>
              </div>
            </div>

            <div className="col-span-12 sm:col-span-5 print:col-span-5 space-y-0.5">
              <div className="flex gap-1.5">
                <span className="font-bold w-[72px] shrink-0">CPF/CNPJ:</span>
                <span>{dav.cliente_cnpj || "-"}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[72px] shrink-0">Bairro:</span>
                <span className="break-words">{clienteBairro}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[72px] shrink-0">Cidade/UF:</span>
                <span className="break-words">
                  {clienteCidade}
                  {clienteUf && clienteUf !== "-" ? ` / ${clienteUf}` : ""}
                </span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[72px] shrink-0">Pagamento:</span>
                <span className="break-words">{pagInfo}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-bold w-[72px] shrink-0">Frete/Prazo:</span>
                <span className="break-words">
                  {freteInfo} | {prazoInfo}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. RELAÇÃO DE PRODUTOS / SERVIÇOS */}
        <div className="mt-2.5">
          <h2 className="font-bold text-xs mb-1">Relação de Produtos/Serviços</h2>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="dav-table w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border-y border-black text-black">
                  <th className="py-1 px-1.5 text-left font-bold w-16">Código</th>
                  <th className="py-1 px-1.5 text-left font-bold">Descrição</th>
                  <th className="py-1 px-1.5 text-right font-bold w-16">Qtd</th>
                  <th className="py-1 px-1.5 text-center font-bold w-10">Med</th>
                  <th className="py-1 px-1.5 text-right font-bold w-20">Unitário</th>
                  <th className="py-1 px-1.5 text-right font-bold w-16">Desconto</th>
                  <th className="py-1 px-1.5 text-right font-bold w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {itens.map((it, idx) => {
                  const qtdNum = Number(it.qtd || it.quantidade || 1);
                  const unitNum = Number(it.valor_unitario || 0);
                  const totNum = Number(it.total ?? it.subtotal ?? qtdNum * unitNum);
                  const descItem = Math.max(0, qtdNum * unitNum - totNum);
                  const med = formatUnidadeMedida(
                    it.unidade_medida || it.produto?.unidade_medida || it.produtos?.unidade_medida,
                  );

                  return (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      <td className="py-1 px-1.5 font-mono font-bold whitespace-nowrap">
                        {it.codigo || "-"}
                      </td>
                      <td className="py-1 px-1.5 font-medium">{it.produto}</td>
                      <td className="py-1 px-1.5 text-right tabular-nums whitespace-nowrap">
                        {formatBrDecimal(qtdNum)}
                      </td>
                      <td className="py-1 px-1.5 text-center whitespace-nowrap">{med}</td>
                      <td className="py-1 px-1.5 text-right tabular-nums whitespace-nowrap">
                        {formatBrDecimal(unitNum)}
                      </td>
                      <td className="py-1 px-1.5 text-right tabular-nums whitespace-nowrap">
                        {formatBrDecimal(descItem)}
                      </td>
                      <td className="py-1 px-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                        {formatBrDecimal(totNum)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. CONDIÇÕES COMERCIAIS, VENCIMENTOS E TOTAIS */}
        <div className="border border-black mt-3 grid grid-cols-12 no-break">
          <div className="col-span-12 sm:col-span-8 print:col-span-8 p-2.5 border-b sm:border-b-0 sm:border-r print:border-b-0 print:border-r border-black space-y-1">
            <p className="font-bold">Condições de Pagamento / Vencimentos</p>
            <p>
              <span className="font-semibold">Pagamento:</span> {pagInfo}
            </p>
            {vencList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-4 gap-y-0.5 font-bold">
                {vencList.map((v: any, idx: number) => {
                  const d = typeof v === "object" && v !== null ? v.data : v;
                  const valParcela = calcularValorParcela(v, idx, vencList.length, totalDoc);
                  return (
                    <span key={idx} className="whitespace-nowrap">
                      {idx + 1}ª: {formatarDataBr(d)}
                      {valParcela > 0 ? ` — R$ ${formatBrDecimal(valParcela)}` : ""}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p>
                <span className="font-semibold">Vencimento:</span> ___ / ___ / ______
              </p>
            )}
            <p>
              <span className="font-semibold">Frete:</span> {freteInfo} &nbsp;|&nbsp;{" "}
              <span className="font-semibold">Prazo:</span> {prazoInfo}
            </p>
            {dav.observacoes && (
              <p>
                <span className="font-semibold">Obs.:</span> {dav.observacoes}
              </p>
            )}
          </div>

          <div className="col-span-12 sm:col-span-4 print:col-span-4 flex flex-col justify-between">
            <div className="p-2.5 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {formatBrDecimal(subtotalDoc)}</span>
              </div>
              {descontoDoc > 0 && (
                <div className="flex justify-between">
                  <span>Desconto:</span>
                  <span>- R$ {formatBrDecimal(descontoDoc)}</span>
                </div>
              )}
              {freteDoc > 0 && (
                <div className="flex justify-between">
                  <span>Frete:</span>
                  <span>R$ {formatBrDecimal(freteDoc)}</span>
                </div>
              )}
            </div>
            <div className="bg-slate-100 border-t border-black px-2.5 py-2 flex justify-between items-center font-extrabold text-sm tabular-nums">
              <span>TOTAL:</span>
              <span>R$ {formatBrDecimal(totalDoc)}</span>
            </div>
          </div>
        </div>

        {/* 5. ASSINATURAS */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-10 text-[10px] font-bold text-center no-break">
          <div className="px-4">
            <div className="border-t border-black pt-1.5">
              ASSINATURA DO VENDEDOR {dav.vendedor ? `(${String(dav.vendedor).toUpperCase()})` : ""}
            </div>
          </div>
          <div className="px-4">
            <div className="border-t border-black pt-1.5">ASSINATURA DO CLIENTE</div>
          </div>
        </div>

        <p className="text-center text-[9px] text-slate-600 mt-4">
          Documento Auxiliar de Venda — Sem valor fiscal.
        </p>
      </div>
    </div>
  );

}
