import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, EyeOff, Upload, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getProfile,
  initialsFrom,
  setProfile,
  type UserProfile,
} from "@/lib/profileStore";

export type ProfileModalMode = "profile" | "password";

export function ProfileModal({
  open,
  onOpenChange,
  email,
  profile,
  mode = "profile",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  profile: UserProfile | null;
  mode?: ProfileModalMode;
}) {
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [photo, setPhoto] = useState<string | undefined>(profile?.photoDataUrl);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [show, setShow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const p = getProfile(email);
      setFirstName(p?.firstName ?? "");
      setLastName(p?.lastName ?? "");
      setPhoto(p?.photoDataUrl);
      setCurrentPwd("");
      setNewPwd("");
      setNewPwd2("");
    }
  }, [open, email]);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      toast.error("Use uma imagem JPG ou PNG.");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 3MB).");
      return;
    }
    const r = new FileReader();
    r.onload = () => setPhoto(String(r.result));
    r.readAsDataURL(f);
  };

  const pwdMatch = newPwd.length >= 8 && newPwd === newPwd2;

  const saveProfile = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Preencha nome e sobrenome.");
      return;
    }
    setProfile(email, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      photoDataUrl: photo,
    });
    toast.success("✅ Perfil atualizado com sucesso!");
    onOpenChange(false);
  };

  const savePassword = () => {
    const stored = getProfile(email)?.password;
    if (stored && currentPwd !== stored) {
      toast.error("Senha atual incorreta.");
      return;
    }
    if (!pwdMatch) {
      toast.error("Nova senha inválida ou não confere.");
      return;
    }
    setProfile(email, { password: newPwd });
    toast.success("✅ Senha alterada com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "profile" ? "Editar perfil" : "Alterar senha"}
          </DialogTitle>
          <DialogDescription>
            {mode === "profile"
              ? "Atualize sua foto, nome e sobrenome."
              : "Informe sua senha atual e crie uma nova."}
          </DialogDescription>
        </DialogHeader>

        {mode === "profile" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {photo && <AvatarImage src={photo} alt="Foto" />}
                <AvatarFallback className="bg-primary text-primary-foreground text-base font-medium">
                  {initialsFrom(
                    { email, firstName, lastName, photoDataUrl: photo },
                    email,
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={onPhoto}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-3.5 w-3.5" /> Trocar foto
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">JPG ou PNG, máx 3MB</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Sobrenome</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Senha atual</Label>
              <Input
                type={show ? "text" : "password"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
              />
            </div>
            <div>
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input
                type={show ? "text" : "password"}
                value={newPwd2}
                onChange={(e) => setNewPwd2(e.target.value)}
              />
              {newPwd2.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  {pwdMatch ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-green-700">As senhas coincidem</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-destructive">
                        {newPwd.length < 8 ? "Mínimo 8 caracteres" : "Senhas não coincidem"}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={mode === "profile" ? saveProfile : savePassword}>
            {mode === "profile" ? "Salvar alterações" : "Salvar nova senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
