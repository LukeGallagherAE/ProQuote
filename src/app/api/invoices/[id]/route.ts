import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { customer: true, job: true, items: true },
  });

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { status, notes, dueDate, paidAt, items, taxRate = 10 } = body;

  const data: Record<string, unknown> = {};
  if (status !== undefined) {
    data.status = status;
    if (status === 'PAID' && !paidAt) data.paidAt = new Date();
  }
  if (notes !== undefined) data.notes = notes;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (paidAt !== undefined) data.paidAt = paidAt ? new Date(paidAt) : null;

  if (items) {
    const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) =>
      sum + item.quantity * item.unitPrice, 0);
    const tax = subtotal * (taxRate / 100);
    data.subtotal = subtotal;
    data.tax = tax;
    data.total = subtotal + tax;

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
    data.items = {
      create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
      })),
    };
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data,
    include: { customer: true, items: true },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.invoice.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
