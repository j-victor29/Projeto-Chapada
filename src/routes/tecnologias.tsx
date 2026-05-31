import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  CATEGORIAS,
  CATEGORIA_ORDEM,
  CategoriaTec,
  Tecnologia,
  addTecnologia,
  deleteTecnologia,
  updateTecnologia,
  useTecnologias,
} from "@/lib/tecnologiasStore";
import { formatDate } from "@/lib/mockData";
import { useProjetos } from "@/lib/projetosStore";
import { canEdit, denyToast, getOwnership, makeOwnership, removeOwnership, setOwnership, useOwnership } from "@/lib/ownershipStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { addNotification } from "@/lib/notificationsStore";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tecnologias")({
  component: TecnologiasPage,
});

const todasCategorias = CATEGORIA_ORDEM;

function TecnologiasPage() {
  const tecnologias = useTecnologias();
  const projetos = useProjetos();
  const { email: currentEmail, name: currentName } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [initialCat, setInitialCat] = useState<CategoriaTec>("hidrica");
  const [editing, setEditing] = useState<Tecnologia | null>(null);
  const [toDelete, setToDelete] = useState<Tecnologia | null>(null);
  const queryClient = useQueryClient();

  const projetoMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      todasCategorias.map((c) => [c, [] as typeof tecnologias]),
    ) as Record<CategoriaTec, typeof tecnologias>;
    tecnologias.forEach((t) => map[t.categoria].push(t));
    return map;
  }, [tecnologias]);

  const openCreate = (cat: CategoriaTec) => {
    setEditing(null);
    setInitialCat(cat);
    setOpen(true);
  };

  const openEdit = (t: Tecnologia) => {
    if (!canEdit("tecnologia", t.id, currentEmail)) { denyToast(); return; }
    setEditing(t);
    setInitialCat(t.categoria);
    setOpen(true);
  };

  const requestDelete = (t: Tecnologia) => {
    if (!canEdit("tecnologia", t.id, currentEmail)) { denyToast(); return; }
    setToDelete(t);
  };

  return (
    <AppLayout
      title="Tecnologias Sociais"
      subtitle="Registro e monitoramento das tecnologias implementadas pela CHAPADA"
      actions={
        <Button className="gap-2" onClick={() => openCreate("hidrica")}>
          <Plus className="h-4 w-4" /> Nova Tecnologia
        </Button>
      }
    >
      <div className="space-y-6">
        {todasCategorias.map((cat) => {
          const meta = CATEGORIAS[cat];
          const items = grouped[cat];
          const total = items.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
          return (
            <Card key={cat} className="overflow-hidden">
              <div
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-white"
                style={{ backgroundColor: meta.color }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{meta.emoji}</span>
                  <div>
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-xs text-white/80">
                      {items.length} tecnologia(s) cadastrada(s) · Total: {total.toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1 bg-white/95 text-foreground hover:bg-white"
                  onClick={() => openCreate(cat)}
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
              <CardContent className="p-0 overflow-x-auto">
                {items.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    Nenhuma tecnologia cadastrada nesta categoria.{" "}
                    <span className="text-xs">Exemplos: {meta.exemplos.join(", ")}.</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Quantidade</TableHead>
                        {meta.mostraFamilias && <TableHead>Famílias</TableHead>}
                        <TableHead>Municípios</TableHead>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((t) => {
                        const projetoRow = projetoMap.get(t.projetoId ?? "");
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.nome}</TableCell>
                            <TableCell>
                              {t.quantidade.toLocaleString("pt-BR")} {t.unidade}
                            </TableCell>
                            {meta.mostraFamilias && (
                              <TableCell>{t.familias ?? "—"}</TableCell>
                            )}
                            <TableCell className="text-sm text-muted-foreground">
                              {t.municipios}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>{projetoRow?.nome ?? "—"}</div>
                              {(() => { const o = getOwnership("tecnologia", t.id); return o ? <div className="text-[10px] text-muted-foreground mt-0.5">Criado por {o.ownerName}</div> : null; })()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(t.data)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label="Editar"
                                onClick={() => openEdit(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                aria-label="Excluir"
                                onClick={() => requestDelete(t)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TecnologiaModal
        open={open}
        onOpenChange={setOpen}
        initialCategoria={initialCat}
        editing={editing}
        projetos={projetos}
        currentEmail={currentEmail}
        currentName={currentName}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir esta tecnologia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {toDelete ? `"${toDelete.nome}" será removida permanentemente.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) {
                  if (!canEdit("tecnologia", toDelete.id, currentEmail)) { denyToast(); setToDelete(null); return; }
                  try {
                    await deleteTecnologia(toDelete.id);
                    removeOwnership("tecnologia", toDelete.id);
                    queryClient.invalidateQueries({ queryKey: ["tecnologias"] });
                    toast.success("Tecnologia excluída.");
                  } catch (err) {
                    console.error("Erro ao excluir tecnologia:", err);
                    toast.error("Erro ao excluir tecnologia.");
                  }
                }
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

const catToLineId: Record<string, number> = {
  hidrica: 1,
  saneamento: 2,
  energia: 3,
  agroecologia: 4,
  alimentacao: 5,
  inclusao: 6,
  formacao: 7,
  ambiente: 8,
  comunicacao: 9,
};

function TecnologiaModal({
  open,
  onOpenChange,
  initialCategoria,
  editing,
  projetos,
  currentEmail,
  currentName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCategoria: CategoriaTec;
  editing: Tecnologia | null;
  projetos: { id: string; nome: string }[];
  currentEmail: string;
  currentName: string;
}) {
  const { data: dbCatalog = [] } = useQuery({
    queryKey: ["tecnologias_sociais_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnologias_sociais")
        .select("id, nome, linha_de_acao_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [categoria, setCategoria] = useState<CategoriaTec>(initialCategoria);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("unidades");
  const [familias, setFamilias] = useState("");
  const [municipios, setMunicipios] = useState("");
  const [comunidades, setComunidades] = useState("");
  const [projetoId, setProjetoId] = useState<string>("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const editingOwnership = useOwnership("tecnologia", editing?.id ?? "");

  const activeLineId = catToLineId[categoria] || 1;
  const filteredCatalog = dbCatalog.filter((x) => x.linha_de_acao_id === activeLineId);
  const dropdownOptions = filteredCatalog.length > 0
    ? filteredCatalog.map((x) => x.nome)
    : CATEGORIAS[categoria].exemplos;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCategoria(editing.categoria);
      setNome(editing.nome);
      setQuantidade(String(editing.quantidade));
      setUnidade(editing.unidade);
      setFamilias(editing.familias ? String(editing.familias) : "");
      setMunicipios(editing.municipios);
      setComunidades(editing.comunidades ?? "");
      setProjetoId(editing.projetoId ?? "");
      setData(editing.data);
      setObservacoes(editing.observacoes ?? "");
    } else {
      setCategoria(initialCategoria);
      setUnidade(CATEGORIAS[initialCategoria].unidades[0]);
      setNome("");
      setQuantidade("");
      setFamilias("");
      setMunicipios("");
      setComunidades("");
      setProjetoId("");
      setData(new Date().toISOString().slice(0, 10));
      setObservacoes("");
    }
  }, [open, editing, initialCategoria]);

  const meta = CATEGORIAS[categoria];

  const queryClient = useQueryClient();

  const submit = async () => {
    if (!nome || !quantidade) return;
    const payload = {
      categoria,
      nome,
      quantidade: Number(quantidade),
      unidade,
      familias: meta.mostraFamilias && familias ? Number(familias) : undefined,
      municipios,
      comunidades: comunidades || undefined,
      projetoId: projetoId || undefined,
      data,
      observacoes: observacoes || undefined,
    };
    try {
      if (editing) {
        if (!canEdit("tecnologia", editing.id, currentEmail)) { denyToast(); return; }
        await updateTecnologia(editing.id, payload);
        toast.success("Tecnologia atualizada.");
      } else {
        const newId = await addTecnologia(payload);
        setOwnership("tecnologia", newId, makeOwnership(currentEmail, currentName));
        addNotification({ type: "tecnologia", title: "Nova tecnologia cadastrada", body: nome });
        toast.success("Tecnologia cadastrada.");
      }
      queryClient.invalidateQueries({ queryKey: ["tecnologias"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar tecnologia:", err);
      toast.error("Erro ao salvar tecnologia.");
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Tecnologia" : "Nova Tecnologia"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={categoria}
              onValueChange={(v) => {
                const c = v as CategoriaTec;
                setCategoria(c);
                setUnidade(CATEGORIAS[c].unidades[0]);
                setNome("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {todasCategorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIAS[c].emoji} {CATEGORIAS[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Nome da tecnologia</Label>
            <Select value={nome || undefined} onValueChange={setNome}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tecnologia" />
              </SelectTrigger>
              <SelectContent>
                {dropdownOptions.length > 0 ? (
                  dropdownOptions.filter(ex => ex && String(ex).trim() !== "").map((ex) => (
                    <SelectItem key={ex} value={String(ex)}>
                      {ex}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Nenhuma tecnologia disponível</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Quantidade implementada</Label>
            <CurrencyInput step={1} value={quantidade !== "" ? Number(quantidade) : undefined} onChange={(v) => setQuantidade(v !== undefined ? String(v) : "")} />
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["unidades", "hectares", "famílias"].map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {meta.mostraFamilias && (
            <div className="space-y-1.5">
              <Label>Famílias beneficiadas</Label>
              <CurrencyInput step={1} value={familias !== "" ? Number(familias) : undefined} onChange={(v) => setFamilias(v !== undefined ? String(v) : "")} />
            </div>
          )}

          <div className="md:col-span-2 space-y-1.5">
            <Label>Municípios atendidos</Label>
            <Input value={municipios} onChange={(e) => setMunicipios(e.target.value)} placeholder="Ex: Araripina, Ouricuri" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Comunidades</Label>
            <Input value={comunidades} onChange={(e) => setComunidades(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Projeto vinculado</Label>
            <Select value={projetoId || undefined} onValueChange={setProjetoId}>
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
          <div className="space-y-1.5">
            <Label>Data de implementação</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
          </div>
          {editing && editingOwnership && (
            <div className="md:col-span-2">
              <CollaboratorsSection type="tecnologia" id={editing.id} ownership={editingOwnership} currentEmail={currentEmail} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{editing ? "Salvar alterações" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
