import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphEntry = require.resolve("@ttsc/graph");
const graphLib = path.dirname(graphEntry);
const { documentationTarget, leadingToken } = require(
  path.join(graphLib, "model", "TtscGraphMemory.js"),
) as {
  documentationTarget(text: string | undefined): string | undefined;
  leadingToken(text: string | undefined): string | undefined;
};
const { docTagsOf } = require(
  path.join(graphLib, "server", "runDetails.js"),
) as {
  docTagsOf(
    node: { docTags?: { name: string; text?: string }[] },
    keep?: (tag: { name: string; text?: string }) => boolean,
  ): { name: string; text?: string }[] | undefined;
};

/**
 * Verifies one definition of "the address" governs both the citation index and
 * the response cap.
 *
 * Two functions decide where an address ends: the index keys on it, and the cap
 * protects it from elision. Measured differently, a braced link — whose group
 * legitimately holds spaces — is indexed whole and then returned cut after
 * `{@link`, so a hit found by an address comes back without it. The other half
 * is the marker: an ellipsis on text that was never cut tells a caller to go on
 * reading something that is already complete.
 *
 * 1. Check the address rule accepts every form in use and refuses prose.
 * 2. Cap a tag whose address alone exceeds the budget, and one that fits.
 * 3. Assert the address survives both, and that only a real cut is marked.
 */
export const test_ttscgraph_documentation_address_rule_is_shared_by_index_and_cap =
  (): void => {
    // Addresses: a path with an anchor, an operation, a data model, a qualified
    // symbol, a URL, and an inline link.
    for (const address of [
      "docs/pricing.md#sale",
      "POST:/orders/{orderId}",
      "prisma:Sale.price",
      "Shopping.ISale",
      "https://example.com/spec#part",
      "{@link ISale}",
    ]) {
      assert.strictEqual(
        documentationTarget(`${address} and the reason after it.`),
        address,
        `${address} must be read as an address`,
      );
    }

    // Prose is not. Each of these opens a tag TypeScript does not recognize —
    // `@todo`, `@default`, `@remarks` — and none of them names anything.
    for (const prose of [
      "Add caching here.",
      "4",
      "Uses the cache.",
      "",
      "   ",
    ]) {
      assert.strictEqual(
        documentationTarget(prose),
        undefined,
        `${JSON.stringify(prose)} must not be read as an address`,
      );
    }

    // An unclosed brace group is not a token: falling back to the whitespace
    // split would index `{@link`, which every link in the project shares.
    assert.strictEqual(
      leadingToken("{@link ISale and no closing brace"),
      undefined,
    );
    assert.strictEqual(
      documentationTarget("{@link ISale and no closing brace"),
      undefined,
    );

    // The cap keeps the address whole. This link's group is longer than the
    // 200-character budget and holds spaces, so a cap measuring to the first
    // whitespace would return `{@link` and cut the address away.
    const longAddress = `{@link ${"A".repeat(230)} trailing}`;
    const capped = docTagsOf({
      docTags: [{ name: "evidence", text: `${longAddress} And the reason.` }],
    });
    assert.ok(
      capped?.[0]?.text?.startsWith(longAddress),
      `the address must survive the cap: ${JSON.stringify(capped?.[0]?.text?.slice(0, 40))}`,
    );
    assert.ok(
      capped?.[0]?.text?.endsWith("…"),
      "a text that really was cut must say so",
    );

    // A text that is nothing but an over-long address comes back whole, with no
    // marker: it was not cut.
    const onlyAddress = `docs/${"a".repeat(250)}.md#x`;
    const whole = docTagsOf({
      docTags: [{ name: "evidence", text: onlyAddress }],
    });
    assert.strictEqual(
      whole?.[0]?.text,
      onlyAddress,
      "an uncut text must carry no elision marker",
    );

    // A short text is untouched, and the optional filter narrows without
    // rewriting.
    const both = docTagsOf(
      {
        docTags: [
          { name: "evidence", text: "docs/a.md#x Reason." },
          { name: "reference", text: "https://example.com Other." },
        ],
      },
      (tag) => tag.name === "reference",
    );
    assert.deepStrictEqual(both, [
      { name: "reference", text: "https://example.com Other." },
    ]);
  };
