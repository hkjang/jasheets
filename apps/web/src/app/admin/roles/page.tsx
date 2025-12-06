'use client';

import { AdminHeader } from '../../../components/admin/AdminHeader';
import { RoleList } from '../../../components/admin/RoleList';

export default function AdminRolesPage() {
  return (
    <>
      <AdminHeader title="Role Management" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <RoleList />
      </div>
    </>
  );
}
