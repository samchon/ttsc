package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a refused exclusion fails only its owning reference obligation.
 *
 * One declaration can resolve into overlapping references, but each reference owns its acknowledgement intent. The strict reference must report and remain uncovered while the ordinary twin accepts the same exclusion independently.
 *
 *  1. Point strict and ordinary references at the same Markdown section.
 *  2. Exclude the section from one selected function host.
 *  3. Assert only the strict reference reports the policy and missing coverage.
 */
func TestRefusedExclusionLeavesOnlyItsReferenceUncovered(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidenceExclude docs/spec.md#contract Not applicable here. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "noEvidenceExclude":true
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2"
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "Forbidden @evidenceExclude"); count != 1 {
    t.Fatalf("expected one strict-reference exclusion diagnostic, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "reference 1 (markdown, symbols: h2): noEvidenceExclude")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf("the ordinary reference must remain acknowledged, got %d missing diagnostics:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
  assertProblemContains(t, messages, "this reference forbids @evidenceExclude")
}

/**
 * Verifies single-evidence cardinality uses distinct units and includes silent hosts.
 *
 * Counting tags would let duplicate citations inflate one host and would never see a selected function with no JSDoc. The policy instead starts from every semantic claim unit and projects distinct covered reference-unit identities onto it.
 *
 *  1. Select an empty host, a duplicate-tag host, and a two-unit host.
 *  2. Require exactly one positive unit per semantic host.
 *  3. Assert only the zero-unit and two-unit hosts fail cardinality.
 */
func TestSingleEvidencePerSymbolCountsDistinctUnitsAndZeroTagHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## First {#first}\n\n## Second {#second}\n",
    "src/tests.ts": `export function empty(): void {}

/**
 * @evidence docs/spec.md#first First proof.
 * @evidence docs/spec.md#first Repeated proof.
 */
export function duplicate(): void {}

/**
 * @evidence docs/spec.md#first First proof.
 * @evidence docs/spec.md#second Second proof.
 */
export function broad(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1"); count != 2 {
    t.Fatalf("expected zero and broad hosts to fail cardinality, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'empty'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s)")
  assertProblemContains(t, messages, "TypeScript function 'broad'")
  assertProblemContains(t, messages, "cites 2 distinct selected evidence unit(s)")
  if strings.Contains(strings.Join(messages, "\n"), "TypeScript function 'duplicate'") {
    t.Fatalf("duplicate tags inflated the semantic host count:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Duplicate @evidence")
}

/**
 * Verifies unique evidence counts semantic claim hosts rather than declarations.
 *
 * Several tags on one exported function remain one implementation or proof, so repetition must not consume a unit's single owner. A second exported identity citing the same unit is the case the policy exists to reject.
 *
 *  1. Cite one unit twice from a single function under `uniqueEvidence`.
 *  2. Assert only the ordinary duplicate-tag diagnostic fires.
 *  3. Move the second citation onto another function and assert the unit reports two owners.
 */
func TestUniqueEvidenceCountsSemanticHostsRatherThanDeclarations(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "uniqueEvidence":true
    }
  }]}`
  oneHost := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/one.ts": `/**
 * @evidence docs/spec.md#contract First proof.
 * @evidence docs/spec.md#contract Repeated proof.
 */
export function one(): void {}
`,
  }, config)
  assertProblemContains(t, oneHost, "Duplicate @evidence")
  if strings.Contains(strings.Join(oneHost, "\n"), "uniqueEvidence") {
    t.Fatalf("repeated tags on one semantic host consumed its unique owner:\n%s", strings.Join(oneHost, "\n"))
  }

  twoHosts := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/one.ts": `/** @evidence docs/spec.md#contract First proof. */
export function one(): void {}
`,
    "src/two.ts": `/** @evidence docs/spec.md#contract Second proof. */
export function two(): void {}
`,
  }, config)
  assertProblemContains(t, twoHosts, "has 2 distinct positive evidence host(s); uniqueEvidence allows at most 1")
}

/**
 * Verifies an aggregate evidence scope contributes each selected descendant identity.
 *
 * Cardinality follows the graph's hierarchy rather than the number of written tags. One parent citation therefore counts as two selected units when that parent and its selected child are both obligations, and as one when only the parent is.
 *
 *  1. Cite one Markdown H2 scope from one function requiring exactly one unit.
 *  2. Assert the H2-only reference passes.
 *  3. Select the H3 descendant as well and assert the same citation now counts two.
 */
func TestSingleEvidencePerSymbolExpandsHierarchicalScopes(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Contract {#contract}\n\n### Validation {#validation}\n",
    "src/test.ts": `/** @evidence docs/spec.md#contract Covers the contract scope. */
export function testContract(): void {}
`,
  }
  shallow := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertNoProblems(t, shallow)

  deep := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2","h3"],
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, deep, "cites 2 distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1")
}

/**
 * Verifies identical references evaluate their policies independently.
 *
 * A declaration may participate in several overlapping obligations, but their policies cannot pool counts. Two hosts citing one shared unit must satisfy the ordinary reference and independently fail the strict twin over the same population.
 *
 *  1. Configure identical references, one ordinary and one requiring unique evidence.
 *  2. Cite their shared unit from two selected hosts.
 *  3. Assert only reference two reports its own cardinality.
 */
func TestReferencePoliciesStayIndependentAcrossIdenticalReferences(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/one.ts": `/** @evidence docs/spec.md#contract First proof. */
export function one(): void {}
`,
    "src/two.ts": `/** @evidence docs/spec.md#contract Second proof. */
export function two(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2"
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "uniqueEvidence":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "uniqueEvidence allows at most 1"); count != 1 {
    t.Fatalf("expected exactly one independent policy failure, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 reference 2")
}

/**
 * Verifies hierarchically overlapping references retain independent policy counts.
 *
 * An H2 scope can cover the H2 selected by one reference and the descendant H3 selected by another, but those are different obligation denominators. Counting the shared written target once globally would let either policy borrow the other's unit.
 *
 *  1. Select an H2 in reference one and the H2 with its H3 descendant in reference two.
 *  2. Cite the H2 scope once under two single-evidence policies.
 *  3. Assert only the descendant-selecting reference fails its own count.
 */
func TestReferencePoliciesStayIndependentAcrossHierarchicalReferences(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n\n### Validation {#validation}\n",
    "src/test.ts": `/** @evidence docs/spec.md#contract Implements the contract scope. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "singleEvidencePerSymbol":true
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2","h3"],
        "singleEvidencePerSymbol":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol"); count != 1 {
    t.Fatalf("expected one hierarchical-reference failure, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 reference 2")
}

/**
 * Verifies an unhealthy partial denominator produces no derived cardinality.
 *
 * A loader can materialize some units before discovering that its population is incomplete. Cardinality over that partial set would claim completeness from missing data, so the evaluator must defer entirely to the owning loader failure.
 *
 *  1. Supply a selected host and one retained unit under an unhealthy reference state.
 *  2. Enable both cardinality options with no positive evidence.
 *  3. Assert the evaluator derives neither cardinality nor missing coverage.
 */
func TestReferencePolicyDerivesNothingFromAnUnhealthyReference(t *testing.T) {
  host := &evidenceUnit{
    ID:       "typescript:src/test.ts:function:testContract",
    Target:   "testContract",
    Type:     artifactTypeScript,
    Symbol:   "function",
    Path:     "src/test.ts",
    Line:     1,
    Readable: "TypeScript function 'testContract'",
  }
  unit := &evidenceUnit{
    ID:       "markdown:docs/spec.md:h2:1",
    Target:   "docs/spec.md#contract",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/spec.md",
    Line:     1,
    Readable: "Markdown H2 'Contract'",
  }
  messages := evaluateEvidenceGraph([]claimState{{
    Spec: claimSpec{
      Index:   0,
      Type:    artifactTypeScript,
      Symbols: symbolSet{"function": true},
    },
    Paths:   []string{"src/test.ts"},
    Hosts:   []*evidenceUnit{host},
    Healthy: true,
    References: []referenceState{{
      Spec: referenceSpec{
        Index: 0,
        Type:  artifactMarkdown,
        Policy: referencePolicy{
          UniqueEvidence:          true,
          SingleEvidencePerSymbol: true,
        },
        Symbols: symbolSet{"h2": true},
      },
      Paths:        []string{"docs/spec.md"},
      Units:        []*evidenceUnit{unit},
      Scopes:       []*evidenceUnit{unit},
      UnitsByScope: map[string][]*evidenceUnit{unit.ID: {unit}},
      Healthy:      false,
    }},
  }}, nil)
  if len(messages) != 0 {
    t.Fatalf("partial reference produced derived diagnostics instead of deferring to its loader failure:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a strict Swagger obligation does not prohibit an ordinary Markdown exclusion.
 *
 * A backend-test claim can cite API operations, requirements, and DTO contracts through separate references. The operation reference's anti-exclusion policy must not infect the ordinary documentary obligation beside it.
 *
 *  1. Configure a strict Swagger operation and an ordinary Markdown section in one claim.
 *  2. Exclude both targets from the same eligible function carrier.
 *  3. Assert only the operation exclusion fails and only the operation remains missing.
 */
func TestStrictSwaggerAndOrdinaryMarkdownExclusionsCoexist(t *testing.T) {
  host := &evidenceUnit{
    ID:       "typescript:src/test.ts:function:testContract",
    Target:   "testContract",
    Type:     artifactTypeScript,
    Symbol:   "function",
    Path:     "src/test.ts",
    Line:     5,
    Readable: "TypeScript function 'testContract'",
  }
  operation := &evidenceUnit{
    ID:       "swagger:openapi.json:POST:/orders",
    Target:   "POST:/orders",
    Type:     artifactSwagger,
    Symbol:   "operation",
    Path:     "openapi.json",
    Readable: "Swagger operation 'POST /orders'",
  }
  requirement := &evidenceUnit{
    ID:       "markdown:docs/requirement.md:h2:1",
    Target:   "docs/requirement.md#requirement",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/requirement.md",
    Line:     1,
    Readable: "Markdown H2 'Requirement'",
  }
  messages := evaluateEvidenceGraph([]claimState{{
    Spec: claimSpec{
      Index:   0,
      Type:    artifactTypeScript,
      Symbols: symbolSet{"function": true},
    },
    Paths: []string{"src/test.ts"},
    Hosts: []*evidenceUnit{host},
    Declarations: []*evidenceDeclaration{
      {
        ID:               "operation-exclusion",
        HostID:           "src/test.ts:0:100",
        SemanticHostIDs:  []string{host.ID},
        Type:             artifactTypeScript,
        Tag:              tagExclude,
        Target:           operation.Target,
        Reason:           "No operation scenario exists.",
        Hosts:            symbolSet{"function": true},
        ExclusionCarrier: true,
        Path:             "src/test.ts",
        Line:             2,
      },
      {
        ID:               "requirement-exclusion",
        HostID:           "src/test.ts:0:100",
        SemanticHostIDs:  []string{host.ID},
        Type:             artifactTypeScript,
        Tag:              tagExclude,
        Target:           requirement.Target,
        Reason:           "The requirement is not applicable.",
        Hosts:            symbolSet{"function": true},
        ExclusionCarrier: true,
        Path:             "src/test.ts",
        Line:             3,
      },
    },
    Healthy: true,
    References: []referenceState{
      {
        Spec: referenceSpec{
          Index:   0,
          Type:    artifactSwagger,
          Policy:  referencePolicy{NoExclude: true},
          Symbols: symbolSet{"operation": true},
        },
        Paths:        []string{"openapi.json"},
        Units:        []*evidenceUnit{operation},
        Scopes:       []*evidenceUnit{operation},
        UnitsByScope: map[string][]*evidenceUnit{operation.ID: {operation}},
        Healthy:      true,
      },
      {
        Spec: referenceSpec{
          Index:   1,
          Type:    artifactMarkdown,
          Symbols: symbolSet{"h2": true},
        },
        Paths:        []string{"docs/requirement.md"},
        Units:        []*evidenceUnit{requirement},
        Scopes:       []*evidenceUnit{requirement},
        UnitsByScope: map[string][]*evidenceUnit{requirement.ID: {requirement}},
        Healthy:      true,
      },
    },
  }}, nil)
  if count := countProblemsContaining(messages, "Forbidden @evidenceExclude"); count != 1 {
    t.Fatalf("expected only the Swagger exclusion to be forbidden, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Forbidden @evidenceExclude for 'POST:/orders'")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf("ordinary Markdown exclusion did not retain coverage, got %d missing diagnostics:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'POST:/orders'")
  if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement for 'docs/requirement.md#requirement'") {
    t.Fatalf("strict Swagger policy leaked into the Markdown reference:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies overloaded declarations retain one semantic claim-host identity.
 *
 * Source positions distinguish overload declarations physically, but the public function is one graph unit. Cardinality must judge that semantic identity once and accept its implementation declaration's citation.
 *
 *  1. Declare two overload signatures and one implementation for one function.
 *  2. Put the only evidence tag on the implementation.
 *  3. Assert single-evidence cardinality sees one satisfied semantic host.
 */
func TestSingleEvidencePerSymbolUsesMergedTypeScriptIdentity(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Parse {#parse}\n",
    "src/parse.ts": `export function parse(value: string): string;
export function parse(value: number): string;
/** @evidence docs/spec.md#parse Implements both public overloads. */
export function parse(value: string | number): string {
  return String(value);
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies cardinality derives nothing from an empty healthy reference.
 *
 * A successfully loaded document can contain no selected unit, and the
 * materializer reports that population as empty on its own. Judging hosts on
 * top of it added one message per host asking each to cite a unit that does not
 * exist, which is the derived finding the loader-failure path already refuses.
 * The count of zero is true; the demand it produced was not answerable.
 *
 *  1. Select one TypeScript function and a Markdown document with no heading.
 *  2. Require exactly one Markdown unit per selected symbol.
 *  3. Assert the population is named once and no host is named at all.
 */
func TestSingleEvidencePerSymbolDerivesNothingFromAHealthyEmptyReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "Plain prose with no selected heading.\n",
    "src/test.ts":  "export function testContract(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, messages, "found no selected evidence units")
  if countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1") != 0 {
    t.Fatalf(
      "an empty population must not be re-reported per host:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies an empty reference answers the same way whether or not a file matched.
 *
 * The removed exception was conditional on the reference having matched at
 * least one path, so the identical empty population produced per-host findings
 * or none depending on a fact the question does not turn on. This is the other
 * half of that pair: same policy, same zero units, no matched file.
 *
 *  1. Point the same policy at a glob no document occupies.
 *  2. Evaluate.
 *  3. Assert the population is named and no host is named.
 */
func TestSingleEvidencePerSymbolAnswersAnUnmatchedGlobTheSameWay(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Discounts {#discounts}\n",
    "src/test.ts":  "export function testContract(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/absent.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, messages, "matched no markdown files")
  if countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1") != 0 {
    t.Fatalf(
      "an unmatched glob must not be re-reported per host:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies cardinality still judges a host against a population that has units.
 *
 * This is the negative twin of the two cases above and the reason the early
 * return is bounded by emptiness rather than by policy. A host that cites none
 * of a population that really holds units is the failure singleEvidencePerSymbol
 * exists to catch, and the suppression must not reach it.
 *
 *  1. Select one TypeScript function and a document with two headings.
 *  2. Require exactly one Markdown unit per selected symbol, and cite neither.
 *  3. Assert the host is named with its zero count.
 */
func TestSingleEvidencePerSymbolStillJudgesAPopulatedReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Discounts {#discounts}\n\n## Coupons {#coupons}\n",
    "src/test.ts":  "export function testContract(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, messages, "TypeScript function 'testContract'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1")
}
