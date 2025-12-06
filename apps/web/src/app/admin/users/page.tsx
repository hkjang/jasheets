'use client';

import { AdminHeader } from '../../../components/admin/AdminHeader';
import { UserList } from '../../../components/admin/UserList';

export default function AdminUsersPage() {
  return (
    <>
      <AdminHeader title="User Management" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <UserList />
      </div>
    </>
  );
}
