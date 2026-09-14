import { useState, useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  Truck,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Calculator,
  Wallet,
  Map,
  Receipt,
  BarChart3,
  Globe,
  Smartphone,
  UserCircle,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  PlusCircle,
  CheckCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { GardenPrimeLogo } from "./garden-prime-logo";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  {
    group: "Principal",
    items: [
      { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/registro", label: "Registro Rápido", icon: PlusCircle },
    ],
  },
  {
    group: "Operação",
    items: [
      { to: "/app/estoque", label: "Estoque", icon: Boxes },
      { to: "/app/produtos", label: "Produtos", icon: Package },
      { to: "/app/vendas-produtos", label: "Vendas Produtos", icon: TrendingUp },
      { to: "/app/clientes", label: "Clientes", icon: Users },
      { to: "/app/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    group: "Comercial",
    items: [
      { to: "/app/compras", label: "Compras", icon: ShoppingBag },
      { to: "/app/vendas", label: "Vendas", icon: ShoppingCart },
      { to: "/app/dav", label: "DAV", icon: FileText },
      { to: "/app/pdv", label: "PDV", icon: Calculator },
      { to: "/app/vendedores", label: "Vendedores", icon: Users },
      { to: "/app/vendas-parceiros", label: "Vendas Parceiros", icon: ShoppingCart },
    ],
  },
  {
    group: "Gestão",
    items: [
      { to: "/app/financeiro", label: "Financeiro", icon: Wallet },
      // { to: "/app/cobrancas", label: "Cobranças ASAAS", icon: Zap },
      { to: "/app/logistica", label: "Logística", icon: Map },
      { to: "/app/fiscal", label: "Fiscal", icon: Receipt },
      { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    group: "Canais",
    items: [
      { to: "/app/catalogo", label: "Catálogo Digital", icon: Globe },
      { to: "/app/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    try {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAllAsRead = async () => {
    await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const toggleDark = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Erro ao sair:", e);
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 h-screen hidden md:flex print:hidden w-64 shrink-0 flex-col bg-gradient-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 border-b border-sidebar-border">
          <GardenPrimeLogo horizontal size="default" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                {g.group}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = pathname === it.to;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}
                      >
                        <it.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 p-2.5">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-brand grid place-items-center text-sm font-bold text-primary-foreground">
              DA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">Douglas Almeida</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">Administrador</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
              title="Sair do sistema"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-gradient-sidebar text-sidebar-foreground p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <GardenPrimeLogo horizontal size="small" />
              <Button
                size="icon"
                variant="ghost"
                className="text-sidebar-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {NAV.map((g) => (
              <div key={g.group} className="mb-4">
                <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  {g.group}
                </div>
                {g.items.map((it) => (
                  <Link
                    key={it.to}
                    to={it.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      pathname === it.to ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
                    )}
                  >
                    <it.icon className="h-4 w-4" /> {it.label}
                  </Link>
                ))}
              </div>
            ))}
            <div className="mt-4 p-3 border-t border-sidebar-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 w-full transition-colors font-medium"
              >
                <LogOut className="h-4 w-4" /> Sair do sistema
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:px-6 print:hidden">
          <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative hidden md:block flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos, clientes, pedidos…"
              className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-card"
            />
          </div>
          <div className="flex-1 md:hidden" />
          <Button variant="ghost" size="icon" onClick={toggleDark}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 h-4 w-4 p-0 grid place-items-center text-[10px] bg-destructive text-destructive-foreground">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold text-sm">Notificações</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs bg-brand/10 text-brand border-0">
                      {unreadCount} novas
                    </Badge>
                  )}
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-brand"
                      onClick={markAllAsRead}
                      title="Marcar todas como lida"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma notificação.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.lida && markAsRead(n.id)}
                      className={cn(
                        "px-4 py-3 border-b cursor-pointer transition-colors",
                        n.lida ? "bg-background hover:bg-muted/50" : "bg-brand/5 hover:bg-brand/10",
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span
                          className={cn(
                            "text-sm",
                            n.lida
                              ? "font-medium text-muted-foreground"
                              : "font-bold text-foreground",
                          )}
                        >
                          {n.titulo}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t text-center">
                <Link to="/app/notificacoes">
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-brand hover:text-brand/80 h-8"
                  >
                    Ver todas as notificações
                  </Button>
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-secondary">
                <div className="h-8 w-8 rounded-full bg-gradient-brand grid place-items-center text-xs font-bold text-primary-foreground">
                  DA
                </div>
                <span className="hidden sm:inline text-sm font-medium">Douglas</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/configuracoes" className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/configuracoes" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between print:hidden">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
