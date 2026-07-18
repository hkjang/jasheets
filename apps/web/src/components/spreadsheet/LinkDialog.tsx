'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { normalizeHyperlinkUrl } from '@/utils/hyperlink';
import styles from './LinkDialog.module.css';

export interface LinkDialogValue {
  text: string;
  url: string;
}

interface LinkDialogProps {
  initialText: string;
  initialUrl: string;
  onApply: (value: LinkDialogValue) => void;
  onClose: () => void;
}

export default function LinkDialog({
  initialText,
  initialUrl,
  onApply,
  onClose,
}: LinkDialogProps) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [showError, setShowError] = useState(false);
  const titleId = useId();
  const urlId = useId();
  const textId = useId();
  const errorId = useId();
  const textInputRef = useRef<HTMLInputElement>(null);
  const normalizedUrl = normalizeHyperlinkUrl(url);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedUrl) {
      setShowError(true);
      return;
    }

    onApply({
      text: text.trim() || normalizedUrl,
      url: normalizedUrl,
    });
  };

  return (
    <div className={styles.overlay} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <h2 id={titleId}>링크 삽입</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.body}>
            <label htmlFor={textId}>표시할 텍스트</label>
            <input
              ref={textInputRef}
              id={textId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="링크 텍스트"
            />

            <label htmlFor={urlId}>링크</label>
            <input
              id={urlId}
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setShowError(false);
              }}
              onBlur={() => setShowError(Boolean(url) && !normalizeHyperlinkUrl(url))}
              placeholder="https://example.com"
              aria-invalid={showError && !normalizedUrl}
              aria-describedby={showError && !normalizedUrl ? errorId : undefined}
            />
            {showError && !normalizedUrl && (
              <p id={errorId} className={styles.error} role="alert">
                http, https 또는 유효한 mailto 주소를 입력하세요.
              </p>
            )}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              취소
            </button>
            <button type="submit" className={styles.applyButton}>
              적용
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
