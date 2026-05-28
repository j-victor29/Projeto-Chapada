import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";

export const Route = createFileRoute("/imagens")({
  head: () => ({ meta: [{ title: "Banco de Imagens — CHAPADA" }] }),
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
  const imgs = useImagens();
  const { data: dbMunicipios = [] } = Municipios.useList();
  const categorias = useCategorias();
  const projetos = useProjetos();
  const { query } = useGlobalSearch();
  const { email: currentEmail, name: currentName } = useCurrentUser();
  const [selected, setSelected] = useState<ImagemItem | null>(null);
  const [toDelete, setToDelete] = useState<ImagemItem | null>(null);
  const [editing, setEditing] = useState<ImagemItem | null>(null);
  const editingOwnership = useOwnership("imagem", editing?.id ?? "");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return imgs.filter((i) => {
      const matchesQuery = !q ||
        [i.projeto, i.local, i.tipo, i.date, i.nomeArquivo, i.categoriaNome]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesCategoria =
        !categoriaFiltro || i.categoriaId === categoriaFiltro;
      return matchesQuery && matchesCategoria;
    });
  }, [imgs, query, categoriaFiltro]);

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
    setForm({ projetoId: "", projetoNome: "", local: "", tipo: "", date: isoDate });
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
      toast.success("Imagem adicionada à galeria.");
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
    } catch {
      toast.error("Erro ao enviar imagem. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (img: ImagemItem) => {
    if (!canEdit("imagem", img.id, currentEmail)) {
      denyToast();
      return;
    }
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
    if (!canEdit("imagem", editing.id, currentEmail)) {
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
      toast.success("Imagem atualizada.");
      setEditing(null);
    } catch {
      toast.error("Erro ao atualizar imagem.");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (img: ImagemItem) => {
    if (!canEdit("imagem", img.id, currentEmail)) {
      denyToast();
      return;
    }
    setToDelete(img);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    if (!canEdit("imagem", toDelete.id, currentEmail)) {
      denyToast();
      setToDelete(null);
      return;
    }
    try {
      await removeImagem(toDelete.id);
      removeOwnership("imagem", toDelete.id);
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
          <Button onClick={openPicker} className="gap-2">
            <Upload className="h-4 w-4" /> Enviar Imagens
          </Button>
        </>
      }
    >
      {/* ── Barra de filtro por categoria ─────────────────────────── */}
      {categorias.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <button
            onClick={() => setCategoriaFiltro(null)}
            className={[
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              categoriaFiltro === null
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
            ].join(" ")}
          >
            Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setCategoriaFiltro(categoriaFiltro === cat.id ? null : cat.id)
              }
              className={[
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                categoriaFiltro === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
              ].join(" ")}
            >
              {cat.nome}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            {query || categoriaFiltro
              ? "Nenhuma imagem encontrada para este filtro."
              : imgs.length === 0
              ? 'Nenhuma imagem na galeria. Clique em "Enviar Imagens" para começar.'
              : "Carregando galeria..."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <Card
              key={img.id}
              className="overflow-hidden group cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow relative"
            >
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
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
                  <Badge variant="secondary" className="text-[10px]">
                    {img.tipo}
                  </Badge>
                  {img.categoriaNome && (
                    <Badge variant="outline" className="text-[10px]">
                      {img.categoriaNome}
                    </Badge>
                  )}
                </div>
                {(() => {
                  const o = getOwnership("imagem", img.id);
                  return o ? (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Criado por {o.ownerName}
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>
          ))}
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
        <DialogContent className="max-w-md">
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
            {isEditMode && editing && editingOwnership && (
              <CollaboratorsSection
                type="imagem"
                id={editing.id}
                ownership={editingOwnership}
                currentEmail={currentEmail}
              />
            )}
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
        <AlertDialogContent>
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
