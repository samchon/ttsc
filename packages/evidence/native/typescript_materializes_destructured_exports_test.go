package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies destructured exports: every public binding leaf materializes under
 * its local or aliased export name as a property.
 *
 * Object and array binding patterns have no declaration-level identifier.
 * Recursing through their leaves must preserve renamed, nested, rest, namespace,
 * and later export-list bindings without guessing callable values.
 *
 *  1. Export representative object and array binding patterns.
 *  2. Add namespace, alias, and private negative twins.
 *  3. Assert the exact public property inventory.
 */
func TestTypeScriptDestructuredExportsMaterializeBindingLeaves(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
const source = {
  state: "ready",
  count: 1,
  nested: { enabled: true },
  extra: "rest",
};
const values = [1, 2, 3];

export const {
  state,
  count: publicCount,
  nested: { enabled = false },
  ...remaining,
} = source;
export const [first, , ...tail] = values;

const { extra: local } = source;
export { local as publicLocal };

const { state: hidden } = source;

export namespace Api {
  const source = { status: "ok", hidden: false };
  export const { status: current } = source;
  const { hidden } = source;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Api.current",
    "property:enabled",
    "property:first",
    "property:publicCount",
    "property:publicLocal",
    "property:remaining",
    "property:state",
    "property:tail",
    "type:Api",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "destructured export units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies destructured claim hosts: statement JSDoc remains eligible for the
 * property bindings resident in an exported pattern.
 *
 * TypeScript attaches leading JSDoc to the variable statement wrapper, while
 * public identities live on nested binding elements. Both nodes must receive
 * the same property-host result.
 *
 *  1. Attach evidence to an exported object binding pattern.
 *  2. Select property hosts and one Markdown heading.
 *  3. Assert the complete rule accepts the host.
 */
func TestTypeScriptDestructuredExportStatementsAreClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
const source = { state: "ready" };
/** @evidence docs/spec.md#contract This binding exposes the contract state. */
export const { state } = source;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies a binding leaf stays a property when the pattern is initialized with
 * a function.
 *
 * The cases above destructure records and arrays of data, so the leaf rule is
 * pinned only where nothing could have made a leaf callable. A `const`
 * initialized with a function is the one shape that reaches the callable
 * branch, and the binding-pattern guard is what stops the whole pattern's
 * initializer from being attributed to each leaf.
 *
 * The two pattern kinds are not symmetric. The object row is a program that
 * compiles, since a function does carry `length` and `name`; the array row is
 * `TS2488` under a checker, because a function is not iterable. It is here
 * anyway: the guard covers both kinds, nothing else in the package narrows it,
 * and its shape is what this case is for.
 *
 * Scope is the other axis the guard does not read, so it is measured rather
 * than assumed: a namespace row is here because a guard narrowed to module
 * scope would otherwise pass.
 *
 *  1. Destructure a function into an object pattern and into an array pattern
 *     at module scope, and into an object pattern inside a namespace.
 *  2. Collect the inventory.
 *  3. Assert every leaf is a property.
 */
func TestDestructuredLeavesStayPropertiesUnderAFunctionInitializer(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export const { length: named, name: labelled } = function target() {};
export const [firstLeaf, ...restLeaves] = (): void => {};
export namespace api {
  export const { length: nestedLeaf } = function target() {};
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:api.nestedLeaf",
    "property:firstLeaf",
    "property:labelled",
    "property:named",
    "property:restLeaves",
    "type:api",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "destructured leaves under a function initializer:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
