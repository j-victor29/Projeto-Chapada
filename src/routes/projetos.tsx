import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/PaginationControls";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, X, Loader2, Check, Star, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatBRL,
  formatDate,
  type ProjetoStatus,
} from "@/lib/mockData";
import { Financiadores, Municipios, Comunidades } from "@/lib/cadastrosStore";
import { calcVigenciaProgress } from "@/lib/progress";
import { toast } from "sonner";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { addNotification } from "@/lib/notificationsStore";
import {
  useProjetos,
  addProjeto,
  updateProjeto,
  deleteProjeto,
  type ProjetoDB,
} from "@/lib/projetosStore";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useComunidadesAutocomplete, useIbgeAutocomplete, useFavoritos } from "@/lib/autocompleteHooks";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useRegistroPermissao } from "@/hooks/useRegistroPermissao";
import { CollaboratorsModal } from "@/components/CollaboratorsModal";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { denyToast } from "@/lib/ownershipStore";

export const Route = createFileRoute("/projetos")({
  component: () => (
    <Suspense
      fallback={
        <AppLayout title="Projetos" subtitle="Cadastro e gestão de projetos institucionais">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </AppLayout>
      }
    >
      <ProjetosPage />
    </Suspense>
  ),
});

const STATUS: ProjetoStatus[] = ["Planejamento", "Em execução", "Concluído", "Suspenso"];

const statusVariant: Record<ProjetoStatus, string> = {
  Planejamento: "bg-terracotta/15 text-terracotta border-terracotta/30",
  "Em execução": "bg-savanna/15 text-savanna border-savanna/30",
  Concluído: "bg-primary/10 text-primary border-primary/30",
  Suspenso: "bg-destructive/15 text-destructive border-destructive/30",
};

const emptyProjeto: Omit<ProjetoDB, "id"> = {
  nome: "",
  contrato: "",
  financiador: "",
  inicio: "",
  termino: "",
  valor: 0,
  municipios: [],
  comunidadesAtendidas: [],
  publicoQuant: 0,
  publicoCaract: "",
  status: "Em execução",
};

type EditingState = Omit<ProjetoDB, "id"> & { id?: string };

// ─── Utilitário: Title Case ──────────────────────────────────────────────────
function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}



const PAGE_SIZE = 20;

function ProjetosPage() {
  const projetos = useProjetos();
  const { data: dbFinanciadores = [] } = Financiadores.useList();
  const { data: dbMunicipios = [] } = Municipios.useList();
  const queryClient = useQueryClient();

  const { favoritos, toggleFavorito, isFavorito } = useFavoritos();

  const [search, setSearch] = useState("");
  const { query: globalQuery } = useGlobalSearch();
  const { user } = useAuth();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return data || [];
    }
  });
  const profilesMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const [fFin, setFFin] = useState<string>("todos");
  const [fMun, setFMun] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState>(emptyProjeto);

  // Validation rules using useFormValidation
  const validationRules = useMemo(() => ({
    required: ["nome", "contrato", "financiador", "inicio", "termino", "municipios"],
    minChars: {
      nome: { min: 3, message: "O nome deve ter pelo menos 3 caracteres" },
    },
    currency: ["valor"],
    custom: [
      (values: any, errors: Record<string, string>) => {
        if (values.inicio && values.termino) {
          const s = new Date(values.inicio);
          const e = new Date(values.termino);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
            errors.termino = "A data de término deve ser igual ou posterior à data de início";
          }
        }
        if (values.municipios && values.municipios.length === 0) {
          errors.municipios = "Selecione pelo menos um município";
        }
      }
    ]
  }), []);

  const { isValid, errors: validationErrors } = useFormValidation(editing, validationRules);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Estado: Financiadora inline ──────────────────────────────────────────
  const [showNewFinanciador, setShowNewFinanciador] = useState(false);
  const [newFinanciadorNome, setNewFinanciadorNome] = useState("");
  const [savingFinanciador, setSavingFinanciador] = useState(false);

  // ── Estado: Comunidades autocomplete ────────────────────────────────────
  const [comunidadeInput, setComunidadeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingComunidade, setSavingComunidade] = useState(false);
  const comunidadeInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { suggestions: comunidadeSuggestions, loading: comunidadeLoading } =
    useComunidadesAutocomplete(comunidadeInput);

  const displayComSuggestions = useMemo(() => {
    if (comunidadeInput.trim().length < 2) {
      const favNomes = favoritos.filter((f: any) => f.tipo === "comunidade").map((f: any) => f.item_nome);
      return favNomes.map((nome: string) => ({ id: nome, nome }));
    }
    return [...comunidadeSuggestions].sort((a: any, b: any) => {
      const aFav = isFavorito("comunidade", a.nome);
      const bFav = isFavorito("comunidade", b.nome);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [comunidadeInput, comunidadeSuggestions, favoritos, isFavorito]);

  // ── Estado: Municípios autocomplete ───────────────────────────────────────
  const [municipioInput, setMunicipioInput] = useState("");
  const [showMunSuggestions, setShowMunSuggestions] = useState(false);
  const [savingMunicipio, setSavingMunicipio] = useState(false);
  const municipioInputRef = useRef<HTMLInputElement>(null);
  const munSuggestionsRef = useRef<HTMLDivElement>(null);
  const { suggestions: munSuggestions, loading: munLoading } =
    useIbgeAutocomplete(municipioInput);

  const displayMunSuggestions = useMemo(() => {
    if (municipioInput.trim().length < 2) {
      const favNomes = favoritos.filter((f: any) => f.tipo === "municipio").map((f: any) => f.item_nome);
      if (favNomes.length === 0) return [];
      return favNomes.map((nome: string) => {
        const found = dbMunicipios.find((m: any) => m.nome.toLowerCase() === nome.toLowerCase());
        if (found) {
          return {
            id: found.codigo_ibge,
            nome: found.nome,
            microrregiao: { mesorregiao: { UF: { sigla: found.uf } } }
          };
        }
        return { id: nome, nome: nome, microrregiao: { mesorregiao: { UF: { sigla: "" } } } };
      });
    }
    return [...munSuggestions].sort((a: any, b: any) => {
      const aFav = isFavorito("municipio", a.nome);
      const bFav = isFavorito("municipio", b.nome);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [municipioInput, munSuggestions, favoritos, dbMunicipios, isFavorito]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        comunidadeInputRef.current &&
        !comunidadeInputRef.current.contains(e.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
      if (
        municipioInputRef.current &&
        !municipioInputRef.current.contains(e.target as Node) &&
        munSuggestionsRef.current &&
        !munSuggestionsRef.current.contains(e.target as Node)
      ) {
        setShowMunSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Salvar nova Financiadora ────────────────────────────────────────────
  const saveNewFinanciador = async () => {
    const normalized = toTitleCase(newFinanciadorNome);
    if (!normalized) return;

    setSavingFinanciador(true);
    try {
      // 1. Verificar duplicata (case-insensitive)
      const { data: existing } = await supabase
        .from("financiadores")
        .select("id, nome")
        .ilike("nome", normalized)
        .limit(1);

      let financiadorId: string;
      let financiadorNome: string;

      if (existing && existing.length > 0) {
        // Já existe — vincular ao existente
        financiadorId = existing[0].id;
        financiadorNome = existing[0].nome;
        toast.info(`Instituição "${financiadorNome}" já existe — selecionada automaticamente.`);
      } else {
        // Nova — inserir
        const { data: inserted, error } = await supabase
          .from("financiadores")
          .insert({ nome: normalized })
          .select("id, nome")
          .single();

        if (error || !inserted) throw error ?? new Error("Falha ao salvar instituição.");
        financiadorId = inserted.id;
        financiadorNome = inserted.nome;
        toast.success(`Instituição "${financiadorNome}" adicionada com sucesso.`);
      }

      // Invalidar cache e selecionar no form
      await queryClient.invalidateQueries({ queryKey: ["financiadores"] });
      setEditing((prev) => ({
        ...prev,
        financiadorId,
        financiador: financiadorNome,
      }));
      setShowNewFinanciador(false);
      setNewFinanciadorNome("");
    } catch (err: any) {
      toast.error(`Erro ao salvar instituição: ${err.message}`);
    } finally {
      setSavingFinanciador(false);
    }
  };

  // ── Adicionar Município (IBGE) ──────────────────────────────────────────
  const addMunicipio = useCallback(
    async (mun: any) => {
      const ufSigla = mun.microrregiao?.mesorregiao?.UF?.sigla || "";
      const microNome = mun.microrregiao?.nome || "";
      const codigoIbge = String(mun.id);
      const nomeMun = mun.nome;

      if ((editing.municipios ?? []).includes(nomeMun)) {
        toast.info("Município já adicionado ao projeto.");
        setMunicipioInput("");
        setShowMunSuggestions(false);
        return;
      }

      setSavingMunicipio(true);
      try {
        // Verificar se existe na tabela local
        const exists = dbMunicipios.find(
          (m) => m.codigo_ibge === codigoIbge || m.nome.toLowerCase() === nomeMun.toLowerCase()
        );

        if (!exists) {
          // Salvar na tabela municipios
          await supabase.from("municipios").insert({
            nome: nomeMun,
            uf: ufSigla,
            regiao: microNome,
            codigo_ibge: codigoIbge,
          });
          await queryClient.invalidateQueries({ queryKey: ["municipios"] });
        }

        setEditing((prev) => ({
          ...prev,
          municipios: [...(prev.municipios ?? []), nomeMun],
        }));

        setMunicipioInput("");
        setShowMunSuggestions(false);
      } catch (err: any) {
        toast.error(`Erro ao adicionar município: ${err.message}`);
      } finally {
        setSavingMunicipio(false);
      }
    },
    [editing.municipios, dbMunicipios, queryClient]
  );

  const removeMunicipioTag = (m: string) => {
    setEditing((prev) => ({
      ...prev,
      municipios: (prev.municipios ?? []).filter((x) => x !== m),
    }));
  };

  // ── Adicionar Comunidade (autocomplete/nova) ─────────────────────────────
  const addComunidade = useCallback(
    async (nomeRaw: string) => {
      const normalized = toTitleCase(nomeRaw);
      if (!normalized) return;

      // Verificar se já está na lista de selecionadas
      if ((editing.comunidadesAtendidas ?? []).includes(normalized)) {
        toast.info("Comunidade já adicionada ao projeto.");
        setComunidadeInput("");
        setShowSuggestions(false);
        return;
      }

      setSavingComunidade(true);
      try {
        // Verificar se existe no banco
        const { data: existing } = await supabase
          .from("comunidades")
          .select("id, nome")
          .ilike("nome", normalized)
          .limit(1);

        if (existing && existing.length > 0) {
          // Existe — vincular ao existente (sem criar duplicata)
          toast.info(
            `Comunidade já cadastrada — vinculando ao registro existente.`,
            { duration: 2000 }
          );
          setEditing((prev) => ({
            ...prev,
            comunidadesAtendidas: [...(prev.comunidadesAtendidas ?? []), existing[0].nome],
          }));
        } else {
          // Nova — salvar no banco com criado_via: "projeto"
          const { data: inserted, error } = await supabase
            .from("comunidades")
            .insert({ nome: normalized, criado_via: "projeto" })
            .select("id, nome")
            .single();

          if (error || !inserted) throw error ?? new Error("Falha ao salvar comunidade.");

          // Invalidar cache de comunidades
          await queryClient.invalidateQueries({ queryKey: ["comunidades"] });
          setEditing((prev) => ({
            ...prev,
            comunidadesAtendidas: [...(prev.comunidadesAtendidas ?? []), inserted.nome],
          }));
        }

        setComunidadeInput("");
        setShowSuggestions(false);
      } catch (err: any) {
        toast.error(`Erro ao adicionar comunidade: ${err.message}`);
      } finally {
        setSavingComunidade(false);
      }
    },
    [editing.comunidadesAtendidas, queryClient]
  );

  const removeComunidadeTag = (c: string) => {
    setEditing((prev) => ({
      ...prev,
      comunidadesAtendidas: (prev.comunidadesAtendidas ?? []).filter((x) => x !== c),
    }));
  };

  const filtered = useMemo(() => {
    const gq = globalQuery.trim().toLowerCase();
    return projetos.filter((p) => {
      if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (
        gq &&
        ![p.nome, p.contrato, p.financiador, p.publicoCaract, p.municipios.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(gq)
      )
        return false;
      if (fFin !== "todos" && p.financiador !== fFin) return false;
      if (fMun !== "todos" && !p.municipios.includes(fMun)) return false;
      if (fStatus !== "todos" && p.status !== fStatus) return false;
      return true;
    });
  }, [projetos, search, globalQuery, fFin, fMun, fStatus]);

  // Resetar página ao mudar filtros
  const prevFilters = useRef({ search, globalQuery, fFin, fMun, fStatus });
  useEffect(() => {
    const prev = prevFilters.current;
    if (
      prev.search !== search ||
      prev.globalQuery !== globalQuery ||
      prev.fFin !== fFin ||
      prev.fMun !== fMun ||
      prev.fStatus !== fStatus
    ) {
      setPage(0);
      prevFilters.current = { search, globalQuery, fFin, fMun, fStatus };
    }
  }, [search, globalQuery, fFin, fMun, fStatus]);

  const paginatedFiltered = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  const openNew = () => {
    setEditing({ ...emptyProjeto });
    setShowNewFinanciador(false);
    setNewFinanciadorNome("");
    setComunidadeInput("");
    setFormErrors({});
    setOpen(true);
  };
  const openEdit = (p: ProjetoDB) => {
    setEditing(p);
    setShowNewFinanciador(false);
    setNewFinanciadorNome("");
    setComunidadeInput("");
    setFormErrors({});
    setOpen(true);
  };

  const { podeEditar: canSave } = useRegistroPermissao("projetos", editing?.id, editing?.created_by);

  const save = async () => {
    if (!isValid) {
      setFormErrors(validationErrors);
      toast.error("Corrija os erros antes de salvar.");
      return;
    }

    if (editing.id && !canSave) {
      denyToast();
      return;
    }

    // ── Verificação de duplicata: número de contrato ─────────────────────────
    if (editing.contrato?.trim()) {
      const contratoNormalizado = editing.contrato.trim().toUpperCase();
      const { data: existing } = await supabase
        .from("projetos")
        .select("id, nome")
        .ilike("contrato", contratoNormalizado)
        .limit(1);

      if (existing && existing.length > 0 && existing[0].id !== editing.id) {
        setFormErrors((prev) => ({
          ...prev,
          contrato: `Já existe um projeto com este número de contrato: "${existing[0].nome}".`,
        }));
        toast.error("Número de contrato já cadastrado.");
        return;
      }
    }

    setFormErrors({});
    setSaving(true);
    try {
      if (editing.id) {
        await updateProjeto(editing.id, editing);
        toast.success("Projeto atualizado.");
      } else {
        await addProjeto(editing as Omit<ProjetoDB, "id">);
        addNotification({ type: "projeto", title: "Novo projeto cadastrado", body: editing.nome });
        toast.success("Projeto cadastrado.");
      }
      setOpen(false);
    } catch (err: any) {
      // Trata violação de unique constraint do banco (código 23505)
      if (err?.code === "23505" && err?.message?.includes("contrato")) {
        setFormErrors((prev) => ({ ...prev, contrato: "Número de contrato já cadastrado no banco de dados." }));
        toast.error("Número de contrato duplicado.");
      } else {
        toast.error("Erro ao salvar projeto. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteProjeto(id);
      toast.success("Projeto removido.");
    } catch {
      toast.error("Erro ao remover projeto.");
    }
  };

  return (
    <AppLayout
      title="Projetos"
      subtitle="Cadastro e acompanhamento de projetos institucionais"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2 chapada-btn">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="md:col-span-2">
                <Label>Nome do Projeto *</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  className={formErrors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {formErrors.nome && <p className="text-xs text-red-500 mt-1">{formErrors.nome}</p>}
              </div>
              <div>
                <Label>Nº do Contrato/Convênio *</Label>
                <Input
                  value={editing.contrato}
                  onChange={(e) => setEditing({ ...editing, contrato: e.target.value })}
                  className={formErrors.contrato ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {formErrors.contrato && <p className="text-xs text-red-500 mt-1">{formErrors.contrato}</p>}
              </div>

              {/* ── FINANCIADORA ──────────────────────────────────────────── */}
              <div>
                <Label>Instituição Financiadora *</Label>
                <Select
                  value={showNewFinanciador ? "__add_new__" : (editing.financiadorId || undefined)}
                  onValueChange={(v) => {
                    if (v === "__add_new__") {
                      setShowNewFinanciador(true);
                      return;
                    }
                    setShowNewFinanciador(false);
                    const selectedFin = dbFinanciadores.find((f) => f.id === v);
                    setEditing({
                      ...editing,
                      financiadorId: v,
                      financiador: selectedFin?.nome ?? "",
                    });
                    if (formErrors.financiador) setFormErrors(prev => ({ ...prev, financiador: "" }));
                  }}
                >
                  <SelectTrigger className={formErrors.financiador ? "border-red-500" : ""}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbFinanciadores.length > 0 ? (
                      dbFinanciadores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>Nenhum financiador</SelectItem>
                    )}
                    <SelectItem value="__add_new__" className="text-primary font-medium border-t mt-1 pt-2">
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar nova instituição
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.financiador && <p className="text-xs text-red-500 mt-1">{formErrors.financiador}</p>}

                {/* Campo inline para nova financiadora */}
                {showNewFinanciador && (
                  <div className="mt-2 flex gap-2 items-center animate-in slide-in-from-top-1 duration-150">
                    <Input
                      autoFocus
                      placeholder="Nome da instituição"
                      value={newFinanciadorNome}
                      onChange={(e) => setNewFinanciadorNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); saveNewFinanciador(); }
                        if (e.key === "Escape") { setShowNewFinanciador(false); setNewFinanciadorNome(""); }
                      }}
                      className="text-sm flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveNewFinanciador}
                      disabled={savingFinanciador || !newFinanciadorNome.trim()}
                      className="shrink-0 gap-1.5"
                    >
                      {savingFinanciador ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0"
                      onClick={() => { setShowNewFinanciador(false); setNewFinanciadorNome(""); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={editing.inicio}
                  onChange={(e) => setEditing({ ...editing, inicio: e.target.value })}
                  className={formErrors.inicio ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {formErrors.inicio && <p className="text-xs text-red-500 mt-1">{formErrors.inicio}</p>}
              </div>
              <div>
                <Label>Data de Término *</Label>
                <Input
                  type="date"
                  value={editing.termino}
                  onChange={(e) => setEditing({ ...editing, termino: e.target.value })}
                  className={formErrors.termino ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {formErrors.termino && <p className="text-xs text-red-500 mt-1">{formErrors.termino}</p>}
              </div>
              <div>
                <Label>Valor Total (R$)</Label>
                <CurrencyInput
                  value={editing.valor}
                  onChange={(v) => setEditing({ ...editing, valor: v || 0 })}
                />
                {formErrors.valor && <p className="text-xs text-red-500 mt-1">{formErrors.valor}</p>}
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v: ProjetoStatus) => setEditing({ ...editing, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-4">
                {/* ── MUNICÍPIOS — Autocomplete IBGE ──────────────────────────── */}
                <div>
                  <Label>Municípios Atendidos</Label>
                  <div className="relative mt-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          ref={municipioInputRef}
                          value={municipioInput}
                          onChange={(e) => {
                            setMunicipioInput(e.target.value);
                            setShowMunSuggestions(true);
                          }}
                          onFocus={() => setShowMunSuggestions(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setShowMunSuggestions(false);
                          }}
                          placeholder="Buscar município (ex: Araripina)..."
                          className="text-xs pr-8"
                        />
                        {munLoading && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Dropdown de sugestões IBGE */}
                    {showMunSuggestions && (
                      <div
                        ref={munSuggestionsRef}
                        className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto"
                      >
                        {displayMunSuggestions.length > 0 ? (
                          displayMunSuggestions.map((m: any) => {
                            const ufSigla = m.microrregiao?.mesorregiao?.UF?.sigla || "";
                            const isFav = isFavorito("municipio", m.nome);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center justify-between"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addMunicipio(m);
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  {isFav ? (
                                    <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" />
                                  ) : (
                                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="font-medium">{m.nome}</span>
                                  {ufSigla && <span className="text-muted-foreground">— {ufSigla}</span>}
                                </span>
                              </button>
                            );
                          })
                        ) : municipioInput.trim().length >= 2 && !munLoading ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Nenhum município encontrado.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Tags dos municípios selecionados */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {(editing.municipios ?? []).map((m, idx) => {
                      const isFav = isFavorito("municipio", m);
                      return (
                        <Badge key={idx} variant="secondary" className="gap-1 px-2.5 py-1 text-xs font-medium">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorito({ tipo: "municipio", item_nome: m, isFavorito: isFav }); }}
                            className="mr-0.5"
                          >
                            <Star className={`h-3.5 w-3.5 transition-colors ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'}`} />
                          </button>
                          {m}
                          <button
                            type="button"
                            onClick={() => removeMunicipioTag(m)}
                            className="hover:text-destructive text-muted-foreground ml-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Badge>
                      );
                    })}
                    {(editing.municipios ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Nenhum município vinculado a este projeto</span>
                    )}
                  </div>
                  {formErrors.municipios && <p className="text-xs text-red-500 mt-1">{formErrors.municipios}</p>}
                </div>

                {/* ── COMUNIDADES — Campo Híbrido ──────────────────────────── */}
                <div>
                  <Label>Comunidades Atendidas</Label>
                  <div className="relative mt-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          ref={comunidadeInputRef}
                          value={comunidadeInput}
                          onChange={(e) => {
                            setComunidadeInput(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (comunidadeInput.trim()) addComunidade(comunidadeInput);
                            }
                            if (e.key === "Escape") setShowSuggestions(false);
                          }}
                          placeholder="Digite para buscar ou criar comunidade..."
                          className="text-xs pr-8"
                        />
                        {comunidadeLoading && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Dropdown de sugestões */}
                    {showSuggestions && (
                      <div
                        ref={suggestionsRef}
                        className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
                      >
                        {displayComSuggestions.length > 0 ? (
                          displayComSuggestions.map((s: any) => {
                            const isFav = isFavorito("comunidade", s.nome);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addComunidade(s.nome);
                                }}
                              >
                                {isFav ? (
                                  <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" />
                                ) : (
                                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                {s.nome}
                              </button>
                            );
                          })
                        ) : comunidadeInput.trim().length >= 2 && !comunidadeLoading ? (
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 transition-colors flex items-center gap-2 text-primary border-t border-border"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addComunidade(comunidadeInput);
                            }}
                          >
                            <Plus className="h-3 w-3 shrink-0" />
                            Criar "{toTitleCase(comunidadeInput)}"
                          </button>
                        ) : comunidadeInput.trim().length < 2 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground italic">
                            Comece a digitar para buscar comunidades...
                          </div>
                        )}
                        {comunidadeInput.trim().length >= 2 && displayComSuggestions.length > 0 && !displayComSuggestions.some((s: any) => s.nome.toLowerCase() === comunidadeInput.trim().toLowerCase()) && (
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 transition-colors flex items-center gap-2 text-primary border-t border-border"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addComunidade(comunidadeInput);
                            }}
                          >
                            <Plus className="h-3 w-3 shrink-0" />
                            Criar "{toTitleCase(comunidadeInput)}"
                          </button>
                        )}
                      </div>
                    )}


                  </div>

                  {/* Tags das comunidades selecionadas */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {(editing.comunidadesAtendidas ?? []).map((c, idx) => {
                      const isFav = isFavorito("comunidade", c);
                      return (
                        <Badge key={idx} variant="secondary" className="gap-1 px-2.5 py-1 text-xs font-medium">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorito({ tipo: "comunidade", item_nome: c, isFavorito: isFav }); }}
                            className="mr-0.5"
                          >
                            <Star className={`h-3.5 w-3.5 transition-colors ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'}`} />
                          </button>
                          {c}
                          <button
                            type="button"
                            onClick={() => removeComunidadeTag(c)}
                            className="hover:text-destructive text-muted-foreground ml-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Badge>
                      );
                    })}
                    {(editing.comunidadesAtendidas ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Nenhuma comunidade vinculada a este projeto</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label>Público Atendido (quantitativo)</Label>
                <CurrencyInput
                  step={1}
                  value={editing.publicoQuant}
                  onChange={(v) => setEditing({ ...editing, publicoQuant: v || 0 })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Caracterização do Público</Label>
                <Textarea
                  rows={3}
                  value={editing.publicoCaract}
                  onChange={(e) => setEditing({ ...editing, publicoCaract: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 border-t pt-4">
              <CollaboratorsSection
                tabela="projetos"
                registro_id={editing.id || null}
                created_by={editing.created_by || user?.id || null}
              />
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Filters */}
      <Card className="mb-4 chapada-filter-card">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar projeto..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={fFin} onValueChange={setFFin}>
            <SelectTrigger>
              <SelectValue placeholder="Financiador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os financiadores</SelectItem>
              {dbFinanciadores.map((f) => (
                <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fMun} onValueChange={setFMun}>
            <SelectTrigger>
              <SelectValue placeholder="Município" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os municípios</SelectItem>
              {dbMunicipios.map((m) => (
                <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Financiador</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Público</TableHead>
                <TableHead className="text-right">Progresso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedFiltered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    {projetos.length === 0
                      ? "Carregando projetos..."
                      : "Nenhum projeto encontrado com os filtros selecionados."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFiltered.map((p) => (
                  <ProjetoRow
                    key={p.id}
                    p={p}
                    openEdit={openEdit}
                    remove={remove}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <PaginationControls
          page={page}
          setPage={setPage}
          count={filtered.length}
          pageSize={PAGE_SIZE}
        />
      )}
    </AppLayout>
  );
}

function ProjetoRow({
  p,
  openEdit,
  remove,
}: {
  p: ProjetoDB;
  openEdit: (p: ProjetoDB) => void;
  remove: (id: string) => void;
}) {
  const { podeEditar, podeExcluir, isCriador } = useRegistroPermissao("projetos", p.id, p.created_by);
  const [colabOpen, setColabOpen] = useState(false);

  return (
    <TableRow className="hover:bg-muted/50 group">
      <TableCell className="font-medium text-primary">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{p.nome}</span>
          {isCriador && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: "#D4EDDA", color: "#2D5A27" }}
            >
              Seu registro
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>{p.contrato}</TableCell>
      <TableCell>{p.financiador}</TableCell>
      <TableCell>
        {p.inicio ? new Date(p.inicio).toLocaleDateString("pt-BR") : "-"}
      </TableCell>
      <TableCell>
        {p.termino ? new Date(p.termino).toLocaleDateString("pt-BR") : "-"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusVariant[p.status as ProjetoStatus] || ""}>
          {p.status}
        </Badge>
      </TableCell>
      <TableCell>
        {p.publicoQuant > 0 ? p.publicoQuant.toLocaleString("pt-BR") : "-"}
      </TableCell>
      <TableCell className="text-right">
        <Progress value={calcVigenciaProgress(p.inicio, p.termino)} className="w-16 ml-auto" />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {isCriador && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setColabOpen(true)}
              title="Colaboradores"
            >
              <Users className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!podeEditar) {
                denyToast();
                return;
              }
              openEdit(p);
            }}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {podeExcluir ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover Projeto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O projeto &quot;{p.nome}&quot; será
                    removido permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => remove(p.id)}>
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10"
              title="Excluir"
              onClick={() => {
                denyToast();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CollaboratorsModal
          open={colabOpen}
          onOpenChange={setColabOpen}
          tabela="projetos"
          registroId={p.id}
          createdBy={p.created_by}
          creatorName={p.created_by ? "Criador" : "Sem dono"}
        />
      </TableCell>
    </TableRow>
  );
}
