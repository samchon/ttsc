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

// reexportedFrom is the population one file layout publishes at one entry.
//
// The fixed layout above cannot express a barrel of barrels or two paths to one
// name, and both are where a mark that travels can go wrong.
func reexportedFrom(t *testing.T, files map[string]string, entry string) []string {
  t.Helper()
  files["src/ledger.ts"] = "/** This claim cites nothing. */\nexport interface ILedger {}\n"
  messages := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["`+entry+`"],
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

func assertReexportedFrom(
  t *testing.T,
  label string,
  files map[string]string,
  entry string,
  want []string,
) {
  t.Helper()
  got := reexportedFrom(t, files, entry)
  if strings.Join(got, "\n") != strings.Join(want, "\n") {
    t.Fatalf("%s:\n%s\nwant:\n%s", label, strings.Join(got, "\n"), strings.Join(want, "\n"))
  }
}

/**
 * Verifies a merged identity survives a type-only edge whichever half is first.
 *
 * One unit can be written by two collectors: `interface Order { member }`
 * beside `namespace Order { export const member }` is one `property` unit
 * spelled by the member collector and by the variable one. Recording which
 * space it is reached through by assignment made the last writer win, so the
 * answer followed declaration order, and the suppression it feeds is silent in
 * both directions. Type-space wins instead, because the interface half really
 * is reachable without a value.
 *
 *  1. Write the merge in both orders behind a type-only re-export.
 *  2. Read each population.
 *  3. Assert both keep the member.
 */
func TestMergedIdentitySurvivesATypeOnlyEdgeWhicheverHalfIsFirst(t *testing.T) {
  layout := func(source string) map[string]string {
    return map[string]string{
      "src/order.ts": source,
      "src/index.ts": "export type { Order } from \"./order.js\";\n",
    }
  }
  want := []string{"Order", "Order.member"}
  assertReexportedFrom(t, "interface first", layout(`
export interface Order {
  member: number;
}
export namespace Order {
  export const member: number = 1;
}
`), "src/index.ts", want)
  assertReexportedFrom(t, "namespace first", layout(`
export namespace Order {
  export const member: number = 1;
}
export interface Order {
  member: number;
}
`), "src/index.ts", want)
}

/**
 * Verifies a value path wins over a type-only path to the same name.
 *
 * A population is the union of what its paths reach, and the top level already
 * unions them. One hop down, the surface a barrel is asked for kept whichever
 * path it saw first, which was fine while two paths to one declaration differed
 * in nothing and stopped being fine the moment they carried a mark. The two
 * halves of the traversal have to answer the same way or a middle barrel's
 * statement order decides the obligation.
 *
 *  1. Reach one module through a type-only barrel and a value barrel.
 *  2. Forward both from a middle barrel, in each order, and re-export by name.
 *  3. Assert both orders publish the value population.
 */
func TestAValuePathWinsOverATypeOnlyPathToTheSameName(t *testing.T) {
  layout := func(middle string) map[string]string {
    return map[string]string{
      "src/sale.ts":   reexportedSurface,
      "src/type.ts":   "export type * from \"./sale.js\";\n",
      "src/value.ts":  "export * from \"./sale.js\";\n",
      "src/middle.ts": middle,
      "src/index.ts":  "export { Sale, IPlain, run } from \"./middle.js\";\n",
    }
  }
  assertReexportedFrom(t, "type-only forwarded first", layout(
    "export * from \"./type.js\";\nexport * from \"./value.js\";\n",
  ), "src/index.ts", valueReexportPopulation)
  assertReexportedFrom(t, "value forwarded first", layout(
    "export * from \"./value.js\";\nexport * from \"./type.js\";\n",
  ), "src/index.ts", valueReexportPopulation)
}

/**
 * Verifies a type-only edge withholds through a value barrel above it.
 *
 * The mark travels rather than being read at the entry, so a value re-export of
 * a type-only re-export publishes what the inner edge allowed. Every row above
 * is one hop, and dropping the term that carries a nested surface's own mark
 * left the whole suite green.
 *
 *  1. Re-export type-only from an inner barrel.
 *  2. Re-export that barrel by name from the entry.
 *  3. Assert the entry publishes the type-only population.
 */
func TestATypeOnlyEdgeWithholdsThroughAValueBarrelAboveIt(t *testing.T) {
  assertReexportedFrom(t, "value over type-only", map[string]string{
    "src/sale.ts":  reexportedSurface,
    "src/inner.ts": "export type { Sale, IPlain, run } from \"./sale.js\";\n",
    "src/index.ts": "export { Sale, IPlain, run } from \"./inner.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}

/**
 * Verifies a type-only star withholds through a value star below it.
 *
 * The other direction of the same term, and the one the recursive calls carry:
 * dropping the inherited mark from the star and namespace branches also left
 * the whole suite green, because nothing walked two star hops.
 *
 *  1. Re-export the module by value from an inner barrel.
 *  2. Re-export that barrel with `export type * from` at the entry.
 *  3. Assert the entry publishes the type-only population.
 */
func TestATypeOnlyStarWithholdsThroughAValueStarBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only over value", map[string]string{
    "src/sale.ts":  reexportedSurface,
    "src/inner.ts": "export * from \"./sale.js\";\n",
    "src/index.ts": "export type * from \"./inner.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}

/**
 * Verifies a type-only star withholds through a named re-export below it.
 *
 * The named branch inherits the mark from the path that reached it as well as
 * reading the edge's own, and the inherited half was pinned by nothing: dropping
 * it left the whole suite green while a type-only star over a named barrel
 * published every value the declaring file holds.
 *
 *  1. Re-export the module by name from an inner barrel.
 *  2. Re-export that barrel with `export type * from` at the entry.
 *  3. Assert the entry publishes the type-only population.
 */
func TestATypeOnlyStarWithholdsThroughANamedReexportBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only star over named", map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/middle.ts": "export { Sale, IPlain, run } from \"./sale.js\";\n",
    "src/index.ts":  "export type * from \"./middle.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}

/**
 * Verifies a type-only star withholds through a namespace re-export below it.
 *
 * The third branch that carries an inherited mark, and the last one nothing
 * pinned. It also keeps the segment, so the row states that the withholding
 * travels with the address rather than being decided where the address starts.
 *
 *  1. Re-export the module as a namespace from an inner barrel.
 *  2. Re-export that barrel with `export type * from` at the entry.
 *  3. Assert the entry publishes the type-only population under the segment.
 */
func TestATypeOnlyStarWithholdsThroughANamespaceReexportBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only star over namespace", map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/middle.ts": "export * as api from \"./sale.js\";\n",
    "src/index.ts":  "export type * from \"./middle.js\";\n",
  }, "src/index.ts", []string{"api.IPlain", "api.IPlain.rate", "api.Sale"})
}

/**
 * Verifies a type-only path lends no mark to another declaration.
 *
 * Two entries under one public name are not always one declaration: an explicit
 * named re-export shadows a star, and the two then name different files. Union
 * the mark across them and the entry describes a path nothing produced, with
 * `Path` from one and the mark from the other, so the value members of a
 * declaration this module reaches only type-only are published. That is the
 * leak the type-only edge exists to stop, arriving through the repair for a
 * different one, and the whole suite stayed green under it.
 *
 * The row asserts the invariant rather than the population: whichever
 * declaration wins the name, nothing reached only through a type-only edge
 * brings its value members. Which one wins is a separate question this
 * traversal answers by source order where TypeScript answers by letting a named
 * re-export shadow a star, and pinning that here would freeze a defect this row
 * is not about.
 *
 *  1. Reach two different classes of one name, one type-only and one by value.
 *  2. Forward both from a middle barrel, in each order, and re-export by name.
 *  3. Assert neither order publishes the type-only declaration's member.
 */
func TestATypeOnlyPathLendsNoMarkToAnotherDeclaration(t *testing.T) {
  layout := func(middle string) map[string]string {
    return map[string]string{
      "src/a.ts": `
export class Sale {
  alpha: number = 0;
}
`,
      "src/b.ts": `
export class Sale {
  beta: number = 0;
}
`,
      "src/middle.ts": middle,
      "src/index.ts":  "export { Sale } from \"./middle.js\";\n",
    }
  }
  for _, middle := range []string{
    "export type * from \"./a.js\";\nexport { Sale } from \"./b.js\";\n",
    "export { Sale } from \"./b.js\";\nexport type * from \"./a.js\";\n",
  } {
    for _, target := range reexportedFrom(t, layout(middle), "src/index.ts") {
      if target != "Sale.prototype.alpha" {
        continue
      }
      t.Fatalf(
        "a declaration reached only type-only published a value member for %q",
        strings.TrimSpace(middle),
      )
    }
  }
}
