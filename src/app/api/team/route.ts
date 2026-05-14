import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const members = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, phone: true, createdAt: true,
      _count: { select: { jobs: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, email, role, phone, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const member = await prisma.user.create({
    data: { name, email, role: role || 'TECHNICIAN', phone, password: hashed },
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
  });

  return NextResponse.json(member, { status: 201 });
}
