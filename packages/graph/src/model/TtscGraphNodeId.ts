/**
 * The structured components carried by a graph symbol id.
 *
 * @evidence contracts/common.md#principled-implementation Decoded path and name preserve quoted identity components; optional kind supports legacy ids without a suffix.
 * @evidence contracts/common.md#clear-and-simple-design Three components isolate identity grammar from graph node payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy kind absence is explicit rather than replaced by a guessed declaration category.
 * @evidence contracts/common.md#meaningful-documentation Native member comments describe decoded components and the legacy optional suffix.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphNodeId declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphNodeId declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphNodeId declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphNodeId declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface ITtscGraphNodeId {
  /** Unquoted producer path coordinate. */
  path: string;

  /** Unquoted simple or owner-qualified declaration name. */
  name: string;

  /** Declaration kind suffix, absent on accepted legacy identities. */
  kind?: string;
}

/**
 * Decode the graph's position-invariant `path#name:kind` identity.
 *
 * The producer quotes `#` and `\\` inside path and name. This reader also
 * accepts pre-codec ordinary ids, so a current package can read an older dump.
 *
 * Returns undefined for a missing unquoted separator or empty name/kind.
 *
 * @evidence contracts/common.md#principled-implementation Escape-parity locates the component separator, then the final colon and inverse quoting recover identity parts without position dependence.
 * @evidence contracts/common.md#clear-and-simple-design Separator discovery and quoting are private codec helpers; this function owns assembling the parsed record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy UNC handling preserves a supported older encoding rather than guessing identity from basename or source position.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents quoting, legacy support and malformed-input absence before acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources parseTtscGraphNodeId acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms parseTtscGraphNodeId makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work parseTtscGraphNodeId computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation parseTtscGraphNodeId operates on in-memory values and performs no filesystem, path or process operation.
 */
export function parseTtscGraphNodeId(id: string): ITtscGraphNodeId | undefined {
  const hash = graphNodeIdHash(id);
  if (hash < 0) return undefined;
  const tail = id.slice(hash + 1);
  if (tail === "") return undefined;
  const colon = tail.lastIndexOf(":");
  if (colon === 0 || colon === tail.length - 1) return undefined;
  return {
    path: unescapeGraphNodeIdPart(id.slice(0, hash)),
    name: unescapeGraphNodeIdPart(colon < 0 ? tail : tail.slice(0, colon)),
    ...(colon < 0 ? {} : { kind: tail.slice(colon + 1) }),
  };
}

/**
 * Encode a symbol identity without making its component boundaries ambiguous.
 *
 * Quotes backslashes and hashes in path/name before adding the hash separator
 * and kind suffix. The caller supplies a supported declaration kind.
 *
 * @evidence contracts/common.md#principled-implementation Escaping delimiter characters before concatenation makes path/name boundaries recoverable by the corresponding parser.
 * @evidence contracts/common.md#clear-and-simple-design One writer shares a quoting helper for both components.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Identity uses actual path/name/kind rather than shortened fixture-specific aliases.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies quoting and the kind precondition without exposing implementation bodies.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources writeTtscGraphNodeId acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms writeTtscGraphNodeId makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work writeTtscGraphNodeId computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation writeTtscGraphNodeId operates on in-memory values and performs no filesystem, path or process operation.
 */
export function writeTtscGraphNodeId(
  path: string,
  name: string,
  kind: string,
): string {
  return `${escapeGraphNodeIdPart(path)}#${escapeGraphNodeIdPart(name)}:${kind}`;
}

/**
 * Return the unquoted path component when id is a symbol identity.
 *
 * Malformed ids return undefined under the shared parser's rules.
 *
 * @evidence contracts/common.md#principled-implementation Delegating to the full parser preserves escape and legacy grammar before selecting its path.
 * @evidence contracts/common.md#clear-and-simple-design The adapter adds no independent delimiter parsing policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Paths are not sliced at the first raw hash, which may be quoted identity content.
 * @evidence contracts/common.md#meaningful-documentation Native prose states decoded output and malformed-input absence.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ttscGraphNodeIdPath acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ttscGraphNodeIdPath makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ttscGraphNodeIdPath computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ttscGraphNodeIdPath operates on in-memory values and performs no filesystem, path or process operation.
 */
export function ttscGraphNodeIdPath(id: string): string | undefined {
  return parseTtscGraphNodeId(id)?.path;
}

function escapeGraphNodeIdPart(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("#", "\\#");
}

function unescapeGraphNodeIdPart(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index++) {
    const next = value[index + 1];
    if (value[index] === "\\" && next !== undefined) {
      if (next === "#" || (next === "\\" && !legacyUNCStart(value, index))) {
        result += next;
        index++;
        continue;
      }
    }
    result += value[index];
  }
  return result;
}

function legacyUNCStart(value: string, index: number): boolean {
  return (
    index === 0 && value.length > 2 && value[2] !== "\\" && value[2] !== "#"
  );
}

function graphNodeIdHash(id: string): number {
  for (let index = 0; index < id.length; index++) {
    if (id[index] !== "#") continue;
    let slashes = 0;
    for (let slash = index - 1; slash >= 0 && id[slash] === "\\"; slash--)
      slashes++;
    if (slashes % 2 === 0) return index;
  }
  return -1;
}
