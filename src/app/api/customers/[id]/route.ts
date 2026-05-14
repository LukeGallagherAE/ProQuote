import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      jobs: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      quotes: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(customer);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.customer.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
