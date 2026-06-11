import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  setPage: (page: number) => void;
  count: number;
  pageSize: number;
  onPageChange?: () => void;
}

export function PaginationControls({
  page,
  setPage,
  count,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(count / pageSize) || 1;
  const startRecord = count === 0 ? 0 : page * pageSize + 1;
  const endRecord = Math.min((page + 1) * pageSize, count);

  const handlePrev = () => {
    if (page > 0) {
      setPage(page - 1);
      onPageChange?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if ((page + 1) * pageSize < count) {
      setPage(page + 1);
      onPageChange?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-border/40 mt-4 select-none">
      <span className="text-sm text-muted-foreground font-medium">
        Exibindo {startRecord}–{endRecord} de {count} registros
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={page === 0}
          className="h-9 px-3 rounded-lg border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold disabled:opacity-50"
        >
          ← Anterior
        </Button>
        <span className="text-xs font-semibold text-foreground bg-muted/60 px-3.5 py-2 rounded-lg border border-border/40 min-w-[100px] text-center">
          Página {page + 1} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={(page + 1) * pageSize >= count}
          className="h-9 px-3 rounded-lg border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold disabled:opacity-50"
        >
          Próximo →
        </Button>
      </div>
    </div>
  );
}
