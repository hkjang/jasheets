
import { useState, useCallback, useEffect, useRef } from 'react';
import { useCollaboration, ChatMessage } from '@/hooks/useCollaboration';
import { CellPosition, CellRange, CellValue, SheetData } from '@/types/spreadsheet';
import { applyCollaborationOperation } from '@/utils/collaborationConflict';
import type { PersistedCellFormat } from '@/utils/cellPersistence';

interface UseSpreadsheetCollaborationProps {
  userId: string;
  userName: string;
  selectedCell: CellPosition | null;
  selection: CellRange | null;
  setData: React.Dispatch<React.SetStateAction<SheetData>>;
  spreadsheetId: string;
  activeSheetId?: string | null;
}

export function useSpreadsheetCollaboration({
  userId,
  userName,
  selectedCell,
  selection,
  setData,
  spreadsheetId,
  activeSheetId,
}: UseSpreadsheetCollaborationProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const cellSequencesRef = useRef(new Map<string, number>());

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages(prev => [...prev, message]);
    if (!isChatOpen) setUnreadCount(prev => prev + 1);
  }, [isChatOpen]);

  const handleCellUpdate = useCallback((data: {
    sheetId: string;
    row: number;
    col: number;
    value: CellValue;
    formula?: string;
    format?: PersistedCellFormat | null;
    sequence?: number;
  }) => {
    if (activeSheetId && data.sheetId !== activeSheetId) return;
    setData(prev => applyCollaborationOperation(prev, data, cellSequencesRef.current));
  }, [activeSheetId, setData]);

  const handleCellsUpdate = useCallback((data: {
    sheetId: string;
    updates: Array<{ row: number; col: number; value: CellValue; formula?: string; format?: PersistedCellFormat | null }>;
    sequence?: number;
  }) => {
    if (activeSheetId && data.sheetId !== activeSheetId) return;
    setData(prev => data.updates.reduce(
      (next, update) => applyCollaborationOperation(next, { ...update, sheetId: data.sheetId, sequence: data.sequence }, cellSequencesRef.current),
      prev,
    ));
  }, [activeSheetId, setData]);

  const {
    users,
    isConnected,
    syncStatus,
    sendCellUpdate,
    sendBatchUpdate,
    sendCursorMove,
    sendSelectionChange,
    sendChatMessage,
  } = useCollaboration({
    spreadsheetId,
    userId,
    userName,
    onChatMessage: handleChatMessage,
    onCellUpdate: handleCellUpdate,
    onCellsUpdate: handleCellsUpdate,
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
    isConnected,
    syncStatus,
    chatMessages,
    isChatOpen,
    unreadCount,
    toggleChat,
    sendChatMessage,
    sendCellUpdate,
    sendBatchUpdate,
  };
}
