import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, ChapadaLogo } from "@/components/AuthLayout";
import { LightInput, FieldLabel } from "./login";
import { isAllowedEmail, DOMAIN_ERROR } from "@/lib/auth-domain";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/esqueci-senha")({
  component: EsqueciSenhaPage,
});


type Step = "email" | "done";

function EsqueciSenhaPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      setEmailError(DOMAIN_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: window.location.origin + "/criar-senha",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setEmail(trimmed);
      setStep("done");
      toast.success("E-mail de recuperação enviado!");
    } catch (err) {
      console.error("resetPassword error", err);
      toast.error("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      left={
        <div className="flex flex-col items-center gap-6">
          <ChapadaLogo />
          <p className="max-w-xs text-center text-sm text-white/90">
            {step === "email" && "Enviaremos um link de recuperação para o seu e-mail institucional."}
            {step === "done" && "Verifique o link enviado para o seu e-mail."}
          </p>
          <Link
            to="/login"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 hover:underline"
          >
            ← Voltar para login
          </Link>
        </div>
      }
      right={
        <>
          {step === "email" && (
            <form onSubmit={handleSendResetLink} className="space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold" style={{ color: "#1A9FD4" }}>
                  Recuperar senha
                </h2>
                <p className="mt-1 text-sm" style={{ color: "#6B8A9A" }}>
                  Informe seu e-mail cadastrado.
                </p>
              </div>
              <div>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "#6B8A9A" }}
                  />
                  <LightInput
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                    placeholder="seu.nome@ongchapada.org.br"
                    className="pl-10"
                    required
                  />
                </div>
                {emailError && (
                  <p className="mt-2 text-xs font-medium" style={{ color: "#d64545" }}>{emailError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: "#1A9FD4" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar link de recuperação
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div
                className="mx-auto grid h-14 w-14 place-items-center rounded-full"
                style={{ backgroundColor: "rgba(76,175,80,0.15)" }}
              >
                <CheckCircle2 className="h-7 w-7" style={{ color: "#4CAF50" }} />
              </div>
              <h2 className="font-display text-xl font-bold" style={{ color: "#1A9FD4" }}>
                ✅ E-mail enviado!
              </h2>
              <p className="text-sm" style={{ color: "#1A3A4A" }}>
                Enviamos as instruções para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
              </p>
              <Link
                to="/login"
                className="inline-block text-xs font-medium hover:underline mt-4"
                style={{ color: "#1A9FD4" }}
              >
                Ir para o login agora
              </Link>
            </div>
          )}
        </>
      }
    />
  );
}
