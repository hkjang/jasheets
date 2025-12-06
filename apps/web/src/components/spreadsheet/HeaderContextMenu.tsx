import React, { useEffect, useRef } from 'react';

interface HeaderContextMenuProps {
  x: number;
  y: number;
  type: 'row' | 'col';
  index: number;
  onClose: () => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
  onHide: () => void;
  onUnhide: () => void;
}

export default function HeaderContextMenu({
  x,
  y,
  type,
  index,
  onClose,
  onInsertBefore,
  onInsertAfter,
  onDelete,
  onHide,
  onUnhide,
}: HeaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border rounded shadow-lg py-1 text-sm text-gray-700 min-w-[150px]"
      style={{ top: y, left: x }}
    >
      <div className="px-3 py-1 font-semibold border-b bg-gray-50 text-xs text-gray-500 uppercase">
        {type === 'col' ? 'Column' : 'Row'} {type === 'col' ? String.fromCharCode(65 + index) : index + 1}
      </div>
      <button
        onClick={onInsertBefore}
        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        Insert 1 {type === 'col' ? 'Left' : 'Above'}
      </button>
      <button
        onClick={onInsertAfter}
        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        Insert 1 {type === 'col' ? 'Right' : 'Below'}
      </button>
      <div className="border-b my-1"></div>
      <button
        onClick={onHide}
        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        Hide {type === 'col' ? 'Column' : 'Row'}
      </button>
      <button
        onClick={onUnhide}
        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        Unhide {type === 'col' ? 'Column' : 'Row'}s
      </button>
      <div className="border-b my-1"></div>
      <button
        onClick={onDelete}
        className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
      >
        Delete {type === 'col' ? 'Column' : 'Row'}
      </button>
    </div>
  );
}
