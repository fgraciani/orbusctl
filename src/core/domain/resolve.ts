export function resolveMatch<T>(
  items: T[],
  search: string,
  getName: (item: T) => string,
  label: string,
  onError: (message: string) => never,
): T {
  const lower = search.toLowerCase()

  const exact = items.filter((item) => getName(item).toLowerCase() === lower)
  if (exact.length === 1) return exact[0]

  const partial = items.filter((item) => getName(item).toLowerCase().includes(lower))
  if (partial.length === 0) return onError(`No ${label} found matching "${search}".`)
  if (partial.length === 1) return partial[0]

  const list = partial.map((item) => `  ${getName(item)}`).join('\n')
  return onError(`Multiple ${label}s match "${search}". Be more specific:\n\n${list}`)
}
