import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Search, X, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Municipios, Comunidades, Financiadores, Categorias, Publicos, Familias
} from "@/lib/cadastrosStore";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";

export const Route = createFileRoute("/cadastros")({
  component: CadastrosPage,
});


function CadastrosPage() {
  return (
    <AppLayout title="Cadastros institucionais" subtitle="Municípios, comunidades, financiadores, categorias, públicos e famílias">
      <div className="space-y-6">
        <Tabs defaultValue="municipios" className="w-full">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="municipios">Municípios</TabsTrigger>
            <TabsTrigger value="comunidades">Comunidades</TabsTrigger>
            <TabsTrigger value="financiadores">Financiadores</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="publicos">Públicos</TabsTrigger>
            <TabsTrigger value="familias">Famílias</TabsTrigger>
          </TabsList>
          
          <TabsContent value="municipios" className="mt-4"><MunicipiosTab /></TabsContent>
          <TabsContent value="comunidades" className="mt-4"><ComunidadesTab /></TabsContent>
          <TabsContent value="financiadores" className="mt-4"><FinanciadoresTab /></TabsContent>
          <TabsContent value="categorias" className="mt-4"><CategoriasTab /></TabsContent>
          <TabsContent value="publicos" className="mt-4"><PublicosTab /></TabsContent>
          <TabsContent value="familias" className="mt-4"><FamiliasTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function CrudShell({
  title, items, columns, renderForm, onSave, onDelete, getId, getRowValues, blank,
}: {
  title: string;
  items: any[] | undefined;
  columns: { label: string; key: string }[];
  renderForm: (state: any, setState: (s: any) => void) => React.ReactNode;
  onSave: (s: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  getId: (row: any) => string;
  getRowValues: (row: any) => Record<string, any>;
  blank: any;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(blank);
  const [localSearch, setLocalSearch] = useState("");
  const search = useDebounce(localSearch, 300);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!search.trim()) return items;
    const lowerSearch = search.toLowerCase().trim();
    return items.filter(item => {
      const rowVals = getRowValues(item);
      return columns.some(col => {
        const val = rowVals[col.key];
        return String(val ?? "").toLowerCase().includes(lowerSearch);
      });
    });
  }, [items, search, columns, getRowValues]);

  return (
    <Card className="border-border/60 hover:shadow-soft transition-shadow">
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
            
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDraft(blank); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 shadow-sm">
                  <Plus className="h-4 w-4" /> Novo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{draft.id ? "Editar" : "Novo"} — {title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">{renderForm(draft, setDraft)}</div>
                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={async () => {
                      try {
                        await onSave(draft);
                        toast.success("Registro salvo com sucesso!");
                        setOpen(false);
                        setDraft(blank);
                      } catch (e: any) {
                        toast.error(e.message ?? "Erro ao salvar o registro");
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      onClick={() => { setDraft({ ...row }); setOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Tem certeza que deseja excluir este registro?")) return;
                        try {
                          await onDelete(getId(row));
                          toast.success("Registro excluído com sucesso!");
                        } catch (e: any) {
                          toast.error(e.message ?? "Erro ao excluir o registro");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
      renderForm={(s, set) => (
        <IbgeMunicipiosSearch state={s} onChange={set} />
      )}
      onSave={(s) => upsert.mutateAsync(s)}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function ComunidadesTab() {
  const { data } = Comunidades.useList();
  const { data: muns } = Municipios.useList();
  const upsert = Comunidades.useUpsert();
  const del = Comunidades.useDelete();
  
  const munMap = useMemo(() => new Map((muns ?? []).map((m) => [m.id, m.nome])), [muns]);
  
  return (
    <CrudShell
      title="Comunidades"
      items={data}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "Município", key: "_mun" },
        { label: "Tipo", key: "tipo" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => ({ ...r, _mun: r.municipio_id ? munMap.get(r.municipio_id) : "" })}
      blank={{ nome: "", municipio_id: null, tipo: "" }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="com-nome">Nome</Label>
            <Input id="com-nome" value={s.nome ?? ""} onChange={(e) => set({ ...s, nome: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="com-municipio">Município</Label>
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
          <div className="space-y-1">
            <Label htmlFor="com-tipo">Tipo</Label>
            <Input id="com-tipo" value={s.tipo ?? ""} placeholder="ex.: assentamento, quilombola..." onChange={(e) => set({ ...s, tipo: e.target.value })} />
          </div>
        </>
      )}
      onSave={(s) => upsert.mutateAsync(s)}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function FinanciadoresTab() {
  const { data } = Financiadores.useList();
  const upsert = Financiadores.useUpsert();
  const del = Financiadores.useDelete();
  
  return (
    <CrudShell
      title="Financiadores"
      items={data}
      columns={[
        { label: "Nome", key: "nome" },
        { label: "Tipo", key: "tipo" },
        { label: "Contato", key: "contato" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => r}
      blank={{ nome: "", tipo: "privado", contato: "", site: "", cnpj: "" }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="fin-nome">Nome</Label>
            <Input id="fin-nome" value={s.nome ?? ""} onChange={(e) => set({ ...s, nome: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-tipo">Tipo</Label>
            <Select 
              value={s.tipo || undefined} 
              onValueChange={(v) => set({ ...s, tipo: v })}
            >
              <SelectTrigger id="fin-tipo">
                <SelectValue placeholder="Selecione um tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="publico">Público</SelectItem>
                <SelectItem value="privado">Privado</SelectItem>
                <SelectItem value="internacional">Internacional</SelectItem>
              </SelectContent>
            </Select>
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
      onSave={(s) => upsert.mutateAsync(s)}
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
      renderForm={(s, set) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="cat-nome">Nome</Label>
            <Input id="cat-nome" value={s.nome ?? ""} onChange={(e) => set({ ...s, nome: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-tipo">Tipo</Label>
            <Select 
              value={s.tipo || undefined} 
              onValueChange={(v) => set({ ...s, tipo: v })}
            >
              <SelectTrigger id="cat-tipo">
                <SelectValue placeholder="Selecione um tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atividade">Atividade</SelectItem>
                <SelectItem value="tecnologia">Tecnologia</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
              </SelectContent>
            </Select>
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
      onSave={(s) => upsert.mutateAsync(s)}
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
      renderForm={(s, set) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="pub-nome">Nome</Label>
            <Input id="pub-nome" value={s.nome ?? ""} onChange={(e) => set({ ...s, nome: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pub-desc">Descrição</Label>
            <Input id="pub-desc" value={s.descricao ?? ""} onChange={(e) => set({ ...s, descricao: e.target.value })} />
          </div>
        </>
      )}
      onSave={(s) => upsert.mutateAsync(s)}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}

function FamiliasTab() {
  const { data } = Familias.useList();
  const { data: muns } = Municipios.useList();
  const { data: coms } = Comunidades.useList();
  const upsert = Familias.useUpsert();
  const del = Familias.useDelete();
  
  const munMap = useMemo(() => new Map((muns ?? []).map((m) => [m.id, m.nome])), [muns]);
  const comMap = useMemo(() => new Map((coms ?? []).map((c) => [c.id, c.nome])), [coms]);
  
  return (
    <CrudShell
      title="Famílias"
      items={data}
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
      renderForm={(s, set) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="fam-responsavel">Nome do Responsável</Label>
            <Input id="fam-responsavel" value={s.nome_responsavel ?? ""} onChange={(e) => set({ ...s, nome_responsavel: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fam-cpf">CPF</Label>
              <Input id="fam-cpf" value={s.cpf ?? ""} onChange={(e) => set({ ...s, cpf: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fam-nis">NIS</Label>
              <Input id="fam-nis" value={s.nis ?? ""} onChange={(e) => set({ ...s, nis: e.target.value })} />
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
      onSave={(s) => upsert.mutateAsync(s)}
      onDelete={(id) => del.mutateAsync(id)}
    />
  );
}
