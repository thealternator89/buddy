'use server';

import { db } from '@/lib/db';
import { payees } from '@/lib/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function getPayees() {
  return db.select().from(payees).orderBy(asc(payees.name));
}

export async function getOrCreatePayee(name: string, defaultCategoryId?: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Search case-insensitively
  const existing = await db
    .select()
    .from(payees)
    .where(sql`lower(${payees.name}) = lower(${trimmed})`)
    .limit(1);

  if (existing.length > 0) {
    // Optionally update default category if provided and payee didn't have one
    if (defaultCategoryId && !existing[0].defaultCategoryId) {
      db.update(payees)
        .set({ defaultCategoryId })
        .where(eq(payees.id, existing[0].id))
        .run();
    }
    return existing[0];
  }

  const id = crypto.randomUUID();
  db.insert(payees)
    .values({
      id,
      name: trimmed,
      defaultCategoryId: defaultCategoryId || null,
    })
    .run();

  revalidatePath('/transactions');
  return { id, name: trimmed, defaultCategoryId: defaultCategoryId || null };
}

export async function updatePayeeDefaultCategory(id: string, defaultCategoryId: string | null) {
  db.update(payees)
    .set({ defaultCategoryId })
    .where(eq(payees.id, id))
    .run();

  revalidatePath('/transactions');
  return { success: true };
}
