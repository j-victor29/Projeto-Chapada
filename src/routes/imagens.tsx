import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  MapPin,
  Calendar,
  Tag,
  FolderOpen,
  Trash2,
  Pencil,
  Filter,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  addImagem,
  removeImagem,
  updateImagem,
  useImagens,
  useCategorias,
  type ImagemItem,
} from "@/lib/imagensStore";
import { useProjetos } from "@/lib/projetosStore";
import { Municipios } from "@/lib/cadastrosStore";
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
import { useRegistroPermissao } from "@/hooks/useRegistroPermissao";
import { CollaboratorsModal } from "@/components/CollaboratorsModal";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaginationControls } from "@/components/PaginationControls";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/imagens")({
  component: ImagensPage,
});


const TIPOS = [
  "Oficina",
  "Encontro",
  "Entrega",
  "Visita Técnica",
  "Capacitação",
  "Mobilização",
  "Plantio",
  "Roda de conversa",
];

interface PendingFile {
  file: File;
  previewUrl: string; // local object URL for preview only
}

const emptyForm = { projetoId: "", projetoNome: "", local: "", tipo: "", date: "", categoriaId: "" };

function ImagensPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  const [page, setPage] = useState(0);

  const { data: dbMunicipios = [] } = Municipios.useList();
  const categorias = useCategorias();
  const projetos = useProjetos();
  const { query } = useGlobalSearch();
  const { email: currentEmail, name: currentName } = useCurrentUser();
  const [selected, setSelected] = useState<ImagemItem | null>(null);
  const [toDelete, setToDelete] = useState<ImagemItem | null>(null);
  const [editing, setEditing] = useState<ImagemItem | null>(null);
  const editingOwnership = useOwnership("imagem", editing?.id ?? "");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string[]>([]);
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
  const [selProjeto, setSelProjeto] = useState("todos");
  const [selTipo, setSelTipo] = useState("todos");
  const [selMunicipio, setSelMunicipio] = useState("todos");
  const [filtroAtividade, setFiltroAtividade] = useState("todos");
  const [filtroAcaoIndependente, setFiltroAcaoIndependente] = useState("todos");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return data || [];
    }
  });
  const profilesMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const { data: atividadesWithImgs = [] } = useQuery({
    queryKey: ["atividades-with-imgs"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arquivos_midia")
        .select("atividade:atividades(id, titulo, descricao, projeto_id, data)")
        .eq("tipo_arquivo", "imagem");
      if (error) throw error;
      
      const seen = new Set<string>();
      const list: any[] = [];
      for (const item of data ?? []) {
        const at = item.atividade as any;
        if (at && !seen.has(at.id)) {
          seen.add(at.id);
          list.push(at);
        }
      }
      return list.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    }
  });

  const atividadesComProjeto = useMemo(() => atividadesWithImgs.filter(at => at.projeto_id), [atividadesWithImgs]);
  const acoesIndependentes = useMemo(() => atividadesWithImgs.filter(at => !at.projeto_id), [atividadesWithImgs]);

  const formatIsoDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const [y, m, d] = dateStr.split("-");
      if (!y || !m || !d) return dateStr;
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  // Reset page to 0 on filter change
  useEffect(() => {
    setPage(0);
  }, [dataDe, dataAte, categoriaFiltro, selProjeto, selTipo, selMunicipio, filtroAtividade, filtroAcaoIndependente, query]);

  const hasActiveFilters = useMemo(() => {
    return (
      dataDe !== "" ||
      dataAte !== "" ||
      categoriaFiltro.length > 0 ||
      selProjeto !== "todos" ||
      selTipo !== "todos" ||
      selMunicipio !== "todos" ||
      filtroAtividade !== "todos" ||
      filtroAcaoIndependente !== "todos"
    );
  }, [dataDe, dataAte, categoriaFiltro, selProjeto, selTipo, selMunicipio, filtroAtividade, filtroAcaoIndependente]);

  const isPeriodInvalid = !!(dataDe && dataAte && dataDe > dataAte);

  const clearFilters = () => {
    setDataDe("");
    setDataAte("");
    setCategoriaFiltro([]);
    setSelProjeto("todos");
    setSelTipo("todos");
    setSelMunicipio("todos");
    setFiltroAtividade("todos");
    setFiltroAcaoIndependente("todos");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: paginatedData, isLoading: isListLoading } = useQuery({
    queryKey: ["arquivos_midia-paginated", page, dataDe, dataAte, selProjeto, selTipo, selMunicipio, categoriaFiltro, filtroAtividade, filtroAcaoIndependente, query],
    enabled: !!session,
    queryFn: async () => {
      let qBuilder = supabase
        .from("arquivos_midia")
        .select("*, projetos(nome), categorias(nome)", { count: "exact" })
        .eq("tipo_arquivo", "imagem");

      if (selProjeto !== "todos") {
        qBuilder = qBuilder.eq("projeto_id", selProjeto);
      }
      if (selTipo !== "todos") {
        qBuilder = qBuilder.eq("tipo_acao", selTipo);
      }
      if (selMunicipio !== "todos") {
        qBuilder = qBuilder.eq("local", selMunicipio);
      }
      if (filtroAtividade !== "todos") {
        qBuilder = qBuilder.eq("atividade_id", filtroAtividade);
      }
      if (filtroAcaoIndependente !== "todos") {
        qBuilder = qBuilder.eq("atividade_id", filtroAcaoIndependente);
      }
      if (dataDe) {
        qBuilder = qBuilder.gte("data", dataDe);
      }
      if (dataAte) {
        qBuilder = qBuilder.lte("data", dataAte);
      }
      if (categoriaFiltro.length > 0) {
        qBuilder = qBuilder.in("categoria_id", categoriaFiltro);
      }

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        let orFilter = `nome.ilike.%${q}%,tipo_acao.ilike.%${q}%,local.ilike.%${q}%`;
        const matchingProjs = projetos.filter(p => p.nome.toLowerCase().includes(q));
        if (matchingProjs.length > 0) {
          orFilter += `,projeto_id.in.(${matchingProjs.map(p => `"${p.id}"`).join(',')})`;
        }
        qBuilder = qBuilder.or(orFilter);
      }

      qBuilder = qBuilder
        .order("created_at", { ascending: false })
        .range(page * 24, (page + 1) * 24 - 1);

      const { data, count, error } = await qBuilder;
      if (error) throw error;

      return {
        data: (data ?? []).map((row: any) => {
          let dateDisplay = "";
          if (row.data) {
            const [y, m, d] = row.data.split("-");
            dateDisplay = `${d}/${m}/${y}`;
          }
          const nomeProjeto = row.projetos?.nome ?? "";
          const nomeCategoria = row.categorias?.nome ?? undefined;
          return {
            id: row.id,
            projeto: nomeProjeto,
            projetoId: row.projeto_id ?? undefined,
            local: row.local ?? "",
            tipo: row.tipo_acao ?? "",
            date: dateDisplay,
            dataIso: row.data ?? "",
            url: row.url ?? "",
            nomeArquivo: row.nome ?? "",
            categoriaId: row.categoria_id ?? undefined,
            categoriaNome: nomeCategoria,
            dataUrl: row.url ?? "",
            created_by: row.created_by,
          };
        }),
        count: count ?? 0,
      };
    }
  });

  const filtered = paginatedData?.data ?? [];
  const total = paginatedData?.count ?? 0;

  const openPicker = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const today = new Date();
    const isoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setPending({ file, previewUrl });
    setForm({ projetoId: "", projetoNome: "", local: "", tipo: "", date: isoDate, categoriaId: "" });
  };

  const handleSave = async () => {
    if (!pending) return;
    if (!form.local || !form.tipo || !form.date) {
      toast.error("Preencha local, tipo e data.");
      return;
    }
    setSaving(true);
    try {
      const newId = await addImagem({
        file: pending.file,
        projeto: form.projetoNome,
        projetoId: form.projetoId || undefined,
        categoriaId: form.categoriaId || undefined,
        local: form.local,
        tipo: form.tipo,
        date: form.date,
      });
      setOwnership("imagem", newId, makeOwnership(currentEmail, currentName));
      addNotification({
        type: "imagem",
        title: "Nova imagem enviada",
        body: `${form.projetoNome || "Projeto"} — ${form.local}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["arquivos_midia-paginated"] });
      toast.success("Imagem adicionada à galeria.");
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
    } catch {
      toast.error("Erro ao enviar imagem. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const { podeEditar: canSaveImage } = useRegistroPermissao("arquivos_midia", editing?.id, editing?.created_by);
  const { podeExcluir: canDeleteImage } = useRegistroPermissao("arquivos_midia", toDelete?.id, toDelete?.created_by);

  const openEdit = (img: ImagemItem) => {
    setEditing(img);
    // Convert dd/mm/yyyy → yyyy-mm-dd for date input
    let isoDate = img.date;
    if (img.date && img.date.includes("/")) {
      const [d, m, y] = img.date.split("/");
      isoDate = `${y}-${m}-${d}`;
    }
    setForm({
      projetoId: img.projetoId ?? "",
      projetoNome: img.projeto,
      local: img.local,
      tipo: img.tipo,
      date: isoDate,
      categoriaId: img.categoriaId ?? "",
    });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (!canSaveImage) {
      denyToast();
      return;
    }
    if (!form.local || !form.tipo || !form.date) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    try {
      await updateImagem(editing.id, {
        projetoId: form.projetoId || undefined,
        categoriaId: form.categoriaId || undefined,
        local: form.local,
        tipo: form.tipo,
        date: form.date,
      });
      await queryClient.invalidateQueries({ queryKey: ["arquivos_midia-paginated"] });
      toast.success("Imagem atualizada.");
      setEditing(null);
    } catch {
      toast.error("Erro ao atualizar imagem.");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (img: ImagemItem) => {
    setToDelete(img);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    if (!canDeleteImage) {
      denyToast();
      setToDelete(null);
      return;
    }
    const deletedId = toDelete.id;
    try {
      await removeImagem(deletedId);
      removeOwnership("imagem", deletedId);
      await queryClient.invalidateQueries({ queryKey: ["arquivos_midia-paginated"] });
      toast.success("Imagem excluída.");
    } catch {
      toast.error("Erro ao excluir imagem.");
    } finally {
      setToDelete(null);
    }
  };

  const handleDownload = (img: ImagemItem) => {
    const a = document.createElement("a");
    a.href = img.url;
    a.download = img.nomeArquivo || `chapada-${img.id}.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const editorOpen = !!pending || !!editing;
  const isEditMode = !!editing;

  return (
    <AppLayout
      title="Banco de Imagens"
      subtitle="Galeria de fotos das atividades realizadas"
      actions={
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
          <Button onClick={openPicker} className="gap-2 chapada-btn">
            <Upload className="h-4 w-4" /> Enviar Imagens
          </Button>
        </>
      }
    >
      {/* ─── FILTROS DE PERÍODO + AVANÇADOS ───────────────────────────────────── */}
      <Card className="mb-4 chapada-filter-card">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-4 items-center justify-between">
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
                      {projetos?.filter(p => p.id && String(p.id).trim() !== "").map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} className="text-xs">
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
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {TIPOS.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Categoria</Label>
                  <Select 
                    value={categoriaFiltro.length === 0 ? "todas" : categoriaFiltro[0]} 
                    onValueChange={(val) => {
                      if (val === "todas") setCategoriaFiltro([]);
                      else setCategoriaFiltro([val]);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Atividade</Label>
                  <Select value={filtroAtividade} onValueChange={setFiltroAtividade}>
                    <SelectTrigger className="h-9 text-xs bg-background/50">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-lg shadow-lg border">
                      <SelectItem value="todos" className="text-xs">Todas</SelectItem>
                      {atividadesComProjeto.map((at) => {
                        const label = `${at.titulo || at.descricao?.slice(0, 30) || "Sem título"} (${formatIsoDate(at.data)})`;
                        return (
                          <SelectItem key={at.id} value={at.id} className="text-xs">
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ação Independente</Label>
                  <Select value={filtroAcaoIndependente} onValueChange={setFiltroAcaoIndependente}>
                    <SelectTrigger className="h-9 text-xs bg-background/50">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-lg shadow-lg border">
                      <SelectItem value="todos" className="text-xs">Todas</SelectItem>
                      {acoesIndependentes.map((at) => {
                        const label = `${at.titulo || at.descricao?.slice(0, 30) || "Sem título"} (${formatIsoDate(at.data)})`;
                        return (
                          <SelectItem key={at.id} value={at.id} className="text-xs">
                            {label}
                          </SelectItem>
                        );
                      })}
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
        </div>
        </CardContent>
      </Card>

      {isListLoading ? (
        <div className="chapada-empty">
          <h3 className="text-base font-semibold text-foreground mb-1">
            Carregando galeria...
          </h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="chapada-empty">
          <div className="chapada-empty-icon">
            <FolderOpen className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {query || categoriaFiltro.length > 0 || dataDe || dataAte
              ? "Nenhuma imagem encontrada para este filtro."
              : "Galeria vazia"}
          </h3>
          {filtered.length === 0 && !query && (
            <p className="text-sm text-muted-foreground">
              Clique em "Enviar Imagens" para começar.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((img) => (
              <ImagemCard
                key={img.id}
                img={img}
                setSelected={setSelected}
                openEdit={openEdit}
                requestDelete={requestDelete}
                profilesMap={profilesMap}
              />
            ))}
          </div>

          <PaginationControls
            page={page}
            setPage={setPage}
            count={total}
            pageSize={24}
          />
        </div>
      )}

      {/* Modal de upload/edição */}
      <Dialog
        open={editorOpen}
        onOpenChange={(o) => {
          if (!o) {
            if (pending) URL.revokeObjectURL(pending.previewUrl);
            setPending(null);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Editar Imagem" : "Nova Imagem"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Atualize os dados desta imagem."
                : "Preencha os dados da imagem enviada."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="aspect-video rounded-md overflow-hidden bg-muted">
              <img
                src={pending?.previewUrl ?? editing?.url ?? ""}
                alt="preview"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <Label>Projeto</Label>
              <Select
                value={form.projetoId}
                onValueChange={(v) => {
                  const proj = projetos.find((p) => p.id === v);
                  setForm((f) => ({ ...f, projetoId: v, projetoNome: proj?.nome ?? "" }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {projetos?.filter(p => p.id && String(p.id).trim() !== "").map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categorias.length > 0 && (
              <div>
                <Label>Categoria Temática</Label>
                <Select
                  value={form.categoriaId}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoriaId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Município / Local</Label>
              <Select
                value={form.local}
                onValueChange={(v) => setForm((f) => ({ ...f, local: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {dbMunicipios.map((m) => (
                    <SelectItem key={m.id} value={m.nome}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Ação</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS?.filter(t => t && String(t).trim() !== "").map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="mt-4 border-t pt-4">
              <CollaboratorsSection
                tabela="arquivos_midia"
                registro_id={editing?.id || null}
                created_by={editing?.created_by || user?.id || null}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (pending) URL.revokeObjectURL(pending.previewUrl);
                setPending(null);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={isEditMode ? handleEditSave : handleSave}
              disabled={saving}
            >
              {saving
                ? "Salvando..."
                : isEditMode
                ? "Salvar alterações"
                : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {selected ? `Imagem: ${selected.projeto}` : "Imagem"}
          </DialogTitle>
          {selected && (
            <div className="grid md:grid-cols-[1fr_320px]">
              <div className="relative bg-black grid place-items-center min-h-[320px] md:min-h-[520px]">
                <img
                  src={selected.url}
                  alt={selected.projeto}
                  className="max-h-[520px] max-w-full object-contain"
                />
              </div>
              <div className="p-6 flex flex-col gap-4 bg-card">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Atividade
                  </div>
                  <h2 className="font-display text-xl font-semibold leading-tight">
                    {selected.projeto}
                  </h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <FolderOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Projeto</div>
                      <div className="font-medium">{selected.projeto}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Local</div>
                      <div className="font-medium">{selected.local}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Data</div>
                      <div className="font-medium">{selected.date}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Tipo de ação</div>
                      <Badge variant="secondary" className="mt-0.5">
                        {selected.tipo}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleDownload(selected)}
                  className="gap-2 mt-auto w-full"
                >
                  <Download className="h-4 w-4" /> Baixar Imagem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir esta imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

function ImagemCard({
  img,
  setSelected,
  openEdit,
  requestDelete,
  profilesMap,
}: {
  img: ImagemItem;
  setSelected: (img: ImagemItem) => void;
  openEdit: (img: ImagemItem) => void;
  requestDelete: (img: ImagemItem) => void;
  profilesMap: Map<string, any>;
}) {
  const { podeEditar, podeExcluir, isCriador } = useRegistroPermissao("arquivos_midia", img.id, img.created_by);
  const [colabOpen, setColabOpen] = useState(false);

  const creatorProfile = img.created_by ? profilesMap.get(img.created_by) : null;
  const creatorName = creatorProfile?.full_name || creatorProfile?.email?.split("@")[0] || "Sem dono";

  return (
    <Card className="chapada-card overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 relative">
      {isCriador && (
        <span
          className="px-2 py-0.5 rounded text-[10px] font-semibold absolute top-2 left-2 z-10"
          style={{ backgroundColor: "#D4EDDA", color: "#2D5A27" }}
        >
          Seu registro
        </span>
      )}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isCriador && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setColabOpen(true);
            }}
            className="h-8 w-8 grid place-items-center rounded-md bg-background text-foreground shadow-md hover:bg-muted"
            aria-label="Colaboradores"
          >
            <Users className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!podeEditar) {
              denyToast();
              return;
            }
            openEdit(img);
          }}
          className="h-8 w-8 grid place-items-center rounded-md bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          aria-label="Editar imagem"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!podeExcluir) {
              denyToast();
              return;
            }
            requestDelete(img);
          }}
          className="h-8 w-8 grid place-items-center rounded-md bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90"
          aria-label="Excluir imagem"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div
        onClick={() => setSelected(img)}
        className="aspect-square relative bg-muted overflow-hidden"
      >
        <img
          src={img.url}
          alt={`${img.projeto} - ${img.tipo}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>
      <CardContent className="p-3" onClick={() => setSelected(img)}>
        <div className="text-sm font-medium truncate">{img.projeto}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {img.local} · {img.date}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge className="text-[10px] bg-savanna/15 text-savanna border-savanna/30 border">
            {img.tipo}
          </Badge>
          {img.categoriaNome && (
            <Badge className="text-[10px] bg-terracotta/15 text-terracotta border-terracotta/30 border">
              {img.categoriaNome}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 select-none">
          Criado por {creatorName}
        </div>
      </CardContent>
      <CollaboratorsModal
        open={colabOpen}
        onOpenChange={setColabOpen}
        tabela="arquivos_midia"
        registroId={img.id}
        createdBy={img.created_by}
        creatorName={creatorName}
      />
    </Card>
  );
}
