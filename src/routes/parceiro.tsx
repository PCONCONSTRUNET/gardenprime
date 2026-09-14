import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import { Home, Calculator, LogOut, Package, Menu, X, Wallet, ClipboardList, Grid, ShoppingCart, Plus, MoreHorizontal, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/parceiro")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    // Se a rota for o login ou cadastro, não faz a checagem restritiva
    if (location.pathname === "/parceiro/login" || location.pathname === "/parceiro/cadastro")
      return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // Salva a URL destino para redirecionar após o login
        sessionStorage.setItem("parceiro_redirect", window.location.href);
        throw redirect({ to: "/parceiro/login" });
      }

      // Bloqueia o acesso de Administradores (Dono) ao portal de Parceiros
      const envAdmin = import.meta.env.VITE_ADMIN_EMAIL || "";
      const adminEmail = `${envAdmin},douglasalmeida156@hotmail.com`;
      const ADMIN_EMAILS = adminEmail
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);

      if (session.user.email && ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
        // Desloga o admin do cliente do parceiro para limpar o storage fantasma
        await supabase.auth.signOut();
        throw redirect({ to: "/app/dashboard" });
      }

      // Verifica se o parceiro está aprovado no sistema
      const { data: vendedor } = await supabase
        .from("vendedores")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!vendedor) {
        // Se o vendedor não existe na tabela, pode ser que o admin deletou ele (vendedores e auth.users).
        // Validamos diretamente no servidor do Supabase se o login (auth) ainda existe e é válido.
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          // O usuário foi deletado! Desloga do local storage e expulsa para o login.
          await supabase.auth.signOut();
          throw redirect({ to: "/parceiro/login" });
        }
      }

      // Não bloqueia o acesso globalmente aqui para não deslogar o usuário.
    } catch (err: any) {
      // Se o erro é um redirect do TanStack Router, repassa normalmente
      if (err?.isRedirect || err?.message === "redirect") throw err;
      // Qualquer outro erro de rede/DB: deixa passar sem bloquear o acesso
      console.warn("[parceiro beforeLoad] erro ao verificar status:", err);
    }
  },
  component: ParceiroLayout,
});

const navItems = [
  { to: "/parceiro/dashboard", icon: Home, label: "Início" },
  { to: "/parceiro/pdv", icon: Calculator, label: "Nova Venda" },
  { to: "/parceiro/vendas", icon: ClipboardList, label: "Vendas" },
  { to: "/parceiro/pagamentos", icon: Wallet, label: "Pagamentos" },
  { to: "/parceiro/catalogo", icon: ShoppingCart, label: "Meus Carrinhos" },
  { to: "/parceiro/clientes", icon: Users, label: "Clientes" },
  { to: "/parceiro/configuracoes", icon: Settings, label: "Configurações" },
];

function ParceiroLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Se for a tela de login ou cadastro, não mostra o menu
  if (pathname === "/parceiro/login" || pathname === "/parceiro/cadastro") {
    return <Outlet />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/parceiro/login";
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── SIDEBAR DESKTOP (≥ lg) ── */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white border-r shadow-sm sticky top-0 h-screen">
        <div className="flex items-center justify-center h-16 border-b px-4">
          <GardenPrimeLogo horizontal size="small" />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                pathname.startsWith(to)
                  ? "bg-brand/10 text-brand font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-destructive w-full transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── DRAWER MOBILE (< lg) ── */}
      {/* Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 border-b px-4">
          <GardenPrimeLogo horizontal size="small" />
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
                pathname.startsWith(to)
                  ? "bg-brand/10 text-brand font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-destructive w-full transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sair
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Mobile Header com botão ☰ (Oculto na tela PDV para usar o cabeçalho customizado) */}
        {pathname !== "/parceiro/pdv" && (
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white shadow-sm px-4 lg:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <GardenPrimeLogo horizontal size="small" />
            <div className="w-10" />
          </header>
        )}

        {/* Page content */}
        <main className={cn("flex-1 max-w-2xl w-full mx-auto lg:max-w-4xl", pathname !== "/parceiro/pdv" && "p-4 lg:px-8 lg:py-8")}>
          <Outlet />
        </main>

        {/* ── BOTTOM NAVIGATION (Mobile) ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0A4D2E] rounded-t-3xl text-white px-6 py-2 flex items-center justify-between z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
          <Link to="/parceiro/dashboard" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 [&.active]:opacity-100 transition-opacity">
            <Grid className="w-6 h-6" />
            <span className="text-[10px] font-medium">Dashboard</span>
          </Link>
          
          <Link to="/parceiro/catalogo" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 [&.active]:opacity-100 transition-opacity">
            <ShoppingCart className="w-6 h-6" />
            <span className="text-[10px] font-medium">Carrinho</span>
          </Link>
          
          {/* Floating Action Button */}
          <div className="relative -top-6 flex items-center justify-center">
            <Link 
              to="/parceiro/pdv"
              className="bg-[#12794C] hover:bg-[#1a905d] text-white p-4 rounded-full shadow-lg border-[6px] border-slate-50 transition-transform active:scale-95"
            >
              <Plus className="w-8 h-8" />
            </Link>
            <span className="absolute -bottom-5 text-[10px] font-medium opacity-100 whitespace-nowrap">Nova Venda</span>
          </div>

          <Link to="/parceiro/vendas" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 [&.active]:opacity-100 transition-opacity">
            <ClipboardList className="w-6 h-6" />
            <span className="text-[10px] font-medium">Pedidos</span>
          </Link>

          <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </div>
    </div>
  );
}
