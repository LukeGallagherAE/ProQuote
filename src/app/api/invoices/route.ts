import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    include: {
      customer: { select: { id: true, name: true } },
      job: { select: { id: true, title: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { customerId, jobId, status, items, notes, dueDate, taxRate = 10 } = body;

  if (!customerId) return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });

  const count = await prisma.invoice.count();
  const number = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

  const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) =>
    sum + item.quantity * item.unitPrice, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const invoice = await prisma.invoice.create({
    data: {
      number,
      customerId,
      jobId: jobId || null,
      status: status || 'DRAFT',
      subtotal,
      tax,
      total,
      notes,
      dueDate: dueDate ? new Date(dueDate) : null,
      items: {
        create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
      },
    },
    include: { customer: true, items: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
