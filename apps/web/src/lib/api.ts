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
  },
  spreadsheets: {
    list: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/sheets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch spreadsheets');
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
};
