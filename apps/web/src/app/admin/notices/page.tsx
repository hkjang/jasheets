'use client';

import { AdminHeader } from '../../../components/admin/AdminHeader';
import { NoticeList } from '../../../components/admin/NoticeList';

export default function AdminNoticesPage() {
  return (
    <>
      <AdminHeader title="Notice Management" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <NoticeList />
      </div>
    </>
  );
}
