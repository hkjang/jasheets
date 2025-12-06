import { useState } from 'react';
import styles from './FindDialog.module.css'; // Use same styles for now or new? reusing is fine for MVP

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: string, subject: string, message: string) => void;
}

export default function EmailDialog({ isOpen, onClose, onSend }: EmailDialogProps) {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Spreadsheet Share');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3>이메일로 보내기</h3>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>
        <div className={styles.body}>
          <div className={styles.inputGroup}>
             <label>받는 사람</label>
             <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@example.com" />
          </div>
          <div className={styles.inputGroup}>
             <label>제목</label>
             <input type="text" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
             <label>메시지</label>
             <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} />
          </div>
        </div>
        <div className={styles.footer}>
          <button onClick={onClose}>취소</button>
          <button 
            className={styles.primaryBtn} 
            onClick={() => {
                onSend(email, subject, message);
                onClose();
            }}
            disabled={!email}
          >
            보내기
          </button>
        </div>
      </div>
    </div>
  );
}
