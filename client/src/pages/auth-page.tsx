import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Lock, Eye, EyeOff, ArrowRight, Quote } from "lucide-react";
import { useTranslation } from "@/lib/translations";
import signupBg from "@assets/auth-signup-bg.png";
import signinBg from "@assets/auth-signin-bg.png";

/** Icon + floating-label input in a bordered pill (matches the auth mockups). */
function AuthField({
  icon: Icon,
  label,
  trailing,
  ...props
}: {
  icon: typeof User;
  label: string;
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-white px-3.5 py-2.5 transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25">
      <Icon className="h-[18px] w-[18px] shrink-0 text-primary/70" />
      <div className="min-w-0 flex-1">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/60">{label}</label>
        <input
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          {...props}
        />
      </div>
      {trailing}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.17-2 3.44-4.95 3.44-8.38z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1.03 7.6-2.78l-3.72-2.89c-1.03.7-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.75v2.98A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.6 14.71a7.2 7.2 0 0 1 0-4.42V7.31H1.75a12 12 0 0 0 0 10.38l3.85-2.98z" />
      <path fill="#EA4335" d="M12 4.75c1.68 0 3.19.58 4.38 1.71l3.28-3.28C17.7 1.2 15.1 0 12 0 7.32 0 3.28 2.69 1.75 6.62L5.6 9.6C6.5 6.89 9.02 4.75 12 4.75z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.68c.03 3.2 2.8 4.26 2.83 4.28-.02.07-.44 1.52-1.46 3-.88 1.29-1.8 2.57-3.24 2.6-1.42.02-1.87-.84-3.5-.84-1.62 0-2.12.82-3.46.87-1.4.05-2.46-1.4-3.34-2.68-1.82-2.63-3.2-7.43-1.34-10.67.93-1.6 2.58-2.62 4.38-2.65 1.36-.03 2.65.92 3.5.92.83 0 2.4-1.14 4.05-.97.69.03 2.62.28 3.87 2.1-.1.06-2.3 1.35-2.29 4.01zM14.1 3.9c.74-.9 1.24-2.14 1.1-3.38-1.06.04-2.35.71-3.11 1.6-.69.79-1.29 2.06-1.13 3.28 1.19.09 2.4-.6 3.14-1.5z" />
    </svg>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, refetch } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation(typeof window !== "undefined" ? localStorage.getItem("preferredLanguage") : null);

  const isRegister = mode === "register";

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    setLocation("/");
    return null;
  }

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
  };

  const notImplemented = () =>
    toast({ title: t("comingSoon") || "Coming soon", description: "This sign-in option isn't available yet." });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body: any = { email, password };
      if (isRegister) {
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
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-primary">
      {/* Full-bleed scene: Adi Shankaracharya — both stacked, crossfaded on mode switch */}
      <img
        src={signinBg}
        alt=""
        aria-hidden={isRegister}
        className="absolute inset-0 h-full w-full object-cover object-left transition-opacity duration-700 ease-in-out"
        style={{ opacity: isRegister ? 0 : 1 }}
      />
      <img
        src={signupBg}
        alt="Adi Shankaracharya"
        aria-hidden={!isRegister}
        className="absolute inset-0 h-full w-full object-cover object-left transition-opacity duration-700 ease-in-out"
        style={{ opacity: isRegister ? 1 : 0 }}
      />

      {/* Quote overlay — top for sign up, bottom for sign in */}
      <div
        key={mode}
        className={`pointer-events-none absolute left-6 hidden max-w-sm xl:left-14 lg:block animate-in fade-in-0 duration-700 ${
          isRegister ? "top-14" : "bottom-14"
        }`}
      >
        <div className="rounded-2xl border border-white/15 bg-black/15 p-6 backdrop-blur-[2px]">
          <Quote className="mb-2 h-5 w-5 text-white/70" />
          <p className="font-hindi-heading text-2xl leading-snug text-white">ज्ञानं परमं तत्त्वम्</p>
          <p className="mt-1 text-[15px] italic text-white/90">Knowledge is the Supreme Truth.</p>
          <p className="mt-2 font-hindi-reading text-sm text-primary-foreground/90">— आदि शंकराचार्य</p>
        </div>
      </div>

      {/* Form card */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 lg:justify-end lg:px-10 xl:px-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-9 lg:max-w-lg">
          {/* Brand */}
          <div className="mb-1 flex items-center justify-center gap-3">
            <span className="h-px flex-1 bg-primary/20" />
            <span className="flex items-center gap-2 whitespace-nowrap">
              <img src="/favicon.png" alt="" className="h-6 w-6 object-contain" />
              <span className="font-page-heading text-lg text-foreground">{t("advaitaVaaridhi")}</span>
            </span>
            <span className="h-px flex-1 bg-primary/20" />
          </div>

          <div className="mb-6 text-center">
            <h1 className="font-page-heading text-3xl font-bold text-foreground">
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <div className="mx-auto mt-2 h-0.5 w-12 rounded-full bg-primary" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <div className="grid grid-cols-2 gap-3">
                <AuthField
                  icon={User}
                  label={t("firstName")}
                  placeholder="Enter your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-testid="input-first-name"
                />
                <AuthField
                  icon={User}
                  label={t("lastName")}
                  placeholder="Enter your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                />
              </div>
            )}

            <AuthField
              icon={Mail}
              label="Email Address"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
            />

            <AuthField
              icon={Lock}
              label={t("password")}
              type={showPw ? "text" : "password"}
              placeholder={isRegister ? "Create a password" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isRegister ? 6 : undefined}
              data-testid="input-password"
              trailing={
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-muted-foreground/60 hover:text-primary" aria-label="Toggle password visibility">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {isRegister && (
              <AuthField
                icon={Lock}
                label="Confirm Password"
                type={showConfirmPw ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
                trailing={
                  <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="text-muted-foreground/60 hover:text-primary" aria-label="Toggle password visibility">
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            )}

            {!isRegister && (
              <div className="text-right">
                <button type="button" onClick={notImplemented} className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" data-testid="text-auth-error">
                {error}
              </p>
            )}

            <Button type="submit" className="h-12 w-full gap-2 text-base" disabled={loading} data-testid="button-auth-submit">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRegister ? "Create Account" : "Sign In"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{isRegister ? "or sign up with" : "or continue with"}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={notImplemented} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-white text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-accent/40">
              <GoogleIcon /> Google
            </button>
            <button type="button" onClick={notImplemented} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-white text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-accent/40">
              <AppleIcon /> Apple
            </button>
          </div>

          {/* Switch */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "login" : "register")}
              className="font-semibold text-primary hover:underline"
              data-testid={isRegister ? "link-switch-to-login" : "link-switch-to-register"}
            >
              {isRegister ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
