package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestBaseChainWalkCrossesGenericBoundary is a shim-completeness probe, not a
// lint test: it runs a real Checker over a ttsc-owned fixture and asserts the
// EXPOSED type-walk surface can traverse a class base chain end-to-end —
// including past a generic boundary. This is the mechanical, consumer-free net
// for the recurring "missing shim" class (#246 and its siblings): a dead-end in
// an exposed traversal shows up here as a red `pnpm test:go`, instead of as a
// downstream consumer issue filed weeks later.
//
// The closure auditor (tools/shim_audit) and the compile-time guards can only
// see whether a symbol is NAMEABLE or whether a composition COMPILES — never
// whether a traversal actually COMPLETES at runtime. `Checker_getBaseTypes`
// nil-derefs on a generic `Reference` base (the `Mid<string>` in
// `class Sub extends Mid<string>`), so a base-chain walk dead-ends at the
// generic boundary and an ancestor's `#private` field is unreachable —
// undetected until a consumer crashes. `Checker_getDeclaredTypeOfSymbol` (#246)
// resolves the Reference's symbol back to a ClassOrInterface instance type that
// IS safe to feed to `getBaseTypes`, so the walk continues.
//
//  1. Compile a fixture: `Base{ #brand }` <- `Mid<T>` <- `Sub extends Mid<string>`.
//  2. Walk `Sub`'s base chain through ONLY the exposed shim ops, two ways: the
//     naive walk (ClassOrInterface bases only, the pre-#246 safe workaround) and
//     the bridged walk (resolving a generic Reference base via
//     getDeclaredTypeOfSymbol).
//  3. Assert the naive walk dead-ends BEFORE `Base` (the gap is real) while the
//     bridged walk reaches `Base` and does not over-reach to an unrelated class.
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
  // boundary — the exact shape classify must see to refuse an unsafe field-copy.
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
  // is gone or broken — the #246 dead-end is back, and a consumer's base-chain
  // walk silently misses an inherited #private ancestor.
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
// the boundary name is recorded but only crossed when bridge is set — by
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
