/** The structured components carried by a graph symbol id. */
export interface ITtscGraphNodeId {
  path: string;
  name: string;
  kind?: string;
}

/**
 * Decode the graph's position-invariant `path#name:kind` identity.
 *
 * The producer quotes `#` and `\\` inside path and name. This reader also
 * accepts pre-codec ordinary ids, so a current package can read an older dump.
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

/** Encode a symbol identity without making its component boundaries ambiguous. */
export function writeTtscGraphNodeId(
  path: string,
  name: string,
  kind: string,
): string {
  return `${escapeGraphNodeIdPart(path)}#${escapeGraphNodeIdPart(name)}:${kind}`;
}

/** Return the raw path component when id is a symbol identity. */
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
