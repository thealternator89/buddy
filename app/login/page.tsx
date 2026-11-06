import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { AuthForm } from '@/components/AuthForm';

export const metadata = {
  title: 'Sign In | Buddy',
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/');
  }

  return <AuthForm mode="login" />;
}
