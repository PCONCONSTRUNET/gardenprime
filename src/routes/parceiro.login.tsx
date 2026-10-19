import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { GardenPrimeLogo } from "@/components/garden-prime-logo";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/parceiro/login")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      await supabase.auth.signOut();
    }
  },
  head: () => ({ meta: [{ title: "Login Parceiro — GARDEN PRIME" }] }),
  component: LoginParceiro,
});

function LoginParceiro() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verifica se o parceiro foi bloqueado via sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem("parceiro_blocked") === "1") {
      setError("⚠️ Sua conta ainda está aguardando aprovação. Aguarde o contato do administrador.");
      sessionStorage.removeItem("parceiro_blocked");
    } else if (sessionStorage.getItem("parceiro_blocked_inactive") === "1") {
      setError("⚠️ Seu cadastro está desativado. Entre em contato com a administração.");
      sessionStorage.removeItem("parceiro_blocked_inactive");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Validação do status do vendedor parceiro
      if (authData?.user) {
        let { data: vendedor } = await supabase
          .from("vendedores")
          .select("id, status, nome")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (!vendedor) {
          const { data: vByEmail } = await supabase
            .from("vendedores")
            .select("id, status, nome")
            .ilike("email", email.trim())
            .maybeSingle();
          vendedor = vByEmail;
        }

        if (vendedor && (vendedor.status === "Inativo" || vendedor.status === "Desativado")) {
          await supabase.auth.signOut();
          setError("⚠️ Seu cadastro está desativado pelo administrador. Acesso não permitido.");
          return;
        }

        if (vendedor && vendedor.status === "Aguardando Aprovação") {
          await supabase.auth.signOut();
          setError("⚠️ Sua conta ainda está aguardando aprovação. Aguarde o contato do administrador.");
          return;
        }
      }

      // Sucesso! Redireciona para onde o usuário tentou ir (ou dashboard)
      const redirectUrl = sessionStorage.getItem("parceiro_redirect");
      if (redirectUrl) {
        sessionStorage.removeItem("parceiro_redirect");
        window.location.href = redirectUrl;
      } else {
        navigate({ to: "/parceiro/dashboard" });
      }
    } catch (err: any) {
      if (err.message === "Email not confirmed") {
        setError(
          "Por favor, confirme seu e-mail (verifique a caixa de entrada) antes de fazer login.",
        );
      } else if (err.message === "Invalid login credentials") {
        setError("E-mail ou senha incorretos.");
      } else {
        setError(err.message || "Ocorreu um erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    setResetLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/parceiro/login`,
      });
      setResetSent(true);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-sm shadow-xl border-0 ring-1 ring-slate-900/5">
        <div className="pt-8 pb-4 flex justify-center">
          <GardenPrimeLogo size="small" />
        </div>
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold font-display text-slate-800">Portal do Parceiro</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Faça login para registrar suas vendas e acompanhar suas comissões.
            </p>
          </div>

          {resetSent ? (
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-700 font-medium">
                ✅ Link de redefinição enviado para <strong>{email}</strong>. Verifique sua caixa de
                entrada.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Senha</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  className={`text-sm text-center font-medium py-2 px-3 rounded-md ${error.startsWith("⚠") ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-destructive/10 text-destructive"}`}
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-gradient-brand text-primary-foreground"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Acessar Portal"}
              </Button>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="w-full text-center text-xs text-muted-foreground hover:text-brand transition-colors pt-1"
              >
                {resetLoading ? "Enviando..." : "Esqueceu sua senha? Clique aqui"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            Ainda não é parceiro?{" "}
            <Link to="/parceiro/cadastro" className="font-semibold text-brand hover:underline">
              Crie sua conta
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
