// ABOUTME: Typed API client for all reRun backend endpoints
// ABOUTME: Uses fetch with JSON helpers, relative URLs work in both dev and production

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params ? `${path}?${new URLSearchParams(params)}` : path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  titles: {
    list: (params?: Record<string, string>) => get<any>('/api/titles', params),
    get: (id: string) => get<any>(`/api/titles/${id}`),
    create: (data: any) => post<any>('/api/titles', data),
    update: (id: string, data: any) => put<any>(`/api/titles/${id}`, data),
    addCopies: (id: string, data: any) => post<any>(`/api/titles/${id}/copies`, data),
  },
  copies: {
    update: (id: string, data: any) => put<any>(`/api/copies/${id}`, data),
    lookupBarcode: (barcode: string) => get<any>(`/api/copies/barcode/${barcode}`),
  },
  customers: {
    list: (params?: Record<string, string>) => get<any>('/api/customers', params),
    get: (id: string) => get<any>(`/api/customers/${id}`),
    search: (q: string) => get<any>('/api/customers/search', { q }),
    create: (data: any) => post<any>('/api/customers', data),
    update: (id: string, data: any) => put<any>(`/api/customers/${id}`, data),
    addFamily: (id: string, data: any) => post<any>(`/api/customers/${id}/family`, data),
    removeFamily: (id: string, familyId: string) => del<any>(`/api/customers/${id}/family/${familyId}`),
    adjustBalance: (id: string, data: any) => put<any>(`/api/customers/${id}/balance`, data),
  },
  products: {
    list: (params?: Record<string, string>) => get<any>('/api/products', params),
    create: (data: any) => post<any>('/api/products', data),
    update: (id: string, data: any) => put<any>(`/api/products/${id}`, data),
    lowStock: () => get<any>('/api/products/low-stock'),
  },
  pricing: {
    list: () => get<any>('/api/pricing'),
    create: (data: any) => post<any>('/api/pricing', data),
    update: (id: string, data: any) => put<any>(`/api/pricing/${id}`, data),
    remove: (id: string) => del<any>(`/api/pricing/${id}`),
  },
  search: {
    query: (params: Record<string, string>) => get<any>('/api/search', params),
  },
  transactions: {
    create: (data: any) => post<any>('/api/transactions', data),
    get: (id: string) => get<any>(`/api/transactions/${id}`),
    void: (id: string, data: any) => post<any>(`/api/transactions/${id}/void`, data),
    hold: (data: any) => post<any>('/api/transactions/hold', data),
    held: () => get<any>('/api/transactions/held'),
    recall: (holdId: string) => post<any>(`/api/transactions/recall/${holdId}`),
  },
  rentals: {
    checkout: (data: any) => post<any>('/api/rentals/checkout', data),
    return: (data: any) => post<any>('/api/rentals/return', data),
    overdue: () => get<any>('/api/rentals/overdue'),
    active: () => get<any>('/api/rentals/active'),
    customer: (id: string) => get<any>(`/api/rentals/customer/${id}`),
  },
  reservations: {
    list: () => get<any>('/api/reservations'),
    create: (data: any) => post<any>('/api/reservations', data),
    fulfill: (id: string) => put<any>(`/api/reservations/${id}/fulfill`, {}),
    cancel: (id: string) => del<any>(`/api/reservations/${id}`),
  },
  import: {
    parse: (data: any) => post<any>('/api/import/parse', data),
    match: (data: any) => post<any>('/api/import/match', data),
    commit: (data: any) => post<any>('/api/import/commit', data),
  },
  tmdb: {
    search: (q: string, year?: number) => get<any>('/api/tmdb/search', {
      q,
      ...(year ? { year: String(year) } : {}),
    }),
    details: (tmdbId: number) => get<any>(`/api/tmdb/details/${tmdbId}`),
  },
  promotions: {
    list: () => get<any>('/api/promotions'),
    create: (data: any) => post<any>('/api/promotions', data),
    update: (id: string, data: any) => put<any>(`/api/promotions/${id}`, data),
  },
  settings: {
    list: () => get<any>('/api/settings'),
    get: (key: string) => get<any>(`/api/settings/${key}`),
    update: (key: string, value: string) => put<any>(`/api/settings/${key}`, { value }),
  },
};
