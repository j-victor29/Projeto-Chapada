import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, LogOut, Loader2, UserCog, KeyRound, Check, Trash2, MessageSquare, Image as ImageIcon, FolderKanban, Sparkles, ClipboardList } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { fullName, initialsFrom, useProfile } from "@/lib/profileStore";
import {
  clearAll,
  markAllRead,
  markRead,
  useNotifications,
  type NotificationType,
} from "@/lib/notificationsStore";
import { ProfileModal } from "./ProfileModal";
import { useDebounce } from "@/hooks/use-debounce";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { ThemeToggle } from "./ThemeToggle";

const typeIcon: Record<NotificationType, ReactNode> = {
  atividade: <ClipboardList className="h-4 w-4 text-primary" />,
  projeto: <FolderKanban className="h-4 w-4 text-primary" />,
  imagem: <ImageIcon className="h-4 w-4 text-primary" />,
  tecnologia: <Sparkles className="h-4 w-4 text-primary" />,
  mensagem: <MessageSquare className="h-4 w-4 text-primary" />,
};

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
};

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { session, loading, user, signOut, impersonate, clearImpersonation } = useAuth();
  const email = user?.email ?? "";
  const profile = useProfile(email);
  const { query, setQuery } = useGlobalSearch();
  const notifications = useNotifications();
  const [profileOpen, setProfileOpen] = useState(false);

  // ── Tempo real: escuta INSERTs na tabela notificacoes ──────────────────────
  useRealtimeNotifications();
  const [passwordOpen, setPasswordOpen] = useState(false);
  
  const [localQuery, setLocalQuery] = useState(query);
  const debouncedQuery = useDebounce(localQuery, 300);

  useEffect(() => {
    setQuery(debouncedQuery);
  }, [debouncedQuery, setQuery]);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  // Clear global search whenever route mounts a new AppLayout (per-page reset)
  useEffect(() => {
    setQuery("");
    setLocalQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = fullName(profile, email.split("@")[0]);
  const initials = initialsFrom(profile, email);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-border/60 bg-card/70 backdrop-blur-md flex items-center px-4 md:px-8 gap-4 shadow-sm">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-display font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/70 w-72 backdrop-blur-sm transition-all focus-within:border-primary/40 focus-within:bg-background/70">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar nesta página..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
            />
          </div>

          {/* User Impersonation Switcher for testing */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30">
            <span className="text-[10px] font-bold text-green-800 dark:text-green-400 uppercase tracking-wider hidden md:inline">Testar RLS:</span>
            <select
              value={user?.id || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "27e51803-8f32-4b08-a97b-365dd1235815") {
                  impersonate("sistema@ongchapada.org.br", "27e51803-8f32-4b08-a97b-365dd1235815");
                } else if (val === "2f6dd0c6-c082-4d76-94c5-eadc984953df") {
                  impersonate("teste@ongchapada.org.br", "2f6dd0c6-c082-4d76-94c5-eadc984953df");
                }
              }}
              className="bg-transparent text-xs font-semibold text-green-900 dark:text-green-300 outline-none border-none cursor-pointer"
            >
              <option value="27e51803-8f32-4b08-a97b-365dd1235815" className="bg-background text-foreground">sistema</option>
              <option value="2f6dd0c6-c082-4d76-94c5-eadc984953df" className="bg-background text-foreground">teste</option>
            </select>
          </div>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-muted transition-colors"
                aria-label="Notificações"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-terracotta text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h4 className="text-sm font-semibold">Notificações</h4>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={markAllRead}
                    disabled={unread === 0}
                  >
                    <Check className="h-3 w-3" /> Marcar lidas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                    onClick={clearAll}
                    disabled={notifications.length === 0}
                  >
                    <Trash2 className="h-3 w-3" /> Limpar
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    Nenhuma notificação no momento.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => markRead(n.id)}
                        onKeyDown={(e) => e.key === "Enter" && markRead(n.id)}
                        className={`px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                          n.read ? "" : "bg-primary/5"
                        }`}
                      >
                        <span className="mt-0.5">{typeIcon[n.type]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" title="Clique para marcar como lida" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs font-medium truncate max-w-[180px]">{displayName}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{email}</span>
          </div>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full" aria-label="Conta">
                <Avatar className="h-9 w-9 border border-border cursor-pointer">
                  {profile?.photoDataUrl && (
                    <AvatarImage src={profile.photoDataUrl} alt={displayName} />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{displayName}</span>
                  <span className="text-xs text-muted-foreground truncate">{email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)} className="gap-2">
                <UserCog className="h-4 w-4" /> Editar perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPasswordOpen(true)} className="gap-2">
                <KeyRound className="h-4 w-4" /> Alterar senha
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
          {actions && <div className="flex flex-wrap gap-3 mb-6 justify-end">{actions}</div>}
          {children}
        </main>
      </div>

      <ProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        email={email}
        profile={profile}
        mode="profile"
      />
      <ProfileModal
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        email={email}
        profile={profile}
        mode="password"
      />
    </div>
  );
}
