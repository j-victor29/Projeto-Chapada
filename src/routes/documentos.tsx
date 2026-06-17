import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaginationControls } from "@/components/PaginationControls";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Upload, Trash2, Download, History, Search, GitBranch, FolderOpen, FileUp, Filter, X, FileX, SearchX } from "lucide-react";
import { useCategorias, useUploadDocumento, useDeleteDocumento, getDocumentoUrl, type Documento } from "@/lib/documentosStore";
import { useProjetos } from "@/lib/projetosStore";
import { addNotification } from "@/lib/notificationsStore";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistroPermissao } from "@/hooks/useRegistroPermissao";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { denyToast } from "@/lib/ownershipStore";
import { EmptySelectMessage, EmptyState } from "@/components/ui/EmptyState";

export const Route = createFileRoute("/documentos")({
  component: DocumentosPage,
});


function safeFormatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatBytes(bytes?: number | null) {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(mimeType?: string | null, titulo?: string) {
  const ext = (titulo?.split(".").pop() ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (ext === "pdf" || mime.includes("pdf")) return "📄";
  if (["xlsx", "xls", "csv"].includes(ext) || mime.includes("excel") || mime.includes("spreadsheet") || mime.includes("csv")) return "📊";
  if (["doc", "docx"].includes(ext) || mime.includes("word") || mime.includes("officedocument.wordprocessingml")) return "📝";
  if (["ppt", "pptx"].includes(ext) || mime.includes("powerpoint") || mime.includes("officedocument.presentationml")) return "📋";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) return "🗜️";
  return "📎";
}

function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border border-muted/80 bg-card rounded-xl overflow-hidden animate-pulse">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-40 sm:w-64" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end md:self-center">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
const PAGE_SIZE = 20;

function DocumentosPage() {
  const { session } = useAuth();
  const user = session?.user;
  const { data: cats } = useCategorias();
  const projs = useProjetos();

  const upload = useUploadDocumento();
  const del = useDeleteDocumento();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return data || [];
    }
  });
  const profilesMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const [open, setOpen] = useState(false);
  const [novaVersao, setNovaVersao] = useState<Documento | null>(null);
  
  // Form draft state
  const [draft, setDraft] = useState<{
    titulo: string;
    descricao: string;
    categoria_id: string;
    projeto_id: string;
    file: File | null;
    tags: string;
    created_by: string | null;
  }>({
    titulo: "",
    descricao: "",
    categoria_id: "none",
    projeto_id: "none",
    file: null,
    tags: "",
    created_by: null,
  });

  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroProjeto, setFiltroProjeto] = useState("todos");
  const [filtroAtividade, setFiltroAtividade] = useState("todos");
  const [filtroAcaoIndependente, setFiltroAcaoIndependente] = useState("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [page, setPage] = useState(0);

  const isPeriodInvalid = !!(dataDe && dataAte && dataDe > dataAte);

  const { data: atividadesWithDocs = [] } = useQuery({
    queryKey: ["atividades-with-docs"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arquivos_midia")
        .select("atividade:atividades(id, titulo, descricao, projeto_id, data)")
        .eq("tipo_arquivo", "documento");
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

  const atividadesComProjeto = useMemo(() => atividadesWithDocs.filter(at => at.projeto_id), [atividadesWithDocs]);
  const acoesIndependentes = useMemo(() => atividadesWithDocs.filter(at => !at.projeto_id), [atividadesWithDocs]);

  const hasActiveFilters = useMemo(() => {
    return (
      busca !== "" ||
      filtroCategoria !== "todos" ||
      filtroProjeto !== "todos" ||
      filtroAtividade !== "todos" ||
      filtroAcaoIndependente !== "todos" ||
      dataDe !== "" ||
      dataAte !== ""
    );
  }, [busca, filtroCategoria, filtroProjeto, filtroAtividade, filtroAcaoIndependente, dataDe, dataAte]);

  const clearFilters = () => {
    setBusca("");
    setFiltroCategoria("todos");
    setFiltroProjeto("todos");
    setFiltroAtividade("todos");
    setFiltroAcaoIndependente("todos");
    setDataDe("");
    setDataAte("");
    setPage(0);
  };

  // Query paginada: busca documentos raiz com filtros aplicados no servidor
  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ["documentos-paginated", page, busca, filtroCategoria, filtroProjeto, dataDe, dataAte, filtroAtividade, filtroAcaoIndependente],
    enabled: !!session,
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select("*", { count: "exact" })
        .is("documento_pai_id", null)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (busca.trim()) {
        q = q.or(
          `titulo.ilike.%${busca.trim()}%,descricao.ilike.%${busca.trim()}%`
        );
      }
      if (filtroCategoria !== "todos") {
        q = q.eq("categoria_id", filtroCategoria);
      }
      if (filtroProjeto !== "todos") {
        q = q.eq("projeto_id", filtroProjeto);
      }
      if (filtroAtividade !== "todos") {
        q = q.ilike("descricao", `%${filtroAtividade}%`);
      }
      if (filtroAcaoIndependente !== "todos") {
        q = q.ilike("descricao", `%${filtroAcaoIndependente}%`);
      }
      if (dataDe) {
        q = q.gte("created_at", dataDe);
      }
      if (dataAte) {
        q = q.lte("created_at", dataAte + "T23:59:59");
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { docs: (data ?? []) as Documento[], count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  // Query separada para buscar TODAS as versões (necessário para o modal de versões)
  const { data: allDocs } = useQuery({
    queryKey: ["documentos-all-versions"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, titulo, versao, tamanho, created_at, documento_pai_id, storage_path")
        .not("documento_pai_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });

  const rootDocs = pagedResult?.docs ?? [];
  const totalCount = pagedResult?.count ?? 0;
  
  // Delete Dialog State
  const [toDelete, setToDelete] = useState<Documento | null>(null);
  // Version History Dialog State
  const [viewingVersions, setViewingVersions] = useState<Documento | null>(null);

  // Filters and Mappings
  const docCats = useMemo(() => (cats ?? []).filter((c) => c.tipo === "documento"), [cats]);
  const projMap = useMemo(() => new Map((projs ?? []).map((p) => [p.id, p.nome])), [projs]);
  const catMap = useMemo(() => new Map((cats ?? []).map((c) => [c.id, c.nome])), [cats]);

  // Get all versions (history) for a document (uses the lighter all-versions query)
  const versionsOf = (docId: string) => {
    const versionsData = allDocs ?? [];
    // Include the root doc itself (from rootDocs list) + child versions
    const root = rootDocs.find((d) => d.id === docId);
    const children = versionsData.filter((d) => d.documento_pai_id === docId);
    const combined = root ? [root, ...children] : children;
    return combined.sort((a, b) => b.versao - a.versao);
  };

  const { podeEditar: canSaveDoc } = useRegistroPermissao("documentos", novaVersao?.id, draft.created_by);

  const submit = async () => {
    if (!draft.titulo) {
      toast.error("O título do documento é obrigatório");
      return;
    }
    if (!draft.file && !novaVersao) {
      toast.error("Você deve selecionar um arquivo");
      return;
    }

    if (novaVersao && !canSaveDoc) {
      denyToast();
      return;
    }

    try {
      await upload.mutateAsync({
        titulo: draft.titulo,
        descricao: draft.descricao || undefined,
        categoria_id: draft.categoria_id === "none" ? null : draft.categoria_id || null,
        projeto_id: draft.projeto_id === "none" ? null : draft.projeto_id || null,
        file: draft.file!,
        tags: draft.tags.split(",").map((s) => s.trim()).filter(Boolean),
        documento_pai_id: novaVersao?.id ?? null,
      });

      addNotification({
        type: "atividade",
        title: novaVersao ? "Nova versão enviada" : "Documento enviado",
        body: `${draft.titulo} (v${novaVersao ? novaVersao.versao + 1 : 1})`,
      });

      toast.success(novaVersao ? "Nova versão enviada com sucesso!" : "Documento enviado com sucesso!");
      setOpen(false);
      setNovaVersao(null);
      setDraft({ titulo: "", descricao: "", categoria_id: "none", projeto_id: "none", file: null, tags: "", created_by: null });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar documento");
    }
  };

  const baixar = async (doc: Documento) => {
    if (!doc.storage_path) {
      toast.error("Caminho do arquivo não encontrado");
      return;
    }
    const url = await getDocumentoUrl(doc.storage_path);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Falha ao gerar link de download");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete);
      toast.success("Documento excluído com sucesso");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir documento");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <AppLayout
      title="Biblioteca de documentos"
      subtitle="Organização institucional, categorização e versionamento"
      actions={
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setNovaVersao(null);
              setDraft({ titulo: "", descricao: "", categoria_id: "none", projeto_id: "none", file: null, tags: "", created_by: null });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-1.5 chapada-btn">
              <Plus className="h-4 w-4" /> Novo documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <FileUp className="h-5 w-5 text-primary animate-pulse" />
                {novaVersao ? `Nova versão de "${novaVersao.titulo}"` : "Enviar documento"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Preencha as informações para organizar e versionar o documento na biblioteca institucional.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-title" className="text-sm font-semibold">Título *</Label>
                <Input
                  id="doc-title"
                  placeholder="Ex: Relatório Final de Monitoramento Hídrico"
                  value={draft.titulo}
                  onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
                  className="rounded-lg bg-background/50 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-desc" className="text-sm font-semibold">Descrição</Label>
                <Textarea
                  id="doc-desc"
                  placeholder="Forneça uma breve descrição do conteúdo deste arquivo..."
                  value={draft.descricao}
                  onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
                  rows={3}
                  className="rounded-lg bg-background/50 resize-none focus-visible:ring-primary focus-visible:ring-offset-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-cat" className="text-sm font-semibold">Categoria</Label>
                  <Select
                    value={draft.categoria_id}
                    onValueChange={(v) => setDraft({ ...draft, categoria_id: v })}
                  >
                    <SelectTrigger id="doc-cat" className="rounded-lg bg-background/50 focus-visible:ring-primary focus-visible:ring-offset-1">
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-lg shadow-lg border">
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {docCats.filter(c => c && c.id).length > 0 ? (
                        docCats.filter(c => c && c.id).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <EmptySelectMessage
                          title="Nenhuma categoria cadastrada."
                          action={{ label: "Ir para Cadastros", href: "/cadastros" }}
                        />
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-proj" className="text-sm font-semibold">Projeto</Label>
                  <Select
                    value={draft.projeto_id}
                    onValueChange={(v) => setDraft({ ...draft, projeto_id: v })}
                  >
                    <SelectTrigger id="doc-proj" className="rounded-lg bg-background/50 focus-visible:ring-primary focus-visible:ring-offset-1">
                      <SelectValue placeholder="Sem projeto" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-lg shadow-lg border">
                      <SelectItem value="none">Sem projeto</SelectItem>
                      {(projs ?? []).filter(p => p && p.id).length > 0 ? (
                        (projs ?? []).filter(p => p && p.id).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <EmptySelectMessage
                          title="Nenhum projeto cadastrado ainda."
                          description="Acesse Projetos para cadastrar o primeiro."
                          action={{ label: "Ir para Projetos", href: "/projetos" }}
                        />
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-tags" className="text-sm font-semibold">Tags (separe por vírgula)</Label>
                <Input
                  id="doc-tags"
                  placeholder="ex: hídrico, relatório final, 2024"
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  className="rounded-lg bg-background/50 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-file" className="text-sm font-semibold">Arquivo *</Label>
                <div className="relative flex items-center justify-center border-2 border-dashed border-muted hover:border-primary/50 transition-colors duration-200 rounded-xl bg-background/30 p-5 text-center cursor-pointer">
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] ?? null })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">
                      {draft.file ? draft.file.name : "Clique para selecionar ou arraste o arquivo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {draft.file ? `${formatBytes(draft.file.size)} - ${draft.file.type}` : "PDF, Word, Excel, PowerPoint, ZIP (Máx. 50MB)"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 border-t pt-4">
              <CollaboratorsSection
                tabela="documentos"
                registro_id={novaVersao?.id || null}
                created_by={draft.created_by || user?.id || null}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg border-muted hover:bg-accent">
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={upload.isPending}
                className="bg-primary text-white hover:bg-primary/95 rounded-lg font-semibold px-5"
              >
                {upload.isPending ? "Enviando..." : "Enviar documento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4">
        {/* Card de Filtros: Período + Avançados */}
        <Card className="border border-muted/80 bg-card/60 backdrop-blur-md shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, descrição ou tag..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 bg-background/50 rounded-lg focus-visible:ring-primary focus-visible:ring-offset-1 border-muted"
                />
              </div>

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
                    {(filtroCategoria !== "todos" || filtroProjeto !== "todos" || filtroAtividade !== "todos" || filtroAcaoIndependente !== "todos") && (
                      <Badge variant="secondary" className="ml-1 rounded-sm px-1.5 py-0 text-[10px]">
                        Ativo
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 space-y-4" align="start">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Categoria</Label>
                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger className="h-9 text-xs bg-background/50">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos" className="text-xs">Todas as categorias</SelectItem>
                        {docCats.filter(c => c && c.id).length > 0 ? (
                          docCats.filter(c => c && c.id).map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.nome}
                            </SelectItem>
                          ))
                        ) : (
                          <EmptySelectMessage
                            title="Nenhuma categoria cadastrada."
                            action={{ label: "Ir para Cadastros", href: "/cadastros" }}
                          />
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Projeto</Label>
                    <Select value={filtroProjeto} onValueChange={setFiltroProjeto}>
                      <SelectTrigger className="h-9 text-xs bg-background/50">
                        <SelectValue placeholder="Todos os projetos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos" className="text-xs">Todos os projetos</SelectItem>
                        {(projs ?? []).filter(p => p && p.id).length > 0 ? (
                          (projs ?? []).filter(p => p && p.id).map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.nome}
                            </SelectItem>
                          ))
                        ) : (
                          <EmptySelectMessage
                            title="Nenhum projeto cadastrado ainda."
                            description="Acesse Projetos para cadastrar o primeiro."
                            action={{ label: "Ir para Projetos", href: "/projetos" }}
                          />
                        )}
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
                          const label = `${at.titulo || at.descricao?.slice(0, 30) || "Sem título"} (${safeFormatDate(at.data)})`;
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
                          const label = `${at.titulo || at.descricao?.slice(0, 30) || "Sem título"} (${safeFormatDate(at.data)})`;
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

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="h-3 w-3" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading and List State */}
        {isLoading ? (
          <CardListSkeleton count={4} />
        ) : rootDocs.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={<SearchX />}
              title="Nenhum resultado encontrado"
              description="Tente ajustar os filtros ou limpar a busca."
              action={{ label: "Limpar filtros", onClick: clearFilters }}
            />
          ) : (
            <EmptyState
              icon={<FileX />}
              title="Nenhum documento cadastrado"
              description="Os documentos anexados em atividades aparecem aqui."
            />
          )
        ) : (
          <div className="grid gap-3.5">
            {rootDocs.map((doc) => {
              return (
                <DocumentoRow
                  key={doc.id}
                  doc={doc}
                  catMap={catMap}
                  projMap={projMap}
                  baixar={baixar}
                  setNovaVersao={setNovaVersao}
                  setDraft={setDraft}
                  setOpen={setOpen}
                  setViewingVersions={setViewingVersions}
                  setToDelete={setToDelete}
                  versionsOf={versionsOf}
                  profilesMap={profilesMap}
                />
              );
            })}
          </div>
        )}

        {/* Controles de paginação */}
        {totalCount > PAGE_SIZE && (
          <PaginationControls
            page={page}
            setPage={setPage}
            count={totalCount}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>

      {/* Modal: View Version History */}
      <Dialog open={!!viewingVersions} onOpenChange={(o) => !o && setViewingVersions(null)}>
        <DialogContent className="max-w-lg rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <FolderOpen className="h-5 w-5 text-primary" />
              Versões — {viewingVersions?.titulo}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Histórico completo de versões deste documento, ordenadas da mais recente para a mais antiga.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-3 max-h-[50vh] overflow-y-auto pr-1">
            {viewingVersions &&
              versionsOf(viewingVersions.id).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between border border-muted/80 rounded-xl px-4 py-3 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-sm font-semibold flex items-center gap-2 mb-0.5">
                      <Badge variant="secondary" className="px-1.5 py-0 rounded bg-secondary/50 font-bold text-xs select-none">
                        v{v.versao}
                      </Badge>
                      <span className="text-muted-foreground text-xs font-normal">
                        Criado em: {safeFormatDate(v.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                      {v.titulo} ({formatBytes(v.tamanho)})
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => baixar(v)}
                    className="gap-1.5 rounded-lg border-muted hover:bg-accent text-xs font-semibold shrink-0"
                  >
                    <Download className="h-3 w-3" /> Baixar
                  </Button>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog: Confirm Deletion */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-foreground">Excluir documento permanentemente?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              O documento &quot;{toDelete?.titulo}&quot; e suas informações de metadados serão apagados permanentemente do banco de dados e do servidor de arquivos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-lg border-muted hover:bg-accent">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg font-semibold px-5"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function DocumentoRow({
  doc,
  catMap,
  projMap,
  baixar,
  setNovaVersao,
  setDraft,
  setOpen,
  setViewingVersions,
  setToDelete,
  versionsOf,
  profilesMap,
}: {
  doc: Documento;
  catMap: Map<string, string>;
  projMap: Map<string, string>;
  baixar: (doc: Documento) => void;
  setNovaVersao: (doc: Documento | null) => void;
  setDraft: any;
  setOpen: (open: boolean) => void;
  setViewingVersions: (doc: Documento | null) => void;
  setToDelete: (doc: Documento | null) => void;
  versionsOf: (docId: string) => Documento[];
  profilesMap: Map<string, any>;
}) {
  const { podeEditar, podeExcluir, isCriador } = useRegistroPermissao("documentos", doc.id, doc.created_by);

  const allVersions = versionsOf(doc.id);
  const totalVersions = allVersions.length;

  const creatorProfile = doc.created_by ? profilesMap.get(doc.created_by) : null;
  const creatorName = creatorProfile?.full_name || creatorProfile?.email?.split("@")[0] || "Sem dono";

  return (
    <Card className="border border-muted/80 bg-card hover:bg-card/90 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 rounded-xl overflow-hidden group">
      <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-2xl leading-none select-none shrink-0">
              {getFileIcon(doc.mime_type, doc.titulo)}
            </span>
            <span className="font-semibold text-base text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl group-hover:text-primary transition-colors duration-200">
              {doc.titulo}
            </span>
            <Badge variant="secondary" className="bg-secondary/40 text-secondary-foreground font-semibold px-2 py-0.5 rounded text-xs select-none">
              v{doc.versao}
            </Badge>
            {isCriador && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{ backgroundColor: "#D4EDDA", color: "#2D5A27" }}
              >
                Seu registro
              </span>
            )}
            {doc.categoria_id && catMap.has(doc.categoria_id) && (
              <Badge variant="outline" className="border-primary/20 text-primary font-medium px-2 py-0.5 rounded text-[10px] select-none">
                {catMap.get(doc.categoria_id)}
              </Badge>
            )}
            {doc.projeto_id && projMap.has(doc.projeto_id) && (
              <Badge variant="outline" className="border-muted-foreground/35 text-muted-foreground font-medium px-2 py-0.5 rounded text-[10px] select-none">
                {projMap.get(doc.projeto_id)}
              </Badge>
            )}
          </div>
          
          {doc.descricao && (
            <p className="text-sm text-muted-foreground/90 mt-1.5 line-clamp-2 leading-relaxed">
              {doc.descricao}
            </p>
          )}

          {/* Document Details & Tags */}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span>Tamanho: {formatBytes(doc.tamanho)}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/45" />
            <span>Criado: {safeFormatDate(doc.created_at)}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/45" />
            <span>Dono: {creatorName}</span>
            {doc.tags && doc.tags.length > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/45" />
                <div className="flex gap-1 flex-wrap">
                  {doc.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[9px] bg-background/50 hover:bg-background/80 transition-colors py-0 px-1.5 border-muted font-normal text-muted-foreground select-none">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions Panel */}
        <div className="flex items-center gap-1 shrink-0 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 border-muted">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => baixar(doc)}
            title="Baixar documento"
            className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!podeEditar) {
                denyToast();
                return;
              }
              setNovaVersao(doc);
              setDraft({
                titulo: doc.titulo,
                descricao: doc.descricao ?? "",
                categoria_id: doc.categoria_id ?? "none",
                projeto_id: doc.projeto_id ?? "none",
                file: null,
                tags: (doc.tags ?? []).join(", "),
                created_by: doc.created_by ?? null,
              });
              setOpen(true);
            }}
            title="Enviar nova versão"
            className="h-9 w-9 rounded-lg hover:bg-secondary/20 hover:text-secondary-foreground text-primary transition-all duration-200"
          >
            <History className="h-4 w-4" />
          </Button>

          {totalVersions > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewingVersions(doc)}
              title="Histórico de versões"
              className="h-9 w-9 rounded-lg hover:bg-accent hover:text-accent-foreground text-foreground transition-all duration-200"
            >
              <GitBranch className="h-4 w-4 text-purple-600" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!podeExcluir) {
                denyToast();
                return;
              }
              setToDelete(doc);
            }}
            title="Excluir documento"
            className="h-9 w-9 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-all duration-200"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
