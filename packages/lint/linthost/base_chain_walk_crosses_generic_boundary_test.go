package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestBaseChainWalkCrossesGenericBoundary exercises the exposed checker
// traversal over an authored Base <- Mid<T> <- Sub inheritance graph.
//
// The pinned compiler's base-type query expects an interface-type payload.
// A generic reference needs its symbol resolved to the declared instance type
// before continuing the walk. The guarded naive mode records Mid and stops;
// the bridged mode must reach Base while excluding the disconnected Unrelated
// class. This owns ancestry traversal, not private-field emit or consumer
// crashes, and does not test whether repository symbols are merely nameable.
//
// 1. Load the real fixture checker and acquire Sub's declared instance type.
// 2. Walk exposed base/type-name operations without and with the symbol bridge.
// 3. Assert the naive generic boundary, bridged Base and unrelated-class absence.
//
// @evidence contracts/testing.md#behavioral-verification The real standalone checker and exposed base/type-name/declared-type operations reach Base from Sub through Mid<string> only with the declared-type bridge; the naive boundary-limited traversal reaches Mid but not Base, and the bridged traversal excludes Unrelated.
// @evidence contracts/testing.md#independent-expectations The authored inheritance graph Sub->Mid<T>->Base and disconnected Unrelated define expected membership independently of traversal results. The naive stop at the generic reference pins the premise for the bridge regression without using the successful traversal as its oracle.
// @evidence contracts/testing.md#distinguishing-cases Direct generic Mid, transitive Base and disconnected Unrelated distinguish underreach and overreach; explicit real checker and declared Sub acquisition prevent empty traversal from passing. The test owns ancestry traversal, not an assertion about private-field emission.
// @evidence contracts/testing.md#execution-ownership loadProgram creates one real fixture/checker and collectAncestorNames composes the exported shim operations in-process in both modes. Authored temporary source/config are compiler inputs, not repository-layout or symbol-nameability checks; no native host or consumer install runs.
func TestBaseChainWalkCrossesGenericBoundary(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  // Base carries a #private field reachable only THROUGH the generic Mid<T>
  // boundary; this test asserts ancestry membership, not a field-copy decision.
  writeFile(t, filepath.Join(root, "src", "main.ts"), `class Base {
  #brand = 0;
  brand(): number {
    return this.#brand;
  }
}
class Mid<T> extends Base {
  value!: T;
}
class Unrelated {}
export class Sub extends Mid<string> {}
void Unrelated;
`)

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()

  if prog.checker == nil {
    t.Fatal("loadProgram did not acquire a checker")
  }

  sub := classSymbol(t, prog, "Sub")
  start := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, sub)
  if start == nil {
    t.Fatal("Checker_getDeclaredTypeOfSymbol returned nil for the Sub class symbol")
  }

  naive := collectAncestorNames(prog.checker, start, false)
  bridged := collectAncestorNames(prog.checker, start, true)

  // The naive walk must dead-end at the generic boundary: it reaches Mid but
  // not Base. If this ever fails, getBaseTypes itself started resolving a
  // generic Reference upstream — the premise changed and this probe (and the
  // consumer algorithm it mirrors) should be revisited.
  if !naive["Mid"] {
    t.Fatal("naive walk did not even reach the direct base Mid; fixture or surface changed")
  }
  if naive["Base"] {
    t.Fatal("premise broken: the naive getBaseTypes walk already reaches Base through the generic boundary; getDeclaredTypeOfSymbol may no longer be required")
  }

  // The bridged walk MUST reach Base. If this fails, the declared-type bridge
  // does not preserve traversal through this authored generic boundary; the
  // observable failure is missing Base membership.
  if !bridged["Base"] {
    t.Fatal("Checker_getDeclaredTypeOfSymbol did not bridge the generic boundary: base-chain walk dead-ended at Mid<string> and never reached Base")
  }
  // Boundary: the bridge must not over-reach to an unrelated class.
  if bridged["Unrelated"] {
    t.Fatal("bridged walk over-reached to an unrelated class")
  }
}

// classSymbol returns the symbol of the top-level class declaration named name,
// failing the test if it is absent.
func classSymbol(t *testing.T, prog *program, name string) *shimast.Symbol {
  t.Helper()
  for _, file := range prog.userSourceFiles() {
    if file.Statements == nil {
      continue
    }
    for _, stmt := range file.Statements.Nodes {
      if sym := stmt.Symbol(); sym != nil && sym.Name == name {
        return sym
      }
    }
  }
  t.Fatalf("class %q not found in fixture", name)
  return nil
}

// collectAncestorNames walks the base chain of start through the exposed shim
// surface and returns the set of type names it reaches. getBaseTypes is only
// safe on a ClassOrInterface type; a generic Reference base nil-derefs it, so
// the boundary name is recorded but only crossed when bridge is set by
// resolving the Reference's symbol to its declared (instance) type via
// Checker_getDeclaredTypeOfSymbol, which IS a ClassOrInterface and safe to keep
// walking. bridge=false mirrors the pre-#246 workaround that dead-ends there.
func collectAncestorNames(c *shimchecker.Checker, start *shimchecker.Type, bridge bool) map[string]bool {
  found := map[string]bool{}
  seen := map[*shimchecker.Type]bool{}
  var visit func(t *shimchecker.Type)
  visit = func(t *shimchecker.Type) {
    if t == nil || seen[t] {
      return
    }
    seen[t] = true
    if sym := shimchecker.Type_getTypeNameSymbol(t); sym != nil {
      found[sym.Name] = true
    }
    if t.ObjectFlags()&shimchecker.ObjectFlagsClassOrInterface == 0 {
      return // not safe to feed to getBaseTypes
    }
    for _, base := range shimchecker.Checker_getBaseTypes(c, t) {
      if base == nil {
        continue
      }
      if base.ObjectFlags()&shimchecker.ObjectFlagsClassOrInterface != 0 {
        visit(base)
        continue
      }
      // base is a generic Reference: record the boundary name, then cross it
      // only when bridging is allowed.
      if sym := shimchecker.Type_getTypeNameSymbol(base); sym != nil {
        found[sym.Name] = true
        if bridge {
          visit(shimchecker.Checker_getDeclaredTypeOfSymbol(c, sym))
        }
      }
    }
  }
  visit(start)
  return found
}
