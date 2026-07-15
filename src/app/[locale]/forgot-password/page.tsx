import { AuthForm } from "@/features/auth/auth-form";
export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; return <AuthForm locale={locale} mode="forgot" />; }
