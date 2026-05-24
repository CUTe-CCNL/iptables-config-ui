export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function newId(prefix: string) {
  if ("randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isEqualJSON(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function compact(value?: string) {
  return value && value.trim() ? value.trim() : undefined;
}

export function nextOrder(items: Array<{ order: number }>) {
  return items.reduce((max, item) => Math.max(max, item.order), 0) + 10;
}

export function reorder<T extends { order: number }>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const copy = [...items];
  const tmp = copy[index];
  copy[index] = copy[nextIndex];
  copy[nextIndex] = tmp;
  return copy.map((item, idx) => ({ ...item, order: (idx + 1) * 10 }));
}

