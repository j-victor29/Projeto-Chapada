export interface DirectoryUser {
  email: string;
  name: string;
}

export const DIRECTORY: DirectoryUser[] = [
  { email: "teste@ongchapada.org.br", name: "Usuário Teste" },
  { email: "maria@chapada.org.br", name: "Maria Conceição" },
  { email: "jose.pedro@chapada.org.br", name: "José Pedro Lima" },
  { email: "ana@chapada.org.br", name: "Ana Beatriz Souza" },
  { email: "carlos@chapada.org.br", name: "Carlos Henrique" },
  { email: "lucia@chapada.org.br", name: "Lúcia Ferreira" },
];

export const findUsers = (q: string): DirectoryUser[] => {
  const s = q.trim().toLowerCase();
  if (!s) return DIRECTORY;
  return DIRECTORY.filter(
    (u) => u.email.toLowerCase().includes(s) || u.name.toLowerCase().includes(s),
  );
};

export const userNameByEmail = (email?: string | null): string => {
  if (!email) return "";
  const u = DIRECTORY.find((x) => x.email.toLowerCase() === email.toLowerCase());
  return u?.name ?? email.split("@")[0];
};
