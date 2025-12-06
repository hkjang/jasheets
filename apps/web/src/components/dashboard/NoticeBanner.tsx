import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Notice {
  id: string;
  title: string;
  content: string;
  type: 'INFO' | 'WARNING' | 'URGENT' | 'MAINTENANCE';
}

const NoticeBanner = () => {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    api.notices.list(true).then(setNotices).catch(console.error);
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`p-4 rounded-md border flex items-start space-x-3 ${
            notice.type === 'URGENT' || notice.type === 'MAINTENANCE'
              ? 'bg-red-50 border-red-200 text-red-800'
              : notice.type === 'WARNING'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex-1">
            <h4 className="font-bold text-sm uppercase tracking-wide opacity-80 mb-1">{notice.type}</h4>
            <h3 className="font-semibold">{notice.title}</h3>
            <p className="text-sm mt-1 opacity-90">{notice.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NoticeBanner;
