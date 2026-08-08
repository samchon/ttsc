package evidence

import (
  "path/filepath"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

/**
 * Verifies TypeScript materialization: type, property, and every documented
 * callable form receive stable public identities.
 *
 * Function syntax is deliberately broader than FunctionDeclaration. The
 * negative twins exclude mutable variables, type-only methods, accessors,
 * private/protected members, and non-exported classes.
 *
 *  1. Parse all supported and adjacent unsupported declaration forms.
 *  2. Collect the inventory's unit targets.
 *  3. Assert the exact public identity set.
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
  absolute := filepath.ToSlash(filepath.Join(t.TempDir(), "api.ts"))
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

/**
 * Verifies TypeScript unit diagnostics point to declaration lines rather than
 * the beginning of leading trivia.
 *
 * AST node full starts may include blank lines and JSDoc. Those positions are
 * useful for comment attachment but misleading in an ambiguous-target or
 * missing-acknowledgement diagnostic that names the contract itself.
 *
 *  1. Put comments and blank lines before an interface and callable.
 *  2. Materialize type, property, and function units.
 *  3. Assert each unit records the line containing its declaration name.
 */
func TestTypeScriptUnitLocationsPointToDeclarations(t *testing.T) {
  inventory := parseTypeScriptInventory(
    t,
    "src/contracts.ts",
    `// File preface.

/** Shape contract. */
export interface Shape {
  width: number;
}

/** Draw contract. */
export const draw = (): void => {};
`,
  )
  lines := map[string]int{}
  for _, unit := range inventory.Units {
    lines[unit.Target] = unit.Line
  }
  want := map[string]int{
    "Shape":       4,
    "Shape.width": 5,
    "draw":        9,
  }
  for target, expected := range want {
    if actual := lines[target]; actual != expected {
      t.Errorf("%s line = %d, want %d", target, actual, expected)
    }
  }
}

/**
 * Verifies TypeScript callable claim hosts: JSDoc on arrow constants,
 * instance methods, static methods, and namespace functions is accepted.
 *
 * These declarations attach JSDoc to different AST shapes. Exercising them
 * through the complete project rule prevents one syntactic form from becoming
 * a source unit that can never bear a valid acknowledgement.
 *
 *  1. Materialize four Markdown source headings.
 *  2. Cite one from each documented callable host form.
 *  3. Assert the function-only claim group is complete.
 */
func TestTypeScriptFunctionClaimAcceptsEveryCallableHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Arrow
## Instance
## Static
## Field
## Typed Field
## Namespace
`,
    "src/api.ts": `
/** @evidence docs/spec.md#arrow Arrow handler implements this section. */
export const arrow = (): void => {};

export class Service {
  /** @evidence docs/spec.md#instance Instance method implements this section. */
  run(): void {}

  /** @evidence docs/spec.md#static Static method implements this section. */
  static create(): void {}

  /** @evidence docs/spec.md#field Function field implements this section. */
  handler = (): void => {};

  /** @evidence docs/spec.md#typed-field Function-typed field implements this section. */
  callback!: () => void;
}

export namespace Api {
  /** @evidence docs/spec.md#namespace Namespace function implements this section. */
  export function send(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/api.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies non-ASCII source text before JSDoc does not corrupt declaration
 * ranges or evidence parsing.
 *
 * TypeScript AST offsets and Go string slices must use the same coordinate
 * system. If they diverge after multibyte text, the rule slices the wrong bytes
 * and silently loses an otherwise valid declaration.
 *
 *  1. Put Korean text before a JSDoc evidence declaration.
 *  2. Use a Korean reason to exercise the complete comment slice.
 *  3. Assert the selected TypeScript host still acknowledges the source.
 */
func TestTypeScriptDeclarationRangesSurviveUnicodeSourceText(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
const 설명 = "다국어 선행 텍스트";

/** @evidence docs/spec.md#contract 이 타입은 문서의 계약을 따른다. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies the TypeScript source default: omitting symbol selects exported
 * interfaces, type aliases, classes, and namespaces without charging callable
 * or property units.
 *
 * The default is intentionally narrower than the claim default. A test that
 * merely inspects decoded options would miss a materializer that ignored the
 * selector and indexed every discovered declaration anyway.
 *
 * The class is here because the omitted selector now reaches it: remove it and
 * `{@link Sale}` stops resolving. Its members are along for the ride rather
 * than under test, since a citation of the class discharges its descendants
 * whether or not they are in the denominator, and this case cannot tell those
 * two apart.
 *
 *  1. Put types, a class with members, a namespace, properties, and callables
 *     in one source file.
 *  2. Acknowledge only the four type identities from a TypeScript claim.
 *  3. Assert the omitted source selector creates no additional obligation.
 */
func TestTypeScriptSourceDefaultMaterializesOnlyTypes(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export interface Shape { width: number; }
export type Options = { enabled: boolean };
export class Sale {
  readonly price: number = 0;
  charge(): void {}
}
export namespace Api {
  export const state = "ready";
  export function run(): void {}
}
export function draw(): void {}
export const render = (): void => {};
`,
    "src/ledger.ts": `import type { Api, Options, Sale, Shape } from "./contracts";

/**
 * @evidence {@link Shape} Shape is documented here.
 * @evidence {@link Options} Options are documented here.
 * @evidence {@link Sale} The subject contract is documented here.
 * @evidence {@link Api} The namespace contract is documented here.
 */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"]}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies every TypeScript selector as a graph source: types, callables, and
 * qualified properties each create an acknowledgement obligation, while a
 * selected type scope covers its property descendants.
 *
 * Inventory inspection alone cannot prove that source filtering preserves all
 * three kinds. This complete graph acknowledges the exact targets after the
 * configured symbol union is applied.
 *
 *  1. Select `"type"`, `"function"`, and `"property"` from one source file.
 *  2. Acknowledge the interface scope and arrow-function identity by link.
 *  3. Assert the source selector materializes all three kinds.
 */
func TestTypeScriptSourceAcceptsEverySymbolKind(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export interface Shape {
  width: number;
}
export const draw = (): void => {};
`,
    "src/ledger.ts": `import type { Shape, draw } from "./contracts";

/**
 * @evidence {@link Shape} The interface is documented.
 * @evidence {@link draw} The callable is documented.
 */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","function","property"]}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies local export lists and aliases use the public export identity.
 *
 * An exported contract need not carry an `export` modifier on its declaration.
 * When `export { Local as Public }` exposes it, evidence targets must use the
 * public name; a type-only export must not expose runtime callable behavior.
 *
 *  1. Export local type, function, class, and namespace declarations by alias.
 *  2. Export a second function through `export type` only.
 *  3. Assert public aliases materialize and local/runtime-only names do not.
 */
func TestTypeScriptExportListsUsePublicAliases(t *testing.T) {
  source := `
interface LocalType {
  field: string;
}
const localFunction = (): void => {};
const typeOnlyFunction = (): void => {};
const localValue = 1;
class LocalClass {
  run(): void {}
}
namespace LocalNamespace {
  export const act = (): void => {};
}
export {
  LocalType as PublicType,
  localFunction as publicFunction,
  localValue as publicValue,
  LocalClass as PublicClass,
  LocalNamespace as PublicNamespace,
};
export type {
  LocalType as TypeOnlyPublicType,
  typeOnlyFunction as TypeOnlyFunction,
};
`
  absolute := filepath.ToSlash(filepath.Join(t.TempDir(), "exports.ts"))
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: absolute},
    source,
    shimcore.ScriptKindTS,
  )
  inventory := scanTypeScriptInventory("src/exports.ts", file)
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  want := []string{
    "PublicClass",
    "PublicClass.prototype.run",
    "PublicNamespace",
    "PublicNamespace.act",
    "PublicType",
    "PublicType.field",
    "TypeOnlyPublicType",
    "TypeOnlyPublicType.field",
    "publicFunction",
    "publicValue",
  }
  sort.Strings(want)
  if strings.Join(targets, "\n") != strings.Join(want, "\n") {
    t.Fatalf("export-list targets:\n%s\nwant:\n%s", strings.Join(targets, "\n"), strings.Join(want, "\n"))
  }
}

/**
 * Verifies a callable exported through a local alias remains an eligible JSDoc
 * host, including for an exclusion acknowledgement.
 *
 * Source materialization and claim-host selection use the same public
 * export analysis. Testing only source targets could leave aliased callables
 * visible as evidence while rejecting declarations attached to them.
 *
 *  1. Attach an exclusion to a local arrow-function `const`.
 *  2. Export that declaration under a public alias.
 *  3. Assert the function-only claim group accepts the host and exclusion.
 */
func TestTypeScriptExportAliasCanHostEvidenceExclusion(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidenceExclude docs/spec.md#contract This adapter intentionally does not use the contract. */
const local = (): void => {};
export { local as publicAdapter };
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies the TypeScript artifact discriminator does not absorb JavaScript
 * files merely because `allowJs` placed them in the compiler Program.
 *
 * SourceFile ASTs can represent both languages, but the public variant is
 * explicitly `"typescript"`. Its file inventory therefore accepts TypeScript
 * extensions and leaves JavaScript for a future artifact variant.
 *
 *  1. Parse equivalent `.ts` and `.js` source files under one project root.
 *  2. Build the TypeScript inventory from both Program entries.
 *  3. Assert only the TypeScript path is available to globs.
 */
func TestTypeScriptInventoryExcludesJavaScriptProgramFiles(t *testing.T) {
  root := t.TempDir()
  parse := func(name string, kind shimcore.ScriptKind) *shimast.SourceFile {
    return shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{
        FileName: filepath.ToSlash(filepath.Join(root, name)),
      },
      "export function run(): void {}",
      kind,
    )
  }
  inventories := loadTypeScriptInventories(
    root,
    []*shimast.SourceFile{
      parse("api.ts", shimcore.ScriptKindTS),
      parse("api.js", shimcore.ScriptKindJS),
    },
    anchoredGraph(root, graphConfig{Claims: []claimSpec{{
      Type: artifactTypeScript,
    }}}),
  )
  if inventories["api.ts"] == nil {
    t.Fatal("TypeScript Program file was not indexed")
  }
  if inventories["api.js"] != nil {
    t.Fatal("JavaScript Program file entered the TypeScript artifact inventory")
  }
}

/**
 * Verifies every TypeScript-family extension in the public artifact boundary is
 * eligible when the compiler Program supplies it, including TSX.
 *
 * The Program, rather than a filesystem crawl, owns TypeScript availability.
 * An extension filter that accidentally recognizes only `.ts` would make a
 * valid exported callable disappear even though ttsc parsed the file.
 *
 *  1. Parse a TSX Program entry containing an exported arrow component.
 *  2. Load TypeScript inventories from that Program.
 *  3. Assert the TSX path and callable unit are present.
 */
func TestTypeScriptInventoryIncludesTSXProgramFiles(t *testing.T) {
  root := t.TempDir()
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{
      FileName: filepath.ToSlash(filepath.Join(root, "view.tsx")),
    },
    "export const View = () => <div />;",
    shimcore.ScriptKindTSX,
  )
  inventory := loadTypeScriptInventories(
    root,
    []*shimast.SourceFile{file},
    anchoredGraph(root, graphConfig{Claims: []claimSpec{{
      Type: artifactTypeScript,
    }}}),
  )["view.tsx"]
  if inventory == nil {
    t.Fatal("TSX Program file was not indexed")
  }
  if len(inventory.Units) != 1 ||
    inventory.Units[0].Symbol != "function" ||
    inventory.Units[0].Target != "View" {
    t.Fatalf("TSX callable inventory = %+v", inventory.Units)
  }
}

/**
 * Verifies TypeScript's type and value namespaces do not collapse evidence
 * units that share one public target text.
 *
 * An interface and a callable `const` may legally export the same name. A
 * function-only source must retain the callable, while a source selecting both
 * kinds must report that the unqualified declaration target is ambiguous.
 *
 *  1. Export an interface and arrow function named `Shared` from one file.
 *  2. Select only `"function"` and assert `Shared` resolves to the callable.
 *  3. Select both kinds and assert the shared target becomes ambiguous.
 */
func TestTypeScriptSymbolKindsDoNotCollapseSharedTargets(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": `
export interface Shared {
  value: string;
}
export const Shared = (): void => {};
`,
    "src/ledger.ts": `import type { Shared } from "./contracts";

/** @evidence {@link Shared} The public callable is documented. */
export interface ILedger {}
`,
  }
  functionOnly := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"function"}
  }]}`)
  assertNoProblems(t, functionOnly)

  bothKinds := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","function"]}
  }]}`)
  assertProblemContains(t, bothKinds, "Ambiguous evidence target '{@link Shared}'")
}

/**
 * Verifies dotted literal member names do not collapse with qualified class
 * identities that render to the same public target.
 *
 * The displayed target intentionally stays human-readable, but its internal
 * identity must retain segment boundaries. Otherwise a static literal method
 * silently overwrites an instance method rather than making the target
 * ambiguous.
 *
 *  1. Export an instance `run` and static `"prototype.run"` method.
 *  2. Cite their shared displayed target.
 *  3. Assert resolution sees two distinct callable units.
 */
func TestTypeScriptIdentityPreservesLiteralSegmentBoundaries(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `export class Service {
  run(): void {}
  static "prototype.run"(): void {}
}
`,
    "src/ledger.ts": `import type { Service } from "./contracts";

/** @evidence {@link Service.prototype.run} This target cannot choose a callable. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Ambiguous evidence target '{@link Service.prototype.run}'")
  assertProblemContains(t, messages, "src/contracts.ts:2")
  assertProblemContains(t, messages, "src/contracts.ts:3")
}

/**
 * Verifies slash and backslash characters in TypeScript literal names remain
 * exact symbol identity.
 *
 * Both literals are legal public method names, and treating either separator as
 * structure makes two distinct callable units ambiguous, leaving neither exact
 * target independently acknowledgeable.
 *
 * The path-normalization half of this hazard is now structural rather than
 * tested: a code target reaches resolution only as an inline link from a
 * TypeScript claim, and `normalizeMarkdownTarget` is never applied to one. What
 * remains worth pinning is that the segment boundary itself survives a
 * separator inside a literal name.
 *
 *  1. Export slash and backslash static literal methods.
 *  2. Acknowledge each exact target by link from one TypeScript claim.
 *  3. Assert both callable units resolve without collision.
 */
func TestTypeScriptLiteralTargetsKeepExactSeparators(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `export class Service {
  static "a\\b"(): void {}
  static "a/b"(): void {}
}
`,
    "src/ledger.ts": `import type { Service } from "./contracts";

/**
 * @evidence {@link Service.a\b} The backslash-named callable is documented.
 * @evidence {@link Service.a/b} The slash-named callable is documented.
 */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"function"}
  }]}`)
  assertNoProblems(t, messages)
}
