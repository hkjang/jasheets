import React from 'react';

export function SpreadsheetLoadingState() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-white text-gray-700"
      role="status"
      aria-live="polite"
      aria-label="스프레드시트를 불러오는 중"
    >
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-green-600 text-lg font-bold text-white shadow-sm">
          J
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-2.5 w-28 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="h-9 w-20 animate-pulse rounded-md bg-blue-100" />
      </div>
      <div className="flex h-11 items-center gap-2 border-b border-gray-200 bg-gray-50 px-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-7 w-9 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
      <div
        className="h-[calc(100vh-108px)] animate-pulse"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '100px 25px',
        }}
      >
        <div className="mx-auto flex max-w-md items-center justify-center pt-24">
          <div className="rounded-full border border-gray-200 bg-white/95 px-5 py-3 text-sm font-medium shadow-sm">
            문서와 계산 상태를 안전하게 불러오고 있습니다…
          </div>
        </div>
      </div>
    </main>
  );
}

interface SpreadsheetErrorStateProps {
  title: string;
  message: string;
  onRetry: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function SpreadsheetErrorState({
  title,
  message,
  onRetry,
  onBack,
  backLabel = '대시보드로 이동',
}: SpreadsheetErrorStateProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-5 py-12">
      <section
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
        role="alert"
        aria-live="assertive"
      >
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.8 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">{message}</p>
        <p className="mt-3 text-xs text-gray-400">입력 중이던 로컬 변경 사항은 삭제하지 않습니다.</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {backLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            다시 시도
          </button>
        </div>
      </section>
    </main>
  );
}
