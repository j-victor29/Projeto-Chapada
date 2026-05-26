import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Download,
  Trash2,
  Search,
  FileText,
  GitBranch,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { useProjetos } from "@/lib/projetosStore";
import { addDocumento, deleteDocumento, useDocumentos, type DocumentoItem } from "@/lib/documentosStore";
import { formatDate } from "@/lib/mockData";
import { addNotification } from "@/lib/notificationsStore";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Biblioteca de Documentos — CHAPADA" },
      { name: "description", content: "Gestão, upload e versionamento de documentos institucionais." },
    ],
  }),
  component: DocumentosPage,
});

// Categorias locais para o formulário (fallback sem banco)
const CATEGORIAS_PADRAO = [
  "Relatório",
  "Apresentação",
  "Planilha Orçamentária",
  "Projeto Base",
  "Manual",
  "Projeto Executivo",
  "Contrato",
  "Termo de Referência",
  "Outros",
];

function fileIcon(nome: string) {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "📄";
  if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["ppt", "pptx"].includes(ext)) return "📋";
  if (["zip", "rar"].includes(ext)) return "🗜️";
  return "📎";
}

function DocumentosPage() {
  const docs = useDocumentos();
  const projetos = useProjetos();
  const { query } = useGlobalSearch();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todos");
  const [fProjeto, setFProjeto] = useState("todos");

  // Upload modal
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ projetoId: "", categoria: "", tagsRaw: "", documentoPaiId: "" });
  const [saving, setSaving] = useState(false);

  // Delete
  const [toDelete, setToDelete] = useState<DocumentoItem | null>(null);

  // Versões
  const [viewingVersions, setViewingVersions] = useState<DocumentoItem | null>(null);

  const filtered = useMemo(() => {
    const q = (query + " " + search).trim().toLowerCase();
    return docs.filter((d) => {
      if (q && ![d.nome, d.projeto ?? "", d.categoria ?? "", (d.tags ?? []).join(" ")]
        .join(" ").toLowerCase().includes(q)) return false;
      if (fCategoria !== "todos" && d.categoria !== fCategoria) return false;
      if (fProjeto !== "todos" && d.projeto_id !== fProjeto) return false;
      return true;
    });
  }, [docs, query, search, fCategoria, fProjeto]);

  // Documentos raiz (sem pai) para listagem principal
  const rootDocs = filtered.filter((d) => !d.documento_pai_id);

  // Versões de um documento
  const versionsOf = (docId: string) =>
    docs.filter((d) => d.documento_pai_id === docId || d.id === docId)
        .sort((a, b) => (a.versao ?? 1) - (b.versao ?? 1));

  const openPicker = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 50 MB).");
      return;
    }
    setPendingFile(file);
    setForm({ projetoId: "", categoria: "", tagsRaw: "", documentoPaiId: "" });
    setUploadOpen(true);
  };

  const handleSave = async () => {
    if (!pendingFile) return;
    if (!form.categoria) {
      toast.error("Selecione uma categoria.");
      return;
    }
    setSaving(true);
    try {
      const tags = form.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      await addDocumento({
        file: pendingFile,
        projetoId: form.projetoId || undefined,
        categoria: form.categoria || undefined,
        tags,
        documentoPaiId: form.documentoPaiId || undefined,
      });
      addNotification({
        type: "atividade",
        title: "Documento enviado",
        body: pendingFile.name,
      });
      toast.success("Documento salvo na biblioteca.");
      setPendingFile(null);
      setUploadOpen(false);
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message ?? "Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (doc: DocumentoItem) => {
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.nome;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteDocumento(toDelete.id);
      toast.success("Documento excluído.");
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e?.message ?? ""));
    } finally {
      setToDelete(null);
    }
  };

  return (
    <AppLayout
      title="Biblioteca de Documentos"
      subtitle="Organização institucional, categorização e versionamento"
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip,.rar"
            onChange={onFileChange}
          />
          <Button onClick={openPicker} className="gap-2">
            <Upload className="h-4 w-4" /> Enviar Documento
          </Button>
        </>
      }
    >
      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documento..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={fCategoria} onValueChange={setFCategoria}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIAS_PADRAO?.filter(c => c && String(c).trim() !== "").map((c) => (
                <SelectItem key={c} value={String(c)}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fProjeto} onValueChange={setFProjeto}>
            <SelectTrigger>
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os projetos</SelectItem>
              {projetos?.filter(p => p.id && String(p.id).trim() !== "").map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rootDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted" />
                    {docs.length === 0
                      ? 'Biblioteca vazia. Clique em "Enviar Documento" para começar.'
                      : "Nenhum documento encontrado com os filtros selecionados."}
                  </TableCell>
                </TableRow>
              ) : (
                rootDocs.map((doc) => {
                  const totalVersions = docs.filter(
                    (d) => d.documento_pai_id === doc.id
                  ).length;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{fileIcon(doc.nome)}</span>
                          <div>
                            <div className="font-medium text-sm">{doc.nome}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.categoria ? (
                          <Badge variant="secondary" className="text-[10px]">{doc.categoria}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.projeto || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(doc.tags ?? []).slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            v{doc.versao ?? 1}
                          </Badge>
                          {totalVersions > 0 && (
                            <button
                              type="button"
                              onClick={() => setViewingVersions(doc)}
                              className="text-xs text-primary hover:underline flex items-center gap-0.5"
                            >
                              <GitBranch className="h-3 w-3" />
                              +{totalVersions}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {doc.created_at ? formatDate(doc.created_at.slice(0, 10)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => {
                              setPendingFile(null);
                              setForm({ projetoId: doc.projeto_id ?? "", categoria: doc.categoria ?? "", tagsRaw: (doc.tags ?? []).join(", "), documentoPaiId: doc.id });
                              setUploadOpen(true);
                            }}
                            title="Enviar nova versão"
                          >
                            <GitBranch className="h-4 w-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(doc)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Upload */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!o) { setPendingFile(null); setUploadOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.documentoPaiId ? "Enviar Nova Versão" : "Novo Documento"}
            </DialogTitle>
            <DialogDescription>
              {pendingFile
                ? `Arquivo: ${pendingFile.name}`
                : form.documentoPaiId
                ? "Selecione o arquivo para a nova versão do documento."
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seleção de arquivo se não carregado */}
            {!pendingFile && (
              <div>
                <Label>Arquivo</Label>
                <div
                  className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar</p>
                </div>
              </div>
            )}

            {pendingFile && (
              <div className="rounded-lg bg-muted p-3 flex items-center gap-3">
                <span className="text-2xl">{fileIcon(pendingFile.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(pendingFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PADRAO?.filter(c => c && String(c).trim() !== "").map((c) => (
                    <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Projeto (opcional)</Label>
              <Select value={form.projetoId} onValueChange={(v) => setForm((f) => ({ ...f, projetoId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projetos?.filter(p => p.id && String(p.id).trim() !== "").map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                className="mt-1"
                placeholder="ex: hídrico, relatório final, 2024"
                value={form.tagsRaw}
                onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))}
              />
            </div>

            {form.documentoPaiId && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 bg-primary/5 rounded px-3 py-2">
                <GitBranch className="h-3 w-3 text-primary" />
                Nova versão do documento original
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingFile(null); setUploadOpen(false); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !pendingFile}>
              {saving ? "Enviando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Versões */}
      <Dialog open={!!viewingVersions} onOpenChange={(o) => !o && setViewingVersions(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Versões — {viewingVersions?.nome}
            </DialogTitle>
            <DialogDescription>Histórico de versões deste documento</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {viewingVersions && versionsOf(viewingVersions.id).map((v) => (
              <div key={v.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="secondary">v{v.versao}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {v.created_at ? formatDate(v.created_at.slice(0, 10)) : "—"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{v.nome}</div>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDownload(v)}>
                  <Download className="h-3 w-3" /> Baixar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar deleção */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{toDelete?.nome}&quot; será removido permanentemente. Esta ação não pode ser desfeita.
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
