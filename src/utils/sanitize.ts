// Remove espaços extras no início, fim e entre palavras
export const trimText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

// Capitaliza a primeira letra de cada palavra (para nomes próprios)
export const toTitleCase = (value: string): string =>
  trimText(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

// Normaliza para letras minúsculas e sem acento (para comparações)
export const normalizeForComparison = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Formata valor monetário para número (ex: "R$ 1.200,50" → 1200.50)
export const parseCurrency = (value: string): number =>
  parseFloat(
    value.replace(/[R$\s.]/g, '').replace(',', '.')
  ) || 0;

// Valida e-mail
export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Valida se data está no formato correto e não é inválida
export const isValidDateRange = (start: string, end: string): boolean => {
  const s = new Date(start);
  const e = new Date(end);
  return !isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e;
};
