import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001';

async function main() {
  console.log('Starting Admin Feature Verification...');

  // 1. Clean up
  await prisma.user.deleteMany({ where: { email: { contains: 'test-admin' } } });
  
  // 2. Register a new user
  console.log('Registering test admin user...');
  const email = `test-admin-${Date.now()}@example.com`;
  const password = 'password123';
  
  try {
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Test Admin' }),
    });
  } catch (e) {
    console.log('Registration failed (might already exist), trying login...');
  }

  // 3. Make user admin via database
  console.log('Promoting user to admin...');
  const user = await prisma.user.update({
    where: { email },
    data: { isAdmin: true },
  });

  // 4. Login to get token
  console.log('Logging in...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!loginRes.ok) throw new Error('Login failed');
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('Got access token');

  // 5. Test List Users (Admin only)
  console.log('Testing GET /users...');
  const usersRes = await fetch(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (usersRes.ok) {
    const users = await usersRes.json();
    console.log(`✅ List Users success. Found ${users.length} users.`);
  } else {
    console.error('❌ List Users failed:', usersRes.status, await usersRes.text());
  }

  // 6. Test List Spreadsheets (Admin only)
  console.log('Testing GET /sheets/admin/all...');
  const sheetsRes = await fetch(`${API_URL}/sheets/admin/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (sheetsRes.ok) {
    const sheets = await sheetsRes.json();
    console.log(`✅ List Spreadsheets success. Found ${sheets.length} spreadsheets.`);
  } else {
    console.error('❌ List Spreadsheets failed:', sheetsRes.status, await sheetsRes.text());
  }

  // 7. Cleanup
  console.log('Cleaning up...');
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Verification Complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
