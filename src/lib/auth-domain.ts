export const ALLOWED_DOMAIN = "ongchapada.org.br";

export const DOMAIN_ERROR =
  "Apenas e-mails @ongchapada.org.br podem se cadastrar neste sistema.";

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@ongchapada\.org\.br$/.test(e);
}
