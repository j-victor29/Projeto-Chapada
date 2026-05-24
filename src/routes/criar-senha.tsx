import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout, ChapadaLogo } from "@/components/AuthLayout";
import { DarkInput, FieldLabel } from "./login";

export const Route = createFileRoute("/criar-senha")({
  head: () => ({ meta: [{ title: "Criar senha — CHAPADA" }] }),
  component: CriarSenhaPage,
});

function CriarSenhaPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Usuário precisa ter session (chegou via link de confirmação do e-mail).
  useEffect(() => {
    if (!loading && !session) {
      toast.error("Link inválido ou expirado. Solicite um novo cadastro.");
      navigate({ to: "/registro" });
    }
  }, [loading, session, navigate]);

  const match = pwd.length >= 8 && pwd === pwd2;
  const longEnough = pwd.length >= 8;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    setSubmitting(false);
    navigate({ to: "/login", search: { msg: "registered" } });
  };

  return (
    <AuthLayout
      left={
        <div className="flex flex-col items-center gap-6">
          <ChapadaLogo />
          <p className="max-w-xs text-center text-sm text-white/90">
            E-mail confirmado! Defina uma senha segura para acessar o sistema.
          </p>
        </div>
      }
      right={
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold" style={{ color: "#1A9FD4" }}>Criar sua senha</h2>
            <p className="mt-1 text-sm" style={{ color: "#6B8A9A" }}>Mínimo de 8 caracteres.</p>
          </div>

          <div>
            <FieldLabel htmlFor="pwd">Nova senha</FieldLabel>
            <div className="relative">
              <DarkInput
                id="pwd"
                type={show ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#6B8A9A" }}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="pwd2">Confirmar senha</FieldLabel>
            <DarkInput
              id="pwd2"
              type={show ? "text" : "password"}
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              required
              minLength={8}
            />
            {pwd2.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {match ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#4CAF50" }} />
                    <span style={{ color: "#4CAF50" }}>As senhas coincidem</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" style={{ color: "#d64545" }} />
                    <span style={{ color: "#d64545" }}>
                      {!longEnough ? "Mínimo de 8 caracteres" : "As senhas não coincidem"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!match || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: "#1A9FD4" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar senha e acessar
          </button>

          <p className="text-center text-xs" style={{ color: "#6B8A9A" }}>
            <Link to="/login" className="hover:underline" style={{ color: "#1A9FD4" }}>Voltar para o login</Link>
          </p>
        </form>
      }
    />
  );
}
