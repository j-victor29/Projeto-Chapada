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
  FolderGit2, 
  Sparkles, 
  Info, 
  CheckCircle2, 
  Wrench 
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

  const getLinhaAcaoBadge = (linha: string) => {
    switch (linha) {
      case "Convivência com o Semiárido e Segurança Hídrica":
        return "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/50";
      case "Saneamento Rural":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50";
      case "Energias Renováveis":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50";
      case "Agroecologia e Produção Sustentável":
        return "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300 border border-lime-200/50";
      case "Fortalecimento Organizativo":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50";
      case "Direitos e Cidadania":
        return "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border border-pink-200/50";
      default:
        return "bg-slate-50 text-slate-700 dark:bg-slate-950/40 dark:text-slate-300 border border-slate-200/50";
    }
  };

  return (
    <AppLayout
      title="Tecnologias Sociais"
      subtitle="Catálogo oficial e registro de tecnologias sociais implementadas pela CHAPADA no Semiárido"
      actions={
        <Button className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium shadow-md shadow-orange-500/10 transition-all duration-300 transform hover:-translate-y-0.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova Tecnologia
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Bloco Informativo Premium da ONG */}
        <div className="bg-gradient-to-br from-teal-900/10 via-emerald-900/5 to-transparent border border-teal-500/20 rounded-2xl p-6 relative overflow-hidden shadow-inner">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-1/4 translate-x-1/4">
            <Droplets className="w-96 h-96 text-teal-600" />
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
            <div className="bg-teal-500/10 border border-teal-500/30 p-3.5 rounded-xl text-teal-600 dark:text-teal-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Convivência e Transformação no Semiárido
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-350 max-w-4xl">
                A ONG Chapada acumula mais de 31 anos de atuação nas comunidades do Semiárido pernambucano e piauiense, 
                tendo implantado quase <strong>11 mil tecnologias sociais hídricas</strong> e beneficiado aproximadamente 
                <strong> 22 mil famílias agricultoras</strong>. Os registros abaixo são integrados aos projetos financiados pelos nossos parceiros e apoiadores.
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard de Métricas Resumidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-slate-900 border-sky-100 dark:border-sky-900/50 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-sky-600 dark:text-sky-400 font-medium tracking-wide uppercase">Implementações</span>
                <h4 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  {tecnologias.length}
                </h4>
                <p className="text-[11px] text-sky-500">Tecnologias registradas</p>
              </div>
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <Wrench className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900 border-emerald-100 dark:border-emerald-900/50 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium tracking-wide uppercase">Quantidade Total</span>
                <h4 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  {metrics.totalQty.toLocaleString("pt-BR")}
                </h4>
                <p className="text-[11px] text-emerald-500">Unidades implantadas</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Droplets className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 border-amber-100 dark:border-amber-900/50 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium tracking-wide uppercase">Famílias Atendidas</span>
                <h4 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  {metrics.totalFamilies.toLocaleString("pt-BR")}
                </h4>
                <p className="text-[11px] text-amber-500">Famílias beneficiadas</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-indigo-100 dark:border-indigo-900/50 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium tracking-wide uppercase">Alcance Geográfico</span>
                <h4 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  {metrics.uniqueCities} {metrics.uniqueCities === 1 ? "Município" : "Municípios"}
                </h4>
                <p className="text-[11px] text-indigo-500">Em {metrics.uniqueProj} {metrics.uniqueProj === 1 ? "projeto" : "projetos"}</p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <MapPin className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listagem Principal e Filtros */}
        <Card className="shadow-lg border-slate-200/60 dark:border-slate-800/80 overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="space-y-0.5">
              <h3 className="font-semibold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-orange-500" /> Registro de Tecnologias Implantadas
              </h3>
              <p className="text-xs text-muted-foreground">Consulte, edite ou registre tecnologias associadas aos projetos.</p>
            </div>
            
            {/* Controles de Filtro */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Buscar tecnologia, projeto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9.5 text-xs bg-white dark:bg-slate-950/80 focus-visible:ring-orange-500/50 focus-visible:border-orange-500"
                />
              </div>

              <div className="w-full sm:w-60">
                <Select value={linhaFiltro} onValueChange={setLinhaFiltro}>
                  <SelectTrigger className="h-9.5 text-xs bg-white dark:bg-slate-950/80 focus:ring-orange-500/50">
                    <SelectValue placeholder="Filtrar por Linha de Ação" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="all" className="text-xs font-semibold text-orange-500 dark:text-orange-400">
                      Todas as Linhas de Ação
                    </SelectItem>
                    {linhasDeAcao.map((linha) => (
                      <SelectItem key={linha} value={linha} className="text-xs">
                        {linha}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              </div>
            ) : filteredTecnologias.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Info className="h-10 w-10 text-slate-350 dark:text-slate-650 mx-auto" />
                <p className="text-sm font-medium text-slate-500">Nenhum registro de tecnologia encontrado.</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {searchQuery || linhaFiltro !== "all" 
                    ? "Tente ajustar seus termos de pesquisa ou remover os filtros de Linha de Ação selecionados."
                    : "Cadastre a primeira tecnologia utilizando o botão 'Nova Tecnologia' no canto superior direito."
                  }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/70 dark:bg-slate-900/60 text-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Tecnologia</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Linha de Ação</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Projeto</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Qtd.</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Unidade</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Famílias</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Municípios</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Comunidades</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Data</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Observações</TableHead>
                    <TableHead className="w-[100px] text-right font-semibold text-slate-700 dark:text-slate-200">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTecnologias.map((t) => (
                    <TableRow key={t.id} className="border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-colors">
                      <TableCell className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {t.tecnologias?.nome || "Sem Nome"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${getLinhaAcaoBadge(t.tecnologias?.linha_acao || "")}`}>
                          {t.tecnologias?.linha_acao || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-750 dark:text-slate-300 font-medium">
                        <div>{t.projetos?.nome || "—"}</div>
                        {(() => { 
                          const o = getOwnership("tecnologia", t.id); 
                          return o ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" /> Criado por {o.ownerName}
                            </div>
                          ) : null; 
                        })()}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                        {t.quantidade.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400 text-xs">
                        {t.unidade}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                        {t.familias ? t.familias.toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-[150px] truncate" title={t.municipios}>
                        {t.municipios || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400 max-w-[150px] truncate" title={t.comunidades}>
                        {t.comunidades || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(t.data)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={t.observacoes}>
                        {t.observacoes || "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350"
                          aria-label="Editar"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          aria-label="Excluir"
                          onClick={() => requestDelete(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        <AlertDialogContent className="border border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-600 dark:text-rose-500">
              Deseja excluir esta tecnologia?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta ação não pode ser desfeita. {toDelete ? `A tecnologia "${toDelete.tecnologias?.nome}" associada ao projeto "${toDelete.projetos?.nome}" será removida permanentemente do sistema.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-md shadow-rose-600/10"
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
              Confirmar Exclusão
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1.5 bg-orange-500/10 text-orange-600 rounded-lg dark:text-orange-400">
              <Wrench className="w-5 h-5" />
            </span>
            {editing ? "Editar Registro de Tecnologia" : "Novo Registro de Tecnologia"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          
          {/* Tecnologia do Catálogo Oficial */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
              Tecnologia Social (Catálogo Chapada) <span className="text-rose-500">*</span>
            </Label>
            <select
              value={tecnologiaId}
              onChange={(e) => setTecnologiaId(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-slate-800 dark:text-slate-100 border-slate-250 dark:border-slate-750 focus:border-orange-500 focus:ring-orange-500/20"
            >
              <option value="">Selecione a tecnologia...</option>
              {linhasDeAcao.map((linha) => (
                <optgroup key={linha} label={linha} className="text-xs font-bold text-teal-650 bg-slate-50 dark:bg-slate-900 py-1">
                  {catalogo
                    .filter((t) => t.linha_acao === linha)
                    .map((t) => (
                      <option key={t.id} value={t.id} className="text-xs text-slate-800 dark:text-slate-250 font-normal">
                        {t.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
              Quantidade Implementada <span className="text-rose-500">*</span>
            </Label>
            <CurrencyInput
              step={1}
              value={quantidade !== "" ? Number(quantidade) : undefined}
              onChange={(v) => setQuantidade(v !== undefined ? String(v) : "")}
              className="h-10 border-slate-250 dark:border-slate-750 focus:border-orange-500 focus:ring-orange-500/20"
            />
          </div>

          {/* Unidade */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
              Unidade de Medida <span className="text-rose-500">*</span>
            </Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="h-10 border-slate-250 dark:border-slate-750 focus:ring-orange-500/20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950">
                {["unidades", "hectares", "famílias"].map((u) => (
                  <SelectItem key={u} value={u} className="text-xs">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Famílias Beneficiadas */}
          {isFamiliasVisible && (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                Famílias Beneficiadas (Opcional)
              </Label>
              <CurrencyInput
                step={1}
                value={familias !== "" ? Number(familias) : undefined}
                onChange={(v) => setFamilias(v !== undefined ? String(v) : "")}
                placeholder="Informe o número total de famílias atendidas"
                className="h-10 border-slate-250 dark:border-slate-750 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
          )}

          {/* Municípios Atendidos */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
              Municípios Atendidos <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={municipios}
              onChange={(e) => setMunicipios(e.target.value)}
              placeholder="Ex: Araripina, Ouricuri, Bodocó"
              className="h-10 border-slate-250 dark:border-slate-750 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 text-xs"
            />
          </div>

          {/* Comunidades */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Comunidades Atendidas</Label>
            <Input
              value={comunidades}
              onChange={(e) => setComunidades(e.target.value)}
              placeholder="Ex: Comunidade da Lagoa, Assentamento Mandacaru"
              className="h-10 border-slate-250 dark:border-slate-750 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 text-xs"
            />
          </div>

          {/* Projeto Vinculado */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
              Projeto Vinculado <span className="text-rose-500">*</span>
            </Label>
            <Select value={projetoId || undefined} onValueChange={setProjetoId}>
              <SelectTrigger className="h-10 border-slate-250 dark:border-slate-750 focus:ring-orange-500/20 text-xs">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 max-h-60">
                {projetos.length > 0 ? (
                  projetos
                    .filter((p) => p.id && String(p.id).trim() !== "")
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                        {p.nome}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>Nenhum projeto cadastrado</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Data de Implementação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
              Data de Implementação <span className="text-rose-500">*</span>
            </Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-10 border-slate-250 dark:border-slate-750 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 text-xs"
            />
          </div>

          {/* Observações */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Observações adicionais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Descreva detalhes específicos do projeto ou implantação"
              className="border-slate-250 dark:border-slate-750 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 text-xs"
            />
          </div>

          {editing && editingOwnership && (
            <div className="md:col-span-2">
              <CollaboratorsSection type="tecnologia" id={editing.id} ownership={editingOwnership} currentEmail={currentEmail} />
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <Button variant="outline" className="text-xs h-9.5" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} className="text-xs h-9.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-sm">
            {editing ? "Salvar Alterações" : "Salvar Registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
