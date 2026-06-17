export const coresPDF = {
  tabelaCabecalho: "#1A9FD4",
  tabelaLinhaPar: "#EAF4FB",
  tabelaLinhaImpar: "#FFFFFF",
  totalDestaque: "#FFF3E0",
  titulo: "#1A3A4A",
  subtitulo: "#1178A8",
  rodape: "#1A9FD4",
  textoRodape: "#FFFFFF",
  texto: "#1A3A4A",
  textoSecundario: "#4A6275",
  borda: "#C4DFF0",
  chart1: "#1A9FD4",
  chart2: "#4CAF50",
  chart3: "#F5A623",
  chart4: "#1178A8",
  chart5: "#88CDEB",
} as const;

export type HexColor = `#${string}`;

export const hexToRgb = (hex: HexColor): [number, number, number] => {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const hexWithoutHash = (hex: HexColor) => hex.replace("#", "");
