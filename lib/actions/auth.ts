'use server';

import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  createSession,
  hashPassword,
  invalidateCurrentSession,
  verifyPassword,
} from '@/lib/auth';

export interface AuthActionState {
  error?: string;
}

export async function loginAction(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const rawEmail = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!rawEmail || !password) {
    return { error: 'Please enter both your email and password.' };
  }

  const found = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${rawEmail}`)
    .limit(1);

  if (found.length === 0) {
    return { error: 'Invalid email or password.' };
  }

  const user = found[0];
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: 'Invalid email or password.' };
  }

  await createSession(user.id);
  redirect('/');
}

export async function signupAction(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const name = String(formData.get('name') || '').trim();
  const rawEmail = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!name) {
    return { error: 'Please enter your name.' };
  }

  if (!rawEmail || !rawEmail.includes('@')) {
    return { error: 'Please enter a valid email address.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, rawEmail))
    .limit(1);

  if (existing.length > 0) {
    return { error: 'An account with this email already exists.' };
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: userId,
    name,
    email: rawEmail,
    passwordHash,
  });

  await createSession(userId);
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await invalidateCurrentSession();
  redirect('/login');
}
