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
