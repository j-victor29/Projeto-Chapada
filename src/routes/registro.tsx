import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Mail, CheckCircle2, XCircle, User } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, ChapadaLogo } from "@/components/AuthLayout";
import { LightInput, FieldLabel } from "./login";
import { isAllowedEmail, DOMAIN_ERROR } from "@/lib/auth-domain";
import { capitalize } from "@/lib/profileStore";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
});


type Step = "email" | "otp" | "password" | "done";

function RegistroPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Step 1: validate domain and send OTP
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      toast.error("Apenas e-mails institucionais @ongchapada.org.br são permitidos");
      setEmailError(DOMAIN_ERROR);
      return;
    }
    setEmail(trimmed);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setStep("otp");
    } catch (err) {
      console.error("sendOtp error", err);
      toast.error("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: verify OTP and advance to password
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.trim();
    if (token.length !== 6) {
      toast.error("Digite o código de 6 dígitos enviado ao seu e-mail.");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setStep("password");
    } catch (err) {
      console.error("verifyOtp error", err);
      toast.error("Erro ao verificar o código. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  // Step 3: collect name + password and update user
  const match = pwd.length >= 8 && pwd === pwd2;
  const canCreate = firstName.trim() && lastName.trim() && match;

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwd,
        data: {
          full_name: `${capitalize(firstName.trim())} ${capitalize(lastName.trim())}`,
          role: "admin",
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setStep("done");
      setTimeout(() => {
        navigate({ to: "/login", search: { msg: "registered" } });
      }, 2000);
    } catch (err) {
      console.error("createAccount error", err);
      toast.error("Não foi possível salvar seus dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const leftMessage =
    step === "email"
      ? "Cadastre seu e-mail institucional para começar."
      : step === "otp"
      ? "Insira o código enviado ao seu e-mail institucional."
      : step === "password"
      ? "Complete seus dados e crie uma senha segura."
      : "Conta verificada! Redirecionando…";

  return (
    <AuthLayout
      left={
        <div className="flex flex-col items-center gap-6">
          <ChapadaLogo />
          <p className="max-w-xs text-center text-sm text-white/90">
            Cadastro restrito a colaboradores com e-mail{" "}
            <span style={{ color: "#F5A623" }}>@ongchapada.org.br</span>
          </p>
          <p className="max-w-xs text-center text-xs text-white/80">{leftMessage}</p>
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
            <form onSubmit={sendOtp} className="space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold" style={{ color: "#1A9FD4" }}>
                  Criar conta
                </h2>
                <p className="mt-1 text-sm" style={{ color: "#6B8A9A" }}>
                  Informe seu e-mail institucional para começar.
                </p>
              </div>
              <div>
                <FieldLabel htmlFor="email">E-mail institucional</FieldLabel>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "#6B8A9A" }}
                  />
                  <LightInput
                    id="email"
                    type="email"
                    placeholder="seu.nome@ongchapada.org.br"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className="pl-10"
                    required
                  />
                </div>
                {emailError && (
                  <p className="mt-2 text-xs font-medium" style={{ color: "#d64545" }}>
                    {emailError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: "#1A9FD4" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Avançar
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyCode} className="space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold" style={{ color: "#1A9FD4" }}>
                  Verifique seu e-mail
                </h2>
                <p className="mt-1 text-sm" style={{ color: "#6B8A9A" }}>
                  Enviamos um código de 6 dígitos para{" "}
                  <strong style={{ color: "#1A3A4A" }}>{email}</strong>.
                  Insira-o abaixo para continuar.
                </p>
              </div>

              <div>
                <FieldLabel htmlFor="otp">Código de verificação</FieldLabel>
                <LightInput
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  className="text-center text-xl tracking-[0.4em] font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: "#1A9FD4" }}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar código
              </button>

              <p className="text-center text-xs" style={{ color: "#6B8A9A" }}>
                Não recebeu?{" "}
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.auth.resend({
                      type: "signup",
                      email: email.trim().toLowerCase(),
                    });
                    if (error) toast.error(error.message);
                    else toast.success("Código reenviado!");
                  }}
                  className="font-medium hover:underline"
                  style={{ color: "#1A9FD4" }}
                >
                  Reenviar código
                </button>
              </p>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={createAccount} className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold" style={{ color: "#1A9FD4" }}>
                  Complete seu cadastro
                </h2>
                <p className="mt-1 text-sm" style={{ color: "#6B8A9A" }}>
                  Informe seus dados e crie uma senha de acesso.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="firstName">Nome</FieldLabel>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: "#6B8A9A" }}
                    />
                    <LightInput
                      id="firstName"
                      placeholder="Ex: Maria"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="lastName">Sobrenome</FieldLabel>
                  <LightInput
                    id="lastName"
                    placeholder="Ex: Conceição"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="pwd">Nova senha</FieldLabel>
                <div className="relative">
                  <LightInput
                    id="pwd"
                    type={show ? "text" : "password"}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    minLength={8}
                    required
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
                <FieldLabel htmlFor="pwd2">Confirmar nova senha</FieldLabel>
                <LightInput
                  id="pwd2"
                  type={show ? "text" : "password"}
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  minLength={8}
                  required
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
                          {pwd.length < 8 ? "Mínimo de 8 caracteres" : "As senhas não coincidem"}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!canCreate || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: "#1A9FD4" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar minha conta
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
                Conta verificada!
              </h2>
              <p className="text-xs" style={{ color: "#6B8A9A" }}>
                Redirecionando para o login…
              </p>
            </div>
          )}
        </>
      }
    />
  );
}
