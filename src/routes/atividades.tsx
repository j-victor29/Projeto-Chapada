import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/atividades")({
  head: () => ({ meta: [{ title: "Atividades — CHAPADA" }] }),
  component: AtividadesPage,
});

const PAGE_SIZE = 10;
const TIPOS = [
  "Oficina",
  "Encontro",
  "Entrega",
  "Visita Técnica",
  "Capacitação",
  "Reunião",
];

interface Anexo {
  nome: string;
  dataUrl: string;
}

const emptyForm = {
  projetoId: "",
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
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [toDelete, setToDelete] = useState<AtividadeFull | null>(null);
  const { email: currentEmail, name: currentName } = useCurrentUser();
  const editingOwnership = useOwnership("atividade", editingId ?? "");

  const projetoMap = useMemo(
    () => new Map(projetos.map((p) => [p.id, p])),
    [projetos]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordenadas;
    return ordenadas.filter((a) => {
      const proj = projetoMap.get(a.projetoId)?.nome ?? "";
      return [a.descricao, a.tipo, a.local, a.responsaveis, a.municipio ?? "", proj]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [ordenadas, query, projetoMap]);

  const total = filtered.length;
  const items = filtered.slice(0, visible);
  const hasMore = visible < total;

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    setTimeout(() => {
      setVisible((v) => Math.min(v + PAGE_SIZE, total));
      setLoading(false);
    }, 200);
  }, [loading, hasMore, total]);

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
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.projetoId || !form.data || !form.tipo || !form.descricao) {
      toast.error("Preencha Projeto, Data, Tipo de Ação e Descrição.");
      return;
    }
    const payload = {
      projetoId: form.projetoId,
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
                      <p className="text-sm">{a.descricao}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {a.local}
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
              <Select value={form.tipo || undefined} onValueChange={setF("tipo")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.length > 0 ? (
                    TIPOS?.filter(t => t && String(t).trim() !== "").map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {t}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhum tipo</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Município</Label>
              <Select value={form.municipio || undefined} onValueChange={setF("municipio")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {dbMunicipios.length > 0 ? (
                    dbMunicipios.map((m) => (
                      <SelectItem key={m.id} value={m.nome}>
                        {m.nome}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhum município</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Local / Comunidade</Label>
              <Input
                value={form.local}
                onChange={(e) => setF("local")(e.target.value)}
                placeholder="Ex: Comunidade Olho d'Água"
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
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={form[key]}
                        onChange={(e) =>
                          setF(key)(e.target.value.replace(/[^\d]/g, ""))
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
