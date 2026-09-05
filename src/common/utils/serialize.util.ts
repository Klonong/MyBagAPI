export function toJsonSafe<T>(value: T): T {
  const json: string = JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? Number(item) : item,
  );
  return JSON.parse(json) as T;
}
