import { AuthForm } from "@/features/auth/auth-form";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await getServerSession()) redirect(`/${locale}/app/home`);
  return <AuthForm locale={locale} mode="register" />;
}
