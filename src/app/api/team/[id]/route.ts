import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, phone, role } = body;

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { name, phone, role },
    select: { id: true, name: true, email: true, role: true, phone: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
