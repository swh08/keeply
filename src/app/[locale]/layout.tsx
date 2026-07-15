import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { AppProviders } from "@/components/app-providers";
import type { Locale } from "@/types/domain";

const locales: Locale[] = ["zh-CN", "en"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const english = locale === "en";
  const name = english ? "Keeply" : "物序 Keeply";

  return {
    title: { default: name, template: `%s · ${name}` },
    description: english
      ? "Keep every possession in order."
      : "让每一件物品，都有清晰的来处与去向。",
    applicationName: name,
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
