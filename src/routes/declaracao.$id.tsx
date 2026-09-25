import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/declaracao/$id")({
  head: () => ({ meta: [{ title: "Declaração de Conteúdo" }] }),
  component: DeclaracaoConteudo,
});

function DeclaracaoConteudo() {
  const { id } = Route.useParams();
  const [venda, setVenda] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      // Carregar configurações do sistema
      const { data: conf } = await supabase.from("configuracoes").select("*").eq("id", 1).single();
      if (conf) setConfig(conf);

      const { data: v } = await supabase
        .from("vendas")
        .select("*, clientes(*)")
        .eq("id", id)
        .single();
      if (v) setVenda(v);

      const { data: i } = await supabase
        .from("vendas_itens")
        .select("*, produtos(nome)")
        .eq("venda_id", id);
      if (i) setItens(i);

      if (v) {
        setTimeout(() => window.print(), 800);
      }
    }
    loadData();
  }, [id]);

  if (!venda) return <div className="p-8 text-center font-sans">Carregando formulário...</div>;

  const remetente = {
    nome: config?.razao_social || "GARDEN PLUS LTDA",
    endereco: config?.endereco || "MATEUS RODRIGUES DA COSTA 327, JARDIM SANTA RITA",
    cidade: "Charqueada",
    uf: "SP",
    cep: "13518-482",
    cpf_cnpj: config?.cnpj || "50.387.381/0001-81",
  };

  const destinatario = venda.clientes || {};

  // Forçar mínimo de 6 linhas na tabela de itens
  const rows = [...itens];
  while (rows.length < 6) {
    rows.push(null);
  }

  const totalQtd = itens.reduce((acc, item) => acc + (item.quantidade || 0), 0);
  const totalVal = itens.reduce((acc, item) => acc + (item.subtotal || 0), 0);

  return (
    <div className="bg-white text-black font-sans text-[12px] p-6 max-w-[850px] mx-auto print:p-0 print:max-w-none">
      {/* HEADER */}
      <div className="border border-black font-bold text-center py-1 mb-2">
        DECLARAÇÃO DE CONTEÚDO
      </div>

      {/* REMETENTE / DESTINATÁRIO */}
      <table className="w-full border-collapse border border-black mb-2 table-fixed">
        <tbody>
          <tr>
            <td className="w-1/2 border border-black font-bold text-center py-0.5">REMETENTE</td>
            <td className="w-1/2 border border-black font-bold text-center py-0.5">DESTINATÁRIO</td>
          </tr>
          <tr>
            <td className="w-1/2 border border-black p-0 align-top">
              <div className="flex px-1 border-b border-black">
                <span>NOME:</span> <span className="ml-1 truncate">{remetente.nome}</span>
              </div>
              <div className="flex px-1 border-b border-black">
                <span>ENDEREÇO:</span> <span className="ml-1 truncate">{remetente.endereco}</span>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[75%] px-1 border-r border-black flex">
                  <span>CIDADE:</span> <span className="ml-1 truncate">{remetente.cidade}</span>
                </div>
                <div className="w-[25%] px-1 flex">
                  <span>UF:</span> <span className="ml-1">{remetente.uf}</span>
                </div>
              </div>
              <div className="flex">
                <div className="w-[40%] px-1 border-r border-black flex">
                  <span>CEP:</span> <span className="ml-1 truncate">{remetente.cep}</span>
                </div>
                <div className="w-[60%] px-1 flex">
                  <span>CNPJ/CPF:</span> <span className="ml-1 truncate">{remetente.cpf_cnpj}</span>
                </div>
              </div>
            </td>
            <td className="w-1/2 border border-black p-0 align-top">
              <div className="flex px-1 border-b border-black">
                <span>NOME:</span>{" "}
                <span className="ml-1 truncate">{destinatario.nome || "Não informado"}</span>
              </div>
              <div className="flex px-1 border-b border-black">
                <span>ENDEREÇO:</span>{" "}
                <span className="ml-1 truncate">
                  {destinatario.endereco || "Não informado"}, {destinatario.numero} -{" "}
                  {destinatario.bairro}
                </span>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[75%] px-1 border-r border-black flex">
                  <span>CIDADE:</span>{" "}
                  <span className="ml-1 truncate">{destinatario.cidade || "-"}</span>
                </div>
                <div className="w-[25%] px-1 flex">
                  <span>UF:</span> <span className="ml-1">{destinatario.uf || "-"}</span>
                </div>
              </div>
              <div className="flex">
                <div className="w-[40%] px-1 border-r border-black flex">
                  <span>CEP:</span> <span className="ml-1 truncate">{destinatario.cep || "-"}</span>
                </div>
                <div className="w-[60%] px-1 flex">
                  <span>CNPJ/CPF:</span>{" "}
                  <span className="ml-1 truncate">{destinatario.cpf_cnpj || "-"}</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* IDENTIFICAÇÃO DOS BENS */}
      <table className="w-full border-collapse border border-black mb-2 table-fixed">
        <thead>
          <tr>
            <th colSpan={4} className="border border-black text-center py-1 font-bold">
              IDENTIFICAÇÃO DOS BENS
            </th>
          </tr>
          <tr className="text-center font-bold">
            <th className="border border-black w-[10%] py-0.5">ITEM</th>
            <th className="border border-black w-[60%] py-0.5">CONTEÚDO</th>
            <th className="border border-black w-[15%] py-0.5">QUANTIDADE</th>
            <th className="border border-black w-[15%] py-0.5">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={index}>
              <td className="border border-black text-center py-0.5 h-[22px]">
                {item ? index + 1 : ""}
              </td>
              <td className="border border-black px-1 truncate">
                {item ? item.produtos?.nome || `Item #${item.produto_id.substring(0, 6)}` : ""}
              </td>
              <td className="border border-black text-center">{item ? item.quantidade : ""}</td>
              <td className="border border-black text-right px-1">
                {item ? Number(item.subtotal).toFixed(2) : ""}
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan={2}
              className="border border-black bg-gray-200 font-bold text-right pr-2 py-0.5"
              style={{
                backgroundColor: "#e5e7eb",
                WebkitPrintColorAdjust: "exact",
                colorAdjust: "exact",
              }}
            >
              TOTAIS
            </td>
            <td className="border border-black text-center">{totalQtd}</td>
            <td className="border border-black text-right px-1">{totalVal.toFixed(2)}</td>
          </tr>
          <tr>
            <td
              colSpan={2}
              className="border border-black bg-gray-200 font-bold text-right pr-2 py-0.5"
              style={{
                backgroundColor: "#e5e7eb",
                WebkitPrintColorAdjust: "exact",
                colorAdjust: "exact",
              }}
            >
              PESO TOTAL(Kg)
            </td>
            <td colSpan={2} className="border border-black"></td>
          </tr>
        </tbody>
      </table>

      {/* DECLARAÇÃO */}
      <div className="border border-black mb-2 flex flex-col min-h-[180px]">
        <div className="font-bold text-center py-1 border-b border-black">DECLARAÇÃO</div>
        <div className="p-2 text-justify flex-1">
          Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei
          Complementar nº 87/1996, uma vez que não realizo, com habitualidade ou em volume que
          caracterize intuito comercial, operações de circulação de mercadoria, ainda que se iniciem
          no exterior, ou estou dispensado da emissão da nota fiscal por força da legislação
          tributária vigente, responsabilizando-me, nos termos da lei e a quem de direito, por
          informações inverídicas.
          <br />
          Declaro ainda que não estou postando conteúdo inflamável, explosivo, causador de combustão
          espontânea, tóxico, corrosivo, gás ou qualquer outro conteúdo que constitua perigo,
          conforme o art. 13 da Lei Postal nº 6.538/78
        </div>

        <div className="flex justify-between items-end px-8 pb-4 mt-6">
          <div className="flex items-end gap-1">
            <div className="border-b border-black w-32 text-center pb-1">
              {remetente.cidade} - {remetente.uf}
            </div>
            <div className="pb-1">,</div>
            <div className="border-b border-black w-8 pb-1"></div>
            <div className="pb-1">de</div>
            <div className="border-b border-black w-24 pb-1"></div>
            <div className="pb-1">de</div>
            <div className="border-b border-black w-12 pb-1 text-center">
              {new Date().getFullYear()}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="border-b border-black w-72 h-8"></div>
            <div className="text-[10px] mt-1">Assinatura do Declarante/Remetente</div>
          </div>
        </div>
      </div>

      {/* OBSERVAÇÃO */}
      <div className="border border-black p-1 leading-tight">
        <span className="font-bold">
          OBSERVAÇÃO:
          <br />
        </span>
        Constitui crime contra a ordem tributária suprimir ou reduzir tributo,ou contribuição social
        de qualquer acessório (Lei8.137/90 Art1,V).
      </div>

      {/* BOTAO IMPRIMIR (ESCONDIDO NA IMPRESSÃO) */}
      <div className="mt-8 text-center print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-black text-white px-6 py-2 rounded font-bold hover:bg-gray-800 transition-colors"
        >
          Imprimir Declaração
        </button>
      </div>
    </div>
  );
}
