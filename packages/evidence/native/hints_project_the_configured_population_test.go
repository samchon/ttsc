package evidence

import (
  "strings"
  "testing"
)

// hintsMarkdownConfig cites a Markdown population from TypeScript.
const hintsMarkdownConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "reference":{"type":"markdown","files":["docs/**"],"symbol":["file","h2"]}
}]}`

// hintsSatisfiedSource acknowledges the whole document, so the graph passes.
//
// Every fixture here has to pass, because a corpus exists only for a rule that
// passed. Acknowledging the file target is enough: a target covers itself and
// every selected descendant, so the heading beneath it is discharged too.
const hintsSatisfiedSource = `/**
 * @evidence docs/pricing.md Implements the pricing document.
 */
export interface ISale {
  price: number;
}
`

/**
 * Verifies the corpus carries a selected heading under its exact target.
 *
 * The anchor is what an author cannot reproduce from memory, which is the whole
 * reason to publish a corpus. One listing headings by title rather than by
 * target would look right in an editor and insert something the graph cannot
 * resolve.
 *
 *  1. Satisfy a graph over one document with a selected heading.
 *  2. Take the published corpus.
 *  3. Assert the heading's target is offered with its text alongside.
 */
func TestHintsPublishSelectedHeadings(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  cited := targetHintsAt(hints, "@evidence ")
  if !contains(targetInserts(cited), "docs/pricing.md#sale-price") {
    t.Fatalf(
      "expected the heading target, got:\n%s",
      strings.Join(targetInserts(cited), "\n"),
    )
  }
  for _, hint := range cited {
    if hint.Insert != "docs/pricing.md#sale-price" {
      continue
    }
    if !strings.Contains(hint.Detail, "Sale Price") {
      t.Fatalf("expected the heading text as detail, got %q", hint.Detail)
    }
  }
}

/**
 * Verifies a heading the reference does not select stays out of the corpus.
 *
 * The corpus is a projection of the configured population, so an unselected
 * heading is not a target. Offering one would teach that any completion is
 * citable, and the author's next build would disagree.
 *
 *  1. Select `h2` only, and declare an `h3` beneath the `h2`.
 *  2. Take the published corpus.
 *  3. Assert the `h3` target is absent while the `h2` is present.
 */
func TestHintsOmitUnselectedHeadings(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n\n### Rounding {#rounding}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  inserts := targetInserts(hints)
  if contains(inserts, "docs/pricing.md#rounding") {
    t.Fatalf("an unselected heading must not be offered:\n%s", strings.Join(inserts, "\n"))
  }
  if !contains(inserts, "docs/pricing.md#sale-price") {
    t.Fatalf("the selected heading must be offered:\n%s", strings.Join(inserts, "\n"))
  }
}

/**
 * Verifies headings are offered before file targets.
 *
 * Slice order is the corpus's only ranking channel, and it answers what an
 * author cannot supply from memory. A file path is visible in the project tree;
 * a generated anchor is neither visible nor guessable, so it comes first.
 *
 *  1. Select both the file and its headings.
 *  2. Take the published corpus.
 *  3. Assert the heading precedes the file target.
 */
func TestHintsRankHeadingsBeforeFiles(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  inserts := targetInserts(targetHintsAt(hints, "@evidence "))
  heading := indexOf(inserts, "docs/pricing.md#sale-price")
  file := indexOf(inserts, "docs/pricing.md")
  if heading < 0 || file < 0 {
    t.Fatalf("expected both targets, got:\n%s", strings.Join(inserts, "\n"))
  }
  if heading > file {
    t.Fatalf(
      "headings must be offered before file targets, got:\n%s",
      strings.Join(inserts, "\n"),
    )
  }
}

/**
 * Verifies both tag positions receive the corpus.
 *
 * An exclusion names a target under the same grammar as a citation, so an
 * author writing one needs the same list. A corpus published for `@evidence`
 * alone would help the easy half and abandon the half that has to justify
 * itself in review.
 *
 *  1. Publish a corpus for a satisfied document.
 *  2. Narrow it to each trigger.
 *  3. Assert both carry the same targets.
 */
func TestHintsPublishForBothTagPositions(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  cited := targetInserts(targetHintsAt(hints, "@evidence "))
  excluded := targetInserts(targetHintsAt(hints, "@evidenceExclude "))
  if len(cited) == 0 {
    t.Fatal("expected a corpus at the citation trigger")
  }
  if strings.Join(cited, "\n") != strings.Join(excluded, "\n") {
    t.Fatalf(
      "both triggers must carry the same targets:\n%s\n---\n%s",
      strings.Join(cited, "\n"),
      strings.Join(excluded, "\n"),
    )
  }
}

/**
 * Verifies no trigger can match inside another tag position's line.
 *
 * The host matches a trigger with `strings.LastIndex` against the line prefix,
 * so the positions stay apart only because `After` carries a trailing space: the
 * character following `@evidence` is `E` inside `@evidenceExclude` and `(`
 * inside a relation tag. That is a property of the host's matcher rather than of
 * this code, which is why it is pinned rather than trusted — dropping the space
 * would silently merge the corpora.
 *
 *  1. Take the triggers this package publishes for a graph declaring a relation.
 *  2. Apply the host's matching rule to each tag line.
 *  3. Assert each trigger matches its own line and no other's.
 */
func TestHintsKeepTheTriggersApart(t *testing.T) {
  // Read from the published triggers rather than from literals retyped here.
  // A copy of the strings would keep passing after the trailing space was
  // dropped from the corpus, which is the one change this case exists to
  // catch.
  audiences := evidenceHintAudiences(anchoredGraph("", graphConfig{
    Claims: []claimSpec{{
      References: []referenceSpec{{Policy: referencePolicy{Role: "produces"}}},
    }},
  }))
  lines := map[string]string{}
  for _, audience := range audiences {
    after := audience.Trigger.After
    lines[after] = " * " + strings.TrimSuffix(after, " ") + " "
  }
  if len(lines) != 3 {
    t.Fatalf("expected three distinct triggers, got %d", len(lines))
  }
  for _, audience := range audiences {
    trigger := audience.Trigger.After
    for after, line := range lines {
      matched := strings.LastIndex(line, trigger) >= 0
      if after == trigger && !matched {
        t.Fatalf("trigger %q must match its own line %q", trigger, line)
      }
      if after != trigger && matched {
        t.Fatalf("trigger %q must not match line %q", trigger, line)
      }
    }
  }
}

/**
 * Verifies every published hint is one the host will keep.
 *
 * The host drops a hint with no scope or no `After` rather than offering it
 * everywhere, so a malformed corpus does not fail — it silently shrinks. A
 * count assertion elsewhere would still pass while the entry never reached an
 * editor.
 *
 *  1. Publish a corpus.
 *  2. Inspect every hint's trigger.
 *  3. Assert each carries a scope and an `After` ending where a target begins.
 */
func TestHintsPublishOnlyUsableEntries(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  if len(hints) == 0 {
    t.Fatal("expected a corpus")
  }
  for _, hint := range hints {
    if hint.Trigger.Scope == "" {
      t.Fatalf("hint %q carries no scope", hint.Insert)
    }
    if !strings.HasSuffix(hint.Trigger.After, " ") {
      t.Fatalf("trigger %q must end where the target begins", hint.Trigger.After)
    }
    if hint.Insert == "" {
      t.Fatalf("hint at trigger %q inserts nothing", hint.Trigger.After)
    }
  }
}

/**
 * Verifies Swagger operations rank last and keep their readable form.
 *
 * Selection is exercised directly rather than through the loader, because
 * materializing a Swagger document spawns Node and this assertion is about
 * ranking rather than about parsing. The loader has its own coverage.
 *
 *  1. Build one Markdown heading and one Swagger operation.
 *  2. Project the corpus population.
 *  3. Assert the operation is offered after the heading.
 */
func TestHintsRankSwaggerOperationsLast(t *testing.T) {
  config, problems := decodeGraphConfig([]byte(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"markdown","files":["docs/**"],"symbol":["h2"]},
      {"type":"swagger","file":"openapi.json"}
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("fixture configuration must decode, got:\n%s", strings.Join(problems, "\n"))
  }
  markdown := map[string]*artifactInventory{
    "docs/pricing.md": {
      Path: "docs/pricing.md",
      Type: artifactMarkdown,
      Units: []*evidenceUnit{{
        ID:       "markdown:docs/pricing.md:#sale-price",
        Target:   "docs/pricing.md#sale-price",
        Type:     artifactMarkdown,
        Symbol:   "h2",
        Path:     "docs/pricing.md",
        Line:     1,
        Readable: "Markdown H2 'Sale Price'",
      }},
    },
  }
  swagger := map[string]*artifactInventory{
    "openapi.json": {
      Path: "openapi.json",
      Type: artifactSwagger,
      Units: []*evidenceUnit{{
        ID:       "swagger:openapi.json:POST:/members",
        Target:   "POST:/members",
        Type:     artifactSwagger,
        Symbol:   "operation",
        Path:     "openapi.json",
        Readable: "Swagger operation 'POST /members'",
      }},
    },
  }
  units := selectedCompletionUnits(
    anchoredGraph("", config),
    markdown,
    map[string]*artifactInventory{},
    swagger,
    hintAudience{},
  )
  targets := make([]string, 0, len(units))
  for _, unit := range units {
    targets = append(targets, unit.Target)
  }
  want := "docs/pricing.md#sale-price\nPOST:/members"
  if strings.Join(targets, "\n") != want {
    t.Fatalf("corpus order:\n%s\nwant:\n%s", strings.Join(targets, "\n"), want)
  }
}

func contains(values []string, expected string) bool {
  return indexOf(values, expected) >= 0
}

func indexOf(values []string, expected string) int {
  for index, value := range values {
    if value == expected {
      return index
    }
  }
  return -1
}
