package evidence

import "testing"

/**
 * Verifies a declared relation moves its targets to the position that can discharge them.
 *
 * The host matches a trigger against the line prefix, so `@evidence ` never matches a line reading `@evidence(produces) `. Leaving the corpus alone would give the one tag the reference accepts no completion at all, while still offering its targets at the position the reference refuses.
 *
 *  1. Require the `produces` relation on the only reference.
 *  2. Satisfy it and read both positive completion positions.
 *  3. Assert the target is offered at the relation position and nowhere else.
 */
func TestHintsOfferTargetsAtTheDeclaredRelation(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence(produces) docs/spec.md#contract Issues the contract. */
export function testContract(): void {}
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
  assertSilent(t, messages)
  relation := targetInserts(targetHintsAt(hints, "@evidence(produces) "))
  plain := targetInserts(targetHintsAt(hints, "@evidence "))
  if !contains(relation, "docs/spec.md#contract") {
    t.Fatalf("the relation position offered nothing: %v", relation)
  }
  if contains(plain, "docs/spec.md#contract") {
    t.Fatalf("a role-only target leaked into the plain position: %v", plain)
  }
}

/**
 * Verifies an exclusion keeps every target a relation constrains.
 *
 * A relation constrains positive evidence only. An exclusion states that the claim does not cover the target rather than how it does, and `noEvidenceExclude` is what decides whether a reference accepts one, so withholding the target here would advertise the opposite of the rule.
 *
 *  1. Require a relation on a reference that permits exclusions.
 *  2. Answer it with an exclusion and read the exclusion position.
 *  3. Assert the target is still offered there.
 */
func TestHintsKeepRoleConstrainedTargetsExcludable(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidenceExclude docs/spec.md#contract The gateway issues it; false once a screen must. */
export function testContract(): void {}
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
  assertSilent(t, messages)
  exclusion := targetInserts(targetHintsAt(hints, "@evidenceExclude "))
  if !contains(exclusion, "docs/spec.md#contract") {
    t.Fatalf("a role dropped the target from exclusions: %v", exclusion)
  }
}

/**
 * Verifies the inline-link route follows the relation that can use it.
 *
 * The route is the only completion a TypeScript reference publishes, and offering it where the reference refuses the tag would hand the author an unwanted-relation diagnostic for taking a suggestion.
 *
 *  1. Require a relation on the only TypeScript reference.
 *  2. Satisfy it through a real imported symbol.
 *  3. Assert the route sits at the relation position and not at the plain one.
 */
func TestHintsRouteTypeScriptThroughTheDeclaredRelation(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "src/contract.ts": "export interface IContract {}\n",
    "src/test.ts": `import type { IContract } from "./contract";

/** @evidence(produces) {@link IContract} Issues the contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/test.ts"],
    "symbol":"function",
    "reference":{
      "type":"typescript",
      "files":["src/contract.ts"],
      "symbol":"type",
      "role":"produces"
    }
  }]}`)
  assertSilent(t, messages)
  relation := targetInserts(targetHintsAt(hints, "@evidence(produces) "))
  plain := targetInserts(targetHintsAt(hints, "@evidence "))
  if !contains(relation, "{@link ") {
    t.Fatalf("the relation position lost the TypeScript route: %v", relation)
  }
  if contains(plain, "{@link ") {
    t.Fatalf("the route leaked into the position the reference refuses: %v", plain)
  }
}
