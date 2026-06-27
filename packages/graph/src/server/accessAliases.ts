import { ITtscGraphNode } from "../structures/ITtscGraphNode";

/**
 * Derive stable access-path aliases for a member edge from its source
 * expression. If a hop reaches `Owner.member` through `obj.path.member`, the
 * alias `Owner.path.member` keeps both the resolved owner and the concrete
 * access path visible without reopening source.
 */
export function accessAliasesFor(
  node: ITtscGraphNode | undefined,
  evidenceText: string | undefined,
): string[] | undefined {
  if (
    node === undefined ||
    node.qualifiedName === undefined ||
    evidenceText === undefined
  ) {
    return undefined;
  }
  const segments = dottedSegments(evidenceText);
  if (segments.length < 2 || segments[segments.length - 1] !== node.name) {
    return undefined;
  }
  const dot = node.qualifiedName.lastIndexOf(".");
  if (dot < 0) return undefined;

  const owner = node.qualifiedName.slice(0, dot);
  const suffix = segments.slice(1).join(".");
  const aliases = new Set<string>();
  for (const candidate of [...ownerDisplayAliases(owner), owner]) {
    const alias = `${candidate}.${suffix}`;
    if (alias !== node.qualifiedName) aliases.add(alias);
  }
  return aliases.size > 0 ? [...aliases] : undefined;
}

function dottedSegments(text: string): string[] {
  const normalized = text.trim().replace(/\?\./g, ".");
  const parts = normalized.split(".");
  if (parts.length < 2) return [];
  return parts.every((part) => /^[A-Za-z_$][\w$]*$/.test(part)) ? parts : [];
}

function ownerDisplayAliases(owner: string): string[] {
  const display = owner.replace(/^_+/, "");
  const out = new Set<string>();
  for (const suffix of ["Internals", "Internal"]) {
    if (display.length > suffix.length && display.endsWith(suffix)) {
      out.add(display.slice(0, -suffix.length));
    }
  }
  if (out.size === 0 && display !== owner) out.add(display);
  out.delete(owner);
  return [...out];
}
