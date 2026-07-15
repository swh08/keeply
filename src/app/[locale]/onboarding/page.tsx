import { Onboarding } from "@/features/auth/onboarding";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!await getServerSession()) redirect(`/${locale}/login`);
  return <Onboarding locale={locale} />;
}
