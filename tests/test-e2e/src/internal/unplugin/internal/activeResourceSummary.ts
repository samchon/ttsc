/**
 * Count this process's active resources by kind, for a failure message.
 *
 * The revived scenarios share one process, so a native watcher or handle an
 * earlier scenario left open stays open for every later one; this shows how
 * many of each kind a notification-coverage failure ran beside.
 */
export function activeResourceSummary(): string {
  const counts = new Map<string, number>();
  for (const kind of process.getActiveResourcesInfo())
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}=${count}`)
    .join(", ");
}
