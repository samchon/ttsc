package evidence

import "testing"

const importScopeConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/views/**"],
  "symbol":"function",
  "reference":{"type":"typescript","files":["src/api/**"],"symbol":"function"}
}]}`

/**
 * Verifies a namespace import resolves an inline link target.
 *
 * This is the shape the issue is written around: `import * as api` contributes
 * no segment of its own, so `api.get` means `get` inside the resolved module.
 * Getting that wrong shifts every segment by one and makes the flagship form
 * unusable.
 *
 *  1. Import a module as a namespace and cite one of its callables.
 *  2. Evaluate the graph.
 *  3. Assert no diagnostic at all, so both resolution and coverage succeeded.
 */
func TestGraphResolvesInlineLinkThroughNamespaceImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}

/**
 * Verifies a named import resolves under the name it brings in.
 *
 * A named import contributes its own segment, unlike a namespace import, so the
 * two forms cannot share one code path without one of them resolving against
 * the wrong module member.
 *
 *  1. Import one callable by name and cite it.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 */
func TestGraphResolvesInlineLinkThroughNamedImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type { get } from "./../api/questions.js";

/** @evidence {@link get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}

/**
 * Verifies an aliased import resolves under the exporting module's name.
 *
 * `import { get as fetchQuestion }` is cited as `fetchQuestion`, but the unit in
 * the other module is `get`. Resolving the local spelling would report a
 * perfectly valid citation as unreachable.
 *
 *  1. Import a callable under an alias and cite the alias.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 */
func TestGraphResolvesInlineLinkThroughAliasedImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type { get as fetchQuestion } from "./../api/questions.js";

/** @evidence {@link fetchQuestion} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}

/**
 * Verifies the motivating defect is gone: one leaf name in two modules, cited
 * from two files, resolves both times without ambiguity.
 *
 * A nestia-shaped SDK puts `get` in every resource module, and the old global
 * table reported every citation of either as ambiguous with no rename able to
 * fix it, because the collision is the intended shape of the API. Import-scope
 * resolution starts from a binding in one file, so the two never compete.
 *
 *  1. Declare `get` in two modules and cite each from its own view.
 *  2. Evaluate the graph.
 *  3. Assert silence, and specifically no ambiguity diagnostic.
 */
func TestGraphResolvesSameLeafNameInTwoModules(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/reviews.ts":   "export function get(): void {}\n",
    "src/views/question.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders the question operation. */
export function question(): void {}
`,
    "src/views/review.ts": `
import type * as reviews from "./../api/reviews.js";

/** @evidence {@link reviews.get} Renders the review operation. */
export function review(): void {}
`,
  }, importScopeConfig)
  assertNoProblems(t, messages)
  if countProblemsContaining(messages, "Ambiguous evidence target") != 0 {
    t.Fatalf("the collision the issue exists for was reported as ambiguous")
  }
}

/**
 * Verifies a citation without an import is reported as unimported.
 *
 * This is the defect the whole grammar exists to close: a target that names a
 * symbol the citing module never references is not a reference at all. The
 * diagnostic has to name `import type`, because that is the form which creates
 * no runtime edge.
 *
 *  1. Cite a symbol without importing it.
 *  2. Evaluate the graph.
 *  3. Assert the unimported diagnostic and its repair.
 */
func TestGraphReportsInlineLinkWithoutImport(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "Unimported evidence target '{@link questions.get}'")
  assertProblemContains(t, messages, "'import type' is enough")
}

/**
 * Verifies a specifier that resolves to nothing is reported as such.
 *
 * One property away from the unimported case, and repaired somewhere else
 * entirely: the import exists, the module does not. Folding both into one
 * message would send the author to the wrong file.
 *
 *  1. Import from a module that does not exist and cite through it.
 *  2. Evaluate the graph.
 *  3. Assert the unresolved-module diagnostic names the specifier.
 */
func TestGraphReportsInlineLinkWithDanglingSpecifier(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as missing from "./../api/absent.js";

/** @evidence {@link missing.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "Unresolved module './../api/absent.js'")
}

/**
 * Verifies a segment the module does not declare is reported as unreachable.
 *
 * The import resolved and the module exists, so the repair is the target text
 * or the reference selection — the diagnostic names both the module it landed
 * in and the name it looked for, since neither is obvious from the citation.
 *
 *  1. Import a real module and cite a member it does not declare.
 *  2. Evaluate the graph.
 *  3. Assert the unreachable diagnostic names the module and the missing name.
 */
func TestGraphReportsInlineLinkWithUnreachableSegment(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.erase} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "src/api/questions.ts' declares no selected unit named 'erase'")
}

/**
 * Verifies an unbraced TypeScript target gets the migration diagnostic.
 *
 * The old spelling still resolves to a real unit, so a bare "unresolved" would
 * be actively misleading — the target is correct and only its form is not. The
 * message names the exact replacement, in the style the retired `sources` and
 * `citedBy` properties already use.
 *
 *  1. Cite a real symbol without braces from a TypeScript claim.
 *  2. Evaluate the graph.
 *  3. Assert the migration diagnostic spells the inline link form.
 */
func TestGraphReportsUnbracedTypeScriptTargetAsMigration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence get Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "Unbraced TypeScript evidence target 'get'")
  assertProblemContains(t, messages, "'@evidence {@link get} <reason>'")
}

/**
 * Verifies a Markdown path target is untouched by the migration branch.
 *
 * The negative twin that keeps the migration diagnostic from swallowing every
 * unbraced target in the repository. A Markdown address never becomes an inline
 * link, so it must never be told to.
 *
 *  1. Cite a Markdown heading from a TypeScript claim, unbraced.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 */
func TestGraphKeepsMarkdownTargetsUnbraced(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/views/detail.ts": `
/** @evidence docs/spec.md#pricing Renders the documented price. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`))
}

/**
 * Verifies a bare symbol in Markdown still cannot identify a code module.
 *
 * File-qualified links enable this population without restoring the old
 * repository-wide name lookup. An unqualified symbol remains an error.
 *
 *  1. Configure a Markdown claim over a TypeScript reference.
 *  2. Evaluate the graph.
 *  3. Assert the bare citation is rejected and the file-qualified repair named.
 */
func TestGraphRefusesCodeEvidenceToAClaimThatCannotAddressIt(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "docs/spec.md":         "<!-- @evidence get Documents this operation. -->\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/spec.md"],
    "symbol":"file",
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Code evidence target 'get'")
  assertProblemContains(t, messages, "@link")
  assertProblemContains(t, messages, "Missing acknowledgement")
}

/**
 * Verifies a Markdown claim is told why it cannot use an inline link.
 *
 * A braced target in Markdown would otherwise fall through to a resolver that
 * has nothing to resolve against, and the author needs to hear the reason
 * rather than a generic failure.
 *
 * The reference here is Markdown rather than TypeScript, and deliberately so:
 * a TypeScript reference is now refused to this claim at configuration decode,
 * and that rejection happens to carry the same sentence. The case would have
 * kept passing while testing nothing — so the fixture cites a document, where
 * the braced form is still the author's mistake to hear about.
 *
 *  1. Cite a Markdown section from a Markdown claim, braced.
 *  2. Evaluate the graph.
 *  3. Assert the explanatory rejection names the inline link itself.
 */
func TestGraphRejectsInlineLinksInMarkdownClaims(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":   "## Pricing {#pricing}\n",
    "docs/reader.md": "<!-- @evidence {@link pricing} Documents this section. -->\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/reader.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Inline link target '{@link pricing}'")
  assertProblemContains(t, messages, "a markdown comment has none")
}

/**
 * Verifies one name in two declaration spaces of one module is reported rather
 * than silently resolved.
 *
 * A file may legally declare an interface and a callable under one name.
 * Resolution lands in the right file and still cannot say which unit was meant,
 * and picking one silently would acknowledge an obligation the author never
 * cited — the coverage would look complete while a real unit went unclaimed.
 *
 *  1. Declare a type and a callable of the same name in one module.
 *  2. Select both kinds as evidence and cite the name once.
 *  3. Assert the ambiguity is reported against that module.
 */
func TestGraphReportsAmbiguityWithinOneResolvedModule(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": `
export interface get {
  id: string;
}
export function get(): void {}
`,
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":["type","function"]}
  }]}`)
  assertProblemContains(t, messages, "Ambiguous evidence target '{@link questions.get}'")
}
