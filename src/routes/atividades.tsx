import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Paperclip,
  Calendar,
  MapPin,
  User,
  ChevronDown,
  X,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Search,
  Filter,
  Users,
} from "lucide-react";
import { formatDate } from "@/lib/mockData";
import { Municipios } from "@/lib/cadastrosStore";
import {
  addAtividade,
  deleteAtividade,
  updateAtividade,
  useAtividades,
  type AtividadeFull,
} from "@/lib/atividadesStore";
import { useProjetos } from "@/lib/projetosStore";
import { addNotification } from "@/lib/notificationsStore";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { useRegistroPermissao } from "@/hooks/useRegistroPermissao";
import { CollaboratorsModal } from "@/components/CollaboratorsModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { PaginationControls } from "@/components/PaginationControls";
import {
  useIbgeAutocomplete,
  useFavoritos,
  useTiposAcao,
} from "@/lib/autocompleteHooks";
import { TipoAcaoSelect } from "@/components/TipoAcaoSelect";
import { LocalComunidadeSelect } from "@/components/LocalComunidadeSelect";
import { useFormValidation } from "@/hooks/useFormValidation";

export const Route = createFileRoute("/atividades")({
  component: () => (
    <Suspense
      fallback={
        <AppLayout title="Atividades" subtitle="Registro de atividades e indicadores">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </AppLayout>
      }
    >
      <AtividadesPage />
    </Suspense>
  ),
});

const PAGE_SIZE = 10;

interface Anexo {
  nome: string;
  dataUrl: string;
}

const emptyForm = {
  projetoId: "",
  titulo: "",
  data: "",
  tipo: "",
  descricao: "",
  local: "",
  municipio: "",
  responsaveis: "",
  participantes: "",
  mulheres: "",
  jovens: "",
  quilombolas: "",
  povosOriginarios: "",
  comunidadesTradicionais: "",
  tecnologiasSociais: "",
};

type FormState = typeof emptyForm;

const intOrUndef = (s: string) => {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const toFormState = (a: AtividadeFull): FormState => ({
  projetoId: a.projetoId,
  titulo: a.titulo ?? "",
  data: a.data,
  tipo: a.tipo,
  descricao: a.descricao,
  local: a.local,
  municipio: a.municipio ?? "",
  responsaveis: a.responsaveis,
  participantes: String(a.indicadores?.participantes ?? ""),
  mulheres: String(a.indicadores?.mulheres ?? ""),
  jovens: String(a.indicadores?.jovens ?? ""),
  quilombolas: String(a.indicadores?.quilombolas ?? ""),
  povosOriginarios: String(a.indicadores?.povosOriginarios ?? ""),
  comunidadesTradicionais: String(a.indicadores?.comunidadesTradicionais ?? ""),
  tecnologiasSociais: String(a.indicadores?.tecnologiasSociais ?? ""),
});

function AtividadesPage() {
  const ordenadas = useAtividades();
  const { data: dbMunicipios = [] } = Municipios.useList();
  const projetos = useProjetos();
  const { query } = useGlobalSearch();
  const queryClient = useQueryClient();

  // ── Estados de Filtro local ──────────────────────────────────────────────
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [selProjeto, setSelProjeto] = useState("todos");
  const [selTipo, setSelTipo] = useState("todos");
  const [selMunicipio, setSelMunicipio] = useState("todos");

  const { tipos: dbTiposAcao = [] } = useTiposAcao();

  const hasActiveFilters = useMemo(() => {
    return (
      dataDe !== "" ||
      dataAte !== "" ||
      selProjeto !== "todos" ||
      selTipo !== "todos" ||
      selMunicipio !== "todos"
    );
  }, [dataDe, dataAte, selProjeto, selTipo, selMunicipio]);

  const isPeriodInvalid = !!(dataDe && dataAte && dataDe > dataAte);

  const clearFilters = () => {
    setDataDe("");
    setDataAte("");
    setSelProjeto("todos");
    setSelTipo("todos");
    setSelMunicipio("todos");
  };
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Validation rules using useFormValidation
  const validationRules = useMemo(() => ({
    required: ["projetoId", "titulo", "data", "tipo", "descricao", "municipio", "local"],
    minChars: {
      titulo: { min: 3, message: "O título deve ter pelo menos 3 caracteres" },
      descricao: { min: 3, message: "A descrição deve ter pelo menos 3 caracteres" },
    },
    custom: [
      (values: any, errors: Record<string, string>) => {
        if (values.data) {
          const dataAtividade = new Date(values.data);
          const umAnoFuturo = new Date();
          umAnoFuturo.setFullYear(umAnoFuturo.getFullYear() + 1);
          if (dataAtividade > umAnoFuturo) {
            errors.data = "A data não pode ser superior a 1 ano no futuro";
          }
        }
      }
    ]
  }), []);

  const { isValid, errors: validationErrors } = useFormValidation(form, validationRules);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [toDelete, setToDelete] = useState<AtividadeFull | null>(null);
  const [localType, setLocalType] = useState<"comunidade" | "local" | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return data || [];
    }
  });
  const profilesMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  // ── Hook de Favoritos ────────────────────────────────────────────────────
  const { favoritos, isFavorito } = useFavoritos();

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const favNomes = favoritos.filter((f: any) => f.tipo === "municipio").map((f: any) => f.item_nome);
      if (favNomes.length === 0) return [];
      return favNomes.map((nome: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = dbMunicipios.find((m: any) => m.nome.toLowerCase() === nome.toLowerCase());
        if (found) {
          return {
            id: found.codigo_ibge,
            nome: found.nome,
            microrregiao: { mesorregiao: { UF: { sigla: found.uf } } },
          };
        }
        return { id: nome, nome: nome, microrregiao: { mesorregiao: { UF: { sigla: "" } } } };
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [...munSuggestions].sort((a: any, b: any) => {
      const aFav = isFavorito("municipio", a.nome);
      const bFav = isFavorito("municipio", b.nome);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [municipioInput, munSuggestions, favoritos, dbMunicipios, isFavorito]);

  // Fecha dropdown de município ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
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

  // ── Adicionar Município (IBGE → banco local → form) ──────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addMunicipio = useCallback(async (mun: any) => {
    const ufSigla = mun.microrregiao?.mesorregiao?.UF?.sigla || "";
    const microNome = mun.microrregiao?.nome || "";
    const codigoIbge = String(mun.id);
    const nomeMun = mun.nome;

    setSavingMunicipio(true);
    try {
      const exists = dbMunicipios.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.codigo_ibge === codigoIbge || m.nome.toLowerCase() === nomeMun.toLowerCase()
      );
      if (!exists && ufSigla) {
        await supabase.from("municipios").insert({
          nome: nomeMun,
          uf: ufSigla,
          regiao: microNome,
          codigo_ibge: codigoIbge,
        });
        await queryClient.invalidateQueries({ queryKey: ["municipios"] });
      }
      setForm((f) => ({ ...f, municipio: nomeMun }));
      setMunicipioInput("");
      setShowMunSuggestions(false);
    } catch (err: unknown) {
      toast.error(`Erro ao selecionar município: ${(err as Error).message}`);
    } finally {
      setSavingMunicipio(false);
    }
  }, [dbMunicipios, queryClient]);

  const projetoMap = useMemo(
    () => new Map(projetos.map((p) => [p.id, p])),
    [projetos]
  );

  const [page, setPage] = useState(0);

  // Reset page to 0 on filter change
  useEffect(() => {
    setPage(0);
  }, [dataDe, dataAte, selProjeto, selTipo, selMunicipio, query]);

  const { data: paginatedData, isLoading: isListLoading } = useQuery({
    queryKey: ["atividades-paginated", page, dataDe, dataAte, selProjeto, selTipo, selMunicipio, query],
    queryFn: async () => {
      let qBuilder = supabase
        .from("atividades")
        .select("*, arquivos_midia(*)", { count: "exact" })
        .not("projeto_id", "is", null) as any;

      if (selProjeto !== "todos") {
        qBuilder = qBuilder.eq("projeto_id", selProjeto);
      }
      if (selTipo !== "todos") {
        qBuilder = qBuilder.eq("tipo", selTipo);
      }
      if (selMunicipio !== "todos") {
        qBuilder = qBuilder.eq("municipio", selMunicipio);
      }
      if (dataDe) {
        qBuilder = qBuilder.gte("data", dataDe);
      }
      if (dataAte) {
        qBuilder = qBuilder.lte("data", dataAte);
      }

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        let orFilter = `descricao.ilike.%${q}%,tipo.ilike.%${q}%,local.ilike.%${q}%,responsaveis.ilike.%${q}%,municipio.ilike.%${q}%,titulo.ilike.%${q}%`;
        const matchingProjs = projetos.filter(p => p.nome.toLowerCase().includes(q));
        if (matchingProjs.length > 0) {
          orFilter += `,projeto_id.in.(${matchingProjs.map(p => `"${p.id}"`).join(',')})`;
        }
        qBuilder = qBuilder.or(orFilter);
      }

      qBuilder = qBuilder
        .order("data", { ascending: false })
        .range(page * 20, (page + 1) * 20 - 1);

      const { data, count, error } = await qBuilder;
      if (error) throw error;

      return {
        data: (data ?? []).map((row: any) => ({
          id: row.id,
          projetoId: row.projeto_id ?? "",
          titulo: row.titulo ?? "",
          data: row.data ?? "",
          tipo: row.tipo ?? "",
          descricao: row.descricao ?? "",
          local: row.local ?? "",
          municipio: row.municipio ?? undefined,
          responsaveis: row.responsaveis ?? "",
          indicadores: row.indicadores ?? undefined,
          anexos: row.anexos ?? undefined,
          arquivosMidia: row.arquivos_midia ?? [],
        })),
        count: count ?? 0,
      };
    }
  });

  const handleDownloadAnexo = async (am: any, projetoId?: string) => {
    if (am.tipo_arquivo === 'imagem') {
      window.open(am.url, "_blank");
      return;
    }
    try {
      let queryBuilder = supabase
        .from("documentos")
        .select("storage_path")
        .eq("titulo", am.nome);
      if (projetoId) {
        queryBuilder = queryBuilder.eq("projeto_id", projetoId);
      }
      const { data, error } = await queryBuilder.maybeSingle();
      if (error || !data || !data.storage_path) {
        window.open(am.url, "_blank");
        return;
      }
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("documentos")
        .createSignedUrl(data.storage_path, 60 * 60);
      if (signedErr || !signedData) {
        window.open(am.url, "_blank");
        return;
      }
      window.open(signedData.signedUrl, "_blank");
    } catch (err) {
      console.error("Erro ao baixar anexo:", err);
      window.open(am.url, "_blank");
    }
  };

  const total = paginatedData?.count ?? 0;
  const items = paginatedData?.data ?? [];

  const setF = (k: keyof FormState) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onAnexos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () =>
        setAnexos((arr) => [
          ...arr,
          { nome: file.name, dataUrl: String(reader.result) },
        ]);
      reader.readAsDataURL(file);
    });
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAnexos([]);
    setMunicipioInput("");
    setLocalType(null);
    setFormErrors({});
    setOpen(true);
  };

  const openEdit = (a: AtividadeFull) => {
    setEditingId(a.id);
    setForm(toFormState(a));
    setAnexos(a.anexos ?? []);
    setMunicipioInput("");
    setLocalType(null);
    setFormErrors({});
    setOpen(true);
  };

  const handleSave = async () => {
    if (!isValid) {
      setFormErrors(validationErrors);
      toast.error("Corrija os erros antes de salvar.");
      return;
    }
    setFormErrors({});
    const payload = {
      projetoId: form.projetoId,
      titulo: form.titulo,
      data: form.data,
      tipo: form.tipo,
      descricao: form.descricao,
      local: form.local,
      municipio: form.municipio,
      responsaveis: form.responsaveis,
      anexos,
      indicadores: {
        participantes: intOrUndef(form.participantes),
        mulheres: intOrUndef(form.mulheres),
        jovens: intOrUndef(form.jovens),
        quilombolas: intOrUndef(form.quilombolas),
        povosOriginarios: intOrUndef(form.povosOriginarios),
        comunidadesTradicionais: intOrUndef(form.comunidadesTradicionais),
        tecnologiasSociais: intOrUndef(form.tecnologiasSociais),
      },
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateAtividade(editingId, payload);
        toast.success("Atividade atualizada.");
      } else {
        await addAtividade(payload);
        addNotification({
          type: "atividade",
          title: "Nova atividade cadastrada",
          body: form.descricao.slice(0, 80),
        });
        toast.success("Atividade registrada.");
      }
      setForm(emptyForm);
      setAnexos([]);
      setEditingId(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["atividades-paginated"] });
    } catch {
      toast.error("Erro ao salvar atividade. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteAtividade(toDelete.id);
      toast.success("Atividade excluída.");
      queryClient.invalidateQueries({ queryKey: ["atividades-paginated"] });
    } catch {
      toast.error("Erro ao excluir atividade.");
    } finally {
      setToDelete(null);
    }
  };

  const requestDelete = (a: AtividadeFull) => {
    setToDelete(a);
  };

  return (
    <AppLayout
      title="Registro de Atividades"
      subtitle="Histórico de ações realizadas nos projetos"
      actions={
        <Button className="gap-2 chapada-btn" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova Atividade
        </Button>
      }
    >
      {/* ─── FILTROS DE ATIVIDADES ───────────────────────────────────────────── */}
      <Card className="mb-4 chapada-filter-card">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Período:</span>
              <DatePicker
                value={dataDe}
                onChange={setDataDe}
                hasError={isPeriodInvalid}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <DatePicker
                value={dataAte}
                onChange={setDataAte}
                hasError={isPeriodInvalid}
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros Avançados
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 rounded-sm px-1.5 py-0 text-[10px]">
                      Ativo
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 space-y-4" align="start">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Projeto</Label>
                  <Select value={selProjeto} onValueChange={setSelProjeto}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os projetos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os projetos</SelectItem>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Ação</Label>
                  <Select value={selTipo} onValueChange={setSelTipo}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos de ação</SelectItem>
                      {dbTiposAcao.map((t) => (
                        <SelectItem key={t.id} value={t.nome} className="text-xs">
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Município</Label>
                  <Select value={selMunicipio} onValueChange={setSelMunicipio}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os municípios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os municípios</SelectItem>
                      {dbMunicipios.map((m) => (
                        <SelectItem key={m.id} value={m.nome} className="text-xs">
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">
              Atividades recentes
            </h3>
            <Badge variant="secondary">
              Exibindo {items.length} de {total}
            </Badge>
          </div>

          {isListLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Carregando atividades...
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query
                ? "Nenhuma atividade encontrada para esta busca."
                : "Nenhuma atividade registrada ainda."}
            </p>
          ) : (
            <ol className="relative border-l-2 border-border ml-3 space-y-5">
              {items.map((a: AtividadeFull) => {
                const projeto = projetoMap.get(a.projetoId);
                return (
                  <AtividadeItem
                    key={a.id}
                    a={a}
                    projeto={projeto}
                    openEdit={openEdit}
                    requestDelete={requestDelete}
                    handleDownloadAnexo={handleDownloadAnexo}
                    profilesMap={profilesMap}
                  />
                );
              })}
            </ol>
          )}

          <PaginationControls
            page={page}
            setPage={setPage}
            count={total}
            pageSize={20}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Atividade" : "Nova Atividade"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize os dados da atividade."
                : "Registre uma nova atividade do projeto."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Projeto *</Label>
              <Select
                value={form.projetoId || undefined}
                onValueChange={(v) => { setF("projetoId")(v); if (formErrors.projetoId) setFormErrors(p => ({ ...p, projetoId: "" })); }}
              >
                <SelectTrigger className={formErrors.projetoId ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.length > 0 ? (
                    projetos?.filter(p => p.id && String(p.id).trim() !== "").map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhum projeto</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {formErrors.projetoId && <p className="text-xs text-red-500 mt-1">{formErrors.projetoId}</p>}
            </div>
            <div className="md:col-span-2">
              <Label>Título da Atividade *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setF("titulo")(e.target.value)}
                placeholder="Ex: Construção de Cisterna"
                className={formErrors.titulo ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.titulo && <p className="text-xs text-red-500 mt-1">{formErrors.titulo}</p>}
            </div>
            <div>
              <Label>Data da Atividade *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setF("data")(e.target.value)}
                className={formErrors.data ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.data && <p className="text-xs text-red-500 mt-1">{formErrors.data}</p>}
            </div>
            <div>
              <Label>Tipo de Ação *</Label>
              <TipoAcaoSelect
                value={form.tipo}
                onValueChange={(v) => { setF("tipo")(v); if (formErrors.tipo) setFormErrors(p => ({ ...p, tipo: "" })); }}
                disabled={saving}
                className={formErrors.tipo ? "border-red-500" : ""}
              />
              {formErrors.tipo && <p className="text-xs text-red-500 mt-1">{formErrors.tipo}</p>}
            </div>

            {/* ── MUNICÍPIO — Autocomplete IBGE ───────────────────────────── */}
            <div>
              <Label>Município *</Label>
              {form.municipio ? (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-xs font-medium">
                    {form.municipio}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, municipio: "" }))}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              ) : (
                <div className={`relative mt-2 ${formErrors.municipio ? "[&_input]:border-red-500" : ""}`}>
                  <div className="relative">
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
                      disabled={savingMunicipio}
                    />
                    {(savingMunicipio || munLoading) && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}
                  </div>

                  {showMunSuggestions && (
                    <div
                      ref={munSuggestionsRef}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto"
                    >
                      {displayMunSuggestions.length > 0 ? (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              )}
              {formErrors.municipio && <p className="text-xs text-red-500 mt-1">{formErrors.municipio}</p>}
            </div>

            {/* ── LOCAL / COMUNIDADE — Autocomplete unificado ────────────────── */}
            <div>
              <Label>Local / Comunidade *</Label>
              <LocalComunidadeSelect
                value={form.local}
                onValueChange={(v) => { setF("local")(v); if (formErrors.local) setFormErrors(p => ({ ...p, local: "" })); }}
                localType={localType}
                onLocalTypeChange={setLocalType}
                disabled={saving}
              />
              {formErrors.local && <p className="text-xs text-red-500 mt-1">{formErrors.local}</p>}
            </div>

            <div className="md:col-span-2">
              <Label>Descrição detalhada *</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setF("descricao")(e.target.value)}
                className={formErrors.descricao ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.descricao && <p className="text-xs text-red-500 mt-1">{formErrors.descricao}</p>}
            </div>
            <div className="md:col-span-2">
              <Label>Responsáveis</Label>
              <Input
                value={form.responsaveis}
                onChange={(e) => setF("responsaveis")(e.target.value)}
                placeholder="Nomes separados por vírgula"
              />
            </div>

            <div className="md:col-span-2 mt-2">
              <div className="border-t pt-4">
                <h4 className="font-display font-semibold text-sm mb-3">
                  Indicadores da Atividade
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(
                    [
                      ["participantes", "Participantes (total)"],
                      ["mulheres", "Mulheres"],
                      ["jovens", "Jovens (até 29 anos)"],
                      ["quilombolas", "Público Quilombola"],
                      ["povosOriginarios", "Povos Originários"],
                      ["comunidadesTradicionais", "Comunidades Tradicionais"],
                      ["tecnologiasSociais", "Tecnologias Sociais"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <CurrencyInput
                        step={1}
                        value={form[key] !== "" ? Number(form[key]) : undefined}
                        onChange={(v) =>
                          setF(key)(v !== undefined ? String(v) : "")
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <Label>Anexos (fotos e documentos)</Label>
              <Input type="file" multiple onChange={onAnexos} />
              {anexos.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {anexos.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between bg-muted/40 rounded px-2 py-1"
                    >
                      <span className="truncate">{a.nome}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAnexos((arr) => arr.filter((_, idx) => idx !== i))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Salvar Atividade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir esta atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function AtividadeItem({
  a,
  projeto,
  openEdit,
  requestDelete,
  handleDownloadAnexo,
  profilesMap,
}: {
  a: AtividadeFull;
  projeto: any;
  openEdit: (a: AtividadeFull) => void;
  requestDelete: (a: AtividadeFull) => void;
  handleDownloadAnexo: (am: any, projId?: string) => void;
  profilesMap: Map<string, any>;
}) {
  const { podeEditar, podeExcluir, isCriador } = useRegistroPermissao("atividades", a.id, a.created_by);
  const [colabOpen, setColabOpen] = useState(false);

  const creatorProfile = a.created_by ? profilesMap.get(a.created_by) : null;
  const creatorName = creatorProfile?.full_name || creatorProfile?.email?.split("@")[0] || "Sem dono";

  return (
    <li className="ml-6">
      <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-primary border-2 border-background" />
      <div className="bg-muted/40 hover:bg-muted/60 rounded-xl p-4 group transition-all duration-200 border border-transparent hover:border-border/40">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {projeto && (
            <Badge className="bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15">
              {projeto.nome}
            </Badge>
          )}
          <Badge variant="outline">{a.tipo}</Badge>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(a.data)}
          </span>
          {isCriador && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: "#D4EDDA", color: "#2D5A27" }}
            >
              Seu registro
            </span>
          )}
          <div className="ml-auto flex gap-1">
            {isCriador && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                onClick={() => setColabOpen(true)}
                aria-label="Colaboradores"
              >
                <Users className="h-3.5 w-3.5" />
              </Button>
            )}
            {podeEditar && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                onClick={() => openEdit(a)}
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {podeExcluir && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                onClick={() => requestDelete(a)}
                aria-label="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-1">
          {a.titulo && (
            <h4 className="font-semibold text-sm leading-snug mb-1">{a.titulo}</h4>
          )}
          <p className="text-sm text-muted-foreground">{a.descricao}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {a.municipio ? `${a.municipio} — ${a.local}` : a.local}
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {a.responsaveis}
          </span>
          {a.anexos && a.anexos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {a.anexos.length} anexo(s)
            </span>
          )}
          <span className="ml-auto text-[10px]">
            Criado por: {creatorName}
          </span>
        </div>
        {a.arquivosMidia && a.arquivosMidia.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-border/30">
            {a.arquivosMidia.map((am: any) => (
              <button
                key={am.id}
                type="button"
                onClick={() => handleDownloadAnexo(am, a.projetoId)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-background/50 hover:bg-background border border-border/60 transition-colors text-[11px] font-medium text-foreground hover:text-primary max-w-[200px]"
              >
                <span>{am.tipo_arquivo === 'imagem' ? '📷' : '📄'}</span>
                <span className="truncate">{am.nome}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <CollaboratorsModal
        open={colabOpen}
        onOpenChange={setColabOpen}
        tabela="atividades"
        registroId={a.id}
        createdBy={a.created_by}
        creatorName={creatorName}
      />
    </li>
  );
}
