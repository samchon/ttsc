package evidence

import (
  "strings"
  "testing"
)

const acknowledgementIntentConfig = `{"claims":[{
  "name":"contracts",
  "type":"typescript",
  "files":["src/*.ts"],
  "symbol":"function",
  "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
}]}`

/**
 * Verifies positive evidence is a many-to-many relation between declaration
 * hosts and evidence scopes.
 *
 * One requirement may need success, refusal, and boundary implementations. A
 * broad implementation may also realize a requirement family while the same
 * or another host realizes one child rule. Neither shape is a duplicate.
 *
 *  1. Cite one target from two declaration hosts.
 *  2. Overlap parent and child scopes across different and identical hosts.
 *  3. Assert every positive graph remains valid.
 */
func TestEvidenceAcrossDeclarationHostsMayShareOrOverlapScopes(t *testing.T) {
  cases := map[string]map[string]string{
    "same target across hosts": {
      "docs/spec.md": "## Contract {#contract}\n",
      "src/first.ts": `/** @evidence docs/spec.md#contract Proves the success path. */
export function first(): void {}
`,
      "src/second.ts": `/** @evidence docs/spec.md#contract Proves the refusal path. */
export function second(): void {}
`,
    },
    "parent and child across hosts": {
      "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
      "src/parent.ts": `/** @evidence docs/spec.md#contract Implements the complete contract. */
export function parent(): void {}
`,
      "src/child.ts": `/** @evidence docs/spec.md#validation Implements validation. */
export function child(): void {}
`,
    },
    "parent and child on one host": {
      "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
      "src/claim.ts": `/**
 * @evidence docs/spec.md#contract Implements the complete contract.
 * @evidence docs/spec.md#validation Implements its validation rule.
 */
export function claim(): void {}
`,
    },
  }
  for name, files := range cases {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runIndexRule(t, files, acknowledgementIntentConfig))
    })
  }

  t.Run("same target across merged identity declarations", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/** @evidence docs/spec.md#contract Defines the contract shape. */
export interface Claim {}

/** @evidence docs/spec.md#contract Defines the contract namespace. */
export namespace Claim {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }]}`)
    assertNoProblems(t, messages)
  })
}

/**
 * Verifies one declaration host cannot repeat one resolved positive scope.
 *
 * Duplicate spelling is not the boundary: aliases can resolve to the same
 * TypeScript unit, and separate JSDoc blocks can attach to one declaration.
 * Both still express one edge whose useful reasons must be combined.
 *
 *  1. Repeat one target in a single JSDoc block and across two blocks.
 *  2. Cite one TypeScript unit through two local import names.
 *  3. Assert each later edge is reported once with its canonical target.
 */
func TestSameDeclarationHostRejectsRepeatedResolvedEvidenceScope(t *testing.T) {
  t.Run("one JSDoc block", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/**
 * @evidence docs/spec.md#contract Implements the contract.
 * @evidence docs/spec.md#contract Repeats the same claim.
 */
export function claim(): void {}
`,
    }, acknowledgementIntentConfig)
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })

  t.Run("separate JSDoc blocks", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/** @evidence docs/spec.md#contract Implements the contract. */
/** @evidence docs/spec.md#contract Repeats the same claim. */
export function claim(): void {}
`,
    }, acknowledgementIntentConfig)
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })

  t.Run("two aliases for one resolved scope", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "src/api.ts": "export function get(): void {}\n",
      "src/claim.ts": `import type { get, get as fetchContract } from "./api.js";

/**
 * @evidence {@link get} Implements the operation.
 * @evidence {@link fetchContract} Repeats the same resolved operation.
 */
export function claim(): void {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"function",
      "reference":{"type":"typescript","files":["src/api.ts"],"symbol":"function"}
    }]}`)
    assertSingleEvidenceDuplicate(t, messages, "get")
  })
}

func assertSingleEvidenceDuplicate(t *testing.T, messages []string, target string) {
  t.Helper()
  if got := countProblemsContaining(messages, "Duplicate @evidence for '"+target+"'"); got != 1 {
    t.Fatalf("same-host duplicate produced %d findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "on the same host at ")
  assertProblemContains(t, messages, "; first declared at ")
  if countProblemsContaining(messages, "Conflicting acknowledgements") != 0 {
    t.Fatalf("same-intent duplicate became a conflict:\n%s", strings.Join(messages, "\n"))
  }
  if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
    t.Fatalf("the duplicate edge stopped covering its target:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies exclusions remain one reviewed decision per covered scope.
 *
 * Repeating an exclusion makes ownership of its reason ambiguous regardless of
 * host or declaration order. Ancestor and descendant exclusions duplicate the
 * selected unit where their scopes intersect.
 *
 *  1. Repeat an exact exclusion on one and on separate hosts.
 *  2. Overlap parent and child exclusions in both source orders.
 *  3. Assert each later exclusion produces one duplicate finding.
 */
func TestOverlappingExclusionsAreRejectedAcrossHostsAndHierarchy(t *testing.T) {
  cases := map[string]string{
    "same target on one host": `/**
 * @evidenceExclude docs/spec.md#contract The claim does not own this contract.
 * @evidenceExclude docs/spec.md#contract The claim repeats the exclusion.
 */
export function first(): void {}
`,
    "same target across hosts": `/** @evidenceExclude docs/spec.md#contract The adapter does not own this contract. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract The service does not own this contract. */
export function second(): void {}
`,
    "parent before child": `/** @evidenceExclude docs/spec.md#contract This layer excludes the contract family. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#validation This layer also excludes validation. */
export function second(): void {}
`,
    "child before parent": `/** @evidenceExclude docs/spec.md#validation This layer excludes validation. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract This layer also excludes the contract family. */
export function second(): void {}
`,
  }
  for name, source := range cases {
    t.Run(name, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
        "src/claim.ts": source,
      }, acknowledgementIntentConfig)
      if got := countProblemsContaining(messages, "Duplicate @evidenceExclude"); got != 1 {
        t.Fatalf("overlapping exclusions produced %d findings:\n%s", got, strings.Join(messages, "\n"))
      }
      if countProblemsContaining(messages, "Conflicting acknowledgements") != 0 {
        t.Fatalf("same-intent exclusions became a conflict:\n%s", strings.Join(messages, "\n"))
      }
      assertProblemContains(t, messages, "in Claim 1 ('contracts') reference 1")
      if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
        t.Fatalf("the duplicate exclusion stopped covering its target:\n%s", strings.Join(messages, "\n"))
      }
    })
  }
}

/**
 * Verifies disjoint, claim-local, and reference-local exclusions remain
 * independent.
 *
 * Exclusion uniqueness belongs to one claim-reference obligation and only to
 * scopes sharing a selected unit. Separate requirements or separate claims
 * express separate reviewed decisions.
 *
 *  1. Exclude two disjoint targets in one claim.
 *  2. Exclude one physical target from separate claims and reference entries.
 *  3. Assert none of the arrangements creates a duplicate.
 */
func TestDisjointClaimAndReferenceLocalExclusionsAreAllowed(t *testing.T) {
  t.Run("disjoint scopes", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Create {#create}\n## Cancel {#cancel}\n",
      "src/create.ts": `/** @evidenceExclude docs/spec.md#create Creation belongs elsewhere. */
export function create(): void {}
`,
      "src/cancel.ts": `/** @evidenceExclude docs/spec.md#cancel Cancellation belongs elsewhere. */
export function cancel(): void {}
`,
    }, acknowledgementIntentConfig)
    assertNoProblems(t, messages)
  })
  t.Run("separate claims", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/backend.ts": `/** @evidenceExclude docs/spec.md#contract Frontend owns this presentation rule. */
export function backend(): void {}
`,
      "src/frontend.ts": `/** @evidenceExclude docs/spec.md#contract Backend owns this persistence rule. */
export function frontend(): void {}
`,
    }, `{"claims":[
      {"name":"backend","type":"typescript","files":["src/backend.ts"],"symbol":"function","reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}},
      {"name":"frontend","type":"typescript","files":["src/frontend.ts"],"symbol":"function","reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}}
    ]}`)
    assertNoProblems(t, messages)
  })
  t.Run("separate references", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/** @evidenceExclude docs/spec.md#contract This claim does not own the contract. */
export function claim(): void {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"function",
      "reference":[
        {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"},
        {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
      ]
    }]}`)
    assertNoProblems(t, messages)
  })
}

/**
 * Verifies opposite acknowledgement intents conflict independent of source
 * order and hierarchy direction.
 *
 * Evidence says a claim uses a selected unit; exclusion says the same claim
 * does not. Exact and ancestor-descendant overlaps are contradictions whichever
 * declaration appears first and whichever intent owns the broader scope.
 *
 *  1. Reverse exact evidence and exclusion order.
 *  2. Reverse order for both parent-evidence and parent-exclusion overlaps.
 *  3. Assert every arrangement produces exactly one conflict.
 */
func TestEvidenceAndExclusionOverlapsConflictInEitherOrderAndHierarchy(t *testing.T) {
  cases := map[string]string{
    "exact evidence first": `/** @evidence docs/spec.md#contract Implements the contract. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract The contract is excluded. */
export function second(): void {}
`,
    "exact exclusion first": `/** @evidenceExclude docs/spec.md#contract The contract is excluded. */
export function first(): void {}
/** @evidence docs/spec.md#contract Implements the contract. */
export function second(): void {}
`,
    "parent evidence first": `/** @evidence docs/spec.md#contract Implements the contract family. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#validation Validation is excluded. */
export function second(): void {}
`,
    "parent evidence second": `/** @evidenceExclude docs/spec.md#validation Validation is excluded. */
export function first(): void {}
/** @evidence docs/spec.md#contract Implements the contract family. */
export function second(): void {}
`,
    "parent exclusion first": `/** @evidenceExclude docs/spec.md#contract The contract family is excluded. */
export function first(): void {}
/** @evidence docs/spec.md#validation Implements validation. */
export function second(): void {}
`,
    "parent exclusion second": `/** @evidence docs/spec.md#validation Implements validation. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract The contract family is excluded. */
export function second(): void {}
`,
  }
  for name, source := range cases {
    t.Run(name, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
        "src/claim.ts": source,
      }, acknowledgementIntentConfig)
      if got := countProblemsContaining(messages, "Conflicting acknowledgements"); got != 1 {
        t.Fatalf("opposite intents produced %d conflicts:\n%s", got, strings.Join(messages, "\n"))
      }
      assertProblemContains(t, messages, "@evidence at ")
      assertProblemContains(t, messages, "overlaps @evidenceExclude at ")
      if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
        t.Fatalf("the conflict stopped covering its target:\n%s", strings.Join(messages, "\n"))
      }
    })
  }
}

/**
 * Verifies Markdown declaration hosts obey positive and exclusion cardinality.
 *
 * Markdown has no AST declaration node, so its scanner must preserve heading
 * identity explicitly. Without that identity, same-host positive duplicates
 * disappear or separate headings collapse into one host.
 *
 *  1. Repeat positive evidence across headings and then within one heading.
 *  2. Repeat an exclusion across headings.
 *  3. Assert only the same-host positive and repeated exclusion fail.
 */
func TestMarkdownHostsPreserveAcknowledgementCardinality(t *testing.T) {
  config := `{"claims":[{
    "type":"markdown",
    "files":["claim.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`
  t.Run("positive across headings", func(t *testing.T) {
    assertNoProblems(t, runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "claim.md": `## First
<!-- @evidence docs/spec.md#contract First implementation. -->
## Second
<!-- @evidence docs/spec.md#contract Second implementation. -->
`,
    }, config))
  })
  t.Run("positive repeated under one heading", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "claim.md": `## First
<!-- @evidence docs/spec.md#contract First reason. -->
<!-- @evidence docs/spec.md#contract Second reason. -->
`,
    }, config)
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })
  t.Run("exclusion repeated across headings", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "claim.md": `## First
<!-- @evidenceExclude docs/spec.md#contract First exclusion. -->
## Second
<!-- @evidenceExclude docs/spec.md#contract Second exclusion. -->
`,
    }, config)
    if got := countProblemsContaining(messages, "Duplicate @evidenceExclude"); got != 1 {
      t.Fatalf("Markdown exclusions produced %d duplicates:\n%s", got, strings.Join(messages, "\n"))
    }
  })
}

/**
 * Verifies Prisma model hosts obey positive and exclusion cardinality.
 *
 * Prisma declarations are reconstructed from comments after the real schema
 * parser classifies models and fields. Host identity must survive that bridge
 * so different models may cite one requirement while one model cannot repeat
 * it, and exclusions remain unique across the claim.
 *
 *  1. Repeat positive evidence across models and then on one model.
 *  2. Repeat an exclusion across models.
 *  3. Assert only the same-host positive and repeated exclusion fail.
 */
func TestPrismaHostsPreserveAcknowledgementCardinality(t *testing.T) {
  t.Run("positive across models", func(t *testing.T) {
    messages := runPrismaAcknowledgementGraph(t, `/// @evidence docs/spec.md#contract First model ownership.
model First {
  id String @id
}

/// @evidence docs/spec.md#contract Second model ownership.
model Second {
  id String @id
}
`, "First", "Second")
    assertNoProblems(t, messages)
  })
  t.Run("positive repeated on one model", func(t *testing.T) {
    messages := runPrismaAcknowledgementGraph(t, `/// @evidence docs/spec.md#contract First reason.
/// @evidence docs/spec.md#contract Second reason.
model First {
  id String @id
}
`, "First")
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })
  t.Run("exclusion repeated across models", func(t *testing.T) {
    messages := runPrismaAcknowledgementGraph(t, `/// @evidenceExclude docs/spec.md#contract First exclusion.
model First {
  id String @id
}

/// @evidenceExclude docs/spec.md#contract Second exclusion.
model Second {
  id String @id
}
`, "First", "Second")
    if got := countProblemsContaining(messages, "Duplicate @evidenceExclude"); got != 1 {
      t.Fatalf("Prisma exclusions produced %d duplicates:\n%s", got, strings.Join(messages, "\n"))
    }
  })
}

func runPrismaAcknowledgementGraph(
  t *testing.T,
  schema string,
  models ...string,
) []string {
  t.Helper()
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", schema, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, name := range models {
    for _, unit := range prismaModelUnits(prismaModel{Name: name}) {
      unit.Path = "prisma/schema.prisma"
      hosts[joinPrismaIdentity(unit.Identity)] = unit
    }
  }
  if problems := prismaDeclarationsFromComments(
    scan.Comments,
    hosts,
    prismaInventoriesByDisplay(inventories),
    nil,
  ); len(problems) != 0 {
    t.Fatalf("Prisma declaration scan failed: %v", problems)
  }
  document, documentProblems := scanProjectMarkdown(
    "docs/spec.md",
    "## Contract {#contract}\n",
  )
  if len(documentProblems) != 0 {
    t.Fatalf("Markdown reference scan failed: %v", documentProblems)
  }
  loader := newTypeScriptLoader("", map[string]*artifactInventory{})
  states, problems := materializeClaimStates(
    anchoredGraph("", graphConfig{Claims: []claimSpec{{
      Type:    artifactPrisma,
      Files:   mustGlobSet(t, []string{"prisma/*.prisma"}),
      Symbols: symbolSet{"model": true},
      References: []referenceSpec{{
        Type:    artifactMarkdown,
        Files:   mustGlobSet(t, []string{"docs/spec.md"}),
        Symbols: symbolSet{"h2": true},
      }},
    }}}),
    map[string]*artifactInventory{"docs/spec.md": document},
    inventories,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    loader,
  )
  return problemMessages(append(problems, evaluateEvidenceGraph(states, loader)...))
}
