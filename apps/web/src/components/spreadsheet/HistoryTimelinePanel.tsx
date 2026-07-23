"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiClient } from "@/lib/api-client";
import styles from "./HistoryTimelinePanel.module.css";

interface Revision {
  id: string;
  action: string;
  targetRange?: string;
  description?: string;
  previousData?: unknown;
  newData?: unknown;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar?: string;
  };
}

interface RevisionStats {
  totalRevisions: number;
  revisionsByAction: Array<{ action: string; count: number }>;
  activityByDay: Record<string, number>;
}

interface HistoryTimelinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  currentVersion: number;
  beforeRollback?: () => Promise<number>;
  onRollback?: (revisionId: string, version: number) => Promise<void> | void;
}

function rollbackIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `rollback-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `rollback-${Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export default function HistoryTimelinePanel({
  isOpen,
  onClose,
  sheetId,
  currentVersion,
  beforeRollback,
  onRollback,
}: HistoryTimelinePanelProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [stats, setStats] = useState<RevisionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(
    null,
  );
  const [filter, setFilter] = useState("");
  const [rolling, setRolling] = useState(false);

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter ? `?action=${encodeURIComponent(filter)}` : "";
      const data = await apiClient.request<{ revisions?: Revision[] }>(
        `/sheets/${sheetId}/revisions${query}`,
      );
      setRevisions(data.revisions || []);
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, sheetId]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiClient.request<RevisionStats>(
        `/sheets/${sheetId}/revisions/stats`,
      );
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [sheetId]);

  useEffect(() => {
    if (!isOpen || !sheetId) return;
    const timer = window.setTimeout(() => {
      void fetchRevisions();
      void fetchStats();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchRevisions, fetchStats, isOpen, sheetId]);

  const handleRollback = async (revisionId: string) => {
    if (!confirm("이 변경에서 수정된 셀을 이전 상태로 복원하시겠습니까?"))
      return;

    setRolling(true);
    try {
      const expectedVersion = beforeRollback
        ? await beforeRollback()
        : currentVersion;
      const result = await apiClient.request<{ version: number }>(
        `/sheets/${sheetId}/revisions/${revisionId}/rollback`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion,
            idempotencyKey: rollbackIdempotencyKey(),
          }),
        },
      );
      await onRollback?.(revisionId, result.version);
      await Promise.all([fetchRevisions(), fetchStats()]);
      setSelectedRevision(null);
      alert("선택한 변경을 복원했습니다.");
    } catch (err) {
      console.error("Rollback failed:", err);
      alert(
        err instanceof ApiError
          ? `복원에 실패했습니다: ${err.message}`
          : "복원에 실패했습니다.",
      );
    } finally {
      setRolling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      CELL_UPDATE: "셀 수정",
      BULK_UPDATE: "일괄 수정",
      ROLLBACK: "롤백",
      ROW_INSERT: "행 추가",
      ROW_DELETE: "행 삭제",
      COL_INSERT: "열 추가",
      COL_DELETE: "열 삭제",
    };
    return labels[action] || action;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>변경 기록</h2>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {stats && (
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.totalRevisions}</span>
            <span className={styles.statLabel}>총 변경</span>
          </div>
          {stats.revisionsByAction.slice(0, 3).map(({ action, count }) => (
            <div key={action} className={styles.statItem}>
              <span className={styles.statValue}>{count}</span>
              <span className={styles.statLabel}>{getActionLabel(action)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.filterBar}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">전체 작업</option>
          <option value="CELL_UPDATE">셀 수정</option>
          <option value="BULK_UPDATE">일괄 수정</option>
          <option value="ROLLBACK">롤백</option>
        </select>
      </div>

      <div className={styles.timeline}>
        {loading ? (
          <div className={styles.loading}>로딩 중...</div>
        ) : revisions.length === 0 ? (
          <div className={styles.empty}>변경 기록이 없습니다.</div>
        ) : (
          revisions.map((rev, index) => (
            <div
              key={rev.id}
              className={`${styles.revisionItem} ${selectedRevision?.id === rev.id ? styles.selected : ""}`}
              onClick={() =>
                setSelectedRevision(
                  selectedRevision?.id === rev.id ? null : rev,
                )
              }
            >
              <div className={styles.timelineDot} />
              {index < revisions.length - 1 && (
                <div className={styles.timelineLine} />
              )}

              <div className={styles.revisionContent}>
                <div className={styles.revisionHeader}>
                  <span className={styles.actionBadge}>
                    {getActionLabel(rev.action)}
                  </span>
                  <span className={styles.time}>
                    {formatDate(rev.createdAt)}
                  </span>
                </div>

                <div className={styles.revisionMeta}>
                  <div className={styles.userInfo}>
                    {rev.user.avatar ? (
                      <img
                        src={rev.user.avatar}
                        alt=""
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {rev.user.name?.[0] ??
                          rev.user.email[0]?.toUpperCase() ??
                          "?"}
                      </div>
                    )}
                    <span>{rev.user.name || rev.user.email}</span>
                  </div>
                  {rev.targetRange && (
                    <span className={styles.range}>{rev.targetRange}</span>
                  )}
                </div>

                {rev.description && (
                  <div className={styles.description}>{rev.description}</div>
                )}

                {selectedRevision?.id === rev.id && (
                  <div className={styles.details}>
                    {rev.previousData != null && (
                      <div className={styles.dataPreview}>
                        <h4>이전 데이터</h4>
                        <pre>
                          {JSON.stringify(rev.previousData, null, 2).slice(
                            0,
                            200,
                          )}
                        </pre>
                      </div>
                    )}
                    <button
                      onClick={() => handleRollback(rev.id)}
                      className={styles.rollbackButton}
                      disabled={rolling}
                    >
                      {rolling ? "복원 중..." : "이 변경 되돌리기"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
