import { API_URL, apiClient } from "./api-client";
import type { CellValue } from "@/types/spreadsheet";
import type { PersistedConditionalRule } from "@/utils/conditionalRulePersistence";
import type { MergedRange } from "@/utils/mergedRanges";
import type { ManagedPivotTable } from "@/utils/managedPivots";

export interface PersistedMergedRange extends MergedRange {
  id: string;
}

export interface SpreadsheetSummary {
  id: string;
  name: string;
  updatedAt: string;
  owner?: { name: string; email: string; avatar?: string | null };
  _count?: { sheets: number };
  isFavorite?: boolean;
}

export interface SpreadsheetDetail {
  id: string;
  name?: string;
  sheets?: SpreadsheetSheet[];
}

export interface SpreadsheetSheet {
  id: string;
  name: string;
  index: number;
  version?: number;
  rowCount?: number;
  colCount?: number;
  frozenRows?: number;
  frozenCols?: number;
  defaultRowHeight?: number;
  defaultColWidth?: number;
  rowMeta?: Array<{ row: number; height?: number | null; hidden: boolean }>;
  colMeta?: Array<{ col: number; width?: number | null; hidden: boolean }>;
  cells?: Array<{
    row: number;
    col: number;
    value: CellValue;
    formula?: string | null;
    format?: unknown;
  }>;
  charts?: unknown[];
  conditionalRules?: PersistedConditionalRule[];
  mergedRanges?: PersistedMergedRange[];
  pivotTables?: ManagedPivotTable[];
}

export interface SpreadsheetVersion {
  id: string;
  name?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    name?: string | null;
    avatar?: string | null;
  };
}

export interface WorkbookImportPayload {
  mode: "append" | "replace";
  expectedSheetVersions: Array<{ sheetId: string; version: number }>;
  sheets: Array<{
    name: string;
    rowCount: number;
    colCount: number;
    frozenRows: number;
    frozenCols: number;
    defaultRowHeight: number;
    defaultColWidth: number;
    cells: Array<{
      row: number;
      col: number;
      value?: unknown;
      formula?: string | null;
      format?: Record<string, unknown>;
    }>;
    rowMeta: Array<{ row: number; height?: number; hidden: boolean }>;
    colMeta: Array<{ col: number; width?: number; hidden: boolean }>;
    mergedRanges: Array<{
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    }>;
  }>;
}
const fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  apiClient.fetch(String(input), init);

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Login failed");
      return res.json();
    },
  },
  versions: {
    list: async (spreadsheetId: string): Promise<SpreadsheetVersion[]> => {
      const res = await fetch(
        `${API_URL}/versions/spreadsheet/${spreadsheetId}`,
      );
      if (!res.ok) throw new Error("버전 기록을 불러오지 못했습니다.");
      return res.json();
    },
    create: async (
      spreadsheetId: string,
      name?: string,
    ): Promise<SpreadsheetVersion> => {
      const res = await fetch(
        `${API_URL}/versions/spreadsheet/${spreadsheetId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) throw new Error("버전을 생성하지 못했습니다.");
      return res.json();
    },
    restore: async (versionId: string): Promise<void> => {
      const res = await fetch(`${API_URL}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("버전을 복원하지 못했습니다.");
    },
  },
  conditionalRules: {
    list: (sheetId: string) =>
      apiClient.request<PersistedConditionalRule[]>(
        `/sheets/${sheetId}/conditional-rules`,
      ),
    create: (
      sheetId: string,
      rule: Omit<PersistedConditionalRule, "id">,
    ) =>
      apiClient.request<PersistedConditionalRule>(
        `/sheets/${sheetId}/conditional-rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        },
      ),
  },
  users: {
    list: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    getProfile: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    updateProfile: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
  },
  spreadsheets: {
    list: async (filter?: string, search?: string, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (filter) params.append("filter", filter);
      if (search) params.append("search", search);
      const query = params.toString();
      return apiClient.request<SpreadsheetSummary[]>(
        `/sheets${query ? `?${query}` : ""}`,
        { signal },
      );
    },
    get: async (id: string, signal?: AbortSignal) => {
      return apiClient.request<SpreadsheetDetail>(`/sheets/${id}`, { signal });
    },
    importWorkbook: async (
      id: string,
      payload: WorkbookImportPayload,
    ) => apiClient.request<{
      mode: "append" | "replace";
      imported: Array<{ id: string; name: string; version: number }>;
      preservedSheetCount: number;
    }>(`/sheets/${id}/import-workbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    addSheet: async (spreadsheetId: string, name: string) => {
      return apiClient.request<SpreadsheetSheet>(
        `/sheets/${spreadsheetId}/sheets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
    },
    renameSheet: async (sheetId: string, name: string) => {
      return apiClient.request<SpreadsheetSheet>(`/sheets/sheet/${sheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    },
    deleteSheet: async (sheetId: string) => {
      await apiClient.request(`/sheets/sheet/${sheetId}`, { method: "DELETE" });
    },
    duplicateSheet: async (sheetId: string) => {
      return apiClient.request<SpreadsheetSheet>(
        `/sheets/sheet/${sheetId}/duplicate`,
        {
          method: "POST",
        },
      );
    },
    reorderSheet: async (sheetId: string, index: number) => {
      return apiClient.request<SpreadsheetSheet[]>(
        `/sheets/sheet/${sheetId}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
        },
      );
    },
    changeStructure: async (
      sheetId: string,
      change: {
        axis: "row" | "column";
        type: "insert" | "delete";
        index: number;
      },
    ) => {
      return apiClient.request<{
        id: string;
        version: number;
        rowCount: number;
        colCount: number;
        pivotTables: ManagedPivotTable[];
      }>(`/sheets/sheet/${sheetId}/structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
    },
    mergeCells: async (
      sheetId: string,
      range: MergedRange,
      expectedVersion: number,
    ) => apiClient.request<{ mergedRange: PersistedMergedRange; version: number }>(
      `/sheets/sheet/${sheetId}/merged-ranges`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...range, expectedVersion }),
      },
    ),
    unmergeCells: async (
      sheetId: string,
      range: MergedRange,
      expectedVersion: number,
    ) => apiClient.request<{ version: number }>(
      `/sheets/sheet/${sheetId}/merged-ranges`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...range, expectedVersion }),
      },
    ),
    saveView: async (
      sheetId: string,
      view: {
        frozenRows: number;
        frozenCols: number;
        rowMeta: Array<{ row: number; height: number; hidden: boolean }>;
        colMeta: Array<{ col: number; width: number; hidden: boolean }>;
      },
    ) => {
      return apiClient.request<{ id: string; version: number }>(
        `/sheets/sheet/${sheetId}/view`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(view),
        },
      );
    },
    update: async (id: string, data: { name?: string }) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update spreadsheet");
      return res.json();
    },
    copy: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/copy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to copy spreadsheet");
      return res.json();
    },
    toggleFavorite: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/favorite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    listPermissions: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to list permissions");
      return res.json();
    },
    addPermission: async (id: string, email: string, role: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) throw new Error("Failed to add permission");
      return res.json();
    },
    removePermission: async (id: string, permId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/permissions/${permId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove permission");
      return res.json();
    },
    updatePublicAccess: async (id: string, isPublic: boolean) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/public`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPublic }),
      });
      if (!res.ok) throw new Error("Failed to update public access");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create spreadsheet");
      return res.json();
    },
    listAdmin: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch spreadsheets");
      return res.json();
    },
    deleteAdmin: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/admin/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete spreadsheet");
      return res.json();
    },
    listTrash: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/trash`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch trash");
      return res.json();
    },
    restore: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/trash/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to restore spreadsheet");
      return res.json();
    },
    hardDelete: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/trash/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to permanently delete spreadsheet");
      return res.json();
    },
    updateCells: async (
      sheetId: string,
      updates: {
        row: number;
        col: number;
        value?: CellValue;
        formula?: string | null;
        format?: unknown;
      }[],
      expectedVersion?: number,
      idempotencyKey?: string,
    ) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/sheet/${sheetId}/cells`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ updates, expectedVersion, idempotencyKey }),
      });
      if (res.status === 409) {
        throw new Error(
          "다른 사용자가 먼저 시트를 변경했습니다. 입력 내용은 유지되며 새로고침 후 다시 저장해 주세요.",
        );
      }
      if (!res.ok) throw new Error("Failed to save cells");
      return res.json();
    },
    saveCharts: async (
      sheetId: string,
      charts: Array<{
        id?: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        data: any;
        options?: any;
      }>,
    ) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/sheet/${sheetId}/charts`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ charts }),
      });
      if (!res.ok) throw new Error("Failed to save charts");
      return res.json();
    },
    savePivotTables: async (
      sheetId: string,
      pivotTables: ManagedPivotTable[],
      expectedVersion?: number,
    ) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/sheets/sheet/${sheetId}/pivot-tables`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pivotTables, expectedVersion }),
        },
      );
      if (!res.ok) throw new Error("Failed to save pivot tables");
      return res.json() as Promise<{
        pivotTables: ManagedPivotTable[];
        version: number;
      }>;
    },
    // Embed settings
    getEmbed: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/embed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch embed config");
      }
      return res.json();
    },
    createEmbed: async (
      id: string,
      config: {
        enabled?: boolean;
        showToolbar?: boolean;
        showTabs?: boolean;
        showGridlines?: boolean;
        allowedDomains?: string[];
      },
    ) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to create embed config");
      return res.json();
    },
    deleteEmbed: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/embed`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete embed config");
      return res.json();
    },
    regenerateEmbedToken: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/sheets/${id}/embed/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to regenerate embed token");
      return res.json();
    },
  },
  audit: {
    list: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  },
  settings: {
    get: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    update: async (key: string, value: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
  },
  roles: {
    list: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
    get: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/roles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch role");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/roles/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/roles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete role");
      return res.json();
    },
  },
  notices: {
    list: async (active?: boolean) => {
      const token = localStorage.getItem("auth_token");
      const url = active
        ? `${API_URL}/notices?active=true`
        : `${API_URL}/notices`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch notices");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/notices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create notice");
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/notices/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update notice");
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/notices/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete notice");
      return res.json();
    },
  },
  templates: {
    list: async (category?: string) => {
      const token = localStorage.getItem("auth_token");
      const url = category
        ? `${API_URL}/templates?category=${category}`
        : `${API_URL}/templates`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/templates/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete template");
      return res.json();
    },
  },
  flows: {
    list: async (spreadsheetId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/spreadsheet/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch flows");
      return res.json();
    },
    get: async (flowId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch flow");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create flow");
      return res.json();
    },
    update: async (flowId: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update flow");
      return res.json();
    },
    delete: async (flowId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete flow");
      return res.json();
    },
    execute: async (flowId: string, triggerData: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/${flowId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(triggerData),
      });
      if (!res.ok) throw new Error("Failed to execute flow");
      return res.json();
    },
    getExecutions: async (flowId: string, limit = 50) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/flows/${flowId}/executions?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch executions");
      return res.json();
    },
    getVersions: async (flowId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/${flowId}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
    rollback: async (flowId: string, versionId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/flows/${flowId}/versions/${versionId}/rollback`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to rollback");
      return res.json();
    },
    toggle: async (flowId: string, active: boolean) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to toggle flow");
      return res.json();
    },
    getExecution: async (executionId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/flows/executions/${executionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch flow execution");
      return res.json();
    },
  },
  events: {
    listRules: async (spreadsheetId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/events/rules?spreadsheetId=${spreadsheetId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch event rules");
      return res.json();
    },
    createRule: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/events/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create event rule");
      return res.json();
    },
    updateRule: async (ruleId: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/events/rules/${ruleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update event rule");
      return res.json();
    },
    deleteRule: async (ruleId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/events/rules/${ruleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete event rule");
      return res.json();
    },
    getLogs: async (spreadsheetId: string, limit = 100) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/events/logs?spreadsheetId=${spreadsheetId}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch event logs");
      return res.json();
    },
  },
  webhooks: {
    list: async (spreadsheetId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/webhooks/spreadsheet/${spreadsheetId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch webhooks");
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create webhook");
      return res.json();
    },
    update: async (webhookId: string, data: any) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/webhooks/${webhookId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update webhook");
      return res.json();
    },
    delete: async (webhookId: string) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/webhooks/${webhookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
      return res.json();
    },
    getExecutions: async (webhookId: string, limit = 50) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_URL}/webhooks/${webhookId}/executions?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch webhook executions");
    },
  },
};
