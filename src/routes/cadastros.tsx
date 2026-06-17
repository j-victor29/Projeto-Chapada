import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, Suspense, useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PaginationControls } from "@/components/PaginationControls";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Search, X, Loader2, MapPin, Building2, Tag, SearchX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Municipios, Comunidades, Financiadores, Categorias, Publicos, Familias,
  CatalogoTecnologias, LinhasAcao, TiposAcao,
} from "@/lib/cadastrosStore";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { toTitleCase } from "@/lib/autocompleteHooks";
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
import { EmptyState } from "@/components/ui/EmptyState";

export const Route = createFileRoute("/cadastros")({
  component: CadastrosPage,
});


function CadastrosPage() {
  return (
    <AppLayout title="Cadastros institucionais" subtitle="Municípios, comunidades, financiadores, categorias, públicos, famílias e tecnologias">
      <div className="space-y-6">
        <Tabs defaultValue="municipios" className="w-full">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="municipios">Municípios</TabsTrigger>
            <TabsTrigger value="comunidades">Comunidades</TabsTrigger>
            <TabsTrigger value="financiadores">Financiadores</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="publicos">Públicos</TabsTrigger>
            <TabsTrigger value="familias">Famílias</TabsTrigger>
            <TabsTrigger value="tecnologias">Tecnologias</TabsTrigger>
            <TabsTrigger value="tipos_acao">Tipos de Ação</TabsTrigger>
          </TabsList>
          
          <TabsContent value="municipios" className="mt-4"><MunicipiosTab /></TabsContent>
          <TabsContent value="comunidades" className="mt-4"><ComunidadesTab /></TabsContent>
          <TabsContent value="financiadores" className="mt-4"><FinanciadoresTab /></TabsContent>
          <TabsContent value="categorias" className="mt-4"><CategoriasTab /></TabsContent>
          <TabsContent value="publicos" className="mt-4"><PublicosTab /></TabsContent>
          <TabsContent value="familias" className="mt-4"><FamiliasTab /></TabsContent>
          <TabsContent value="tecnologias" className="mt-4"><TecnologiasTab /></TabsContent>
          <TabsContent value="tipos_acao" className="mt-4"><TiposAcaoTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function CrudShell({
  title, items, columns, renderForm, onSave, onDelete, getId, getRowValues, blank, canEdit, canDelete,
  searchExternal, onSearchExternalChange, pagination, validate, emptyState,
}: {
  title: string;
  items: any[] | undefined;
  columns: { label: string; key: string }[];
  renderForm: (state: any, setState: (s: any) => void, errors: Record<string, string>) => React.ReactNode;
  onSave: (s: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  getId: (row: any) => string;
  getRowValues: (row: any) => Record<string, any>;
  blank: any;
  canEdit?: (row: any) => boolean;
  canDelete?: (row: any) => boolean;
  searchExternal?: string;
  onSearchExternalChange?: (s: string) => void;
  pagination?: {
    page: number;
    setPage: (p: number) => void;
    count: number;
    pageSize: number;
  };
  validate?: (state: any) => Record<string, string>;
  emptyState?: {
    icon: ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(blank);
  const [localSearch, setLocalSearch] = useState("");
  const search = useDebounce(localSearch, 300);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPaginated = !!pagination;

  // Sync external search if paginated
  useEffect(() => {
    if (isPaginated && onSearchExternalChange) {
      onSearchExternalChange(search);
    }
  }, [search, isPaginated, onSearchExternalChange]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (isPaginated) return items; // Already filtered and paginated on server
    if (!search.trim()) return items;
    const lowerSearch = search.toLowerCase().trim();
    return items.filter(item => {
      const rowVals = getRowValues(item);
      return columns.some(col => {
        const val = rowVals[col.key];
        return String(val ?? "").toLowerCase().includes(lowerSearch);
      });
    });
  }, [items, search, columns, getRowValues, isPaginated]);
  const hasSearch = search.trim() !== "";
  const clearSearch = () => {
    setLocalSearch("");
    onSearchExternalChange?.("");
  };

  return (
    <Card className="chapada-filter-card shadow-sm">
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-medium text-lg text-foreground/90">{title}</h3>
          
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Buscar...`}
                className="pl-9 bg-muted/20"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>
            
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setDraft(blank); setErrors({}); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 shadow-sm chapada-btn">
                  <Plus className="h-4 w-4" /> Novo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
                <DialogHeader>
                  <DialogTitle>{draft.id ? "Editar" : "Novo"} — {title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">{renderForm(draft, setDraft, errors)}</div>
                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={async () => {
                      if (validate) {
                        const validationErrors = validate(draft);
                        if (Object.keys(validationErrors).length > 0) {
                          setErrors(validationErrors);
                          toast.error("Corrija os erros antes de salvar.");
                          return;
                        }
                      }
                      setErrors({});
                      try {
                        await onSave(draft);
                        toast.success("Registro salvo com sucesso!");
                        setOpen(false);
                        setDraft(blank);
                      } catch (e: any) {
                        if (e?.code === '23505' || e?.message?.includes('23505') || e?.message?.includes('duplicate key')) {
                          toast.error('Já existe um registro com esses dados.');
                        } else {
                          toast.error(e.message ?? "Erro ao salvar o registro");
                        }
                      }
                    }}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border/50">
                {columns.map(c => (
                  <th key={c.key} className="text-left px-4 py-3 font-medium text-muted-foreground">{c.label}</th>
                ))}
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredItems.map((row) => (
                <tr key={getId(row)} className="hover:bg-muted/20 transition-colors">
                  {columns.map(c => (
                    <td key={c.key} className="px-4 py-2.5 font-normal text-foreground/80">
                      {String(getRowValues(row)[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1">
                    {(!canEdit || canEdit(row)) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                        onClick={() => { setDraft({ ...row }); setOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {(!canDelete || canDelete(row)) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        onClick={() => setDeleteId(getId(row))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6">
                    {hasSearch || (items && items.length > 0) ? (
                      <EmptyState
                        icon={<SearchX />}
                        title="Nenhum resultado encontrado"
                        description="Tente ajustar os filtros ou limpar a busca."
                        action={{ label: "Limpar filtros", onClick: clearSearch }}
                        className="border-0"
                      />
                    ) : emptyState ? (
                      <EmptyState
                        icon={emptyState.icon}
                        title={emptyState.title}
                        description={emptyState.description}
                        action={{
                          label: emptyState.actionLabel ?? "Novo",
                          onClick: () => setOpen(true),
                        }}
                        className="border-0"
                      />
                    ) : (
                      <EmptyState
                        icon={<SearchX />}
                        title="Nenhum registro encontrado"
                        className="border-0"
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isPaginated && pagination && (
          <PaginationControls
            page={pagination.page}
            setPage={pagination.setPage}
            count={pagination.count}
            pageSize={pagination.pageSize}
          />
        )}

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent className="rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!deleteId) return;
                  try {
                    await onDelete(deleteId);
                    toast.success("Registro excluído com sucesso!");
                  } catch (e: any) {
                    toast.error(e.message ?? "Erro ao excluir o registro");
                  } finally {
                    setDeleteId(null);
                  }
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

interface IbgeSearchProps {
  state: any;
  onChange: (updated: any) => void;
}

function IbgeMunicipiosSearch({ state, onChange }: IbgeSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [isOpen, setIsOpen] = useState(false);

  const { data: ibgeMunicipios = [], isLoading: loadingIbge } = useQuery({
    queryKey: ["ibge-municipios"],
    queryFn: async () => {
      const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
      if (!res.ok) throw new Error("Erro ao buscar municípios do IBGE");
      return res.json() as Promise<any[]>;
    },
    staleTime: 1000 * 60 * 30, // 30 minutos de cache
  });

  const filtered = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return [];
    const lower = debouncedSearchTerm.toLowerCase().trim();
    return ibgeMunicipios
      .filter((m: any) => {
        const nameMatch = m.nome.toLowerCase().includes(lower);
        const ufMatch = m.microrregiao?.mesorregiao?.UF?.sigla?.toLowerCase() === lower;
        return nameMatch || ufMatch;
      })
      .slice(0, 100); // limite de 100 resultados para performance
  }, [ibgeMunicipios, debouncedSearchTerm]);

  const hasSelection = !!state.codigo_ibge;

  if (hasSelection) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Município Selecionado</span>
            <div className="font-semibold text-sm text-foreground">{state.nome} — {state.estado || state.uf}</div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
            onClick={() => {
              onChange({
                ...state,
                codigo_ibge: "",
                nome: "",
                uf: "",
                estado: "",
                regiao: "",
                microrregiao: ""
              });
              setSearchTerm("");
            }}
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={state.nome ?? ""} readOnly className="bg-muted/40 cursor-not-allowed font-medium" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado (UF)</Label>
            <Input value={state.estado || state.uf || ""} readOnly className="bg-muted/40 cursor-not-allowed font-medium" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Microrregião</Label>
            <Input value={state.microrregiao || state.regiao || ""} readOnly className="bg-muted/40 cursor-not-allowed font-medium" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Código IBGE</Label>
            <Input value={state.codigo_ibge ?? ""} readOnly className="bg-muted/40 cursor-not-allowed font-medium" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      <Label htmlFor="ibge-search-input">Buscar Município (Brasil inteiro)</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="ibge-search-input"
          placeholder={loadingIbge ? "Carregando municípios do Brasil..." : "Digite o nome da cidade (Ex: Ouricuri, Petrolina...)"}
          className="pl-9 pr-8 bg-background"
          value={searchTerm}
          disabled={loadingIbge}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
        />
        {loadingIbge && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!loadingIbge && searchTerm && (
          <button 
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchTerm(""); setIsOpen(false); }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && searchTerm.trim() && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md z-20 divide-y divide-border/55">
            {filtered.length > 0 ? (
              filtered.map((mun: any) => {
                const ufSigla = mun.microrregiao?.mesorregiao?.UF?.sigla || "";
                const microNome = mun.microrregiao?.nome || "";
                return (
                  <button
                    key={mun.id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex justify-between items-center"
                    onClick={() => {
                      onChange({
                        ...state,
                        codigo_ibge: String(mun.id),
                        nome: mun.nome,
                        uf: ufSigla,
                        estado: ufSigla,
                        regiao: microNome,
                        microrregiao: microNome,
                      });
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    <div>
                      <span className="font-medium text-foreground">{mun.nome}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {ufSigla}</span>
                    </div>
                    {microNome && (
                      <span className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full font-normal">
                        {microNome}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                Nenhum município encontrado
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MunicipiosTab() {
  const { data } = Municipios.useList();
  const upsert = Municipios.useUpsert();
  const del = Municipios.useDelete();
  
  return (
    <CrudShell
      title="Municípios"
      items={data}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "UF", key: "uf" },
        { label: "Microrregião", key: "microrregiao" },
        { label: "Código IBGE", key: "codigo_ibge" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => ({ ...r, microrregiao: r.microrregiao || r.regiao || "" })}
      blank={{ nome: "", uf: "", regiao: "", codigo_ibge: "", estado: "", microrregiao: "" }}
      renderForm={(s, set, errors) => (
        <IbgeMunicipiosSearch state={s} onChange={set} />
      )}
      validate={(s) => {
        const errors: Record<string, string> = {};
        if (!s.codigo_ibge) {
          errors.codigo_ibge = "Selecione um município da busca IBGE";
        }
        return errors;
      }}
      onSave={(s) => upsert.mutateAsync(s)}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function ComunidadesTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "comunidade" | "local">("todos");

  const { data: muns } = Municipios.useList();
  const upsert = Comunidades.useUpsert();
  const del = Comunidades.useDelete();

  // Reset page to 0 on filter change
  useEffect(() => {
    setPage(0);
  }, [filter]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(0);
  };

  const { data: paginatedData } = useQuery({
    queryKey: ["comunidades-paginated", page, filter, search],
    queryFn: async () => {
      let qBuilder = supabase
        .from("comunidades")
        .select("*", { count: "exact" });

      if (filter === "comunidade") {
        qBuilder = qBuilder.eq("categoria", "Comunidade");
      } else if (filter === "local") {
        qBuilder = qBuilder.eq("categoria", "Local/Espaço");
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        qBuilder = qBuilder.ilike("nome", `%${q}%`);
      }

      qBuilder = qBuilder
        .order("nome", { ascending: true })
        .range(page * 25, (page + 1) * 25 - 1);

      const { data, count, error } = await qBuilder;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    }
  });

  const communitiesList = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  
  const munMap = useMemo(() => new Map((muns ?? []).map((m) => [m.id, m.nome])), [muns]);
  
  return (
    <div className="space-y-4">
      {/* Filtro superior */}
      <div className="flex gap-2 p-1 bg-muted/30 w-fit rounded-lg border border-border/50">
        <Button
          variant={filter === "todos" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("todos")}
          className="h-8 text-xs px-4"
        >
          Todos
        </Button>
        <Button
          variant={filter === "comunidade" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("comunidade")}
          className="h-8 text-xs px-4"
        >
          Comunidades
        </Button>
        <Button
          variant={filter === "local" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("local")}
          className="h-8 text-xs px-4"
        >
          Locais
        </Button>
      </div>

      <CrudShell
        title={filter === "todos" ? "Comunidades & Locais" : filter === "comunidade" ? "Comunidades" : "Locais"}
        items={communitiesList}
        columns={[
          { label: "Nome", key: "nome" },
          { label: "Município", key: "_mun" },
          { label: "Categoria", key: "categoria" },
          { label: "Tipo / Natureza", key: "tipo" }
        ]}
        getId={(r) => r.id}
        getRowValues={(r) => ({ 
          ...r, 
          _mun: r.municipio_id ? munMap.get(r.municipio_id) : "" 
        })}
        blank={{ nome: "", municipio_id: null, tipo: "", categoria: "Comunidade" }}
        searchExternal={search}
        onSearchExternalChange={handleSearchChange}
        pagination={{
          page,
          setPage,
          count: totalCount,
          pageSize: 25,
        }}
        emptyState={{
          icon: <MapPin />,
          title: "Nenhuma comunidade cadastrada",
          actionLabel: "+ Nova Comunidade",
        }}
        renderForm={(s, set, errors) => (
          <>
            <div className="space-y-1">
              <Label htmlFor="com-nome">Nome <span className="text-destructive">*</span></Label>
              <Input 
                id="com-nome" 
                value={s.nome ?? ""} 
                onChange={(e) => set({ ...s, nome: e.target.value })} 
                placeholder="Ex: Vila Esperança"
                className={errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {errors.nome && <p className="text-xs text-red-500">{errors.nome}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="com-categoria">Categoria <span className="text-destructive">*</span></Label>
              <Select 
                value={s.categoria || "Comunidade"} 
                onValueChange={(v) => set({ ...s, categoria: v })}
              >
                <SelectTrigger id="com-categoria" className={errors.categoria ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Comunidade">Comunidade</SelectItem>
                  <SelectItem value="Local/Espaço">Local</SelectItem>
                </SelectContent>
              </Select>
              {errors.categoria && <p className="text-xs text-red-500">{errors.categoria}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="com-tipo">Tipo / Natureza (Opcional)</Label>
              <Input 
                id="com-tipo" 
                value={s.tipo ?? ""} 
                placeholder="Ex: Quilombola, Assentamento, Escola Municipal..." 
                onChange={(e) => set({ ...s, tipo: e.target.value })} 
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="com-municipio">Município (Opcional)</Label>
              <Select 
                value={s.municipio_id || undefined} 
                onValueChange={(v) => set({ ...s, municipio_id: v || null })}
              >
                <SelectTrigger id="com-municipio">
                  <SelectValue placeholder="Selecione um município..." />
                </SelectTrigger>
                <SelectContent>
                  {(muns ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        validate={(s) => {
          const errors: Record<string, string> = {};
          if (!s.nome || !s.nome.trim()) {
            errors.nome = "O nome é obrigatório";
          }
          if (!s.categoria) {
            errors.categoria = "A categoria é obrigatória";
          }
          return errors;
        }}
        onSave={async (s) => {
          if (!s.nome || !s.nome.trim()) {
            throw new Error("O nome é obrigatório.");
          }
          if (!s.categoria) {
            throw new Error("A categoria é obrigatória.");
          }

          const nomeNormalizado = toTitleCase(s.nome.trim());
          
          // Verificar duplicata no servidor
          const { data: dupData, error: dupError } = await supabase
            .from("comunidades")
            .select("id")
            .ilike("nome", nomeNormalizado)
            .limit(1);
          if (!dupError && dupData && dupData.length > 0 && dupData[0].id !== s.id) {
            throw new Error(`Já existe uma comunidade ou local com o nome "${nomeNormalizado}".`);
          }

          await upsert.mutateAsync({
            ...s,
            nome: nomeNormalizado,
            tipo: s.tipo?.trim() || null,
          });
        }}
        onDelete={(id) => del.mutateAsync(id)}
      />
    </div>
  );
}

function TiposAcaoTab() {
  const { data } = TiposAcao.useList();
  const upsert = TiposAcao.useUpsert();
  const del = TiposAcao.useDelete();

  return (
    <CrudShell
      title="Tipos de Ação"
      items={data}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "Origem", key: "_origem" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => ({
        ...r,
        _origem: r.padrao ? "Sistema" : "Usuário"
      })}
      blank={{ nome: "", padrao: false, criado_via: "usuario" }}
      canEdit={(row) => !row.padrao}
      canDelete={(row) => !row.padrao}
      emptyState={{
        icon: <Tag />,
        title: "Nenhum tipo de ação cadastrado",
        actionLabel: "+ Novo Tipo",
      }}
      renderForm={(s, set, errors) => (
        <div className="space-y-1">
          <Label htmlFor="tipo-nome">Nome do Tipo <span className="text-destructive">*</span></Label>
          <Input
            id="tipo-nome"
            value={s.nome ?? ""}
            onChange={(e) => set({ ...s, nome: e.target.value })}
            placeholder="Ex: Webinar Técnico"
            className={errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {errors.nome && <p className="text-xs text-red-500">{errors.nome}</p>}
        </div>
      )}
      validate={(s) => {
        const errors: Record<string, string> = {};
        if (!s.nome || !s.nome.trim()) {
          errors.nome = "O nome é obrigatório";
        }
        return errors;
      }}
      onSave={async (s) => {
        if (!s.nome || !s.nome.trim()) {
          throw new Error("O nome é obrigatório.");
        }
        const nomeNormalizado = toTitleCase(s.nome.trim());

        // Verificar duplicata
        const duplicado = (data ?? []).some(
          (t) => t.nome.toLowerCase() === nomeNormalizado.toLowerCase() && t.id !== s.id
        );
        if (duplicado) {
          throw new Error(`Já existe um tipo de ação com o nome "${nomeNormalizado}".`);
        }

        await upsert.mutateAsync({
          ...s,
          nome: nomeNormalizado,
          padrao: false,
          criado_via: "usuario"
        });
      }}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function FinanciadoresTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const upsert = Financiadores.useUpsert();
  const del = Financiadores.useDelete();

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(0);
  };

  const { data: paginatedData } = useQuery({
    queryKey: ["financiadores-paginated", page, search],
    queryFn: async () => {
      let qBuilder = supabase
        .from("financiadores")
        .select("*", { count: "exact" });

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        qBuilder = qBuilder.or(`nome.ilike.%${q}%,tipo.ilike.%${q}%,contato.ilike.%${q}%`);
      }

      qBuilder = qBuilder
        .order("nome", { ascending: true })
        .range(page * 25, (page + 1) * 25 - 1);

      const { data, count, error } = await qBuilder;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    }
  });

  const fundersList = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  
  return (
    <CrudShell
      title="Financiadores"
      items={fundersList}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "Tipo", key: "tipo" },
        { label: "Contato", key: "contato" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => r}
      blank={{ nome: "", tipo: "privado", contato: "", site: "", cnpj: "" }}
      searchExternal={search}
      onSearchExternalChange={handleSearchChange}
      pagination={{
        page,
        setPage,
        count: totalCount,
        pageSize: 25,
      }}
      emptyState={{
        icon: <Building2 />,
        title: "Nenhum financiador cadastrado",
        actionLabel: "+ Novo Financiador",
      }}
      renderForm={(s, set, errors) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="fin-nome">Nome <span className="text-destructive">*</span></Label>
            <Input 
              id="fin-nome" 
              value={s.nome ?? ""} 
              onChange={(e) => set({ ...s, nome: e.target.value })} 
              className={errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.nome && <p className="text-xs text-red-500">{errors.nome}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-tipo">Tipo <span className="text-destructive">*</span></Label>
            <Select 
              value={s.tipo || undefined} 
              onValueChange={(v) => set({ ...s, tipo: v })}
            >
              <SelectTrigger id="fin-tipo" className={errors.tipo ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecione um tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="publico">Público</SelectItem>
                <SelectItem value="privado">Privado</SelectItem>
                <SelectItem value="internacional">Internacional</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && <p className="text-xs text-red-500">{errors.tipo}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-cnpj">CNPJ</Label>
            <Input id="fin-cnpj" value={s.cnpj ?? ""} onChange={(e) => set({ ...s, cnpj: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-contato">Contato</Label>
            <Input id="fin-contato" value={s.contato ?? ""} onChange={(e) => set({ ...s, contato: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-site">Site</Label>
            <Input id="fin-site" value={s.site ?? ""} onChange={(e) => set({ ...s, site: e.target.value })} />
          </div>
        </>
      )}
      validate={(s) => {
        const errors: Record<string, string> = {};
        if (!s.nome || !s.nome.trim()) {
          errors.nome = "O nome é obrigatório";
        }
        if (!s.tipo) {
          errors.tipo = "O tipo é obrigatório";
        }
        return errors;
      }}
      onSave={async (s) => {
        const nomeNorm = toTitleCase((s.nome ?? "").trim());
        // Verificar duplicata de nome (case-insensitive)
        const { data: dup } = await supabase
          .from("financiadores")
          .select("id")
          .ilike("nome", nomeNorm)
          .limit(1);
        if (dup && dup.length > 0 && dup[0].id !== s.id) {
          throw new Error(`Já existe um financiador com o nome "${nomeNorm}".`);
        }
        await upsert.mutateAsync({ ...s, nome: nomeNorm });
      }}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function CategoriasTab() {
  const { data } = Categorias.useList();
  const upsert = Categorias.useUpsert();
  const del = Categorias.useDelete();
  
  return (
    <CrudShell
      title="Categorias"
      items={data}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "Tipo", key: "tipo" },
        { label: "Cor", key: "cor" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => r}
      blank={{ nome: "", tipo: "atividade", cor: "#1A9FD4", icone: "" }}
      renderForm={(s, set, errors) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="cat-nome">Nome <span className="text-destructive">*</span></Label>
            <Input 
              id="cat-nome" 
              value={s.nome ?? ""} 
              onChange={(e) => set({ ...s, nome: e.target.value })} 
              className={errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.nome && <p className="text-xs text-red-500">{errors.nome}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-tipo">Tipo <span className="text-destructive">*</span></Label>
            <Select 
              value={s.tipo || undefined} 
              onValueChange={(v) => set({ ...s, tipo: v })}
            >
              <SelectTrigger id="cat-tipo" className={errors.tipo ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecione um tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atividade">Atividade</SelectItem>
                <SelectItem value="tecnologia">Tecnologia</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="imagem">Banco de Imagens</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && <p className="text-xs text-red-500">{errors.tipo}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-cor">Cor (hex)</Label>
            <Input id="cat-cor" value={s.cor ?? ""} onChange={(e) => set({ ...s, cor: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-icone">Ícone (lucide)</Label>
            <Input id="cat-icone" value={s.icone ?? ""} onChange={(e) => set({ ...s, icone: e.target.value })} />
          </div>
        </>
      )}
      validate={(s) => {
        const errors: Record<string, string> = {};
        if (!s.nome || !s.nome.trim()) {
          errors.nome = "O nome é obrigatório";
        }
        if (!s.tipo) {
          errors.tipo = "O tipo é obrigatório";
        }
        return errors;
      }}
      onSave={async (s) => {
        const nomeNorm = toTitleCase((s.nome ?? "").trim());
        // Verificar duplicata de nome+tipo
        const { data: dup } = await supabase
          .from("categorias")
          .select("id")
          .ilike("nome", nomeNorm)
          .eq("tipo", s.tipo)
          .limit(1);
        if (dup && dup.length > 0 && dup[0].id !== s.id) {
          throw new Error(`Já existe uma categoria "${nomeNorm}" do tipo "${s.tipo}".`);
        }
        await upsert.mutateAsync({ ...s, nome: nomeNorm });
      }}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function PublicosTab() {
  const { data } = Publicos.useList();
  const upsert = Publicos.useUpsert();
  const del = Publicos.useDelete();
  
  return (
    <CrudShell
      title="Públicos atendidos"
      items={data}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "Descrição", key: "descricao" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => r}
      blank={{ nome: "", descricao: "" }}
      renderForm={(s, set, errors) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="pub-nome">Nome <span className="text-destructive">*</span></Label>
            <Input 
              id="pub-nome" 
              value={s.nome ?? ""} 
              onChange={(e) => set({ ...s, nome: e.target.value })} 
              className={errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.nome && <p className="text-xs text-red-500">{errors.nome}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pub-desc">Descrição</Label>
            <Input id="pub-desc" value={s.descricao ?? ""} onChange={(e) => set({ ...s, descricao: e.target.value })} />
          </div>
        </>
      )}
      validate={(s) => {
        const errors: Record<string, string> = {};
        if (!s.nome || !s.nome.trim()) {
          errors.nome = "O nome é obrigatório";
        }
        return errors;
      }}
      onSave={async (s) => {
        const nomeNorm = toTitleCase((s.nome ?? "").trim());
        // Verificar duplicata de nome
        const { data: dup } = await supabase
          .from("publicos")
          .select("id")
          .ilike("nome", nomeNorm)
          .limit(1);
        if (dup && dup.length > 0 && dup[0].id !== s.id) {
          throw new Error(`Já existe um público com o nome "${nomeNorm}".`);
        }
        await upsert.mutateAsync({ ...s, nome: nomeNorm });
      }}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function FamiliasTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const { data: muns } = Municipios.useList();
  const { data: coms } = Comunidades.useList();
  const upsert = Familias.useUpsert();
  const del = Familias.useDelete();

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(0);
  };

  const { data: paginatedData } = useQuery({
    queryKey: ["beneficiarios-paginated", page, search],
    queryFn: async () => {
      let qBuilder = supabase
        .from("beneficiarios")
        .select("*", { count: "exact" });

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        qBuilder = qBuilder.or(`nome_responsavel.ilike.%${q}%,cpf.ilike.%${q}%,nis.ilike.%${q}%`);
      }

      qBuilder = qBuilder
        .order("nome_responsavel", { ascending: true })
        .range(page * 20, (page + 1) * 20 - 1);

      const { data, count, error } = await qBuilder;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    }
  });

  const familiesList = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  
  const munMap = useMemo(() => new Map((muns ?? []).map((m) => [m.id, m.nome])), [muns]);
  const comMap = useMemo(() => new Map((coms ?? []).map((c) => [c.id, c.nome])), [coms]);
  
  return (
    <CrudShell
      title="Famílias"
      items={familiesList}
      columns={[
        { label: "Responsável", key: "nome_responsavel" },
        { label: "Município", key: "_mun" },
        { label: "Comunidade", key: "_com" },
        { label: "CPF", key: "cpf" },
        { label: "NIS", key: "nis" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => ({
        ...r,
        _mun: r.municipio_id ? munMap.get(r.municipio_id) : "",
        _com: r.comunidade_id ? comMap.get(r.comunidade_id) : "",
      })}
      blank={{
        nome_responsavel: "",
        cpf: "",
        nis: "",
        municipio_id: null,
        comunidade_id: null,
        quilombola: false,
        povo_originario: false,
      }}
      searchExternal={search}
      onSearchExternalChange={handleSearchChange}
      pagination={{
        page,
        setPage,
        count: totalCount,
        pageSize: 20,
      }}
      renderForm={(s, set, errors) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="fam-responsavel">Nome do Responsável <span className="text-destructive">*</span></Label>
            <Input 
              id="fam-responsavel" 
              value={s.nome_responsavel ?? ""} 
              onChange={(e) => set({ ...s, nome_responsavel: e.target.value })} 
              className={errors.nome_responsavel ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.nome_responsavel && <p className="text-xs text-red-500">{errors.nome_responsavel}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fam-cpf">CPF</Label>
              <Input 
                id="fam-cpf" 
                value={s.cpf ?? ""} 
                onChange={(e) => set({ ...s, cpf: e.target.value })} 
                className={errors.cpf ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {errors.cpf && <p className="text-xs text-red-500">{errors.cpf}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="fam-nis">NIS</Label>
              <Input 
                id="fam-nis" 
                value={s.nis ?? ""} 
                onChange={(e) => set({ ...s, nis: e.target.value })} 
                className={errors.nis ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {errors.nis && <p className="text-xs text-red-500">{errors.nis}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fam-municipio">Município</Label>
            <Select 
              value={s.municipio_id || undefined} 
              onValueChange={(v) => set({ ...s, municipio_id: v || null })}
            >
              <SelectTrigger id="fam-municipio">
                <SelectValue placeholder="Selecione um município..." />
              </SelectTrigger>
              <SelectContent>
                {(muns ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fam-comunidade">Comunidade</Label>
            <Select 
              value={s.comunidade_id || undefined} 
              onValueChange={(v) => set({ ...s, comunidade_id: v || null })}
            >
              <SelectTrigger id="fam-comunidade">
                <SelectValue placeholder="Selecione uma comunidade..." />
              </SelectTrigger>
              <SelectContent>
                {(coms ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-6 pt-3 border-t border-border/40">
            <label className="flex items-center space-x-2 text-sm text-foreground/80 cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-border/60 bg-muted/10 text-primary focus:ring-primary focus:ring-offset-background"
                checked={s.quilombola ?? false} 
                onChange={(e) => set({ ...s, quilombola: e.target.checked })} 
              />
              <span>Quilombola</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-foreground/80 cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-border/60 bg-muted/10 text-primary focus:ring-primary focus:ring-offset-background"
                checked={s.povo_originario ?? false} 
                onChange={(e) => set({ ...s, povo_originario: e.target.checked })} 
              />
              <span>Povo Originário</span>
            </label>
          </div>
        </>
      )}
      validate={(s) => {
        const errors: Record<string, string> = {};
        if (!s.nome_responsavel || !s.nome_responsavel.trim()) {
          errors.nome_responsavel = "O nome do responsável é obrigatório";
        }
        if (s.cpf && s.cpf.trim() && !/^\d{11}$/.test(s.cpf.replace(/[.-]/g, ""))) {
          errors.cpf = "CPF deve ter 11 dígitos numéricos";
        }
        if (s.nis && s.nis.trim() && !/^\d{11}$/.test(s.nis.replace(/[.-]/g, ""))) {
          errors.nis = "NIS deve ter 11 dígitos numéricos";
        }
        return errors;
      }}
      onSave={async (s) => {
        // Verificar duplicata de CPF
        if (s.cpf && s.cpf.trim()) {
          const cpfLimpo = s.cpf.replace(/[.-]/g, "").trim();
          const { data: dupCpf } = await supabase
            .from("beneficiarios")
            .select("id, nome_responsavel")
            .eq("cpf", cpfLimpo)
            .limit(1);
          if (dupCpf && dupCpf.length > 0 && dupCpf[0].id !== s.id) {
            throw new Error(`CPF já cadastrado para a família "${dupCpf[0].nome_responsavel}".`);
          }
        }
        // Verificar duplicata de NIS
        if (s.nis && s.nis.trim()) {
          const nisLimpo = s.nis.replace(/[.-]/g, "").trim();
          const { data: dupNis } = await supabase
            .from("beneficiarios")
            .select("id, nome_responsavel")
            .eq("nis", nisLimpo)
            .limit(1);
          if (dupNis && dupNis.length > 0 && dupNis[0].id !== s.id) {
            throw new Error(`NIS já cadastrado para a família "${dupNis[0].nome_responsavel}".`);
          }
        }
        await upsert.mutateAsync(s);
      }}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA TECNOLOGIAS
// ─────────────────────────────────────────────────────────────────────────────

const BLANK_TECH = { nome: "", linha_acao: "" };

function TecnologiasTab() {
  const { data: items } = CatalogoTecnologias.useList();
  const { data: linhas = [] } = LinhasAcao.useList();
  const upsert = CatalogoTecnologias.useUpsert();
  const deactivate = CatalogoTecnologias.useDeactivate();
  const reactivate = CatalogoTecnologias.useReactivate();
  const del = CatalogoTecnologias.useDelete();
  const createLinha = LinhasAcao.useCreate();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(BLANK_TECH);
  const [localSearch, setLocalSearch] = useState("");
  const [linhaFiltro, setLinhaFiltro] = useState("all");
  const [showInativos, setShowInativos] = useState(false);
  const [novaLinha, setNovaLinha] = useState("");
  const [criandoLinha, setCriandoLinha] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const search = useDebounce(localSearch, 300);

  const openCreate = () => { setDraft(BLANK_TECH); setNovaLinha(""); setCriandoLinha(false); setErrors({}); setOpen(true); };
  const openEdit = (row: any) => { setDraft({ ...row }); setNovaLinha(""); setCriandoLinha(false); setErrors({}); setOpen(true); };

  const linhasUnicas = useMemo(() => {
    const fromItems = [...new Set((items ?? []).map((t: any) => t.linha_acao).filter(Boolean))];
    const fromLinhas = linhas.map((l) => l.nome);
    return [...new Set([...fromLinhas, ...fromItems])].sort();
  }, [items, linhas]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((row: any) => {
      const matchesAtivo = showInativos ? true : row.ativo !== false;
      const matchesLinha = linhaFiltro === "all" || row.linha_acao === linhaFiltro;
      const lowerSearch = search.toLowerCase().trim();
      const matchesSearch = !lowerSearch ||
        (row.nome ?? "").toLowerCase().includes(lowerSearch) ||
        (row.linha_acao ?? "").toLowerCase().includes(lowerSearch);
      return matchesAtivo && matchesLinha && matchesSearch;
    });
  }, [items, search, linhaFiltro, showInativos]);

  const handleSave = async () => {
    const validationErrors: Record<string, string> = {};
    let linhaFinal = draft.linha_acao;

    if (draft.linha_acao === "__nova__") {
      if (!novaLinha.trim()) {
        validationErrors.linha_acao = "Digite o nome da nova Linha de Ação.";
      } else {
        try {
          const created = await createLinha.mutateAsync(novaLinha.trim());
          linhaFinal = created.nome;
        } catch (e: any) {
          validationErrors.linha_acao = e.message || "Erro ao criar Linha de Ação";
        }
      }
    }

    if (!draft.nome?.trim()) {
      validationErrors.nome = "O nome da tecnologia é obrigatório.";
    }
    if (!linhaFinal?.trim()) {
      validationErrors.linha_acao = "Selecione ou crie uma Linha de Ação.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Corrija os erros antes de salvar.");
      return;
    }

    setErrors({});
    try {
      const nomeNorm = toTitleCase(draft.nome.trim());
      // Verificar duplicata de nome + linha de ação
      const { data: dup } = await supabase
        .from("catalogo_tecnologias")
        .select("id")
        .ilike("nome", nomeNorm)
        .eq("linha_acao", linhaFinal)
        .limit(1);
      if (dup && dup.length > 0 && dup[0].id !== draft.id) {
        toast.error(`Já existe a tecnologia "${nomeNorm}" nessa Linha de Ação.`);
        setErrors((prev) => ({ ...prev, nome: `Tecnologia "${nomeNorm}" já existe nessa Linha de Ação.` }));
        return;
      }

      await upsert.mutateAsync({ ...draft, nome: nomeNorm, linha_acao: linhaFinal });
      toast.success("Tecnologia salva com sucesso!");
      setOpen(false);
      setDraft(BLANK_TECH);
      setNovaLinha("");
      setCriandoLinha(false);
    } catch (e: any) {
      if (e?.code === "23505") {
        toast.error("Tecnologia duplicada. Verifique o nome e a linha de ação.");
      } else {
        toast.error(e.message ?? "Erro ao salvar a tecnologia");
      }
    }
  };

  return (
    <Card className="border-border/60 hover:shadow-soft transition-shadow">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-medium text-lg text-foreground/90">Catálogo de Tecnologias</h3>
          <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">

            {/* Busca */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 bg-muted/20"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>

            {/* Filtro por Linha de Ação */}
            <Select value={linhaFiltro} onValueChange={setLinhaFiltro}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrar por Linha de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Linhas</SelectItem>
                {linhasUnicas.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle inativos */}
            <button
              type="button"
              onClick={() => setShowInativos((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                showInativos
                  ? "bg-muted text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-border/50 hover:border-border"
              }`}
            >
              {showInativos ? "Ocultar inativos" : "Ver inativos"}
            </button>

            {/* Botão Novo */}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setDraft(BLANK_TECH); setNovaLinha(""); setCriandoLinha(false); setErrors({}); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 shadow-sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Novo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{draft.id ? "Editar" : "Nova"} Tecnologia</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">

                  {/* Nome */}
                  <div className="space-y-1">
                    <Label htmlFor="tech-nome">Nome da Tecnologia <span className="text-destructive">*</span></Label>
                    <Input
                      id="tech-nome"
                      value={draft.nome ?? ""}
                      placeholder="Ex.: Cisterna de consumo humano"
                      onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                      className={errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.nome && <p className="text-xs text-red-500">{errors.nome}</p>}
                  </div>

                  {/* Linha de Ação */}
                  <div className="space-y-1">
                    <Label htmlFor="tech-linha">Linha de Ação <span className="text-destructive">*</span></Label>
                    <Select
                      value={draft.linha_acao || undefined}
                      onValueChange={(v) => {
                        setDraft({ ...draft, linha_acao: v });
                        setCriandoLinha(v === "__nova__");
                        if (v !== "__nova__") setNovaLinha("");
                      }}
                    >
                      <SelectTrigger id="tech-linha" className={errors.linha_acao ? "border-red-500" : ""}>
                        <SelectValue placeholder="Selecione a linha de ação..." />
                      </SelectTrigger>
                      <SelectContent>
                        {linhasUnicas.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                        <SelectItem value="__nova__">➕ Criar nova linha de ação</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.linha_acao && <p className="text-xs text-red-500">{errors.linha_acao}</p>}
                  </div>

                  {/* Campo inline para nova linha de ação */}
                  {criandoLinha && (
                    <div className="space-y-1">
                      <Label htmlFor="nova-linha">Nome da nova Linha de Ação <span className="text-destructive">*</span></Label>
                      <Input
                        id="nova-linha"
                        value={novaLinha}
                        placeholder="Ex.: Educação Ambiental"
                        onChange={(e) => setNovaLinha(e.target.value)}
                        className={errors.linha_acao ? "border-red-500 focus-visible:ring-red-500" : ""}
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground">Essa categoria será criada e ficará disponível para futuras tecnologias.</p>
                    </div>
                  )}

                </div>
                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={handleSave}
                    disabled={upsert.isPending || createLinha.isPending}
                  >
                    {(upsert.isPending || createLinha.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tecnologia</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Linha de Ação</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredItems.map((row: any) => (
                <tr key={row.id} className={`hover:bg-muted/20 transition-colors ${row.ativo === false ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 font-normal text-foreground/80">{row.nome}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] border bg-primary/10 text-primary border-primary/30 font-medium">
                      {row.linha_acao || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.ativo === false ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] border bg-muted/60 text-muted-foreground border-border/50 font-medium">Inativa</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] border bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium">Ativa</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Excluir permanentemente"
                      className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma tecnologia encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent className="rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!deleteId) return;
                  try {
                    await del.mutateAsync(deleteId);
                    toast.success("Registro excluído com sucesso!");
                  } catch (e: any) {
                    toast.error(e.message ?? "Erro ao excluir o registro");
                  } finally {
                    setDeleteId(null);
                  }
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}
