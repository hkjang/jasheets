'use client';

import { AdminHeader } from '../../../components/admin/AdminHeader';
import { TemplateList } from '../../../components/admin/TemplateList';

export default function AdminTemplatesPage() {
  return (
    <>
      <AdminHeader title="Template Management" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <TemplateList />
      </div>
    </>
  );
}
