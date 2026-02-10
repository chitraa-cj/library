import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/translations";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, refetch } = useAuth();
  const { t } = useTranslation(typeof window !== 'undefined' ? localStorage.getItem('preferredLanguage') : null);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email, password };
      if (mode === "register") {
        body.firstName = firstName;
        body.lastName = lastName;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || t("somethingWentWrong"));
        return;
      }

      await refetch();
      setLocation("/");
    } catch (err) {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img
              src="https://oneness.org.in/assets/img/favicon.png"
              alt="Advaita Vaaridhi"
              className="h-10 w-10 object-contain"
            />
            <h1 className="font-serif text-xl font-bold text-primary">{t("advaitaVaaridhi")}</h1>
          </div>
          <p className="text-xs text-muted-foreground tracking-wide">{t("encyclopaediaOfAdvaitaVedanta")}</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex gap-2">
              <Button
                variant={mode === "login" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => { setMode("login"); setError(""); }}
                data-testid="tab-login"
              >
                {t("logIn")}
              </Button>
              <Button
                variant={mode === "register" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => { setMode("register"); setError(""); }}
                data-testid="tab-register"
              >
                {t("signUp")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">{t("firstName")}</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t("firstNamePlaceholder")}
                      required
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">{t("lastName")}</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={t("lastNamePlaceholder")}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? t("passwordPlaceholderRegister") : t("passwordPlaceholderLogin")}
                  required
                  minLength={mode === "register" ? 6 : undefined}
                  data-testid="input-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" data-testid="text-auth-error">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-auth-submit"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "login" ? t("logIn") : t("signUp")}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {mode === "login" ? (
                <>
                  {t("dontHaveAccount")}{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => { setMode("register"); setError(""); }}
                    data-testid="link-switch-to-register"
                  >
                    {t("signUpLink")}
                  </button>
                </>
              ) : (
                <>
                  {t("alreadyHaveAccount")}{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => { setMode("login"); setError(""); }}
                    data-testid="link-switch-to-login"
                  >
                    {t("logInLink")}
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
