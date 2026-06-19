export function getHttpHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  if (!Object.hasOwn(headers, name)) {
    return undefined;
  }

  const value = Reflect.get(headers, name);
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}
