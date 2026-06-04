import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Timezone-safe parser from display format DD/MM/YYYY to YYYY-MM-DD
const parseDisplayToIso = (display: string): string | null => {
  const parts = display.split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000 || year > 9999) return null;

  const tempDate = new Date(year, month - 1, day);
  if (
    tempDate.getFullYear() === year &&
    tempDate.getMonth() === month - 1 &&
    tempDate.getDate() === day
  ) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
};

// Timezone-safe formatter from YYYY-MM-DD to DD/MM/YYYY
const formatIsoToDisplay = (iso: string): string => {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  hasError = false,
}: DatePickerProps) {
  const [displayValue, setDisplayValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [localError, setLocalError] = React.useState(false);

  // Sync internal display state with prop value
  React.useEffect(() => {
    if (value) {
      setDisplayValue(formatIsoToDisplay(value));
      setLocalError(false);
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const clean = rawVal.replace(/\D/g, "");

    let formatted = clean;
    if (clean.length > 2) {
      formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    if (clean.length > 4) {
      formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
    }

    setDisplayValue(formatted);

    if (clean.length === 0) {
      setLocalError(false);
      onChange("");
    } else if (clean.length === 8) {
      const iso = parseDisplayToIso(formatted);
      if (iso) {
        setLocalError(false);
        onChange(iso);
      } else {
        setLocalError(true);
      }
    } else {
      // Incomplete date value
      setLocalError(false);
    }
  };

  const handleInputBlur = () => {
    if (displayValue && displayValue.replace(/\D/g, "").length < 8) {
      setLocalError(true);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const iso = `${year}-${month}-${day}`;
      onChange(iso);
      setIsOpen(false);
      setLocalError(false);
    }
  };

  // Selected date as Date object for Calendar
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const parts = value.split("-");
    if (parts.length !== 3) return undefined;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }, [value]);

  return (
    <div className={cn("relative flex items-center w-36", className)}>
      <Input
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        maxLength={10}
        className={cn(
          "h-9 pr-8 text-xs bg-background/50 border-muted rounded-lg w-full",
          (hasError || localError) && "border-destructive focus-visible:ring-destructive"
        )}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
