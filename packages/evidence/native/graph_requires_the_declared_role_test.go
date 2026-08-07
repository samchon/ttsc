package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a required role is discharged by that relation and by no other.
 *
 * Every obligation the graph could express before this was a reachability obligation: some host cites some unit. That cannot say a unit must be produced rather than mentioned, so a model covered by a host that only consumes it read as covered while nothing anywhere issued the rows, and the recovery route it belonged to could only ever refuse.
 *
 *  1. Require the `produces` relation on one reference.
 *  2. Acknowledge its unit from a host declaring `consumes`.
 *  3. Assert the unit stays uncovered and the diagnostic names the relation it wanted.
 */
func TestRequiredRoleRefusesAnotherRelation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence(consumes) docs/spec.md#recovery Reads the one-time proof. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#recovery'")
  assertProblemContains(t, messages, "naming the 'produces' relation")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf("expected exactly one uncovered unit, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
}

/**
 * Verifies the relation the reference asks for discharges it.
 *
 * A role that refused every declaration would be a reference nothing can satisfy rather than one that distinguishes relations, so the accepting half is what makes the refusing half meaningful.
 *
 *  1. Require the `produces` relation on one reference.
 *  2. Acknowledge its unit from a host declaring `produces`.
 *  3. Assert the graph reports nothing.
 */
func TestRequiredRoleAcceptsItsOwnRelation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence(produces) docs/spec.md#recovery Issues the one-time proof. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  if len(messages) != 0 {
    t.Fatalf("expected a clean graph, got:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a declaration naming no relation cannot discharge a reference that requires one.
 *
 * An undeclared role is the state every tag written before roles existed is in, so a reference that requires one has to refuse it. Accepting it would make the option a suggestion, and the obligation it exists to tighten would stay exactly as loose as before.
 *
 *  1. Require the `proves` relation on one reference.
 *  2. Acknowledge its unit from a host declaring no relation at all.
 *  3. Assert the unit stays uncovered.
 */
func TestRequiredRoleRefusesAnUndeclaredRelation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Refusal {#refusal}\n",
    "src/test.ts": `/** @evidence docs/spec.md#refusal Exercises the refusal path. */
export function testRefusal(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"proves"
    }
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#refusal'")
  assertProblemContains(t, messages, "naming the 'proves' relation")
}

/**
 * Verifies a declared role is inert where no reference asks for one.
 *
 * Every reference written before roles existed declares none, and the zero value of each earlier policy option is the behavior that preceded it. A role on a declaration must therefore change nothing until a reference asks for one, or adding the property to a tag would silently alter a graph nobody reconfigured.
 *
 *  1. Configure a reference with no role requirement.
 *  2. Acknowledge its unit from a host declaring one anyway.
 *  3. Assert the graph reports nothing.
 */
func TestUnrequiredRoleLeavesCoverageUnchanged(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence(reads) docs/spec.md#contract Renders the stated contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2"
    }
  }]}`)
  if len(messages) != 0 {
    t.Fatalf("expected a clean graph, got:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies one declaration pays into the reference whose relation it names and not the other.
 *
 * The three failures this exists for all shared one shape: a truthful tag on the wrong side of an obligation. Two references over the same units, asking for opposite relations, are what proves the role is scoped to the reference rather than to the target.
 *
 *  1. Point a `reads` reference and a `writes` reference at the same section.
 *  2. Acknowledge it once, declaring `writes`.
 *  3. Assert only the `reads` reference reports the unit uncovered.
 */
func TestRoleScopesCoverageToItsOwnReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## History {#history}\n",
    "src/test.ts": `/** @evidence(writes) docs/spec.md#history Records the resolution. */
export function testHistory(): void {}
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
        "role":"reads"
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "role":"writes"
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf("expected exactly one uncovered reference, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "naming the 'reads' relation")
}

/**
 * Verifies a relation no obligation wanted is reported where it is written.
 *
 * A resolving tag must discharge at least one obligation, which is why a declaration that discharges nothing has always been reported. A relation nobody asked for would otherwise be the first way to write a tag that pays into nothing and says nothing, because the unit's own diagnostic names the reference rather than the tag.
 *
 *  1. Require the `produces` relation on the only reference.
 *  2. Acknowledge its unit from a host declaring `prduces`, a typo.
 *  3. Assert the tag reports at its own location naming both relations.
 */
func TestUnwantedRelationReportsWhereItIsWritten(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence(prduces) docs/spec.md#recovery Issues the proof. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  assertProblemContains(t, messages, "Unwanted relation on @evidence")
  assertProblemContains(t, messages, "this declaration names 'prduces'")
  assertProblemContains(t, messages, "wants 'produces'")
}

/**
 * Verifies an exclusion answers for a role-carrying reference without claiming the relation.
 *
 * An exclusion states that the claim does not cover the target. Asking it to name the relation would make an author write the opposite of what the tag means, and it would let a role disarm the rule that an evidence scope and an exclusion scope may not overlap. What decides whether a reference accepts an exclusion is noEvidenceExclude, and it still does.
 *
 *  1. Require the `produces` relation on a reference that permits exclusions.
 *  2. Exclude its unit from a carrier, naming no relation.
 *  3. Assert the graph reports nothing.
 */
func TestExclusionAnswersARoleCarryingReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidenceExclude docs/spec.md#recovery The backend issues it; false once a screen must. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  if len(messages) != 0 {
    t.Fatalf("expected a clean graph, got:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a target that opens with a parenthesis still means what it always meant.
 *
 * This is the shape the whole change rests on. `@evidence (target) reason` was a declaration whose target begins with a parenthesis before relations existed, and a grammar that consumed it would change what a published consumer's tag means without anyone editing it.
 *
 *  1. Write a tag whose target is separated by a space and opens with a parenthesis.
 *  2. Run a graph with no relation required anywhere.
 *  3. Assert the target is reported verbatim as unresolved, exactly as before.
 */
func TestParenthesizedTargetKeepsItsOldMeaning(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence (contract) Names a target that opens with a parenthesis. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(t, messages, "Unresolved evidence target '(contract)'")
}

/**
 * Verifies a malformed relation opener reports the text the author wrote.
 *
 * The alternative is that the line stops being a declaration, which drops an acknowledgement without a word and is the outcome the graph exists to prevent. An unterminated inline link is handled the same way and for the same reason.
 *
 *  1. Write a relation opener with whitespace inside it.
 *  2. Run a graph with no relation required.
 *  3. Assert the opener is reported as the unresolved target rather than ignored.
 */
func TestMalformedRelationOpenerReportsItself(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence(produces here) docs/spec.md#contract Issues the contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(t, messages, "Unresolved evidence target '(produces'")
}

/**
 * Verifies Markdown and Prisma parse a relation the way TypeScript does.
 *
 * The relation is threaded through four declaration hosts. Exercising one of them would leave the grammar with three dialects and nothing able to notice.
 *
 *  1. Declare the relation from a Prisma model comment and from a Markdown comment.
 *  2. Require it on the reference each answers to.
 *  3. Assert both graphs are clean.
 */
func TestEveryDeclarationHostParsesARelation(t *testing.T) {
  prisma := runIndexRuleAtRoot(t, prismaBridgeRoot(t, nil), map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "prisma/schema.prisma": `datasource db {
  provider = "sqlite"
}

/// @evidence(produces) docs/spec.md#recovery Stores the issued proof.
model Reset {
  id Int @id
}
`,
  }, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema.prisma"],
    "symbol":"model",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  if len(prisma) != 0 {
    t.Fatalf("expected a clean Prisma graph, got:\n%s", strings.Join(prisma, "\n"))
  }
  markdown := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "docs/plan.md": "# Plan\n\n<!-- @evidence(produces) docs/spec.md#recovery Issues the proof. -->\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/plan.md"],
    "symbol":"h1",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  if len(markdown) != 0 {
    t.Fatalf("expected a clean Markdown graph, got:\n%s", strings.Join(markdown, "\n"))
  }
}

/**
 * Verifies a declaration that answered for one obligation is not reported for another that refused it.
 *
 * This is the whole of the finding's condition. A declaration is eligible for every obligation that refused it, so eligibility cannot decide the question, and the sentence the finding emits — that every obligation selecting the target wants another relation — is false the moment one of them took it. Without this the finding fires on a correct tag.
 *
 *  1. Select one target through a claim requiring `produces` and a claim requiring nothing.
 *  2. Acknowledge it once, naming no relation, from a host both claims select.
 *  3. Assert the relation-free claim's obligation is discharged and the tag is never reported.
 */
func TestRefusedDeclarationThatAnsweredElsewhereIsNotReported(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence docs/spec.md#recovery Implements recovery. */
export function testRecovery(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "role":"produces"
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2"
      }
    }
  ]}`)
  if countProblemsContaining(messages, "Unwanted relation") != 0 {
    t.Fatalf(
      "a declaration that answered for an obligation was reported anyway:\n%s",
      strings.Join(messages, "\n"),
    )
  }
  if countProblemsContaining(messages, "Non-participating") != 0 {
    t.Fatalf(
      "a participating declaration was reported as participating in nothing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf(
      "expected only the relation-requiring claim to still owe its unit, got %d:\n%s",
      count,
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a relation followed by no separator reports rather than disappearing.
 *
 * `@evidence(produces)docs/spec.md#recovery` is the typo the relation grammar makes possible, and it is one keystroke from a correct tag. Refusing to treat it as a declaration would drop an acknowledgement the author believes they wrote, and the missing-unit diagnostic names the reference rather than the tag, so nothing would point at the line.
 *
 *  1. Write a well-formed relation with no space before the target.
 *  2. Run a graph requiring that relation.
 *  3. Assert the whole unconsumed text is reported as the target.
 */
func TestRelationWithoutASeparatorReportsItself(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence(produces)docs/spec.md#recovery Issues the proof. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces"
    }
  }]}`)
  assertProblemContains(t, messages, "Unresolved evidence target '(produces)docs/spec.md#recovery'")
}

/**
 * Verifies a relation the configuration would refuse is not one a tag can name.
 *
 * The parser and the decoder have to agree on what a relation is, or a tag names a relation no reference is permitted to require, which is a relation that can never be asked for and never be wrong. A closing parenthesis cannot survive the scan to the first one; an opening parenthesis can, and is the only shape where the two could drift.
 *
 *  1. Write a relation containing an opening parenthesis.
 *  2. Run a graph requiring no relation, so nothing but the parse decides the outcome.
 *  3. Assert the opener is reported as the target rather than consumed.
 */
func TestRelationCharsetMatchesTheConfiguration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence((x) docs/spec.md#recovery Issues the proof. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(t, messages, "Unresolved evidence target '((x)'")
}

/**
 * Verifies an exclusion carries no relation and says so.
 *
 * A relation names how a host answers for a target. An exclusion answers that the claim does not cover it at all, so there is no relation to name, and silently swallowing the word would let an author write a sentence the tag cannot mean and read a passing build as agreement.
 *
 *  1. Write a relation on an exclusion.
 *  2. Run a graph that would accept the exclusion without one.
 *  3. Assert the parenthesis is reported as the target rather than consumed.
 */
func TestExclusionCarriesNoRelation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidenceExclude(produces) docs/spec.md#recovery The gateway issues it; false once a screen must. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(t, messages, "Unresolved evidence target '(produces)'")
}

/**
 * Verifies a cardinality count says which relation it counted.
 *
 * A host citing the target under another relation counts zero here. The bare count would tell an author their one visible citation is not there, which sends them looking for a missing tag instead of at the word inside the one they wrote.
 *
 *  1. Require a relation and exactly one unit per host.
 *  2. Cite the unit naming another relation.
 *  3. Assert the cardinality diagnostic names the relation it counted.
 */
func TestCardinalityNamesTheRelationItCounted(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Recovery {#recovery}\n",
    "src/test.ts": `/** @evidence(reads) docs/spec.md#recovery Reads the proof. */
export function testRecovery(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"produces",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s) naming the 'produces' relation")
}
