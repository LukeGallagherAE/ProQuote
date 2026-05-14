import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { customer: true, job: true, items: true },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { status, items, notes, validUntil, taxRate = 10 } = body;

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (notes !== undefined) data.notes = notes;
  if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null;

  if (items) {
    const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) =>
      sum + item.quantity * item.unitPrice, 0);
    const tax = subtotal * (taxRate / 100);
    data.subtotal = subtotal;
    data.tax = tax;
    data.total = subtotal + tax;

    await prisma.quoteItem.deleteMany({ where: { quoteId: params.id } });
    data.items = {
      create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
      })),
    };
  }

  const quote = await prisma.quote.update({
    where: { id: params.id },
    data,
    include: { customer: true, items: true },
  });

  return NextResponse.json(quote);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.quote.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
