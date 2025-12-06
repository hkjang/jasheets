import { PrismaClient, PermissionRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Cleanup
  await prisma.comment.deleteMany();
  await prisma.cell.deleteMany();
  await prisma.rowMeta.deleteMany();
  await prisma.colMeta.deleteMany();
  await prisma.sheet.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.version.deleteMany();
  await prisma.spreadsheet.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleanup finished.');

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  // Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@jasheets.com',
      password: passwordHash,
      name: 'Super Admin',
      isAdmin: true,
      avatar: 'https://ui-avatars.com/api/?name=Super+Admin&background=0D8ABC&color=fff',
    },
  });
  console.log('Created Admin:', admin.email);

  // Regular Users
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        email: `user${i}@example.com`,
        password: passwordHash,
        name: `User ${i}`,
        isAdmin: false,
        avatar: `https://ui-avatars.com/api/?name=User+${i}&background=random`,
      },
    });
    users.push(user);
    console.log(`Created User ${i}:`, user.email);
  }

  // 3. Create Spreadsheets
  // Admin Project
  const adminSheet = await prisma.spreadsheet.create({
    data: {
      name: 'Quarterly Report (Admin)',
      ownerId: admin.id,
      isPublic: false,
      sheets: {
        create: [
          { name: 'Revenue', index: 0 },
          { name: 'Expenses', index: 1 },
        ]
      }
    },
    include: { sheets: true }
  });

  // Add some data to Admin Sheet
  if (adminSheet.sheets[0]) {
    await prisma.cell.create({
      data: {
        sheetId: adminSheet.sheets[0].id,
        row: 0,
        col: 0,
        value: 'Q1 Revenue',
        format: { bold: true }
      }
    });
    await prisma.cell.create({
      data: {
        sheetId: adminSheet.sheets[0].id,
        row: 0,
        col: 1,
        value: 150000,
        format: { type: 'currency' }
      }
    });
  }

  // Public Sheet by User 1
  const publicSheet = await prisma.spreadsheet.create({
    data: {
      name: 'Public Template',
      ownerId: users[0].id,
      isPublic: true, // Public access
      sheets: {
        create: { name: 'Template', index: 0 }
      }
    }
  });

  // Shared Project (User 1 owns, User 2 edits, User 3 views)
  const sharedSheet = await prisma.spreadsheet.create({
    data: {
      name: 'Team Project Alpha',
      ownerId: users[0].id,
      isPublic: false,
      sheets: {
        create: { name: 'Tasks', index: 0 }
      },
      permissions: {
        create: [
          { userId: users[1].id, role: PermissionRole.EDITOR },
          { userId: users[2].id, role: PermissionRole.VIEWER },
        ]
      }
    }
  });

  console.log('Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
