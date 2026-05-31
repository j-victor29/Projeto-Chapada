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
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Search,
  Droplets,
  Users,
  MapPin,
  Info,
  Wrench,
} from "lucide-react";
import { formatDate } from "@/lib/mockData";
import { useProjetos } from "@/lib/projetosStore";
import { canEdit, denyToast, getOwnership, makeOwnership, removeOwnership, setOwnership, useOwnership } from "@/lib/ownershipStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { addNotification } from "@/lib/notificationsStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tecnologias")({
  component: TecnologiasPage,
});

interface ProjetoTecnologiaRow {
  id: string;
  projeto_id: string;
  tecnologia_id: string;
  quantidade: number;
  unidade: string;
  familias?: number;
  municipios: string;
  comunidades?: string;
  data: string;
  observacoes?: string;
  tecnologias?: {
    nome: string;
    linha_acao: string;
  };
  projetos?: {
    nome: string;
  };
}

function TecnologiasPage() {
  const projetos = useProjetos();
  const { email: currentEmail, name: currentName } = useCurrentUser();
  
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjetoTecnologiaRow | null>(null);
  const [toDelete, setToDelete] = useState<ProjetoTecnologiaRow | null>(null);
  
  const [tecnologias, setTecnologias] = useState<ProjetoTecnologiaRow[]>([]);
  const [catalogo, setCatalogo] = useState<{ id: string; nome: string; linha_acao: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [linhaFiltro, setLinhaFiltro] = useState("all");

  const fetchTecnologias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projeto_tecnologias")
      .select(`
        id,
        projeto_id,
        tecnologia_id,
        quantidade,
        unidade,
        familias,
        municipios,
        comunidades,
        data,
        observacoes,
        tecnologias (
          id,
          nome,
          linha_acao
        ),
        projetos (
          nome
        )
      `)
      .order("data", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("ERRO SUPABASE:", error.code, error.message, error.details, error.hint);
      toast.error(`Erro ao carregar tecnologias: ${error.message}`);
    } else {
      setTecnologias((data as unknown as ProjetoTecnologiaRow[]) || []);
    }
    setLoading(false);
  };

  const fetchCatalogo = async () => {
    const { data, error } = await supabase
      .from("tecnologias")
      .select("id, nome, linha_acao")
      .order("linha_acao")
      .order("nome");
    if (error) {
      console.error("Erro ao buscar catálogo:", error);
    } else {
      setCatalogo(data || []);
    }
  };

  useEffect(() => {
    fetchTecnologias();
    fetchCatalogo();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (t: ProjetoTecnologiaRow) => {
    if (!canEdit("tecnologia", t.id, currentEmail)) { denyToast(); return; }
    setEditing(t);
    setOpen(true);
  };

  const requestDelete = (t: ProjetoTecnologiaRow) => {
    if (!canEdit("tecnologia", t.id, currentEmail)) { denyToast(); return; }
    setToDelete(t);
  };

  // Métricas do Dashboard
  const metrics = useMemo(() => {
    const totalQty = tecnologias.reduce((acc, t) => acc + (Number(t.quantidade) || 0), 0);
    const totalFamilies = tecnologias.reduce((acc, t) => acc + (Number(t.familias) || 0), 0);
    
    const uniqueProj = new Set(tecnologias.map(t => t.projeto_id).filter(Boolean)).size;
    
    const allCities = tecnologias.flatMap(t => t.municipios ? t.municipios.split(",").map(s => s.trim()) : []);
    const uniqueCities = new Set(allCities.filter(Boolean)).size;

    return { totalQty, totalFamilies, uniqueProj, uniqueCities };
  }, [tecnologias]);

  // Lista única de Linhas de Ação do Catálogo para o filtro
  const linhasDeAcao = useMemo(() => {
    return [...new Set(catalogo.map(t => t.linha_acao))];
  }, [catalogo]);

  // Filtragem dos itens na listagem
  const filteredTecnologias = useMemo(() => {
    return tecnologias.filter(t => {
      const nomeTech = t.tecnologias?.nome?.toLowerCase() || "";
      const projName = t.projetos?.nome?.toLowerCase() || "";
      const muni = t.municipios?.toLowerCase() || "";
      const obs = t.observacoes?.toLowerCase() || "";
      const search = searchQuery.toLowerCase();

      const matchesSearch = 
        nomeTech.includes(search) || 
        projName.includes(search) || 
        muni.includes(search) || 
        obs.includes(search);

      const matchesLinha = linhaFiltro === "all" || t.tecnologias?.linha_acao === linhaFiltro;

      return matchesSearch && matchesLinha;
    });
  }, [tecnologias, searchQuery, linhaFiltro]);

  return (
    <AppLayout
      title="Tecnologias Sociais"
      subtitle="Catálogo oficial e registro de tecnologias sociais implementadas pela CHAPADA no Semiárido"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Tecnologia
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl text-primary shrink-0">
              <Droplets className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Convivência e Transformação no Semiárido
              </h3>
              <p className="text-sm text-muted-foreground max-w-4xl">
                A ONG Chapada acumula mais de 31 anos de atuação nas comunidades do Semiárido pernambucano e piauiense, 
                tendo implantado quase <strong>11 mil tecnologias sociais hídricas</strong> e beneficiado aproximadamente 
                <strong> 22 mil famílias agricultoras</strong>. Os registros abaixo são integrados aos projetos financiados pelos nossos parceiros e apoiadores.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Implementações</span>
                <h4 className="text-2xl font-bold">{tecnologias.length}</h4>
                <p className="text-[11px] text-muted-foreground">Tecnologias registradas</p>
              </div>
              <Wrench className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Quantidade Total</span>
                <h4 className="text-2xl font-bold">{metrics.totalQty.toLocaleString("pt-BR")}</h4>
                <p className="text-[11px] text-muted-foreground">Unidades implantadas</p>
              </div>
              <Droplets className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Famílias Atendidas</span>
                <h4 className="text-2xl font-bold">{metrics.totalFamilies.toLocaleString("pt-BR")}</h4>
                <p className="text-[11px] text-muted-foreground">Famílias beneficiadas</p>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alcance Geográfico</span>
                <h4 className="text-2xl font-bold">{metrics.uniqueCities} {metrics.uniqueCities === 1 ? "Município" : "Municípios"}</h4>
                <p className="text-[11px] text-muted-foreground">Em {metrics.uniqueProj} {metrics.uniqueProj === 1 ? "projeto" : "projetos"}</p>
              </div>
              <MapPin className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-border">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tecnologia, projeto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={linhaFiltro} onValueChange={setLinhaFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Linha de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Linhas de Ação</SelectItem>
                {linhasDeAcao.map((linha) => (
                  <SelectItem key={linha} value={linha}>
                    {linha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTecnologias.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Info className="h-10 w-10 mx-auto mb-3 text-muted" />
                <p>Nenhum registro de tecnologia encontrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead>Linha de Ação</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Famílias</TableHead>
                    <TableHead>Municípios</TableHead>
                    <TableHead>Comunidades</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTecnologias.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.tecnologias?.nome || "Sem Nome"}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-[11px] border bg-primary/10 text-primary border-primary/30 font-medium">
                          {t.tecnologias?.linha_acao || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.projetos?.nome || "—"}</div>
                        {(() => { 
                          const o = getOwnership("tecnologia", t.id); 
                          return o ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Criado por {o.ownerName}
                            </div>
                          ) : null; 
                        })()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {t.quantidade.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.unidade}
                      </TableCell>
                      <TableCell>
                        {t.familias ? t.familias.toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]" title={t.municipios}>
                        {t.municipios || "—"}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]" title={t.comunidades}>
                        {t.comunidades || "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(t.data)}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[180px]" title={t.observacoes}>
                        {t.observacoes || "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => requestDelete(t)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TecnologiaModal
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        projetos={projetos}
        catalogo={catalogo}
        currentEmail={currentEmail}
        currentName={currentName}
        onSuccess={fetchTecnologias}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tecnologia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {toDelete ? `A tecnologia "${toDelete.tecnologias?.nome}" associada ao projeto "${toDelete.projetos?.nome}" será removida permanentemente.` : ""}
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
                    const { error } = await supabase.from("projeto_tecnologias").delete().eq("id", toDelete.id);
                    if (error) throw error;
                    
                    removeOwnership("tecnologia", toDelete.id);
                    toast.success("Tecnologia excluída com sucesso.");
                    await fetchTecnologias();
                  } catch (err: any) {
                    console.error("ERRO COMPLETO:", JSON.stringify(err, null, 2));
                    toast.error(`Erro ao excluir tecnologia: ${err.message || JSON.stringify(err)}`);
                  }
                }
                setToDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function TecnologiaModal({
  open,
  onOpenChange,
  editing,
  projetos,
  catalogo,
  currentEmail,
  currentName,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ProjetoTecnologiaRow | null;
  projetos: { id: string; nome: string }[];
  catalogo: { id: string; nome: string; linha_acao: string }[];
  currentEmail: string;
  currentName: string;
  onSuccess: () => Promise<void>;
}) {
  const [tecnologiaId, setTecnologiaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("unidades");
  const [familias, setFamilias] = useState("");
  const [municipios, setMunicipios] = useState("");
  const [comunidades, setComunidades] = useState("");
  const [projetoId, setProjetoId] = useState<string>("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const editingOwnership = useOwnership("tecnologia", editing?.id ?? "");

  // Agrupar catálogo por linha de ação para exibir no select
  const linhasDeAcao = useMemo(() => {
    return [...new Set(catalogo.map(t => t.linha_acao))];
  }, [catalogo]);

  // Identificar se a tecnologia selecionada necessita de exibição de famílias (como Agroecologia ou Fortalecimento)
  const isFamiliasVisible = useMemo(() => {
    if (!tecnologiaId) return true; // Mostrar por padrão ou deixar visível
    const selected = catalogo.find(t => t.id === tecnologiaId);
    if (!selected) return true;
    
    // De acordo com o perfil real da ONG, tecnologias agroecológicas, saneamento, etc., beneficiam famílias
    return true; // Mantemos visível como opcional para todas as tecnologias do Semiárido
  }, [tecnologiaId, catalogo]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTecnologiaId(editing.tecnologia_id || "");
      setQuantidade(String(editing.quantidade));
      setUnidade(editing.unidade || "unidades");
      setFamilias(editing.familias ? String(editing.familias) : "");
      setMunicipios(editing.municipios || "");
      setComunidades(editing.comunidades ?? "");
      setProjetoId(editing.projeto_id ?? "");
      setData(editing.data ? editing.data.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setObservacoes(editing.observacoes ?? "");
    } else {
      setTecnologiaId("");
      setUnidade("unidades");
      setQuantidade("");
      setFamilias("");
      setMunicipios("");
      setComunidades("");
      setProjetoId("");
      setData(new Date().toISOString().slice(0, 10));
      setObservacoes("");
    }
  }, [open, editing]);

  const submit = async () => {
    if (!tecnologiaId) {
      toast.error("Por favor, selecione uma tecnologia do catálogo oficial.");
      return;
    }
    if (!quantidade || Number(quantidade) <= 0) {
      toast.error("Por favor, insira uma quantidade válida superior a 0.");
      return;
    }
    if (!projetoId) {
      toast.error("O campo 'Projeto vinculado' é obrigatório.");
      return;
    }
    if (!municipios.trim()) {
      toast.error("Por favor, informe os municípios atendidos.");
      return;
    }
    
    try {
      const selectedTech = catalogo.find(t => t.id === tecnologiaId);
      const techNome = selectedTech?.nome || "Tecnologia Social";

      if (editing) {
        if (!canEdit("tecnologia", editing.id, currentEmail)) { denyToast(); return; }
        const { error } = await supabase
          .from("projeto_tecnologias")
          .update({
            projeto_id: projetoId,
            tecnologia_id: tecnologiaId,
            quantidade: Number(quantidade),
            unidade,
            familias: familias ? Number(familias) : null,
            municipios,
            comunidades: comunidades || null,
            data,
            observacoes: observacoes || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Tecnologia atualizada com sucesso.");
      } else {
        const id = crypto.randomUUID();
        const { error } = await supabase
          .from("projeto_tecnologias")
          .insert({
            id,
            projeto_id: projetoId,
            tecnologia_id: tecnologiaId,
            quantidade: Number(quantidade),
            unidade,
            familias: familias ? Number(familias) : null,
            municipios,
            comunidades: comunidades || null,
            data,
            observacoes: observacoes || null,
          });
        if (error) throw error;
        setOwnership("tecnologia", id, makeOwnership(currentEmail, currentName));
        addNotification({ type: "tecnologia", title: "Nova tecnologia cadastrada", body: techNome });
        toast.success("Tecnologia cadastrada com sucesso.");
      }
      
      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("ERRO COMPLETO AO SALVAR:", JSON.stringify(err, null, 2));
      toast.error(`Erro ao salvar tecnologia: ${err.message || JSON.stringify(err)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar Registro de Tecnologia" : "Novo Registro de Tecnologia"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          
          <div className="md:col-span-2">
            <Label>Tecnologia Social (Catálogo Chapada) <span className="text-destructive">*</span></Label>
            <select
              value={tecnologiaId}
              onChange={(e) => setTecnologiaId(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecione a tecnologia...</option>
              {linhasDeAcao.map((linha) => (
                <optgroup key={linha} label={linha}>
                  {catalogo
                    .filter((t) => t.linha_acao === linha)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label>Quantidade Implementada <span className="text-destructive">*</span></Label>
            <CurrencyInput
              step={1}
              value={quantidade !== "" ? Number(quantidade) : undefined}
              onChange={(v) => setQuantidade(v !== undefined ? String(v) : "")}
            />
          </div>

          <div>
            <Label>Unidade de Medida <span className="text-destructive">*</span></Label>
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

          {isFamiliasVisible && (
            <div className="md:col-span-2">
              <Label>Famílias Beneficiadas (Opcional)</Label>
              <CurrencyInput
                step={1}
                value={familias !== "" ? Number(familias) : undefined}
                onChange={(v) => setFamilias(v !== undefined ? String(v) : "")}
                placeholder="Informe o número total de famílias atendidas"
              />
            </div>
          )}

          <div className="md:col-span-2">
            <Label>Municípios Atendidos <span className="text-destructive">*</span></Label>
            <Input
              value={municipios}
              onChange={(e) => setMunicipios(e.target.value)}
              placeholder="Ex: Araripina, Ouricuri, Bodocó"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Comunidades Atendidas</Label>
            <Input
              value={comunidades}
              onChange={(e) => setComunidades(e.target.value)}
              placeholder="Ex: Comunidade da Lagoa, Assentamento Mandacaru"
            />
          </div>

          <div>
            <Label>Projeto Vinculado <span className="text-destructive">*</span></Label>
            <Select value={projetoId || undefined} onValueChange={setProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.length > 0 ? (
                  projetos
                    .filter((p) => p.id && String(p.id).trim() !== "")
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>Nenhum projeto cadastrado</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data de Implementação <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Observações adicionais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Descreva detalhes específicos do projeto ou implantação"
            />
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
          <Button onClick={submit}>
            {editing ? "Salvar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
