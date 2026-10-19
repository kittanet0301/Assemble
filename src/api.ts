export async function api<T = any>(path: string, data?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method ?? (data === undefined ? 'GET' : 'POST'),
    credentials: 'same-origin',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error ?? 'เชื่อมต่อไม่สำเร็จ');
  return result;
}
