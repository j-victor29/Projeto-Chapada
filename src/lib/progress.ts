/**
 * Calcula o percentual decorrido entre as datas de início e término
 * em relação à data atual. Retorna 0 se ainda não começou e 100 se já encerrou.
 */
export function calcVigenciaProgress(inicioISO: string, terminoISO: string): number {
  if (!inicioISO || !terminoISO) return 0;
  const inicio = new Date(inicioISO).getTime();
  const termino = new Date(terminoISO).getTime();
  const agora = Date.now();
  if (Number.isNaN(inicio) || Number.isNaN(termino) || termino <= inicio) return 0;
  if (agora <= inicio) return 0;
  if (agora >= termino) return 100;
  return Math.round(((agora - inicio) / (termino - inicio)) * 100);
}
