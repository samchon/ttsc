import { createHash } from "node:crypto";

/**
 * Digests one parsed declaration under a serialization that does not depend on
 * how it was written.
 *
 * A review fingerprint answers whether the thing a reviewer read has changed,
 * so two inputs that describe the same declaration have to produce one value.
 * `JSON.stringify` emits keys in insertion order, and insertion order here is a
 * function of the input dialect and of a converter's internals: a Swagger 2.0
 * document and an OpenAPI 3.1 document that normalize to the same operation
 * would otherwise hash differently, and a converter change would expire every
 * review in a project.
 *
 * Object keys are therefore sorted and arrays are not, because an array's order
 * is part of what it says: OpenAPI parameter order and `required` membership
 * are both arrays, and reordering the second is a real edit a reviewer must
 * see. Sorting them would hide it.
 *
 * `undefined` is dropped from objects and rendered as `null` inside arrays,
 * which is what `JSON.stringify` does, so an absent property and a present one
 * holding `undefined` cannot be told apart. That is the same thing to every
 * consumer downstream of the parser.
 *
 * @internal
 */
export const canonicalDigest = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

/**
 * Renders a parsed value with object keys in sorted order and no incidental
 * whitespace.
 *
 * @internal
 */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return stringify(value);
  if (Array.isArray(value))
    return `[${value.map((element) => canonicalJson(element ?? null)).join(",")}]`;
  const entries: Array<[string, unknown]> = Object.entries(
    value as Record<string, unknown>,
  ).filter(([, element]) => element !== undefined);
  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, element]) => `${JSON.stringify(key)}:${canonicalJson(element)}`)
    .join(",")}}`;
};

const stringify = (value: unknown): string => {
  const rendered: string | undefined = JSON.stringify(value);
  return rendered ?? "null";
};

/**
 * Drops the properties that carry a declaration's documentation.
 *
 * A review of a declaration is written in that declaration's own comment, so a
 * digest covering the comment moves the moment the review is written and the
 * review is stale before the next build reads it. That is the non-terminating
 * repair loop the whole feature exists to avoid, and it is why the one content
 * field the Prisma payload carries in full is the one field that must not be
 * hashed.
 *
 * @internal
 */
export const withoutDocumentation = <Value>(
  value: Value,
  ...keys: string[]
): Value => {
  const copy: Record<string, unknown> = {
    ...(value as unknown as Record<string, unknown>),
  };
  for (const key of keys) delete copy[key];
  return copy as unknown as Value;
};
