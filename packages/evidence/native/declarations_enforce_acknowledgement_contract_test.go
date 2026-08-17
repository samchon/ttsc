package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies declaration validation: malformed, unresolved, and conflicting
 * acknowledgements receive distinct actionable diagnostics.
 *
 * These failures share one tag grammar but have different repairs. Collapsing
 * them into "not covered" would hide whether the author must add a reason,
 * correct a target, or remove a contradictory acknowledgement.
 *
 *  1. Add one valid declaration and three adjacent invalid declarations.
 *  2. Evaluate them against one configured source unit.
 *  3. Assert each failure class is reported without losing coverage.
 */
func TestDeclarationsReportMalformedUnresolvedAndConflictingCases(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.md#contract Primary acknowledgement. */
export interface Primary {}

/** @evidence docs/spec.md#contract */
export interface MissingReason {}

/** @evidence docs/spec.md#unknown This target does not exist. */
export interface Unknown {}

/** @evidenceExclude docs/spec.md#contract This contradicts the implementation acknowledgement. */
export interface Conflict {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration")
  // The warning is a constant appended outside the literal, and asserting the
  // joint through the constant itself is what catches its name slipping
  // inside the quotes — where the message leaked '.+untrueTagWarning' and
  // dropped the warning from the one diagnostic class most likely to be
  // repaired by writing a hasty tag.
  assertProblemContains(t, messages, "Write '@evidence <target> <reason>'."+untrueTagWarning)
  if strings.Contains(strings.Join(messages, "\n"), "+untrueTagWarning") {
    t.Fatalf("a diagnostic leaked a constant's name:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Unresolved evidence target 'docs/spec.md#unknown'")
  assertProblemContains(t, messages, "Conflicting acknowledgements for 'docs/spec.md#contract'")
  if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
    t.Fatalf("the valid primary declaration did not cover the unit:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies JSDoc grammar boundaries: a later JSDoc tag cannot become the
 * missing reason of an evidence declaration.
 *
 * Reasons may wrap across prose lines, but `@returns`, `@example`, and other
 * tags begin new JSDoc fields. Treating one as prose would accept a declaration
 * whose mandatory explanation is still absent.
 *
 *  1. Write an `@evidence` target without a reason.
 *  2. Follow it with an unrelated JSDoc tag.
 *  3. Assert the declaration remains malformed.
 */
func TestDeclarationReasonStopsAtTheNextJSDocTag(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/**
 * @evidence docs/spec.md#contract
 * @returns Nothing.
 */
export function ref(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration")
  assertProblemContains(t, messages, "Missing acknowledgement")
}

/**
 * Verifies Markdown explanation prose is not constrained by JSDoc tag
 * boundaries.
 *
 * A line beginning with `@` starts a new field in JSDoc, but an HTML comment
 * has no such grammar. The same parser handles both hosts, so it must preserve
 * an at-prefixed Markdown reason while still stopping at real JSDoc tags.
 *
 *  1. Put a Markdown declaration target on one line.
 *  2. Begin its explanation with an at-prefixed approval marker on the next.
 *  3. Assert the non-empty explanation satisfies coverage.
 */
func TestMarkdownDeclarationReasonMayBeginWithAtSign(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "docs/ref.md": `<!--
@evidence docs/spec.md#contract
@architecture approved this adoption.
-->
`,
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies Markdown declaration paths accept Windows separators without
 * normalizing unrelated TypeScript symbol names.
 *
 * Markdown units have canonical project-relative paths with slash separators,
 * but declarations are authored on both Windows and POSIX. Path portability is
 * therefore a Markdown resolution concern, not a global target rewrite.
 *
 *  1. Materialize one canonical Markdown heading target.
 *  2. Cite it from TypeScript with backslash path separators.
 *  3. Assert the declaration resolves and satisfies coverage.
 */
func TestMarkdownTargetsAcceptWindowsPathSeparators(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs\spec.md#contract This type adopts the portable document path. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies multiline Markdown declarations report the tag's line rather than
 * the opening HTML comment's line.
 *
 * Declaration locations are part of the repair path. Trimming the comment body
 * before parsing erases its leading newline and points the diagnostic at
 * `<!--`, which is especially misleading when several declarations share one
 * comment.
 *
 *  1. Put a reasonless declaration one line after an HTML comment opens.
 *  2. Trigger the malformed-declaration diagnostic.
 *  3. Assert its location identifies the actual tag line.
 */
func TestMarkdownDeclarationPreservesMultilineTagLocation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "docs/ref.md": `# Claim
<!--
@evidence docs/spec.md#contract
-->
`,
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"h1",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration at docs/ref.md:3")
}

/**
 * Verifies declaration identity includes the artifact discriminator.
 *
 * One project path may deliberately be interpreted by separate configured
 * artifact variants. A path, line, and sequence alone would let a Markdown
 * declaration overwrite a TypeScript declaration when graph evaluation
 * deduplicates declarations globally.
 *
 *  1. Scan a Markdown and TypeScript declaration at the same path and line.
 *  2. Compare their internal declaration identities.
 *  3. Assert the artifact-specific identities remain distinct.
 */
func TestDeclarationIdentitySeparatesArtifactVariants(t *testing.T) {
  markdown, problems := scanProjectMarkdown(
    "src/mixed.ts",
    "<!-- @evidence Shared Markdown reason. -->\n",
  )
  if len(problems) != 0 {
    t.Fatalf("unexpected Markdown scan problems: %v", problems)
  }
  typescript := parseTypeScriptInventory(
    t,
    "src/mixed.ts",
    "/** @evidence Shared TypeScript reason. */\nexport interface Ref {}\n",
  )
  if len(markdown.Declarations) != 1 || len(typescript.Declarations) != 1 {
    t.Fatalf(
      "declaration counts = Markdown %d, TypeScript %d",
      len(markdown.Declarations),
      len(typescript.Declarations),
    )
  }
  if markdown.Declarations[0].ID == typescript.Declarations[0].ID {
    t.Fatalf("artifact declarations shared identity %q", markdown.Declarations[0].ID)
  }
}

/**
 * Verifies TypeScript declarations retain source order when byte offsets cross
 * a decimal digit boundary.
 *
 * JSDoc ranges are deduplicated through position keys. Sorting those keys as
 * strings places offset 100 before offset 20 and makes a later duplicate appear
 * to be the first acknowledgement in diagnostics.
 *
 *  1. Put one declaration below offset 20 and another beyond offset 100.
 *  2. Scan the TypeScript inventory.
 *  3. Assert declaration order follows numeric source positions.
 */
func TestTypeScriptDeclarationsKeepNumericSourceOrder(t *testing.T) {
  inventory := parseTypeScriptInventory(
    t,
    "src/ref.ts",
    `export const pad = 1;
/** @evidence First The first declaration. */
export interface FirstRef {}










/** @evidence Second The second declaration. */
export interface SecondRef {}
`,
  )
  if len(inventory.Declarations) != 2 {
    t.Fatalf("declaration count = %d", len(inventory.Declarations))
  }
  if inventory.Declarations[0].Target != "First" ||
    inventory.Declarations[1].Target != "Second" {
    t.Fatalf(
      "declaration order = %q, %q",
      inventory.Declarations[0].Target,
      inventory.Declarations[1].Target,
    )
  }
}

/**
 * Verifies a claim that cannot address code does not reach a symbol through
 * another claim's reference.
 *
 * This replaces a case asserting that a plain-token code target from Markdown
 * is ambiguous when two files export one name (upstream lint-plugin-evidence#82). That hazard is gone
 * by construction — such a claim cannot declare a TypeScript reference at all —
 * but the configuration guard alone did not finish the job, and what it left
 * was silent. Addresses are indexed from every claim at once, so a Markdown
 * claim citing a document could still land on a symbol some OTHER claim's
 * TypeScript reference had materialized. Measured before the fix: it resolved
 * and reported nothing, which left repository-wide symbol-name uniqueness
 * load-bearing through a door the guard does not cover.
 *
 * The message must not be "unresolved", which would be true and useless: the
 * unit exists, and the author needs to hear why naming it here cannot work.
 *
 *  1. Configure a TypeScript claim over TypeScript, and a Markdown claim over
 *     Markdown, in one graph.
 *  2. Cite the code symbol by plain token from the Markdown claim.
 *  3. Assert it is refused, naming the citing artifact and the repair.
 */
func TestDeclarationsRefuseCodeTargetsFromAnotherClaimsReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": "export interface Shared {}\n",
    "src/claim.ts": `import type { Shared } from "./contracts";

/** @evidence {@link Shared} The code cites its own reference. */
export interface IClaim {}
`,
    "docs/spec.md": "## Pricing {#pricing}\n",
    "docs/ref.md": `<!-- @evidence docs/spec.md#pricing This document relies on the section. -->
<!-- @evidence Shared This document relies on the shared type. -->
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"type",
      "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"type"}
    },
    {
      "type":"markdown",
      "files":["docs/ref.md"],
      "symbol":"file",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }
  ]}`)
  assertProblemContains(t, messages, "Code evidence target 'Shared'")
  assertProblemContains(t, messages, "a markdown claim cannot cite a TypeScript symbol")
  assertProblemContains(t, messages, "Invert the obligation")
}

/**
 * Verifies duplicate Markdown anchors remain distinct source units and make a
 * declaration target ambiguous.
 *
 * Generated or explicit anchors can repeat inside one document. Collapsing
 * them by target would let one declaration silently acknowledge two different
 * sections and make heading order decide which source prose the edge means.
 *
 *  1. Give two selected headings the same explicit anchor.
 *  2. Cite that path-and-anchor target once.
 *  3. Assert resolution reports both sections as ambiguous.
 */
func TestDeclarationsRejectDuplicateMarkdownAnchors(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## First {#shared}
## Second {#shared}
`,
    "src/ref.ts": `
/** @evidence docs/spec.md#shared This target cannot choose a section. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Ambiguous evidence target 'docs/spec.md#shared'")
  assertProblemContains(t, messages, "Markdown H2 'First'")
  assertProblemContains(t, messages, "Markdown H2 'Second'")
}

/**
 * Verifies claim host scope: a resolvable declaration on an unselected
 * symbol kind does not satisfy coverage.
 *
 * Resolution and host eligibility are separate checks. Treating every JSDoc
 * tag in a matched file as valid would make a property-only claim selector
 * indistinguishable from the all-symbol default.
 *
 *  1. Select only TypeScript property hosts and materialize one such host.
 *  2. Put a valid target on a neighboring exported function.
 *  3. Assert both the out-of-scope host and missing acknowledgement.
 */
func TestDeclarationsRejectOutOfScopeSymbolHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.md#contract This function is outside the selected host kind. */
export function ref(): void {}
export const selectedProperty = true;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Out-of-scope @evidence host")
  assertProblemContains(t, messages, "host kind 'function' is not selected")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}

/**
 * Verifies TypeScript claim defaults: type, function, and qualified
 * property hosts all accept evidence declarations when symbol is omitted.
 *
 * The claim default is the union of all supported kinds, unlike the source
 * default. This complete graph proves each host can fire rather than trusting a
 * quiet rule with only one declaration shape.
 *
 *  1. Materialize three Markdown headings.
 *  2. Cite them from an interface, function, and interface property.
 *  3. Assert the omitted claim selector accepts every host kind.
 */
func TestTypeScriptClaimDefaultAcceptsEverySymbolKind(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Type
## Function
## Property
`,
    "src/ref.ts": `
/** @evidence docs/spec.md#type The type adopts this section. */
export interface Ref {
  /** @evidence docs/spec.md#property The property adopts this section. */
  value: string;
}

/** @evidence docs/spec.md#function The function adopts this section. */
export function execute(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
