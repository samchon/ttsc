package evidence

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies TypeScript materialization: type, property, and every documented
 * callable form receive stable public identities.
 *
 * Function syntax is deliberately broader than FunctionDeclaration. The
 * negative twins exclude accessors, private/protected members, and
 * non-exported classes.
 *
 *  1. Parse all supported and adjacent unsupported declaration forms.
 *  2. Collect the inventory's unit targets.
 *  3. Assert the exact public identity set.
 *
 * @evidence contracts/testing.md#behavioral-verification scanTypeScriptInventory is called on one parsed file and the sorted list of unit targets (symbol kind is not recorded) must equal an authored literal list of 30 targets covering interface and object-type members, function declarations and callable consts, class instance/static/field members, namespaces including a dotted one, and a nested class.
 * @evidence contracts/testing.md#independent-expectations The expected list is authored from the contract that every documented callable form and every public member has a stable public address. Absent from it, and therefore asserted absent, are the get accessor, the protected and private members and the non-exported class Internal. The mutable arrow export `mutable` is present, because a mutable variable is still a public property unit; it is not a negative case.
 * @evidence contracts/testing.md#distinguishing-cases Positive forms (declaration, arrow, function expression, parenthesized, as-asserted, satisfies, mutable let, instance/static/field callables, declared function-typed fields) sit beside negatives (accessor, protected, private, non-exported class). Because only targets are compared, a callable misclassified as a property would still pass here; symbol kinds are asserted by sibling inventory tests.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptMaterializesEveryDocumentedCallableForm runs as a Go unit entry in the native package. scanTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptMaterializesEveryDocumentedCallableForm(t *testing.T) {
  source := `
export interface Shape {
  width: number;
  draw(): void;
}
export type Options = {
  enabled: boolean;
  run(): void;
};
export function declared(): void {}
export const arrow = (): void => {};
export const expression = function (): void {};
export const parenthesized = (() => {});
export const asserted = (() => {}) as () => void;
export const satisfied = (() => {}) satisfies () => void;
export let mutable = (): void => {};
export class Service {
  run(): void {}
  static create(): void {}
  handler = (): void => {};
  static factory = function (): void {};
  declare callback: () => void;
  declare wrapped: (() => void);
  declare static provider: () => void;
  protected hidden(): void {}
  private secret = (): void => {};
  get value(): number { return 1; }
}
export namespace Api {
  export function fetch(): void {}
  export const send = (): void => {};
  export class Client {
    connect(): void {}
    static open(): void {}
  }
}
export namespace Outer.Inner {
  export const nested = (): void => {};
}
class Internal {
  method(): void {}
}
`
  absolute := shimtspath.RootedFilePathFromAbsolute(filepath.Join(t.TempDir(), "api.ts"))
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: absolute},
    source,
    shimcore.ScriptKindTS,
  )
  inventory := scanTypeScriptInventory("src/api.ts", file)
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  want := []string{
    "Api",
    "Api.Client",
    "Api.Client.open",
    "Api.Client.prototype.connect",
    "Api.fetch",
    "Api.send",
    "Options",
    "Options.enabled",
    "Options.run",
    "Outer",
    "Outer.Inner",
    "Outer.Inner.nested",
    "Service",
    "Service.create",
    "Service.provider",
    "Service.factory",
    "Service.prototype.callback",
    "Service.prototype.handler",
    "Service.prototype.run",
    "Service.prototype.wrapped",
    "Shape",
    "Shape.draw",
    "Shape.width",
    "arrow",
    "asserted",
    "declared",
    "expression",
    "mutable",
    "parenthesized",
    "satisfied",
  }
  sort.Strings(want)
  if strings.Join(targets, "\n") != strings.Join(want, "\n") {
    t.Fatalf("TypeScript targets:\n%s\nwant:\n%s", strings.Join(targets, "\n"), strings.Join(want, "\n"))
  }
}
