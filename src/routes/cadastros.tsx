import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Municipios, Comunidades, Financiadores, Categorias, Publicos, Familias
} from "@/lib/cadastrosStore";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros — CHAPADA" }] }),
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
  const [search, setSearch] = useState("");

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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
        { label: "Região", key: "regiao" }
      ]}
      getId={(r) => r.id}
      getRowValues={(r) => r}
      blank={{ nome: "", uf: "PE", regiao: "" }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1">
            <Label htmlFor="mun-nome">Nome</Label>
            <Input id="mun-nome" value={s.nome ?? ""} onChange={(e) => set({ ...s, nome: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mun-uf">UF</Label>
            <Input id="mun-uf" value={s.uf ?? "PE"} maxLength={2} onChange={(e) => set({ ...s, uf: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mun-regiao">Região</Label>
            <Input id="mun-regiao" value={s.regiao ?? ""} onChange={(e) => set({ ...s, regiao: e.target.value })} />
          </div>
        </>
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
