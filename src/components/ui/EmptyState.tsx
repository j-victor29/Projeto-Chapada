import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const button = action ? (
    <Button type="button" onClick={action.onClick} className="mt-1 gap-2">
      {action.label}
    </Button>
  ) : null;

  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action?.href ? (
        <Button asChild type="button" className="mt-5 gap-2">
          <a href={action.href}>{action.label}</a>
        </Button>
      ) : (
        action && <div className="mt-5">{button}</div>
      )}
    </div>
  );
}

interface EmptySelectMessageProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptySelectMessage({
  title,
  description,
  action,
}: EmptySelectMessageProps) {
  const content = (
    <>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1">{description}</p>}
      {action?.href ? (
        <Button type="button" size="sm" variant="outline" className="mt-3 h-8" asChild>
          <a href={action.href}>{action.label}</a>
        </Button>
      ) : action ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 h-8"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            action.onClick?.();
          }}
        >
          {action.label}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="px-3 py-3 text-xs text-muted-foreground">
      {content}
    </div>
  );
}
