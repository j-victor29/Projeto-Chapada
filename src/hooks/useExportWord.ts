import { useCallback, useState } from "react";
import { Packer } from "docx";
import { toast } from "sonner";
import {
  gerarDocumentoWord,
  type DadosIndicadores,
} from "@/lib/exportWord";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const filenameHoje = () => {
  const dateIso = new Date().toISOString().slice(0, 10);
  return `relatorio-chapada-${dateIso}.docx`;
};

export async function buscarDadosIndicadores(dados: DadosIndicadores): Promise<DadosIndicadores> {
  return dados;
}

export function useExportWord(dados: DadosIndicadores) {
  const [isExportingWord, setIsExportingWord] = useState(false);

  const handleExportWord = useCallback(async () => {
    setIsExportingWord(true);
    const toastId = toast.loading("Gerando relatório Word...");

    try {
      const dadosIndicadores = await buscarDadosIndicadores(dados);
      const document = gerarDocumentoWord(dadosIndicadores);
      const blob = await Packer.toBlob(document);

      downloadBlob(blob, filenameHoje());
      toast.success("Relatório Word exportado com sucesso.", { id: toastId });
    } catch (error) {
      console.error("[useExportWord] erro ao gerar relatório:", error);
      toast.error("Falha ao gerar o relatório Word.", { id: toastId });
    } finally {
      setIsExportingWord(false);
    }
  }, [dados]);

  return { handleExportWord, isExportingWord };
}
