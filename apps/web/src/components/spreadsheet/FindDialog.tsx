"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FindDialog.module.css";

interface FindDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFind: (
    query: string,
    matchCase: boolean,
    options: {
      scope: "sheet" | "workbook";
      mode: "all" | "values" | "formulas";
      direction: "previous" | "next";
    },
  ) => Promise<void> | void;
  onReplace: (query: string, replacement: string, matchCase: boolean) => void;
  onReplaceAll: (
    query: string,
    replacement: string,
    matchCase: boolean,
  ) => void;
}

export default function FindDialog({
  isOpen,
  onClose,
  onFind,
  onReplace,
  onReplaceAll,
}: FindDialogProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [mode, setMode] = useState<"find" | "replace">("find");
  const [scope, setScope] = useState<"sheet" | "workbook">("sheet");
  const [searchMode, setSearchMode] = useState<"all" | "values" | "formulas">(
    "values",
  );
  const queryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    queryInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-dialog-title"
      >
        <div className={styles.header}>
          <h3 id="find-dialog-title">
            {mode === "find" ? "찾기" : "찾기 및 바꾸기"}
          </h3>
          <button
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === "find" ? styles.activeTab : ""}`}
              onClick={() => setMode("find")}
            >
              찾기
            </button>
            <button
              className={`${styles.tab} ${mode === "replace" ? styles.activeTab : ""}`}
              onClick={() => setMode("replace")}
            >
              바꾸기
            </button>
          </div>

          <div className={styles.field}>
            <label htmlFor="find-query">찾을 내용</label>
            <input
              id="find-query"
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !query) return;
                event.preventDefault();
                void onFind(query, matchCase, {
                  scope,
                  mode: searchMode,
                  direction: event.shiftKey ? "previous" : "next",
                });
              }}
            />
          </div>

          {mode === "replace" && (
            <div className={styles.field}>
              <label htmlFor="find-replacement">바꿀 내용</label>
              <input
                id="find-replacement"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
            </div>
          )}

          <div className={styles.options}>
            <label>
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
              대소문자 구분
            </label>
            {mode === "find" && (
              <div className={styles.searchOptions}>
                <label>
                  검색 범위
                  <select
                    value={scope}
                    onChange={(event) =>
                      setScope(event.target.value as "sheet" | "workbook")
                    }
                  >
                    <option value="sheet">현재 시트</option>
                    <option value="workbook">전체 통합 문서</option>
                  </select>
                </label>
                <label>
                  검색 대상
                  <select
                    value={searchMode}
                    onChange={(event) =>
                      setSearchMode(
                        event.target.value as "all" | "values" | "formulas",
                      )
                    }
                  >
                    <option value="values">값</option>
                    <option value="formulas">수식</option>
                    <option value="all">값과 수식</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          {mode === "find" ? (
            <>
              <button
                onClick={() =>
                  void onFind(query, matchCase, {
                    scope,
                    mode: searchMode,
                    direction: "previous",
                  })
                }
                disabled={!query}
              >
                이전
              </button>
              <button
                onClick={() =>
                  void onFind(query, matchCase, {
                    scope,
                    mode: searchMode,
                    direction: "next",
                  })
                }
                disabled={!query}
              >
                다음
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onReplace(query, replacement, matchCase)}
                disabled={!query}
              >
                바꾸기
              </button>
              <button
                onClick={() => onReplaceAll(query, replacement, matchCase)}
                disabled={!query}
              >
                모두 바꾸기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
