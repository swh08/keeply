import { AppExperience } from "@/components/app-experience";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function AppPage({ params }: { params: Promise<{ locale: string; path?: string[] }> }) {
  const { locale, path = ["home"] } = await params;
  const session = await getServerSession();
  if (!session) redirect(`/${locale}/login`);
  return <AppExperience locale={locale} path={path} user={{ id: session.user.id, name: session.user.name, email: session.user.email }} />;
}
