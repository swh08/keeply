"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { KeeplyLogo } from "@/components/app-shell/keeply-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AuthForm({ locale, mode }: { locale: string; mode: "login" | "register" | "forgot" }) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "forgot") return;
    setLoading(true);
    try {
      const result = mode === "register"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password, rememberMe: true });
      if (result.error) throw new Error(result.error.message ?? t("errors.generic"));
      router.replace(mode === "register" ? `/${locale}/onboarding` : `/${locale}/app/home`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center"><KeeplyLogo locale={locale} className="h-14" /></div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t(`auth.${mode === "forgot" ? "forgotPassword" : mode}`)}</CardTitle>
            <CardDescription>{mode === "forgot" ? t("auth.resetUnavailable") : t("brand.tagline")}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "forgot" ? (
              <div className="flex flex-col gap-5">
                <p className="text-sm leading-6 text-muted-foreground">{t("auth.resetInstructions")}</p>
                <Button asChild><Link href={`/${locale}/login`}>{t("auth.login")}</Link></Button>
              </div>
            ) : (
              <>
                <form onSubmit={submit}>
                  <FieldGroup>
                    {mode === "register" ? (
                      <Field>
                        <FieldLabel htmlFor="name">{t("auth.displayName")}</FieldLabel>
                        <Input id="name" autoComplete="name" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} />
                      </Field>
                    ) : null}
                    <Field>
                      <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
                      <Input id="email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
                      <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
                    </Field>
                    <Button type="submit" disabled={loading}>
                      <ArrowRight data-icon="inline-end" />
                      {t(`auth.${mode}`)}
                    </Button>
                  </FieldGroup>
                </form>
                <div className="mt-6 flex justify-between text-sm">
                  {mode === "login" ? (
                    <>
                      <Link className="text-primary hover:underline" href={`/${locale}/register`}>{t("auth.register")}</Link>
                      <Link className="text-muted-foreground hover:underline" href={`/${locale}/forgot-password`}>{t("auth.forgotPassword")}</Link>
                    </>
                  ) : (
                    <Link className="text-primary hover:underline" href={`/${locale}/login`}>{t("auth.login")}</Link>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">{t("auth.selfHosted")}</p>
      </div>
    </main>
  );
}
