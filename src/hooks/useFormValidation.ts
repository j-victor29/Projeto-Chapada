import { useMemo } from "react";
import { trimText } from "@/utils/sanitize";

export interface ValidationRules {
  required?: string[];
  minChars?: Record<string, { min: number; message: string }>;
  currency?: string[];
  dateRange?: { startKey: string; endKey: string; message: string }[];
  emails?: string[];
  custom?: ((values: any, errors: Record<string, string>) => void)[];
}

export function useFormValidation<T extends Record<string, any>>(
  values: T,
  rules: ValidationRules
) {
  const { isValid, errors } = useMemo(() => {
    const errors: Record<string, string> = {};

    // 1. Required fields
    if (rules.required) {
      for (const field of rules.required) {
        const val = values[field];
        if (
          val === undefined ||
          val === null ||
          (typeof val === "string" && trimText(val) === "") ||
          (Array.isArray(val) && val.length === 0)
        ) {
          errors[field] = "Este campo é obrigatório";
        }
      }
    }

    // 2. Minimum characters
    if (rules.minChars) {
      for (const [field, { min, message }] of Object.entries(rules.minChars)) {
        if (errors[field]) continue;
        const val = values[field];
        if (typeof val === "string" && trimText(val).length > 0 && trimText(val).length < min) {
          errors[field] = message;
        }
      }
    }

    // 3. Currency/Numeric (should be >= 0)
    if (rules.currency) {
      for (const field of rules.currency) {
        if (errors[field]) continue;
        const val = values[field];
        const num = Number(val);
        if (isNaN(num) || num < 0) {
          errors[field] = "O valor deve ser maior ou igual a zero";
        }
      }
    }

    // 4. Date ranges
    if (rules.dateRange) {
      for (const { startKey, endKey, message } of rules.dateRange) {
        if (errors[startKey] || errors[endKey]) continue;
        const startVal = values[startKey];
        const endVal = values[endKey];
        if (startVal && endVal) {
          const s = new Date(startVal);
          const e = new Date(endVal);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
            errors[endKey] = message;
          }
        }
      }
    }

    // 5. Emails
    if (rules.emails) {
      for (const field of rules.emails) {
        if (errors[field]) continue;
        const val = values[field];
        if (typeof val === "string" && val.trim().length > 0) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            errors[field] = "E-mail inválido";
          }
        }
      }
    }

    // 6. Custom validators
    if (rules.custom) {
      for (const customVal of rules.custom) {
        customVal(values, errors);
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [values, rules]);

  return { isValid, errors };
}
