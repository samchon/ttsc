/** An evaluated contributor namespace and its already-resolved Go source. */
type ConfigPluginEntry = { namespace: string; source: string };

/** A native-host contributor name paired with its original source directory. */
type TtscPluginContributor = { name: string; source: string };

/**
 * Normalize evaluated contributor namespaces without losing a distinct
 * registration.
 *
 * Hyphens become underscores in Go package names. Distinct user namespaces that
 * then collide are rejected before exact repeated namespaces keep their first
 * source, preserving config-array folding's established precedence.
 *
 * @evidence contracts/common.md#principled-implementation Collision detection groups original namespace spellings by hyphen-to-underscore Go names before folding exact repetitions, so a distinct registration cannot silently disappear and a repeated spelling retains its first source.
 * @evidence contracts/common.md#clear-and-simple-design The operation owns namespace normalization and repetition precedence after config evaluation; filesystem discovery, contributor resolution and cache lifetime remain with the descriptor resolver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Every evaluated entry follows the same normalization and collision rules, without fixture-specific names, foreign mutation or a fallback that discards a distinct colliding namespace.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the Go naming transformation, collision failure and first-source precedence, with descriptive paragraphs separated from acknowledgment tags.
 */
export function normalizeContributors(
  entries: ConfigPluginEntry[],
  configPath: string,
): TtscPluginContributor[] {
  assertContributorNamespacesDoNotCollide(entries, configPath);
  // Dedup exact repeated namespaces on the Go-subpackage form. Config-array
  // folding can surface the same namespace more than once; that existing
  // behavior stays intact after distinct namespaces are rejected above.
  const occupied = new Set<string>();
  const out: TtscPluginContributor[] = [];
  for (const entry of entries) {
    const goName = goSubpackageName(entry.namespace);
    if (occupied.has(goName)) continue;
    occupied.add(goName);
    out.push({ name: goName, source: entry.source });
  }
  return out;
}

/**
 * Map a user-facing namespace (`react-hooks`) to a Go-valid sub-package name
 * (`react_hooks`). Required because ttsc's plugin builder uses the `name` field
 * as a directory and import-path suffix, both of which must satisfy Go's
 * stricter `[a-z][a-z0-9_]*` identifier rules. The function is total over
 * namespaces that already passed `NAMESPACE_PATTERN`.
 */
function goSubpackageName(namespace: string): string {
  return namespace.replace(/-/g, "_");
}

function assertContributorNamespacesDoNotCollide(
  entries: ConfigPluginEntry[],
  configPath: string,
): void {
  const namespacesByGoName = new Map<string, Set<string>>();
  for (const entry of entries) {
    const goName = goSubpackageName(entry.namespace);
    let namespaces = namespacesByGoName.get(goName);
    if (namespaces === undefined) {
      namespaces = new Set<string>();
      namespacesByGoName.set(goName, namespaces);
    }
    namespaces.add(entry.namespace);
  }
  const collisions = [...namespacesByGoName]
    .map(([goName, namespaces]) => [goName, [...namespaces].sort()] as const)
    .filter(([, namespaces]) => namespaces.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  if (collisions.length === 0) return;

  const details = collisions
    .map(
      ([goName, namespaces]) =>
        `${namespaces.map((namespace) => JSON.stringify(namespace)).join(", ")} all normalize to ${JSON.stringify(goName)}`,
    )
    .join("; ");
  throw new Error(
    `@ttsc/lint: lint config ${configPath} contributor namespaces collide after Go normalization: ${details}`,
  );
}
