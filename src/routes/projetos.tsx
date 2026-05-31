import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatBRL,
  formatDate,
  type ProjetoStatus,
} from "@/lib/mockData";
import { Financiadores, Municipios } from "@/lib/cadastrosStore";
import { calcVigenciaProgress } from "@/lib/progress";
import { toast } from "sonner";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { addNotification } from "@/lib/notificationsStore";
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
import {
  useProjetos,
  addProjeto,
  updateProjeto,
  deleteProjeto,
  type ProjetoDB,
} from "@/lib/projetosStore";

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

const STATUS: ProjetoStatus[] = ["Em execução", "Concluído", "Suspenso"];

const statusVariant: Record<ProjetoStatus, string> = {
  "Em execução": "bg-savanna/15 text-savanna border-savanna/30",
  Concluído: "bg-primary/10 text-primary border-primary/30",
  Suspenso: "bg-terracotta/15 text-terracotta border-terracotta/30",
};

const emptyProjeto: Omit<ProjetoDB, "id"> = {
  nome: "",
  contrato: "",
  financiador: "",
  inicio: "",
  termino: "",
  valor: 0,
  municipios: [],
  publicoQuant: 0,
  publicoCaract: "",
  status: "Em execução",
};

type EditingState = Omit<ProjetoDB, "id"> & { id?: string };

function ProjetosPage() {
  const projetos = useProjetos();
  const { data: dbFinanciadores = [] } = Financiadores.useList();
  const { data: dbMunicipios = [] } = Municipios.useList();
  const [search, setSearch] = useState("");
  const { query: globalQuery } = useGlobalSearch();
  const { email: currentEmail, name: currentName } = useCurrentUser();
  const [fFin, setFFin] = useState<string>("todos");
  const [fMun, setFMun] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState>(emptyProjeto);
  const editingOwnership = useOwnership("projeto", editing.id ?? "");

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

  const openNew = () => {
    setEditing({ ...emptyProjeto });
    setOpen(true);
  };
  const openEdit = (p: ProjetoDB) => {
    if (!canEdit("projeto", p.id, currentEmail)) { denyToast(); return; }
    setEditing(p);
    setOpen(true);
  };

  const save = async () => {
    if (!editing.nome || !editing.financiador) {
      toast.error("Preencha nome e financiador.");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        if (!canEdit("projeto", editing.id, currentEmail)) { denyToast(); return; }
        await updateProjeto(editing.id, editing);
        toast.success("Projeto atualizado.");
      } else {
        const novo = await addProjeto(editing as Omit<ProjetoDB, "id">);
        setOwnership("projeto", novo.id, makeOwnership(currentEmail, currentName));
        addNotification({ type: "projeto", title: "Novo projeto cadastrado", body: editing.nome });
        toast.success("Projeto cadastrado.");
      }
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar projeto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!canEdit("projeto", id, currentEmail)) { denyToast(); return; }
    try {
      await deleteProjeto(id);
      removeOwnership("projeto", id);
      toast.success("Projeto removido.");
    } catch {
      toast.error("Erro ao remover projeto.");
    }
  };

  const toggleMun = (m: string) => {
    setEditing((e) =>
      e.municipios.includes(m)
        ? { ...e, municipios: e.municipios.filter((x) => x !== m) }
        : { ...e, municipios: [...e.municipios, m] }
    );
  };

  return (
    <AppLayout
      title="Projetos"
      subtitle="Cadastro e acompanhamento de projetos institucionais"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="md:col-span-2">
                <Label>Nome do Projeto</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              </div>
              <div>
                <Label>Nº do Contrato/Convênio</Label>
                <Input
                  value={editing.contrato}
                  onChange={(e) => setEditing({ ...editing, contrato: e.target.value })}
                />
              </div>
              <div>
                <Label>Instituição Financiadora</Label>
                <Select
                  value={editing.financiadorId || undefined}
                  onValueChange={(v) => {
                    const selectedFin = dbFinanciadores.find((f) => f.id === v);
                    setEditing({
                      ...editing,
                      financiadorId: v,
                      financiador: selectedFin?.nome ?? "",
                    });
                  }}
                >
                  <SelectTrigger>
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
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={editing.inicio}
                  onChange={(e) => setEditing({ ...editing, inicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Término</Label>
                <Input
                  type="date"
                  value={editing.termino}
                  onChange={(e) => setEditing({ ...editing, termino: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor Total (R$)</Label>
                <CurrencyInput
                  value={editing.valor}
                  onChange={(v) =>
                    setEditing({ ...editing, valor: v || 0 })
                  }
                />
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
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Municípios / Comunidades Atendidos</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {dbMunicipios.map((m) => {
                    const sel = editing.municipios.includes(m.nome);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMun(m.nome)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${sel
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent border-border"
                          }`}
                      >
                        {m.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Público Atendido (quantitativo)</Label>
                <CurrencyInput
                  step={1}
                  value={editing.publicoQuant}
                  onChange={(v) =>
                    setEditing({ ...editing, publicoQuant: v || 0 })
                  }
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
              {editing.id && editingOwnership && (
                <div className="md:col-span-2">
                  <CollaboratorsSection
                    type="projeto"
                    id={editing.id}
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
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Filters */}
      <Card className="mb-4">
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
                <SelectItem key={f.id} value={f.nome}>
                  {f.nome}
                </SelectItem>
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
                <SelectItem key={m.id} value={m.nome}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS?.filter(s => s && String(s).trim() !== "").map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Financiador</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Municípios</TableHead>
                <TableHead>Público</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {projetos.length === 0
                      ? "Carregando projetos..."
                      : "Nenhum projeto encontrado com os filtros selecionados."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">{p.contrato}</div>
                      {(() => {
                        const o = getOwnership("projeto", p.id);
                        return o ? (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Criado por {o.ownerName}
                          </div>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">{p.financiador}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap min-w-[140px]">
                      <div>{formatDate(p.inicio)}</div>
                      <div className="text-muted-foreground">{formatDate(p.termino)}</div>
                      {(() => {
                        const pct = calcVigenciaProgress(p.inicio, p.termino);
                        const done = pct >= 100;
                        return (
                          <div className="mt-1.5">
                            <Progress
                              value={pct}
                              className={`h-1 ${done ? "[&>div]:bg-savanna" : ""}`}
                            />
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {pct}%
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap">
                      {formatBRL(p.valor)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-48">
                        {p.municipios.slice(0, 2).map((m) => (
                          <Badge key={m} variant="secondary" className="text-[10px]">
                            {m}
                          </Badge>
                        ))}
                        {p.municipios.length > 2 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{p.municipios.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.publicoQuant}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] border ${statusVariant[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover projeto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O projeto &quot;{p.nome}&quot; será
                                removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(p.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
