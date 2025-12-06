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
  },
  spreadsheets: {
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
  },
};
