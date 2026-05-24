import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Images,
  BarChart3,
  Users,
  Sprout,
  FileText,
  Database,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import chapadaLogo from "@/assets/chapada-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileStore";

type NavItem = {
  to: "/" | "/projetos" | "/atividades" | "/imagens" | "/indicadores" | "/tecnologias" | "/usuarios" | "/documentos" | "/cadastros" | "/auditoria";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/atividades", label: "Atividades", icon: ClipboardList },
  { to: "/imagens", label: "Banco de Imagens", icon: Images },
  { to: "/indicadores", label: "Indicadores", icon: BarChart3 },
  { to: "/tecnologias", label: "Tecnologias Sociais", icon: Sprout },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/cadastros", label: "Cadastros", icon: Database },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/auditoria", label: "Auditoria", icon: ShieldAlert },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const profile = useProfile(user?.email);
  const isAdmin = profile?.role === "admin";

  const visibleNav = nav.filter(item => {
    if (item.to === "/auditoria") return isAdmin;
    if (item.to === "/usuarios") return isAdmin;
    return true;
  });

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 grid place-items-center">
            <img
              src={chapadaLogo}
              alt="Logo CHAPADA"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">CHAPADA</div>
            <div className="text-[11px] text-sidebar-foreground/70">Gestão de Projetos</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60">
        Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe
      </div>
    </aside>
  );
}
