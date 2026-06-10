import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout, ChapadaLogo } from "@/components/AuthLayout";

const searchSchema = z.object({
  msg: z.enum(["registered", "password_reset"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});


function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { msg } = useSearch({ from: "/login" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let flash: string | null = msg ?? null;
    if (!flash && typeof window !== "undefined") {
      flash = sessionStorage.getItem("chapada.flash");
      if (flash) sessionStorage.removeItem("chapada.flash");
    }
    if (flash === "registered") {
      toast.success("Conta criada com sucesso! Faça seu login.");
    } else if (flash === "password_reset") {
      toast.success("Senha alterada com sucesso!");
    }
  }, [msg]);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message,
        );
        return;
      }
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/" });
    } catch (err) {
      console.error("login error", err);
      toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      left={
        <div className="flex flex-col items-center gap-8">
          <ChapadaLogo />
          <div className="mt-6 text-center">
            <p className="text-base text-white/90">Primeiro Acesso?</p>
            <Link
              to="/registro"
              className="mt-3 inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold shadow-md transition-all hover:brightness-110"
              style={{ backgroundColor: "#F5A623", color: "#1A3A4A" }}
            >
              Registre Agora
            </Link>
          </div>
        </div>
      }
      right={
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold" style={{ color: "#1A9FD4" }}>
              Bem-vindo à Chapada!
            </h2>
            <p className="mt-1 text-sm" style={{ color: "#6B8A9A" }}>
              Entre com suas credenciais para acessar.
            </p>
          </div>

          <div>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <LightInput
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu.nome@ongchapada.org.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <div className="relative">
              <LightInput
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#6B8A9A" }}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer items-center gap-2" style={{ color: "#4A6275" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded accent-[#1A9FD4]"
                style={{ borderColor: "#C4DFF0" }}
              />
              Lembrar a senha
            </label>
            <Link
              to="/esqueci-senha"
              className="font-medium hover:underline"
              style={{ color: "#1A9FD4" }}
            >
              Esqueci minha senha
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: "#1A9FD4" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>
      }
    />
  );
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
      style={{ color: "#4A6275" }}
    >
      {children}
    </label>
  );
}

export function LightInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1A9FD4] focus:ring-2 focus:ring-[#1A9FD4]/20 ${className}`}
      style={{ borderColor: "#C4DFF0", color: "#1A3A4A" }}
    />
  );
}

// Backwards-compat alias for screens that still import DarkInput.
export const DarkInput = LightInput;
