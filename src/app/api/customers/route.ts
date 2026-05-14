import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const customers = await prisma.customer.findMany({
    include: {
      _count: { select: { jobs: true, invoices: true, quotes: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, email, phone, address, city, state, postcode, notes } = body;

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const customer = await prisma.customer.create({
    data: { name, email, phone, address, city, state, postcode, notes },
  });

  return NextResponse.json(customer, { status: 201 });
}
