"use client";

import { useState } from "react";
import { set } from "idb-keyval";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { KeeplyLogo } from "@/components/app-shell/keeply-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function Onboarding({ locale }: { locale: string }) { const t = useTranslations(); const router = useRouter(); const { setTheme } = useTheme(); const [step, setStep] = useState(0); const [language, setLanguage] = useState(locale); const [currency, setCurrency] = useState(locale === "zh-CN" ? "CNY" : "AUD"); const [theme, setLocalTheme] = useState("system"); const finish = async () => { await Promise.all([set("keeply:default-currency", currency), set("keeply:density", "comfortable")]); setTheme(theme); router.push(`/${language}/app/home`); };
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full max-w-lg"><div className="mb-7 flex justify-center"><KeeplyLogo locale={language} className="h-14" /></div><Card><CardHeader><CardTitle className="text-2xl">{t("onboarding.title")}</CardTitle><CardDescription>{t("brand.tagline")}</CardDescription></CardHeader><CardContent><div className="mb-7 flex gap-2" aria-hidden="true">{[0,1,2].map((value) => <span key={value} className={`h-1.5 flex-1 rounded-full ${value <= step ? "bg-primary" : "bg-muted"}`} />)}</div><FieldGroup>{step === 0 ? <Field><FieldLabel>{t("onboarding.language")}</FieldLabel><ToggleGroup type="single" value={language} onValueChange={(value) => value && setLanguage(value)} variant="outline"><ToggleGroupItem className="flex-1" value="zh-CN">简体中文</ToggleGroupItem><ToggleGroupItem className="flex-1" value="en">English</ToggleGroupItem></ToggleGroup></Field> : null}{step === 1 ? <Field><FieldLabel>{t("onboarding.currency")}</FieldLabel><Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["CNY","AUD","USD","EUR","GBP","JPY"].map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectGroup></SelectContent></Select></Field> : null}{step === 2 ? <Field><FieldLabel>{t("onboarding.appearance")}</FieldLabel><ToggleGroup type="single" value={theme} onValueChange={(value) => value && setLocalTheme(value)} variant="outline"><ToggleGroupItem className="flex-1" value="system">{t("settings.system")}</ToggleGroupItem><ToggleGroupItem className="flex-1" value="light">{t("settings.light")}</ToggleGroupItem><ToggleGroupItem className="flex-1" value="dark">{t("settings.dark")}</ToggleGroupItem></ToggleGroup></Field> : null}<Button onClick={() => step < 2 ? setStep(step + 1) : void finish()}>{step < 2 ? t("common.continue") : t("onboarding.finish")}<ArrowRight data-icon="inline-end" /></Button></FieldGroup></CardContent></Card></div></main>; }
