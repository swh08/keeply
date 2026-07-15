import Link from "next/link";
import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { KeeplyLogo } from "@/components/app-shell/keeply-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return <main className="grid min-h-dvh place-items-center px-4"><Card className="w-full max-w-lg"><CardHeader><KeeplyLogo locale={locale} /><CardTitle className="flex items-center gap-2 pt-5"><WifiOff className="size-5" />{t("sync.offline")}</CardTitle><CardDescription>{t("sync.safe")}</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/${locale}/app/home`}>{t("common.continue")}</Link></Button></CardContent></Card></main>;
}
