'use client';

import { useState } from 'react';
import styles from './AIAssistant.module.css'; // Reusing panel styles for consistency

export interface ConditionalRule {
  id: string;
  type: 'greaterThan' | 'lessThan' | 'equalTo' | 'contains' | 'between';
  value: string;
  value2?: string; // for between
  style: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: 'bold';
    fontStyle?: 'italic';
  };
  range: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
}

interface ConditionalFormattingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: ConditionalRule) => void;
  selection: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
}

export default function ConditionalFormattingDialog({
  isOpen,
  onClose,
  onSave,
  selection,
}: ConditionalFormattingDialogProps) {
  const [type, setType] = useState<ConditionalRule['type']>('greaterThan');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [color, setColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  const handleSave = () => {
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      type,
      value,
      value2,
      style: {
        color: color !== '#000000' ? color : undefined,
        backgroundColor: backgroundColor !== '#ffffff' ? backgroundColor : undefined,
        fontWeight: isBold ? 'bold' : undefined,
        fontStyle: isItalic ? 'italic' : undefined,
      },
      range: selection,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', 
      alignItems: 'center', justifyContent: 'center' 
    }}>
      <div 
        onClick={e => e.stopPropagation()} 
        style={{ 
          background: 'white', padding: '24px', borderRadius: '8px', 
          width: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>조건부 서식 규칙 추가</h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>조건</label>
          <select 
            value={type} 
            onChange={e => setType(e.target.value as any)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="greaterThan">다음 값보다 큼</option>
            <option value="lessThan">다음 값보다 작음</option>
            <option value="equalTo">다음 값과 같음</option>
            <option value="contains">텍스트 포함</option>
            <option value="between">다음 값 사이에 있음</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>값</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={value} 
              onChange={e => setValue(e.target.value)}
              placeholder="값 입력"
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            {type === 'between' && (
              <input 
                type="text" 
                value={value2} 
                onChange={e => setValue2(e.target.value)}
                placeholder="값 2"
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            )}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>서식 스타일</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => setIsBold(!isBold)}
              style={{ padding: '8px', background: isBold ? '#e8f0fe' : '#f1f3f4', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              B
            </button>
            <button 
              onClick={() => setIsItalic(!isItalic)}
              style={{ padding: '8px', background: isItalic ? '#e8f0fe' : '#f1f3f4', border: 'none', borderRadius: '4px', cursor: 'pointer', fontStyle: 'italic' }}
            >
              I
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>글자:</span>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>배경:</span>
              <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
          <button 
            onClick={onClose}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            style={{ padding: '8px 16px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
