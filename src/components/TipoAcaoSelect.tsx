import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Check } from "lucide-react";
import { useTiposAcao, toTitleCase } from "@/lib/autocompleteHooks";
import { toast } from "sonner";
import { EmptySelectMessage } from "@/components/ui/EmptyState";

const NOVO_TIPO_SENTINEL = "__novo__";

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * TipoAcaoSelect — Select dinâmico conectado à tabela `tipos_acao` do Supabase.
 *
 * Comportamento:
 * - Carrega tipos de `tipos_acao` (padrão primeiro, depois usuário, alfabético)
 * - Oferece a opção "+ Adicionar novo tipo de ação" ao final da lista
 * - Ao selecionar essa opção, exibe inline Input + botão "Salvar tipo"
 * - Normaliza para Title Case e verifica duplicatas antes de salvar
 * - Após salvar, seleciona automaticamente o novo tipo
 * - Compartilhado entre "Nova Atividade" e "Nova Ação Independente"
 */
export function TipoAcaoSelect({ value, onValueChange, disabled, className }: Props) {
  const { tipos, loading, adicionarTipo } = useTiposAcao();
  const [showNovoInput, setShowNovoInput] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focar o input quando ele aparecer
  useEffect(() => {
    if (showNovoInput) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showNovoInput]);

  const handleSelectChange = (v: string) => {
    if (v === NOVO_TIPO_SENTINEL) {
      setShowNovoInput(true);
      setNovoNome("");
      return;
    }
    setShowNovoInput(false);
    onValueChange(v);
  };

  const handleSalvar = async () => {
    const nome = toTitleCase(novoNome);
    if (!nome) {
      toast.error("Digite um nome para o tipo de ação.");
      return;
    }
    setSaving(true);
    try {
      const nomeSalvo = await adicionarTipo(nome);
      if (!nomeSalvo) return;

      // Verificar se já existia (adicionarTipo retorna nome existente ou novo)
      const jaExistia = tipos.some(
        (t) => t.nome.toLowerCase() === nomeSalvo.toLowerCase()
      );
      if (jaExistia) {
        toast.info(`"${nomeSalvo}" já existe — selecionado automaticamente.`, {
          duration: 2500,
        });
      } else {
        toast.success(`Tipo "${nomeSalvo}" adicionado com sucesso.`);
      }

      onValueChange(nomeSalvo);
      setShowNovoInput(false);
      setNovoNome("");
    } catch (err: unknown) {
      toast.error(`Erro ao salvar tipo: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSalvar();
    }
    if (e.key === "Escape") {
      setShowNovoInput(false);
      setNovoNome("");
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={showNovoInput ? NOVO_TIPO_SENTINEL : (value || undefined)}
        onValueChange={handleSelectChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione"} />
        </SelectTrigger>
        <SelectContent>
          {tipos.filter((t) => t.nome && t.nome.trim() !== "").length > 0 ? (
            tipos
              .filter((t) => t.nome && t.nome.trim() !== "")
              .map((t) => (
                <SelectItem key={t.id} value={t.nome}>
                  {t.nome}
                </SelectItem>
              ))
          ) : (
            <EmptySelectMessage
              title="Nenhum tipo de ação cadastrado."
              description="Você pode adicionar um novo tipo digitando acima."
            />
          )}
          <SelectItem
            key={NOVO_TIPO_SENTINEL}
            value={NOVO_TIPO_SENTINEL}
            className="text-primary font-medium border-t mt-1 pt-1"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Adicionar novo tipo de ação
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {showNovoInput && (
        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200">
          <Input
            ref={inputRef}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nome do novo tipo (ex: Webinar Técnico)"
            className="text-sm h-8 flex-1"
            disabled={saving}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            onClick={handleSalvar}
            disabled={saving || !novoNome.trim()}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Salvar tipo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-muted-foreground shrink-0"
            onClick={() => {
              setShowNovoInput(false);
              setNovoNome("");
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
