package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the rule fires on an undocumented export and names the reason.
 *
 * The anchor case. The diagnostic has to say why a missing block matters, or a
 * reader treats it as a style preference and disables it — the point is that a
 * declaration without a block has nowhere to put a citation at all.
 *
 *  1. Export one function with no JSDoc.
 *  2. Run the rule with the default selection.
 *  3. Assert the finding names the declaration and the consequence.
 */
func TestDocumentedReportsUndocumentedExport(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
  assertReported(t, messages, "only ever read from a JSDoc block")
}

/**
 * Verifies the negative twin: a documented export is silent.
 *
 * Without it the case above is equally satisfied by a rule that reports every
 * declaration it sees.
 *
 *  1. Export the same function with a JSDoc block.
 *  2. Run the rule with the default selection.
 *  3. Assert silence.
 */
func TestDocumentedAcceptsDocumentedExport(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
/** Normalizes a raw input value. */
export function parse(value: string): string {
  return value;
}
`, ""))
}

/**
 * Verifies a block holding only a tag counts as content.
 *
 * The rule checks presence, never prose quality. A citation with no prose
 * around it is a complete JSDoc block for this rule's purpose, and reporting it
 * would push authors to pad blocks to satisfy a linter.
 *
 *  1. Document an export with nothing but an `@evidence` tag.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedAcceptsTagOnlyBlocks(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
/** @evidence docs/spec.md#parse Implements the documented normalization. */
export function parse(value: string): string {
  return value;
}
`, ""))
}

/**
 * Verifies an empty block gets its own diagnostic.
 *
 * A block with neither prose nor tag satisfies nothing, but reporting it as
 * "missing" would confuse a reader looking straight at one. The separate
 * message also keeps the emptiness check visibly structural rather than a
 * judgment about what was written.
 *
 *  1. Document an export with an empty block.
 *  2. Run the rule.
 *  3. Assert the emptiness message rather than the missing one.
 */
func TestDocumentedReportsEmptyBlocks(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/** */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Empty JSDoc on exported function 'parse'")
}

/**
 * Verifies a whitespace-and-asterisk block is empty too.
 *
 * A multi-line block whose lines hold only the leading asterisk looks
 * substantial in a diff and says nothing, so the emptiness check has to strip
 * the same decoration the tag parser does.
 *
 *  1. Document an export with a multi-line block of bare asterisks.
 *  2. Run the rule.
 *  3. Assert the emptiness message.
 */
func TestDocumentedTreatsAsteriskOnlyBlocksAsEmpty(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/**
 *
 */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Empty JSDoc on exported function 'parse'")
}

/**
 * Verifies a line comment does not satisfy the rule.
 *
 * This is the rule's correctness constraint made observable: what it accepts
 * must equal what the tag collector can see. A tag written in a `//` comment is
 * unreadable to the graph, which reports it rather than acting on it, so
 * accepting one here would certify a declaration that can still never cite
 * anything.
 *
 *  1. Precede an export with a line comment carrying a citation.
 *  2. Run the rule.
 *  3. Assert the export is still reported as missing a block.
 */
func TestDocumentedRejectsLineComments(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
// @evidence docs/spec.md#parse The graph reports this tag rather than reading it.
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
}

/**
 * Verifies a detached block comment does not satisfy the rule.
 *
 * The twin of the line-comment case one syntax away: a `/* *\/` block that is
 * not a JSDoc block is equally unreadable to the tag collector.
 *
 *  1. Precede an export with a non-JSDoc block comment.
 *  2. Run the rule.
 *  3. Assert the export is still reported.
 */
func TestDocumentedRejectsNonJsdocBlockComments(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/* @evidence docs/spec.md#parse The graph reports this tag rather than reading it. */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
}

/**
 * Verifies non-exported declarations are never required to be documented.
 *
 * The rule is about the public surface. Demanding a block on every local helper
 * would make the rule unusable in the implementation files it is meant to
 * protect.
 *
 *  1. Declare two undocumented local helpers beside one documented export.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedIgnoresNonExportedDeclarations(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
const cache = new Map<string, string>();
function normalize(value: string): string {
  return value.trim();
}
/** Normalizes a raw input value. */
export function parse(value: string): string {
  return normalize(value) + cache.size;
}
`, ""))
}

/**
 * Verifies one block on a variable statement documents every binding it
 * declares.
 *
 * TypeScript attaches a variable's leading JSDoc to the statement wrapper, not
 * to each declaration, so a rule checking declarations directly would report
 * every documented `export const` in existence.
 *
 *  1. Document one statement declaring two exported bindings.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedAcceptsOneBlockForAVariableStatement(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/limits.ts", `
/** Ceilings applied to a single order. */
export const maximumItems = 10,
  maximumCoupons = 2;
`, ""))
}

/**
 * Verifies the variable branch still fires when the block is absent.
 *
 * The twin of the case above: skipping the declaration nodes must not turn into
 * skipping variables altogether, which would silently exempt every exported
 * constant in a project.
 *
 *  1. Export two bindings from one undocumented statement.
 *  2. Run the rule.
 *  3. Assert one finding naming both bindings.
 */
func TestDocumentedReportsUndocumentedVariableStatements(t *testing.T) {
  messages := runDocumentedRule(t, "src/limits.ts", `
export const maximumItems = 10,
  maximumCoupons = 2;
`, "")
  if len(messages) != 1 {
    t.Fatalf("expected one finding, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReported(t, messages, "'maximumItems', 'maximumCoupons'")
}

/**
 * Verifies interface properties are selected by default.
 *
 * A property is a claim host, so it belongs to the population that must be able
 * to carry a tag. Leaving it out of the default would let a property be
 * obligated by the graph while this rule reported the file as fine.
 *
 *  1. Document an interface but leave one property bare.
 *  2. Run the rule with the default selection.
 *  3. Assert the property is reported.
 */
func TestDocumentedSelectsInterfacePropertiesByDefault(t *testing.T) {
  messages := runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
  price: number;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported property 'ISale.price'")
}

/**
 * Verifies the symbol selector narrows the population.
 *
 * Adoption in an existing project depends on this: a team documents types
 * first, then callables, then properties. A selector that silently kept the
 * default would make that impossible and get the rule switched off entirely.
 *
 *  1. Leave an interface property and an exported function undocumented.
 *  2. Select only `type`.
 *  3. Assert neither is reported while the documented type stays silent.
 */
func TestDocumentedNarrowsToTheSelectedSymbolKinds(t *testing.T) {
  source := `
/** A sale offered to a customer. */
export interface ISale {
  price: number;
}
export function total(sale: ISale): number {
  return sale.price;
}
`
  assertSilent(t, runDocumentedRule(t, "src/ISale.ts", source, `{"symbol":"type"}`))
  assertReported(
    t,
    runDocumentedRule(t, "src/ISale.ts", source, `{"symbol":"function"}`),
    "Missing JSDoc on exported function 'total'",
  )
}

/**
 * Verifies an unknown option is rejected rather than ignored.
 *
 * A misspelled property that decodes to the zero value silently restores the
 * default selection, so a project believing it narrowed the rule would be
 * running the widest form. The decoder has to refuse it.
 *
 *  1. Configure a misspelled option key.
 *  2. Run the rule.
 *  3. Assert a configuration diagnostic instead of a scan.
 */
func TestDocumentedRejectsUnknownOptions(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbols":"type"}`)
  assertReported(t, messages, "unknown property")
}

/**
 * Verifies an unsupported symbol value is rejected.
 *
 * The Markdown vocabulary shares the option shape, so `h2` decodes cleanly as a
 * string and would otherwise select nothing at all — a rule that silently
 * checks an empty population.
 *
 *  1. Configure a Markdown symbol on a TypeScript rule.
 *  2. Run the rule.
 *  3. Assert the value is named as unsupported.
 */
func TestDocumentedRejectsUnsupportedSymbolValues(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbol":"h2"}`)
  assertReported(t, messages, "symbol 'h2' is not supported")
}
