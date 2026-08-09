package evidence

import (
  "regexp"
  "sort"
  "strings"
  "testing"
)

// reexportedSurface is the file every case in this file re-exports.
//
// It holds one of each thing the answer depends on: a class whose name is
// type-space and whose members are not, an interface no class merges with whose
// members are type-space, and a module-scope function that is value-space
// outright.
const reexportedSurface = `
export class Sale {
  price: number = 0;
  charge(): void {}
}
export interface IPlain {
  rate: number;
}
export function run(): void {}
`

var missingAcknowledgement = regexp.MustCompile(`Missing acknowledgement for '([^']+)'`)

// reexportedPopulation is the sorted set of units one barrel form publishes.
//
// The obligation is read from what goes unacknowledged rather than from the
// inventory, because that is the population an author is actually held to, and
// it is the number the barrel form is supposed to change.
func reexportedPopulation(t *testing.T, barrel string) []string {
  t.Helper()
  messages := runIndexRule(t, map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/index.ts":  barrel,
    "src/ledger.ts": "/** This claim cites nothing. */\nexport interface ILedger {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["src/index.ts"],
      "symbol":["type","function","property"]
    }
  }]}`)
  targets := []string{}
  for _, message := range messages {
    if match := missingAcknowledgement.FindStringSubmatch(message); match != nil {
      targets = append(targets, match[1])
    }
  }
  sort.Strings(targets)
  return targets
}

func assertReexportedPopulation(t *testing.T, barrel string, want []string) {
  t.Helper()
  got := reexportedPopulation(t, barrel)
  if strings.Join(got, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "population of %q:\n%s\nwant:\n%s",
      strings.TrimSpace(barrel),
      strings.Join(got, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

// valueReexportPopulation is everything the declaring file publishes.
var valueReexportPopulation = []string{
  "IPlain",
  "IPlain.rate",
  "Sale",
  "Sale.prototype.charge",
  "Sale.prototype.price",
  "run",
}

// typeReexportPopulation is what survives a type-only edge: the class name,
// because a name is type-space, and the interface with its members, because an
// interface no class merges with declares nothing in value space.
var typeReexportPopulation = []string{
  "IPlain",
  "IPlain.rate",
  "Sale",
}

/**
 * Verifies a value re-export publishes everything the declaring file does.
 *
 * The control every type-only row is measured against. Without it each of those
 * rows would also pass if the traversal had stopped reaching that module at
 * all, which is the same silence a withheld population produces.
 *
 *  1. Re-export a class, an interface, and a function by value from a barrel.
 *  2. Point a reference at the barrel alone.
 *  3. Assert the whole surface is owed.
 */
func TestValueReexportPublishesValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export { Sale, IPlain, run } from \"./sale.js\";\n",
    valueReexportPopulation,
  )
}

/**
 * Verifies a named type-only re-export withholds value-space across the module
 * boundary.
 *
 * The mark stopped at the boundary: `collectLocalExportNames` skips any export
 * declaration carrying a module specifier, so a barrel published every class
 * member the declaring file held while the same intent written locally withheld
 * them. The criterion had become the specifier rather than the export's own
 * kind, which is a distinction with nothing behind it, and every surface that
 * stated the type-only rule had to carry a caveat about it.
 *
 *  1. Re-export the same three declarations with `export type { … } from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the class name and the whole unmerged interface survive and
 *     nothing else does.
 */
func TestTypeOnlyNamedReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export type { Sale, IPlain, run } from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}

/**
 * Verifies the inline spelling withholds the same thing.
 *
 * `export { type Sale } from` is the per-name form and it is marked on the
 * specifier rather than on the declaration, so a fix reading only one of the two
 * would answer this spelling wrongly while the other looked closed.
 *
 *  1. Re-export the same three declarations with `export { type … } from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the same population as the declaration-level spelling.
 */
func TestInlineTypeOnlyReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export { type Sale, type IPlain, type run } from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}

/**
 * Verifies a type-only star re-export withholds value-space.
 *
 * The star form has no clause to carry a per-name mark, so the declaration's
 * own is the whole answer and a fix keyed on the clause would miss it entirely.
 *
 *  1. Re-export the module with `export type * from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the same population.
 */
func TestTypeOnlyStarReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export type * from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}

/**
 * Verifies a type-only namespace re-export withholds value-space under its
 * segment.
 *
 * `export type * as api from` nests the whole surface one segment deeper, so
 * this row also pins that the withholding travels with the address rather than
 * being decided at the top of it.
 *
 *  1. Re-export the module with `export type * as api from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the same population, addressed through the segment.
 */
func TestTypeOnlyNamespaceReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export type * as api from \"./sale.js\";\n",
    []string{"api.IPlain", "api.IPlain.rate", "api.Sale"},
  )
}
