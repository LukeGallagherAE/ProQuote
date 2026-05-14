import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@proquote.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@proquote.com',
      password: hashedPassword,
      role: 'ADMIN',
      phone: '0400 000 000',
    },
  });

  const tech1 = await prisma.user.upsert({
    where: { email: 'james@proquote.com' },
    update: {},
    create: {
      name: 'James Wilson',
      email: 'james@proquote.com',
      password: await bcrypt.hash('password123', 10),
      role: 'TECHNICIAN',
      phone: '0411 111 111',
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: 'sarah@proquote.com' },
    update: {},
    create: {
      name: 'Sarah Chen',
      email: 'sarah@proquote.com',
      password: await bcrypt.hash('password123', 10),
      role: 'TECHNICIAN',
      phone: '0422 222 222',
    },
  });

  // Create customers
  const customer1 = await prisma.customer.upsert({
    where: { id: 'customer-1' },
    update: {},
    create: {
      id: 'customer-1',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '0433 123 456',
      address: '12 Main Street',
      city: 'Sydney',
      state: 'NSW',
      postcode: '2000',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'customer-2' },
    update: {},
    create: {
      id: 'customer-2',
      name: 'Emily Johnson',
      email: 'emily.j@email.com',
      phone: '0444 567 890',
      address: '45 Park Avenue',
      city: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { id: 'customer-3' },
    update: {},
    create: {
      id: 'customer-3',
      name: 'Robert Davis',
      email: 'rob.davis@email.com',
      phone: '0455 678 901',
      address: '7 Ocean Drive',
      city: 'Brisbane',
      state: 'QLD',
      postcode: '4000',
    },
  });

  const customer4 = await prisma.customer.upsert({
    where: { id: 'customer-4' },
    update: {},
    create: {
      id: 'customer-4',
      name: 'Lisa Thompson',
      email: 'lisa.t@email.com',
      phone: '0466 789 012',
      address: '23 Hill Road',
      city: 'Perth',
      state: 'WA',
      postcode: '6000',
    },
  });

  // Create jobs
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  const yesterday = new Date(now.getTime() - 86400000);

  const job1 = await prisma.job.upsert({
    where: { id: 'job-1' },
    update: {},
    create: {
      id: 'job-1',
      title: 'Hot Water System Replacement',
      description: 'Replace old gas hot water system with new heat pump unit.',
      status: 'COMPLETED',
      priority: 'HIGH',
      customerId: customer1.id,
      assignedId: tech1.id,
      scheduledAt: lastWeek,
      completedAt: lastWeek,
      address: '12 Main Street, Sydney NSW 2000',
    },
  });

  const job2 = await prisma.job.upsert({
    where: { id: 'job-2' },
    update: {},
    create: {
      id: 'job-2',
      title: 'Bathroom Renovation - Full Replumb',
      description: 'Full bathroom replumb including new shower, vanity and toilet connections.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      customerId: customer2.id,
      assignedId: tech1.id,
      scheduledAt: now,
      address: '45 Park Avenue, Melbourne VIC 3000',
    },
  });

  const job3 = await prisma.job.upsert({
    where: { id: 'job-3' },
    update: {},
    create: {
      id: 'job-3',
      title: 'Kitchen Tap Replacement',
      description: 'Replace kitchen mixer tap and fix under-sink leak.',
      status: 'SCHEDULED',
      priority: 'MEDIUM',
      customerId: customer3.id,
      assignedId: tech2.id,
      scheduledAt: tomorrow,
      address: '7 Ocean Drive, Brisbane QLD 4000',
    },
  });

  const job4 = await prisma.job.upsert({
    where: { id: 'job-4' },
    update: {},
    create: {
      id: 'job-4',
      title: 'Blocked Drain Emergency',
      description: 'Main sewer drain blocked, urgent clearance required.',
      status: 'PENDING',
      priority: 'URGENT',
      customerId: customer4.id,
      address: '23 Hill Road, Perth WA 6000',
    },
  });

  const job5 = await prisma.job.upsert({
    where: { id: 'job-5' },
    update: {},
    create: {
      id: 'job-5',
      title: 'New Ensuite Rough-in',
      description: 'Rough-in plumbing for new ensuite addition.',
      status: 'SCHEDULED',
      priority: 'LOW',
      customerId: customer1.id,
      assignedId: tech2.id,
      scheduledAt: nextWeek,
      address: '12 Main Street, Sydney NSW 2000',
    },
  });

  // Create quotes
  await prisma.quote.upsert({
    where: { id: 'quote-1' },
    update: {},
    create: {
      id: 'quote-1',
      number: 'Q-2024-001',
      customerId: customer1.id,
      jobId: job1.id,
      status: 'ACCEPTED',
      subtotal: 2200,
      tax: 220,
      total: 2420,
      notes: 'Includes labour and materials for heat pump hot water system.',
      validUntil: new Date(now.getTime() + 30 * 86400000),
      items: {
        create: [
          { description: 'Rheem ProTech Heat Pump 270L', quantity: 1, unitPrice: 1400, total: 1400 },
          { description: 'Installation labour (4hrs)', quantity: 4, unitPrice: 150, total: 600 },
          { description: 'Connection fittings and materials', quantity: 1, unitPrice: 200, total: 200 },
        ],
      },
    },
  });

  await prisma.quote.upsert({
    where: { id: 'quote-2' },
    update: {},
    create: {
      id: 'quote-2',
      number: 'Q-2024-002',
      customerId: customer2.id,
      jobId: job2.id,
      status: 'ACCEPTED',
      subtotal: 4500,
      tax: 450,
      total: 4950,
      notes: 'Full bathroom replumb, price subject to wall access.',
      validUntil: new Date(now.getTime() + 30 * 86400000),
      items: {
        create: [
          { description: 'Labour - replumb (12hrs)', quantity: 12, unitPrice: 150, total: 1800 },
          { description: 'Shower waste and fitting kit', quantity: 1, unitPrice: 350, total: 350 },
          { description: 'Vanity supply lines and tap', quantity: 1, unitPrice: 280, total: 280 },
          { description: 'Toilet suite and cistern', quantity: 1, unitPrice: 520, total: 520 },
          { description: 'Pipe and fittings', quantity: 1, unitPrice: 1550, total: 1550 },
        ],
      },
    },
  });

  await prisma.quote.upsert({
    where: { id: 'quote-3' },
    update: {},
    create: {
      id: 'quote-3',
      number: 'Q-2024-003',
      customerId: customer3.id,
      status: 'SENT',
      subtotal: 380,
      tax: 38,
      total: 418,
      notes: 'Kitchen tap replacement and leak repair.',
      validUntil: new Date(now.getTime() + 14 * 86400000),
      items: {
        create: [
          { description: 'Methven Aio Kitchen Mixer', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'Labour (1.5hrs)', quantity: 1.5, unitPrice: 150, total: 225 },
        ],
      },
    },
  });

  await prisma.quote.upsert({
    where: { id: 'quote-4' },
    update: {},
    create: {
      id: 'quote-4',
      number: 'Q-2024-004',
      customerId: customer4.id,
      status: 'DRAFT',
      subtotal: 650,
      tax: 65,
      total: 715,
      notes: 'Blocked drain clearance - CCTV inspection included.',
      items: {
        create: [
          { description: 'CCTV drain inspection', quantity: 1, unitPrice: 250, total: 250 },
          { description: 'High pressure jetting', quantity: 1, unitPrice: 300, total: 300 },
          { description: 'Call-out fee', quantity: 1, unitPrice: 100, total: 100 },
        ],
      },
    },
  });

  // Create invoices
  await prisma.invoice.upsert({
    where: { id: 'invoice-1' },
    update: {},
    create: {
      id: 'invoice-1',
      number: 'INV-2024-001',
      customerId: customer1.id,
      jobId: job1.id,
      status: 'PAID',
      subtotal: 2200,
      tax: 220,
      total: 2420,
      dueDate: new Date(lastWeek.getTime() + 14 * 86400000),
      paidAt: yesterday,
      items: {
        create: [
          { description: 'Rheem ProTech Heat Pump 270L', quantity: 1, unitPrice: 1400, total: 1400 },
          { description: 'Installation labour (4hrs)', quantity: 4, unitPrice: 150, total: 600 },
          { description: 'Connection fittings and materials', quantity: 1, unitPrice: 200, total: 200 },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { id: 'invoice-2' },
    update: {},
    create: {
      id: 'invoice-2',
      number: 'INV-2024-002',
      customerId: customer2.id,
      status: 'SENT',
      subtotal: 4500,
      tax: 450,
      total: 4950,
      dueDate: new Date(now.getTime() + 14 * 86400000),
      items: {
        create: [
          { description: 'Labour - replumb (12hrs)', quantity: 12, unitPrice: 150, total: 1800 },
          { description: 'Shower waste and fitting kit', quantity: 1, unitPrice: 350, total: 350 },
          { description: 'Vanity supply lines and tap', quantity: 1, unitPrice: 280, total: 280 },
          { description: 'Toilet suite and cistern', quantity: 1, unitPrice: 520, total: 520 },
          { description: 'Pipe and fittings', quantity: 1, unitPrice: 1550, total: 1550 },
        ],
      },
    },
  });

  console.log('Seed complete. Login: admin@proquote.com / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
