'use client';

import { AdminHeader } from '../../../components/admin/AdminHeader';
import { SpreadsheetList } from '../../../components/admin/SpreadsheetList';

export default function AdminSpreadsheetsPage() {
  return (
    <>
      <AdminHeader title="Spreadsheet Management" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <SpreadsheetList />
      </div>
    </>
  );
}
