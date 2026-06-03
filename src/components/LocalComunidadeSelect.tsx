import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  X,
  Search,
} from "lucide-react";
import {
  useLocaisAutocomplete,
  useSalvarLocal,
  toTitleCase,
  type LocalSuggestion,
} from "@/lib/autocompleteHooks";
import { toast } from "sonner";

// Ícones de tipo como texto (evita dependência de libs de emoji)
const ICON_COMUNIDADE = "🏘️";
const ICON_LOCAL = "📍";

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  localType?: "comunidade" | "local" | null;
  onLocalTypeChange?: (t: "comunidade" | "local" | null) => void;
  disabled?: boolean;
}

/**
 * LocalComunidadeSelect — Campo de autocomplete unificado para local/comunidade.
 *
 * Comportamento:
 * - Busca simultaneamente em `comunidades` (🏘️) e `locais` (📍) com 2+ chars
 * - Agrupa resultados por tipo com identificação visual
 * - Deduplicação: antes de criar, verifica ambas as tabelas
 * - Quando nome não existe: exibe modal inline perguntando o tipo
 * - Exibe chip com ícone do tipo após seleção; botão × remove sem apagar do banco
 * - Compartilhado entre "Nova Atividade" e "Nova Ação Independente"
 */
export function LocalComunidadeSelect({
  value,
  onValueChange,
  localType,
  onLocalTypeChange,
  disabled,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [pendingNome, setPendingNome] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { suggestions, loading } = useLocaisAutocomplete(inputValue);
  const { salvar, saving } = useSalvarLocal();

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setShowTipoModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    async (sugestao: LocalSuggestion) => {
      setInputValue("");
      setShowSuggestions(false);
      onValueChange(sugestao.nome);
      onLocalTypeChange?.(sugestao.fonte);
    },
    [onValueChange, onLocalTypeChange]
  );

  const handleConfirmarTipo = useCallback(
    async (tipo: "comunidade" | "local") => {
      setShowTipoModal(false);
      try {
        const resultado = await salvar(pendingNome, tipo);
        if (resultado.jaExistia) {
          toast.info("Já cadastrado — vinculando ao registro existente.", {
            duration: 2500,
          });
        } else {
          toast.success(
            `${tipo === "comunidade" ? "Comunidade" : "Local"} "${resultado.nome}" cadastrado com sucesso.`
          );
        }
        onValueChange(resultado.nome);
        onLocalTypeChange?.(resultado.fonte);
        setInputValue("");
      } catch (err: unknown) {
        toast.error(`Erro ao salvar: ${(err as Error).message}`);
      }
    },
    [pendingNome, salvar, onValueChange, onLocalTypeChange]
  );

  const handleConfirmarInput = useCallback(async () => {
    const nome = toTitleCase(inputValue);
    if (!nome) return;

    // Verificar se já existe na lista de sugestões
    const existente = suggestions.find(
      (s) => s.nome.toLowerCase() === nome.toLowerCase()
    );
    if (existente) {
      await handleSelect(existente);
      return;
    }

    // Nome novo: pedir o tipo
    setPendingNome(nome);
    setShowSuggestions(false);
    setShowTipoModal(true);
  }, [inputValue, suggestions, handleSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmarInput();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setShowTipoModal(false);
    }
  };

  const handleRemove = () => {
    onValueChange("");
    onLocalTypeChange?.(null);
  };

  const iconForFonte = (fonte: "comunidade" | "local") =>
    fonte === "comunidade" ? ICON_COMUNIDADE : ICON_LOCAL;

  // Separar sugestões por tipo para exibição agrupada
  const comunidades = suggestions.filter((s) => s.fonte === "comunidade");
  const locais = suggestions.filter((s) => s.fonte === "local");

  if (value) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Badge
          variant="secondary"
          className="gap-1.5 px-2.5 py-1 text-xs font-medium max-w-full"
        >
          <span className="shrink-0">
            {localType ? iconForFonte(localType) : "📌"}
          </span>
          <span className="truncate">{value}</span>
          {localType && (
            <span className="text-muted-foreground shrink-0 text-[10px]">
              {localType === "comunidade" ? "Comunidade" : "Local"}
            </span>
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="ml-1 hover:text-destructive transition-colors shrink-0"
            aria-label="Remover seleção"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-2">
      {/* Input principal */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
              setShowTipoModal(false);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar ou criar local / comunidade..."
            className="text-xs pr-8"
            disabled={disabled || saving}
          />
          {(saving || loading) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleConfirmarInput}
          disabled={disabled || saving || !inputValue.trim()}
          className="h-9 shrink-0"
          title="Confirmar / criar local"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Dropdown de sugestões */}
      {showSuggestions && !showTipoModal && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto"
        >
          {suggestions.length > 0 ? (
            <>
              {comunidades.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {ICON_COMUNIDADE} Comunidades
                  </div>
                  {comunidades.map((s) => (
                    <SuggestionItem
                      key={`com-${s.id}`}
                      sugestao={s}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
              {locais.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1">
                    {ICON_LOCAL} Locais / Espaços
                  </div>
                  {locais.map((s) => (
                    <SuggestionItem
                      key={`loc-${s.id}`}
                      sugestao={s}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
            </>
          ) : inputValue.trim().length >= 2 && !loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Nenhum resultado para "{toTitleCase(inputValue)}".
              </span>
              <button
                type="button"
                className="text-primary font-medium flex items-center gap-1 hover:underline"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleConfirmarInput();
                }}
              >
                <Plus className="h-3 w-3" /> Criar novo
              </button>
            </div>
          ) : inputValue.trim().length < 2 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Digite ao menos 2 letras para buscar...
            </div>
          ) : null}
        </div>
      )}

      {/* Modal inline: escolha do tipo (Comunidade ou Local) */}
      {showTipoModal && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg p-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs font-semibold mb-1">
            "{pendingNome}" não está cadastrado.
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Este local é uma comunidade ou um local/espaço?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={() => handleConfirmarTipo("comunidade")}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>{ICON_COMUNIDADE}</span>
              )}
              Comunidade
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={() => handleConfirmarTipo("local")}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>{ICON_LOCAL}</span>
              )}
              Local / Espaço
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs h-8 text-muted-foreground"
              onClick={() => {
                setShowTipoModal(false);
                setPendingNome("");
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponente: Item de sugestão ─────────────────────────────────────────
function SuggestionItem({
  sugestao,
  onSelect,
}: {
  sugestao: LocalSuggestion;
  onSelect: (s: LocalSuggestion) => void;
}) {
  const icon = sugestao.fonte === "comunidade" ? "🏘️" : "📍";
  return (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2"
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(sugestao);
      }}
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="shrink-0">{icon}</span>
      <span className="font-medium truncate">{sugestao.nome}</span>
    </button>
  );
}
