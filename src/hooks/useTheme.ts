import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function useThemeLogic() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("chapada-theme") as Theme;
    return saved || "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    function applyTheme(currentTheme: Theme) {
      const root = window.document.documentElement;
      let newResolved: ResolvedTheme = "light";

      if (currentTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        newResolved = systemTheme;
      } else {
        newResolved = currentTheme;
      }

      setResolvedTheme(newResolved);
      
      root.classList.remove("light", "dark");
      root.classList.add(newResolved);
    }

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        applyTheme("system");
      };
      
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem("chapada-theme", newTheme);
    setThemeState(newTheme);
  };

  return { theme, setTheme, resolvedTheme };
}
