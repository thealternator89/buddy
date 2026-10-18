import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/AuthForm';

export const metadata = {
  title: 'Create Account | Buddy',
};

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/');
  }

  return <AuthForm mode="signup" />;
}
