const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Login failed');
      return res.json();
    },
  },
  users: {
    list: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update user');
      return res.json();
    },
    getProfile: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    updateProfile: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
  },
  spreadsheets: {
    list: async (filter?: string, search?: string) => {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (filter) params.append('filter', filter);
      if (search) params.append('search', search);

      const res = await fetch(`${API_URL}/sheets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch spreadsheets');
      return res.json();
    },
    get: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch spreadsheet');
      return res.json();
    },
    update: async (id: string, data: { name?: string }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update spreadsheet');
      return res.json();
    },
    copy: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to copy spreadsheet');
      return res.json();
    },
    toggleFavorite: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to toggle favorite');
      return res.json();
    },
    listPermissions: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to list permissions');
      return res.json();
    },
    addPermission: async (id: string, email: string, role: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) throw new Error('Failed to add permission');
      return res.json();
    },
    removePermission: async (id: string, permId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/permissions/${permId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove permission');
      return res.json();
    },
    updatePublicAccess: async (id: string, isPublic: boolean) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/public`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isPublic }),
      });
      if (!res.ok) throw new Error('Failed to update public access');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create spreadsheet');
      return res.json();
    },
    listAdmin: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch spreadsheets');
      return res.json();
    },
    deleteAdmin: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/admin/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete spreadsheet');
      return res.json();
    },
    listTrash: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/trash`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch trash');
      return res.json();
    },
    restore: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/trash/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to restore spreadsheet');
      return res.json();
    },
    hardDelete: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/trash/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to permanently delete spreadsheet');
      return res.json();
    },
    updateCells: async (sheetId: string, updates: { row: number, col: number, value?: any, formula?: string, format?: any }[]) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/sheet/${sheetId}/cells`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error('Failed to save cells');
      return res.json();
    },
    saveCharts: async (sheetId: string, charts: Array<{
      id?: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      data: any;
      options?: any;
    }>) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/sheet/${sheetId}/charts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ charts }),
      });
      if (!res.ok) throw new Error('Failed to save charts');
      return res.json();
    },
    savePivotTables: async (sheetId: string, pivotTables: Array<{
      id?: string;
      name?: string;
      config: any;
      sourceRange?: string;
      targetCell?: string;
    }>) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/sheet/${sheetId}/pivot-tables`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pivotTables }),
      });
      if (!res.ok) throw new Error('Failed to save pivot tables');
      return res.json();
    },
    // Embed settings
    getEmbed: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/embed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch embed config');
      }
      return res.json();
    },
    createEmbed: async (id: string, config: {
      enabled?: boolean;
      showToolbar?: boolean;
      showTabs?: boolean;
      showGridlines?: boolean;
      allowedDomains?: string[];
    }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to create embed config');
      return res.json();
    },
    deleteEmbed: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/embed`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete embed config');
      return res.json();
    },
    regenerateEmbedToken: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets/${id}/embed/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to regenerate embed token');
      return res.json();
    },
  },
  audit: {
    list: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
  },
  settings: {
    get: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    update: async (key: string, value: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
  },
  roles: {
    list: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    },
    get: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/roles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch role');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create role');
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/roles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete role');
      return res.json();
    },
  },
  notices: {
    list: async (active?: boolean) => {
      const token = localStorage.getItem('auth_token');
      const url = active ? `${API_URL}/notices?active=true` : `${API_URL}/notices`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch notices');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create notice');
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/notices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update notice');
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/notices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete notice');
      return res.json();
    },
  },
  templates: {
    list: async (category?: string) => {
      const token = localStorage.getItem('auth_token');
      const url = category ? `${API_URL}/templates?category=${category}` : `${API_URL}/templates`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    update: async (id: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    delete: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
  },
  flows: {
    list: async (spreadsheetId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/spreadsheet/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch flows');
      return res.json();
    },
    get: async (flowId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch flow');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create flow');
      return res.json();
    },
    update: async (flowId: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update flow');
      return res.json();
    },
    delete: async (flowId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete flow');
      return res.json();
    },
    execute: async (flowId: string, triggerData: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(triggerData),
      });
      if (!res.ok) throw new Error('Failed to execute flow');
      return res.json();
    },
    getExecutions: async (flowId: string, limit = 50) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}/executions?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch executions');
      return res.json();
    },
    getVersions: async (flowId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.json();
    },
    rollback: async (flowId: string, versionId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}/versions/${versionId}/rollback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to rollback');
      return res.json();
    },
    toggle: async (flowId: string, active: boolean) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error('Failed to toggle flow');
      return res.json();
    },
    getExecution: async (executionId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/flows/executions/${executionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch flow execution');
      return res.json();
    },
  },
  events: {
    listRules: async (spreadsheetId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/events/rules?spreadsheetId=${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch event rules');
      return res.json();
    },
    createRule: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/events/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create event rule');
      return res.json();
    },
    updateRule: async (ruleId: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/events/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update event rule');
      return res.json();
    },
    deleteRule: async (ruleId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/events/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete event rule');
      return res.json();
    },
    getLogs: async (spreadsheetId: string, limit = 100) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/events/logs?spreadsheetId=${spreadsheetId}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch event logs');
      return res.json();
    },
  },
  webhooks: {
    list: async (spreadsheetId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/webhooks/spreadsheet/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch webhooks');
      return res.json();
    },
    create: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create webhook');
      return res.json();
    },
    update: async (webhookId: string, data: any) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update webhook');
      return res.json();
    },
    delete: async (webhookId: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete webhook');
      return res.json();
    },
    getExecutions: async (webhookId: string, limit = 50) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/webhooks/${webhookId}/executions?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch webhook executions');
    },
  },
};
