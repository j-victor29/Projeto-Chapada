import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastros")({
  component: CadastrosPage,
});

// Tipos genéricos para os dados mestres
type MasterRecord = { id: string; nome: string; [key: string]: any };

function GenericList({ 
  table, 
  title, 
  columns, 
  formFields 
}: { 
  table: string; 
  title: string; 
  columns: { key: string; label: string }[];
  formFields: { key: string; label: string; placeholder?: string }[];
}) {
  const [data, setData] = useState<MasterRecord[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MasterRecord> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const { data: result, error } = await supabase.from(table).select("*").order("nome");
      if (!error && result) setData(result);
    } catch (e) {
      console.warn("Table might not exist yet:", table);
    }
  };

  useEffect(() => {
    fetchData();
  }, [table]);

  const filtered = useMemo(() => {
    return data.filter(d => d.nome?.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const handleSave = async () => {
    if (!editing?.nome) {
      toast.error("O nome é obrigatório");
      return;
    }
    setLoading(true);
    try {
      if (editing.id) {
        const { error } = await supabase.from(table).update(editing).eq("id", editing.id);
        if (error) throw error;
        toast.success(`${title} atualizado!`);
      } else {
        const { error } = await supabase.from(table).insert([editing]);
        if (error) throw error;
        toast.success(`${title} criado!`);
      }
      setOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído com sucesso");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${title.toLowerCase()}...`}
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => { setEditing({ nome: "" }); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                {columns.map(c => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    {columns.map(c => (
                      <TableCell key={c.key}>{item[c.key]}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editing?.nome || ""}
                onChange={e => setEditing(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            {formFields.map(f => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Input
                  placeholder={f.placeholder}
                  value={editing?.[f.key] || ""}
                  onChange={e => setEditing(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CadastrosPage() {
  return (
    <AppLayout title="Cadastros Institucionais" subtitle="Municípios, comunidades, financiadores, categorias e públicos">
      <Tabs defaultValue="financiadores" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="financiadores">Financiadores</TabsTrigger>
          <TabsTrigger value="municipios">Municípios</TabsTrigger>
          <TabsTrigger value="comunidades">Comunidades</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="publicos">Públicos</TabsTrigger>
        </TabsList>
        <TabsContent value="financiadores">
          <GenericList 
            table="financiadores" 
            title="Financiador" 
            columns={[{ key: "cnpj", label: "CNPJ" }, { key: "contato", label: "Contato" }]} 
            formFields={[{ key: "cnpj", label: "CNPJ" }, { key: "contato", label: "Contato" }]} 
          />
        </TabsContent>
        <TabsContent value="municipios">
          <GenericList 
            table="municipios" 
            title="Município" 
            columns={[{ key: "uf", label: "UF" }]} 
            formFields={[{ key: "uf", label: "UF", placeholder: "BA" }]} 
          />
        </TabsContent>
        <TabsContent value="comunidades">
          <GenericList 
            table="comunidades" 
            title="Comunidade" 
            columns={[]} 
            formFields={[]} 
          />
        </TabsContent>
        <TabsContent value="categorias">
          <GenericList 
            table="categorias" 
            title="Categoria" 
            columns={[{ key: "tipo", label: "Tipo" }]} 
            formFields={[{ key: "tipo", label: "Tipo", placeholder: "documento, tecnologia..." }]} 
          />
        </TabsContent>
        <TabsContent value="publicos">
          <GenericList 
            table="publicos" 
            title="Público" 
            columns={[{ key: "descricao", label: "Descrição" }]} 
            formFields={[{ key: "descricao", label: "Descrição" }]} 
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
