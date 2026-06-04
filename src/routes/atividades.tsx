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
import {
  canEdit,
  denyToast,
  getOwnership,
  makeOwnership,
  removeOwnership,
  setOwnership,
  useOwnership,
} from "@/lib/ownershipStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useIbgeAutocomplete,
  useFavoritos,
  useTiposAcao,
} from "@/lib/autocompleteHooks";
import { TipoAcaoSelect } from "@/components/TipoAcaoSelect";
import { LocalComunidadeSelect } from "@/components/LocalComunidadeSelect";

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
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [toDelete, setToDelete] = useState<AtividadeFull | null>(null);
  const [localType, setLocalType] = useState<"comunidade" | "local" | null>(null);
  const { email: currentEmail, name: currentName } = useCurrentUser();
  const editingOwnership = useOwnership("atividade", editingId ?? "");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordenadas.filter((a) => {
      if (q) {
        const proj = projetoMap.get(a.projetoId)?.nome ?? "";
        const matchesQuery = [a.descricao, a.tipo, a.local, a.responsaveis, a.municipio ?? "", proj]
          .join(" ")
          .toLowerCase()
          .includes(q);
        if (!matchesQuery) return false;
      }
      if (dataDe && a.data < dataDe) return false;
      if (dataAte && a.data > dataAte) return false;
      if (selProjeto !== "todos" && a.projetoId !== selProjeto) return false;
      if (selTipo !== "todos" && a.tipo !== selTipo) return false;
      if (selMunicipio !== "todos" && a.municipio !== selMunicipio) return false;
      return true;
    });
  }, [ordenadas, query, projetoMap, dataDe, dataAte, selProjeto, selTipo, selMunicipio]);

  const total = filtered.length;
  const items = filtered.slice(0, visible);
  const hasMore = visible < total;

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, dataDe, dataAte, selProjeto, selTipo, selMunicipio]);

  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    loadTimerRef.current = setTimeout(() => {
      setVisible((v) => Math.min(v + PAGE_SIZE, total));
      setLoading(false);
    }, 200);
  }, [loading, hasMore, total]);

  useEffect(() => {
    return () => {
      if (loadTimerRef.current !== null) clearTimeout(loadTimerRef.current);
    };
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

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
    setOpen(true);
  };

  const openEdit = (a: AtividadeFull) => {
    if (!canEdit("atividade", a.id, currentEmail)) {
      denyToast();
      return;
    }
    setEditingId(a.id);
    setForm(toFormState(a));
    setAnexos(a.anexos ?? []);
    setMunicipioInput("");
    setLocalType(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.projetoId || !form.titulo || !form.data || !form.tipo || !form.descricao) {
      toast.error("Preencha Projeto, Título da Atividade, Data, Tipo de Ação e Descrição.");
      return;
    }
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
        if (!canEdit("atividade", editingId, currentEmail)) {
          denyToast();
          return;
        }
        await updateAtividade(editingId, payload);
        toast.success("Atividade atualizada.");
      } else {
        const newId = await addAtividade(payload);
        setOwnership("atividade", newId, makeOwnership(currentEmail, currentName));
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
    } catch {
      toast.error("Erro ao salvar atividade. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (!canEdit("atividade", toDelete.id, currentEmail)) {
      denyToast();
      setToDelete(null);
      return;
    }
    try {
      await deleteAtividade(toDelete.id);
      removeOwnership("atividade", toDelete.id);
      toast.success("Atividade excluída.");
    } catch {
      toast.error("Erro ao excluir atividade.");
    } finally {
      setToDelete(null);
    }
  };

  const requestDelete = (a: AtividadeFull) => {
    if (!canEdit("atividade", a.id, currentEmail)) {
      denyToast();
      return;
    }
    setToDelete(a);
  };

  return (
    <AppLayout
      title="Registro de Atividades"
      subtitle="Histórico de ações realizadas nos projetos"
      actions={
        <Button className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova Atividade
        </Button>
      }
    >
      {/* ─── FILTROS DE ATIVIDADES ───────────────────────────────────────────── */}
      <Card className="mb-4 border-border/50 bg-card/60 backdrop-blur-sm">
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

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">
              Atividades recentes
            </h3>
            <Badge variant="secondary">
              {items.length} de {total}
            </Badge>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query
                ? "Nenhuma atividade encontrada para esta busca."
                : ordenadas.length === 0
                ? "Carregando atividades..."
                : "Nenhuma atividade registrada ainda."}
            </p>
          ) : (
            <ol className="relative border-l-2 border-border ml-3 space-y-5">
              {items.map((a) => {
                const projeto = projetoMap.get(a.projetoId);
                return (
                  <li key={a.id} className="ml-6">
                    <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-primary border-2 border-background" />
                    <div className="bg-muted/40 rounded-lg p-4 group">
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
                        <div className="ml-auto flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(a)}
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => requestDelete(a)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
                        {(() => {
                          const o = getOwnership("atividade", a.id);
                          return o ? (
                            <span className="ml-auto text-[10px]">
                              Criado por {o.ownerName}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {hasMore && (
            <>
              <div ref={sentinelRef} aria-hidden="true" className="h-1" />
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  {loading ? "Carregando..." : "Carregar mais"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Select value={form.projetoId || undefined} onValueChange={setF("projetoId")}>
                <SelectTrigger>
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
            </div>
            <div className="md:col-span-2">
              <Label>Título da Atividade *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setF("titulo")(e.target.value)}
                placeholder="Ex: Construção de Cisterna"
              />
            </div>
            <div>
              <Label>Data da Atividade *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setF("data")(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo de Ação *</Label>
              <TipoAcaoSelect
                value={form.tipo}
                onValueChange={setF("tipo")}
                disabled={saving}
              />
            </div>

            {/* ── MUNICÍPIO — Autocomplete IBGE ───────────────────────────── */}
            <div>
              <Label>Município</Label>
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
                <div className="relative mt-2">
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
            </div>

            {/* ── LOCAL / COMUNIDADE — Autocomplete unificado ────────────────── */}
            <div>
              <Label>Local / Comunidade</Label>
              <LocalComunidadeSelect
                value={form.local}
                onValueChange={setF("local")}
                localType={localType}
                onLocalTypeChange={setLocalType}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Descrição detalhada *</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setF("descricao")(e.target.value)}
              />
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
            {editingId && editingOwnership && (
              <div className="md:col-span-2">
                <CollaboratorsSection
                  type="atividade"
                  id={editingId}
                  ownership={editingOwnership}
                  currentEmail={currentEmail}
                />
              </div>
            )}
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
