'use client';

import React from 'react';
import NoticeBanner from '@/components/dashboard/NoticeBanner';
import { UserSpreadsheetList } from '@/components/dashboard/UserSpreadsheetList';
import { TemplateGallery } from '@/components/dashboard/TemplateGallery';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center text-white font-bold">J</div>
            <span className="text-xl font-bold text-gray-800">JaSheets</span>
        </div>
        <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/admin')} className="text-gray-600 hover:text-gray-900">Admin</button>
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
        </div>
      </header>
      
      <main className="container mx-auto max-w-6xl py-8 px-4">
        <NoticeBanner />
        
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Workspace</h1>
            <p className="text-gray-500">Manage your spreadsheets and templates.</p>
        </div>

        <TemplateGallery />
        <UserSpreadsheetList />
      </main>
    </div>
  );
}
