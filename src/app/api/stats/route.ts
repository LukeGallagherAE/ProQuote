import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalJobs, pendingJobs, completedJobs, totalCustomers, paidInvoices, unpaidInvoices, recentJobs, upcomingJobs] =
    await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: { in: ['PENDING', 'SCHEDULED'] } } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.customer.count(),
      prisma.invoice.aggregate({ where: { status: 'PAID' }, _sum: { total: true } }),
      prisma.invoice.aggregate({ where: { status: { in: ['SENT', 'OVERDUE'] } }, _sum: { total: true } }),
      prisma.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, assignee: { select: { name: true } } },
      }),
      prisma.job.findMany({
        where: {
          scheduledAt: { gte: now },
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
        take: 5,
        orderBy: { scheduledAt: 'asc' },
        include: { customer: { select: { name: true } }, assignee: { select: { name: true } } },
      }),
    ]);

  // Monthly revenue for last 6 months
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const result = await prisma.invoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: start, lte: end } },
      _sum: { total: true },
    });
    monthlyRevenue.push({
      month: d.toLocaleString('en-AU', { month: 'short' }),
      revenue: result._sum.total ?? 0,
    });
  }

  return NextResponse.json({
    totalJobs,
    pendingJobs,
    completedJobs,
    totalCustomers,
    paidRevenue: paidInvoices._sum.total ?? 0,
    unpaidRevenue: unpaidInvoices._sum.total ?? 0,
    recentJobs,
    upcomingJobs,
    monthlyRevenue,
  });
}
