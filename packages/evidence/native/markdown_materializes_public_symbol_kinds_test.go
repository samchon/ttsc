package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies Markdown materialization: file and H1-H4 units receive the target
 * identities documented by TtscEvidenceGraphMarkdownSymbol.
 *
 * Heading level and anchor are separate pieces of the contract. This fixture
 * includes explicit, generated, duplicate-capable, and unsupported levels so a
 * broad line matcher cannot accidentally turn every heading into evidence.
 *
 *  1. Scan one document containing H1 through H5.
 *  2. Collect every materialized target and declaration host.
 *  3. Assert file/H1-H4 identities and reject H5 as an eligible host.
 */
func TestMarkdownMaterializesFileAndHeadingKinds(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/spec.md", `<!-- @evidence docs/source.md File host. -->
# Product Overview
<!-- @evidence docs/source.md#one H1 host. -->
## Create Order {#create}
<!-- @evidence docs/source.md#two H2 host. -->
### Retry Policy
<!-- @evidence docs/source.md#three H3 host. -->
#### Audit Trail
<!-- @evidence docs/source.md#four H4 host. -->
##### Internal Notes
<!-- @evidence docs/source.md#five H5 host. -->
`)
  if len(problems) != 0 {
    t.Fatalf("unexpected Markdown scan problems: %v", problems)
  }
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  wantTargets := []string{
    "docs/spec.md",
    "docs/spec.md#audit-trail",
    "docs/spec.md#create",
    "docs/spec.md#product-overview",
    "docs/spec.md#retry-policy",
  }
  sort.Strings(wantTargets)
  if strings.Join(targets, "\n") != strings.Join(wantTargets, "\n") {
    t.Fatalf("Markdown targets:\n%s\nwant:\n%s", strings.Join(targets, "\n"), strings.Join(wantTargets, "\n"))
  }
  hosts := []string{}
  for _, declaration := range inventory.Declarations {
    hosts = append(hosts, declaration.Hosts.names())
  }
  if got := strings.Join(hosts, ","); got != "file,h1,h2,h3,h4,h5" {
    t.Fatalf("Markdown declaration hosts = %q", got)
  }
}

/**
 * Verifies Markdown defaults: an omitted source and claim symbol selector
 * covers the file plus every resident H1-H4 unit.
 *
 * A quiet result is meaningful only when every default unit actually had to be
 * acknowledged. The fixture cites the file ancestor once so every resident
 * default unit must participate in its scope.
 *
 *  1. Omit both Markdown symbol selectors.
 *  2. Acknowledge the file containing four heading levels.
 *  3. Assert the complete default graph is green.
 */
func TestMarkdownDefaultsSelectEverySupportedResidentKind(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `# Product
## Create
### Validate
#### Persist
`,
    "refs/ledger.md": `<!-- @evidence docs/spec.md The whole specification is adopted. -->
`,
  }, `{"claims":[{
    "type":"markdown",
    "files":["refs/ledger.md"],
    "reference":{"type":"markdown","files":["docs/spec.md"]}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies exclusion position independence: moving an exclusion between two
 * eligible Markdown hosts leaves the acknowledged source unit unchanged.
 *
 * The exclusion belongs to the claim group, not to the heading where the
 * author happened to record it. Both placements remain subject to the H2 host
 * selector, while their host identity cannot alter coverage.
 *
 *  1. Place one exclusion under the first selected H2 host.
 *  2. Move the same exclusion under a second selected H2 host.
 *  3. Assert both graphs satisfy the same source unit.
 */
func TestMarkdownExclusionIsPositionIndependentAcrossEligibleHosts(t *testing.T) {
  config := `{"claims":[{
    "type":"markdown",
    "files":["refs/ledger.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`
  for name, ledger := range map[string]string{
    "first": `## First host
<!-- @evidenceExclude docs/spec.md#contract This ledger intentionally does not implement the contract. -->
## Second host
`,
    "second": `## First host
## Second host
<!-- @evidenceExclude docs/spec.md#contract This ledger intentionally does not implement the contract. -->
`,
  } {
    t.Run(name, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md":   "## Contract\n",
        "refs/ledger.md": ledger,
      }, config)
      assertNoProblems(t, messages)
    })
  }
}

/**
 * Verifies Markdown scan diagnostics stay inside the configured source
 * population and symbol selection.
 *
 * The project walk sees claim documents and unrelated repository Markdown,
 * and a heading needs a resolvable anchor only where some declared population
 * reads it. Both sides ask that question now, so the boundary is each
 * population's own `files` globs and its own symbol set rather than the
 * distinction between a claim and a reference. Reporting every malformed
 * heading would make the globs stop being a real boundary.
 *
 *  1. Put an empty H2 in the source file, claim file, and unrelated file.
 *  2. Select only H1 source units and assert the graph ignores all empty H2s.
 *  3. Select H2 source units and assert only the configured source is reported.
 */
func TestMarkdownProblemsRespectSourceFilesAndSymbols(t *testing.T) {
  files := map[string]string{
    "docs/source.md": "# Selected\n##\n",
    "docs/ref.md":    "<!-- @evidence docs/source.md#selected The claim adopts the H1. -->\n##\n",
    "notes/other.md": "##\n",
  }
  h1Messages := runIndexRule(t, files, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h1"}
  }]}`)
  assertNoProblems(t, h1Messages)

  h2Messages := runIndexRule(t, files, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h2"}
  }]}`)
  if got := countProblemsContaining(h2Messages, "has no resolvable anchor"); got != 1 {
    t.Fatalf("source-scoped Markdown problems = %d: %s", got, strings.Join(h2Messages, "\n"))
  }
  assertProblemContains(t, h2Messages, "docs/source.md:2")
}

/**
 * Verifies Markdown syntax boundaries: heading-shaped text inside fenced code
 * and HTML comments does not become an evidence section.
 *
 * Evidence units follow rendered Markdown structure, not lines that merely
 * begin with hash characters. Both constructs commonly contain examples whose
 * accidental indexing would create obligations no reader can navigate to.
 *
 *  1. Put fake H2 lines inside a code fence and a multiline HTML comment.
 *  2. Put one real H2 after both constructs.
 *  3. Assert only the real heading materializes.
 */
func TestMarkdownIgnoresHeadingsInsideCodeAndComments(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/spec.md", `# Product
`+"```md"+`
## Fenced
`+"```ts"+`
## Still fenced
`+"```"+`
<!--
## Commented
-->
## Real
`)
  if len(problems) != 0 {
    t.Fatalf("unexpected Markdown scan problems: %v", problems)
  }
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  if got := strings.Join(targets, "\n"); got != strings.Join([]string{
    "docs/spec.md",
    "docs/spec.md#product",
    "docs/spec.md#real",
  }, "\n") {
    t.Fatalf("Markdown syntax boundaries produced:\n%s", got)
  }
}

/**
 * Verifies the Markdown discriminator, not a hard-coded file extension,
 * determines which configured files are parsed as Markdown.
 *
 * The public contract accepts project-relative globs and never narrows them to
 * `.md`. Repositories may use `.markdown` or extensionless documentation, so a
 * matching configured file must not disappear before glob evaluation.
 *
 *  1. Configure a `.markdown` source file explicitly.
 *  2. Acknowledge its H2 unit from TypeScript.
 *  3. Assert the non-`.md` document participates in the graph.
 */
func TestMarkdownSelectionDoesNotHardcodeFileExtension(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.markdown": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.markdown#contract This type adopts the contract. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.markdown"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies generated anchors follow the documented Unicode and punctuation
 * normalization rather than an ASCII-only shortcut.
 *
 * International headings are ordinary evidence units. Dropping their letters
 * would produce an empty or unrelated target, while retaining punctuation
 * would contradict the public slug grammar and make citations unpredictable.
 *
 *  1. Generate slugs from Korean, accented Latin, punctuation, and whitespace.
 *  2. Compare the result with the public normalization rules.
 *  3. Assert meaningful letters remain and separators collapse once.
 */
func TestMarkdownGeneratedAnchorsPreserveUnicodeLetters(t *testing.T) {
  cases := map[string]string{
    "주문 생성 정책":          "주문-생성-정책",
    "Résumé / Café":     "résumé-café",
    "Create---  Order!": "create-order",
    "snake_case value":  "snake_case-value",
  }
  for heading, expected := range cases {
    if actual := markdownSlug(heading); actual != expected {
      t.Errorf("markdownSlug(%q) = %q, want %q", heading, actual, expected)
    }
  }
}

/**
 * Verifies whitespace-bearing Markdown paths fail with the target grammar's
 * real repair instead of producing an impossible missing acknowledgement.
 *
 * Evidence targets are one whitespace-delimited token. A source path containing
 * spaces cannot be written in `@evidence <target> <reason>`, so materializing it
 * would create an obligation no declaration can ever satisfy.
 *
 *  1. Select a Markdown file whose project-relative path contains a space.
 *  2. Evaluate it as an H2 evidence source.
 *  3. Assert the rule asks for a rename and suppresses the generic no-unit error.
 */
func TestMarkdownSourceRejectsWhitespaceInTargetPaths(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/my spec.md": "## Contract\n",
    "src/ref.ts":      "export interface Ref {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/my spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "path contains whitespace")
  if countProblemsContaining(messages, "materialized no selected evidence units") != 0 {
    t.Fatalf("generic materialization diagnostic hid the path repair: %v", messages)
  }
}
