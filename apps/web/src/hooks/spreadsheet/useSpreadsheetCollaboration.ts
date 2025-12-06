
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useCollaboration, ChatMessage } from '@/hooks/useCollaboration';
import { CellPosition, CellRange, SheetData } from '@/types/spreadsheet';

interface UseSpreadsheetCollaborationProps {
  userId: string;
  userName: string;
  selectedCell: CellPosition | null;
  selection: CellRange | null;
  setData: React.Dispatch<React.SetStateAction<SheetData>>;
}

export function useSpreadsheetCollaboration({
  userId,
  userName,
  selectedCell,
  selection,
  setData,
}: UseSpreadsheetCollaborationProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages(prev => [...prev, message]);
    if (!isChatOpen) setUnreadCount(prev => prev + 1);
  }, [isChatOpen]);

  const handleCellUpdate = useCallback((data: {
    sheetId: string;
    row: number;
    col: number;
    value: any;
    formula?: string;
  }) => {
     setData(prev => {
       const next = { ...prev };
       if (!next[data.row]) next[data.row] = {};
       next[data.row][data.col] = {
         ...next[data.row][data.col],
         value: data.value,
         formula: data.formula
       };
       return next;
     });
  }, [setData]);

  const {
    users,
    sendCellUpdate,
    sendCursorMove,
    sendSelectionChange,
    sendChatMessage,
  } = useCollaboration({
    spreadsheetId: 'demo-sheet',
    userId,
    userName,
    onChatMessage: handleChatMessage,
    onCellUpdate: handleCellUpdate,
  });

  useEffect(() => {
    if (selectedCell) sendCursorMove(selectedCell.row, selectedCell.col);
  }, [selectedCell, sendCursorMove]);

  useEffect(() => {
    if (selection) sendSelectionChange(selection.start.row, selection.start.col, selection.end.row, selection.end.col);
  }, [selection, sendSelectionChange]);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => !prev);
    if (!isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  return {
    users,
    chatMessages,
    isChatOpen,
    unreadCount,
    toggleChat,
    sendChatMessage,
    sendCellUpdate,
  };
}
