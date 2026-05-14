import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const customerId = searchParams.get('customerId');

  const jobs = await prisma.job.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      assignee: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, customerId, assignedId, scheduledAt, address, notes } = body;

  if (!title || !customerId) {
    return NextResponse.json({ error: 'Title and customer are required' }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      title,
      description,
      status: status || 'PENDING',
      priority: priority || 'MEDIUM',
      customerId,
      assignedId: assignedId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      address,
      notes,
    },
    include: {
      customer: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(job, { status: 201 });
}
