package evidence

import "testing"

/**
 * Verifies a healthy TypeScript claim with no selected exported host is
 * inactive before its references load.
 *
 * Evaluation-only suppression is too late: an unreadable reference would
 * still fail a graph whose claim has no declaration capable of acknowledging
 * it. An enum is exported here but is not a `type` unit, which pins activation
 * to the claim selector rather than to any export or merely matched file.
 *
 *  1. Match one healthy TypeScript file that exports no selected `type` unit.
 *  2. Point its Markdown reference at a missing root.
 *  3. Assert the inactive claim neither loads nor diagnoses that reference.
 */
func TestTypeScriptClaimWithoutASelectedExportSkipsItsReferences(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/placeholder.ts": "export enum Placeholder {\n  Empty = \"empty\",\n}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}

/**
 * Verifies the first selected exported host activates the complete claim.
 *
 * Inactivity is derived from the current Program rather than latched in
 * configuration. Adding one selected interface must therefore restore the
 * existing reference coverage behavior without another config edit.
 *
 *  1. Match one exported interface selected by a TypeScript `type` claim.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the now-active claim reports its missing acknowledgement.
 */
func TestFirstSelectedTypeScriptExportActivatesCoverage(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md":    "## Contract\n",
    "src/contract.ts": "export interface Contract {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#contract'")
}

/**
 * Verifies a healthy claim glob matching zero files is inactive.
 *
 * A typo and an intentionally empty folder are indistinguishable from the
 * selected Program population alone. Both therefore have the same activation
 * semantics: without one matching selected export, no reference is loaded and
 * no acknowledgement diagnostic is emitted.
 *
 *  1. Miss every TypeScript source with a typo in the claim glob.
 *  2. Give the empty claim an unreadable Markdown reference root.
 *  3. Assert the whole claim remains inactive and silent.
 */
func TestTypeScriptClaimMatchingZeroFilesIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/contract.ts": "export interface Contract {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/typo/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}

/**
 * Verifies exclusions can leave a TypeScript claim with zero matched paths.
 *
 * This is the benchmark controller boundary: `HealthController.ts` is a real
 * exported controller but is intentionally outside the evidence claim. Once
 * that exact exclusion removes the only path, its references must not load.
 *
 *  1. Match all controller files and exclude exactly `HealthController.ts`.
 *  2. Supply HealthController as the only controller and an unreadable reference.
 *  3. Assert the resulting healthy zero-path claim is inactive and silent.
 */
func TestTypeScriptClaimWithOnlyExcludedHealthControllerIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/controllers/HealthController.ts": `
export class HealthController {
  public get(): string {
    return "ok";
  }
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":[
      "src/controllers/**/*.ts",
      "!src/controllers/HealthController.ts"
    ],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}

/**
 * Verifies a failed own population cannot prove a TypeScript claim inactive.
 *
 * Loader failure and healthy emptiness have opposite meanings for coverage.
 * A partial population may be missing the selected export, so filtering that
 * claim would hide both the direct failure and every repair signal behind it.
 *
 *  1. Mark the only matching TypeScript inventory as failed and unitless.
 *  2. Apply the activation filter to the configured claim.
 *  3. Assert the failed claim remains present for normal failure handling.
 */
func TestFailedTypeScriptClaimPopulationDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/claim.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  address := config.Claims[0].Base.addressOf("src/claim.ts")
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    map[string]*artifactInventory{
      address.Key: {
        Address:    address.Key,
        Path:       address.Display,
        Type:       artifactTypeScript,
        LoadFailed: true,
      },
    },
  )
  if len(active.Claims) != 1 {
    t.Fatal("a failed TypeScript population must remain active until its contents are knowable")
  }
}

/**
 * Verifies an unreadable TypeScript root is not treated as healthy emptiness.
 *
 * A missing root yields the same zero matched paths as an intentionally empty
 * population, but the filesystem failure means the absence is not evidence.
 * Keeping the claim active preserves its existing root/population diagnostic.
 *
 *  1. Resolve a TypeScript claim against a root that does not exist.
 *  2. Apply activation with no materialized inventory.
 *  3. Assert the unreadable claim remains active for diagnostic evaluation.
 */
func TestUnreadableTypeScriptClaimRootDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "root":"missing-source-root",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("an unreadable TypeScript root must remain active for its population diagnostic")
  }
}

/**
 * Verifies a function claim ignores an exported non-function variable.
 *
 * Matching a TypeScript file or any exported declaration is insufficient.
 * The own population must contain the symbol kind selected by the claim, so a
 * scalar `const` cannot activate a function obligation.
 *
 *  1. Export one scalar variable from a matched TypeScript file.
 *  2. Select only function hosts and configure an unreadable reference root.
 *  3. Assert the healthy zero-function claim remains inactive and silent.
 */
func TestFunctionClaimIgnoresExportedNonFunctionVariable(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/value.ts": "export const value = 1;\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}

/**
 * Verifies an exported callable variable activates a function claim.
 *
 * The negative twin above proves ordinary exported data stays outside the
 * function population. Replacing only its initializer with an arrow function
 * must open the existing obligation without a configuration change.
 *
 *  1. Export one arrow-function variable from a matched TypeScript file.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the selected callable activates missing-acknowledgement coverage.
 */
func TestCallableVariableActivatesFunctionClaim(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/run.ts":   "export const run = (): void => {};\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#contract'")
}
