import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      assignee: { select: { id: true, name: true, email: true, phone: true } },
      quote: { include: { items: true } },
      invoice: { include: { items: true } },
    },
  });

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, customerId, assignedId, scheduledAt, address, notes, completedAt } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) {
    data.status = status;
    if (status === 'COMPLETED' && !completedAt) data.completedAt = new Date();
  }
  if (priority !== undefined) data.priority = priority;
  if (customerId !== undefined) data.customerId = customerId;
  if (assignedId !== undefined) data.assignedId = assignedId || null;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (address !== undefined) data.address = address;
  if (notes !== undefined) data.notes = notes;
  if (completedAt !== undefined) data.completedAt = completedAt ? new Date(completedAt) : null;

  const job = await prisma.job.update({
    where: { id: params.id },
    data,
    include: {
      customer: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(job);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.job.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
