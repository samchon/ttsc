// Package main is a mechanical completeness auditor for the typescript-go
// shim (`packages/ttsc/shim/*`).
//
// Background. ttsc re-exports typescript-go's `internal/*` packages through the
// shim so plugin authors (typia, nestia, third-party rules) never touch Go
// internals. A missing re-export is an ttsc bug, not a plugin bug — yet they
// keep being discovered one reactive issue at a time (#217, #218, #220, #221,
// #226, #230). This tool computes the shortfall mechanically instead.
//
// The invariant. The shim should be TRANSITIVELY CLOSED over the operations of
// the types it already exposes. If the shim already aliases an upstream type T,
// then everything a plugin can *reach* starting from T should also be reachable
// through the shim. Three closure rules are checked:
//
//   - ENUM   every exported const whose type is an already-exposed enum type
//     must be re-exported. (This is the `SignatureKindConstruct` class —
//     #230 rule 1. `SignatureKind` is exposed but only `...Call` is, so
//     `...Construct` is a deterministic gap.)
//   - FUNC   every exported package-level func whose params and results are all
//     already-reachable types must be reachable. (A plugin holding those
//     types could call it, but can't.)
//   - ESCAPE every exported named type that appears in the signature of an
//     already-exposed operation but is not itself aliased. (A plugin can
//     obtain the value but cannot name its type.)
//
// What it deliberately does NOT find: UNEXPORTED helpers a plugin needs by name
// (e.g. `(*Checker).getMinArgumentCount`, #230 rule 2). Those are invisible to
// closure and must come from the consumer-demand scan. The audit prints the
// unexported method/func pool of exposed types as a triage list so the demand
// side has a bounded candidate set.
//
// Usage (from packages/ttsc):
//
//  go run ./tools/shim_audit            # human report to stdout
//  go run ./tools/shim_audit -md        # markdown report
//
// "Reachable" is computed from what the shim source textually references: every
// `inner<pkg>.Symbol` selector and every //go:linkname target name. That set is
// exactly the surface a plugin can name, regardless of how it was exposed
// (alias, wrapper, or linkname).
package main

import (
  "bytes"
  "encoding/json"
  "flag"
  "fmt"
  "go/ast"
  "go/format"
  "go/parser"
  "go/token"
  "go/types"
  "os"
  "path/filepath"
  "regexp"
  "sort"
  "strings"

  "golang.org/x/tools/go/packages"
)

const internalPrefix = "github.com/microsoft/typescript-go/internal/"

// shimDirs maps each shim directory to its upstream internal package suffix.
// Kept explicit (rather than globbed) so a new shim dir is a conscious add.
var shimDirs = map[string]string{
  "ast":              "ast",
  "bundled":          "bundled",
  "checker":          "checker",
  "compiler":         "compiler",
  "core":             "core",
  "diagnosticwriter": "diagnosticwriter",
  "lsp":              "lsp",
  "parser":           "parser",
  "printer":          "printer",
  "scanner":          "scanner",
  "transformers":     "transformers",
  "tsoptions":        "tsoptions",
  "tspath":           "tspath",
  "vfs":              "vfs",
}

// reachable holds, per upstream package suffix, the set of upstream symbol names
// the shim makes nameable (selector references + linkname targets).
type reachable map[string]map[string]bool

func (r reachable) has(pkg, name string) bool {
  m := r[pkg]
  return m != nil && m[name]
}
func (r reachable) add(pkg, name string) {
  if r[pkg] == nil {
    r[pkg] = map[string]bool{}
  }
  r[pkg][name] = true
}

// linknameRe captures the trailing symbol name of a go:linkname target like
// `...internal/checker.(*Checker).getMinArgumentCount` or `...checker.foo`.
var linknameRe = regexp.MustCompile(`(?m)^//go:linkname\s+\S+\s+` +
  regexp.QuoteMeta("github.com/microsoft/typescript-go/internal/") +
  `([A-Za-z0-9_/]+)\.(?:\(\*?[A-Za-z0-9_]+\)\.)?([A-Za-z0-9_]+)`)

// scanShimReachable parses every .go file under each shim dir and records the
// upstream symbols it references.
func scanShimReachable(shimRoot string) (reachable, error) {
  r := reachable{}
  fset := token.NewFileSet()
  for dir := range shimDirs {
    paths, _ := filepath.Glob(filepath.Join(shimRoot, dir, "*.go"))
    for _, p := range paths {
      src, err := os.ReadFile(p)
      if err != nil {
        return nil, err
      }
      // linkname directives live in comments, so scan raw text too.
      for _, m := range linknameRe.FindAllStringSubmatch(string(src), -1) {
        r.add(m[1], m[2])
      }
      f, err := parser.ParseFile(fset, p, src, parser.SkipObjectResolution)
      if err != nil {
        return nil, fmt.Errorf("%s: %w", p, err)
      }
      // alias map: local import name -> internal pkg suffix
      alias := map[string]string{}
      for _, imp := range f.Imports {
        path := strings.Trim(imp.Path.Value, `"`)
        if !strings.HasPrefix(path, internalPrefix) {
          continue
        }
        suffix := strings.TrimPrefix(path, internalPrefix)
        name := suffix[strings.LastIndex(suffix, "/")+1:]
        if imp.Name != nil {
          name = imp.Name.Name
        }
        alias[name] = suffix
      }
      ast.Inspect(f, func(n ast.Node) bool {
        sel, ok := n.(*ast.SelectorExpr)
        if !ok {
          return true
        }
        id, ok := sel.X.(*ast.Ident)
        if !ok {
          return true
        }
        if suffix, ok := alias[id.Name]; ok {
          r.add(suffix, sel.Sel.Name)
        }
        return true
      })
    }
  }
  return r, nil
}

// checkShimDirCoverage fails if any immediate sub-directory of the shim root
// that contains Go source is not registered in shimDirs. This keeps the audit's
// package list honest: a newly-added shim cannot escape the gate by omission.
func checkShimDirCoverage(shimRoot string) error {
  entries, err := os.ReadDir(shimRoot)
  if err != nil {
    return err
  }
  var unmapped []string
  for _, e := range entries {
    if !e.IsDir() {
      continue
    }
    if _, ok := shimDirs[e.Name()]; ok {
      continue
    }
    if goFiles, _ := filepath.Glob(filepath.Join(shimRoot, e.Name(), "*.go")); len(goFiles) > 0 {
      unmapped = append(unmapped, e.Name())
    }
  }
  if len(unmapped) > 0 {
    sort.Strings(unmapped)
    return fmt.Errorf("shim dir(s) not registered in shimDirs (would escape the audit): %s\n"+
      "  add them to shimDirs in tools/shim_audit/main.go", strings.Join(unmapped, ", "))
  }
  return nil
}

// loadInner loads the upstream internal packages via go/types, anchored in a
// shim module that requires typescript-go (same trick gen_shims uses).
func loadInner(anchorDir string) (map[string]*packages.Package, error) {
  var full []string
  expected := map[string]bool{}
  for _, suffix := range shimDirs {
    full = append(full, internalPrefix+suffix)
    expected[suffix] = true
  }
  loaded, err := packages.Load(&packages.Config{
    Dir:  anchorDir,
    Mode: packages.LoadTypes | packages.NeedDeps | packages.NeedImports,
  }, full...)
  if err != nil {
    return nil, err
  }
  out := map[string]*packages.Package{}
  errored := map[string]string{}
  for _, p := range loaded {
    suffix := strings.TrimPrefix(p.PkgPath, internalPrefix)
    if len(p.Errors) > 0 {
      errored[suffix] = p.Errors[0].Error()
      continue
    }
    out[suffix] = p
  }
  // A package that fails to load (or is missing entirely) must FAIL the audit,
  // never be silently skipped — otherwise a load error in any environment turns
  // the gate into a no-op that passes blind.
  var failed []string
  for suffix := range expected {
    if _, ok := out[suffix]; ok {
      continue
    }
    msg := errored[suffix]
    if msg == "" {
      msg = "did not load"
    }
    failed = append(failed, suffix+": "+msg)
  }
  if len(failed) > 0 {
    sort.Strings(failed)
    return nil, fmt.Errorf("%d shim package(s) failed to load (audit would be incomplete):\n  %s",
      len(failed), strings.Join(failed, "\n  "))
  }
  return out, nil
}

// namedInfo returns the defining package suffix and name of a named type, when
// it is a typescript-go internal type.
func namedInfo(t types.Type) (pkgSuffix, name string, ok bool) {
  n, isNamed := t.(*types.Named)
  if !isNamed || n.Obj().Pkg() == nil {
    return "", "", false
  }
  path := n.Obj().Pkg().Path()
  if !strings.HasPrefix(path, internalPrefix) {
    return "", "", false
  }
  return strings.TrimPrefix(path, internalPrefix), n.Obj().Name(), true
}

// isReachable reports whether a plugin holding only shim-exposed types could
// name/produce a value of type t.
func isReachable(t types.Type, r reachable, seen map[types.Type]bool) bool {
  if seen[t] {
    return true
  }
  seen[t] = true
  switch x := t.(type) {
  case *types.Basic:
    return true
  case *types.Pointer:
    return isReachable(x.Elem(), r, seen)
  case *types.Slice:
    return isReachable(x.Elem(), r, seen)
  case *types.Array:
    return isReachable(x.Elem(), r, seen)
  case *types.Map:
    return isReachable(x.Key(), r, seen) && isReachable(x.Elem(), r, seen)
  case *types.Chan:
    return isReachable(x.Elem(), r, seen)
  case *types.Interface:
    return true // error / empty interface in practice
  case *types.Signature:
    return tupleReachable(x.Params(), r) && tupleReachable(x.Results(), r)
  case *types.TypeParam:
    return false
  case *types.Named:
    o := x.Obj()
    if o.Pkg() == nil {
      return true // builtin error etc.
    }
    path := o.Pkg().Path()
    if strings.HasPrefix(path, internalPrefix) {
      suffix := strings.TrimPrefix(path, internalPrefix)
      if _, shimmed := pkgIsShimmed(suffix); shimmed {
        return r.has(suffix, o.Name())
      }
      return false // internal pkg we do not shim at all
    }
    return o.Exported() // external module type the plugin can import directly
  default:
    return false
  }
}

func tupleReachable(t *types.Tuple, r reachable) bool {
  if t == nil {
    return true
  }
  for i := 0; i < t.Len(); i++ {
    if !isReachable(t.At(i).Type(), r, map[types.Type]bool{}) {
      return false
    }
  }
  return true
}

func pkgIsShimmed(suffix string) (string, bool) {
  for dir, s := range shimDirs {
    if s == suffix {
      return dir, true
    }
  }
  return "", false
}

// Finding kinds.
type finding struct {
  kind   string // ENUM / FUNC / ESCAPE
  pkg    string
  symbol string
  detail string
}

func main() {
  md := flag.Bool("md", false, "emit markdown report")
  fix := flag.Bool("fix", false, "write enums_gen.go closing every exposed enum family (Layer 1)")
  check := flag.Bool("check", false, "CI gate: exit non-zero on any TIER-1 enum gap or any TIER-2/3 gap outside the baseline")
  writeBaseline := flag.Bool("write-baseline", false, "(re)generate the baseline of accepted TIER-2/3 gaps")
  baselinePath := flag.String("baseline", "baseline.json", "path to the accepted-gap baseline")
  anchor := flag.String("anchor", "./shim/ast", "module dir anchoring the typescript-go require")
  shimRoot := flag.String("shim", "./shim", "shim root directory")
  flag.Parse()

  // A shim directory that is not registered in shimDirs would silently escape
  // every check — close that hole before doing anything else.
  if err := checkShimDirCoverage(*shimRoot); err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(2)
  }

  r, err := scanShimReachable(*shimRoot)
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  inner, err := loadInner(*anchor)
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }

  findings, pool := analyze(r, inner)

  switch {
  case *fix:
    runFix(findings, *shimRoot)
  case *writeBaseline:
    runWriteBaseline(findings, *baselinePath)
  case *check:
    runCheck(findings, *baselinePath)
  default:
    report(findings, pool, *md)
  }
}

// analyze runs the three closure checks plus the unexported demand-pool scan and
// returns the deduped findings and pool.
func analyze(r reachable, inner map[string]*packages.Package) (findings, unexportedPool []finding) {
  for suffix, pkg := range inner {
    scope := pkg.Types.Scope()

    // CHECK 1 (ENUM): consts of an exposed enum type that are not re-exported.
    // Two passes so we also catch family members that upstream declares as
    // UNTYPED ints (e.g. `ObjectFlagsContainsSpread = 1 << 22`, which reuses
    // a bit position and drops the `ObjectFlags` annotation). go/types sees
    // those as plain ints, so a strict type-based grouping silently misses
    // them — a real blind spot the closure check must not have.
    constsByType := map[string][]string{} // "pkg.Type" -> member const names
    typeKey := map[string][2]string{}     // "pkg.Type" -> {pkgSuffix, typeName}

    // Seed a family for every exported named basic (int/string) type in this
    // package, keyed by the TYPE — not by whether any of its consts happens to
    // be typed. This is essential: an enum whose members are ALL untyped (every
    // member `= iota` / `1<<n` with no annotation, e.g. printer's
    // GeneratedIdentifierFlags) would otherwise never register as a family, and
    // a partial re-export of exactly the #230 class would pass the gate. A
    // length-then-lexical sort makes the prefix attribution below deterministic.
    var enumNames []string
    for _, name := range scope.Names() {
      tn, ok := scope.Lookup(name).(*types.TypeName)
      if !ok || !tn.Exported() || tn.IsAlias() {
        continue
      }
      if named, ok := tn.Type().(*types.Named); ok {
        if _, isBasic := named.Underlying().(*types.Basic); isBasic {
          enumNames = append(enumNames, name)
        }
      }
    }
    sort.Slice(enumNames, func(i, j int) bool {
      if len(enumNames[i]) != len(enumNames[j]) {
        return len(enumNames[i]) > len(enumNames[j])
      }
      return enumNames[i] < enumNames[j]
    })

    var basicConsts []string // exported consts with an unnamed basic type
    for _, name := range scope.Names() {
      c, ok := scope.Lookup(name).(*types.Const)
      if !ok || !c.Exported() {
        continue
      }
      if ps, tn, ok := namedInfo(c.Type()); ok {
        key := ps + "." + tn
        constsByType[key] = append(constsByType[key], name)
        typeKey[key] = [2]string{ps, tn}
      } else if _, isBasic := c.Type().Underlying().(*types.Basic); isBasic {
        basicConsts = append(basicConsts, name)
      }
    }
    // Attach each untyped const to the longest enum-type-name prefix it carries
    // (followed by an uppercase letter), which is its family by tsgo convention.
    for _, cn := range basicConsts {
      for _, en := range enumNames {
        if len(cn) > len(en) && strings.HasPrefix(cn, en) && cn[len(en)] >= 'A' && cn[len(en)] <= 'Z' {
          key := suffix + "." + en
          constsByType[key] = append(constsByType[key], cn)
          typeKey[key] = [2]string{suffix, en}
          break
        }
      }
    }
    for key, names := range constsByType {
      tk := typeKey[key]
      if !r.has(tk[0], tk[1]) {
        continue // the enum type itself isn't exposed; not a closure gap
      }
      // Tier by partial exposure: an enum with SOME members already
      // re-exported but not all is the near-certain #230 bug class
      // (e.g. SignatureKindCall present, SignatureKindConstruct absent).
      // An enum with zero members exposed is a deliberate type-only
      // aliasing choice — report it, but at INFO.
      var exposed, missing int
      for _, n := range names {
        if r.has(suffix, n) {
          exposed++
        } else {
          missing++
        }
      }
      kind := "ENUM"
      detail := "member of exposed enum " + tk[1]
      if exposed == 0 {
        kind = "ENUM?"
        detail += " (type-only: NO members exposed — likely intentional)"
      } else {
        detail += fmt.Sprintf(" (PARTIAL: %d/%d members exposed — missing siblings)", exposed, exposed+missing)
      }
      for _, n := range names {
        if !r.has(suffix, n) {
          findings = append(findings, finding{kind, suffix, n, detail})
        }
      }
    }

    // CHECK 2 (FUNC) + CHECK 3 (ESCAPE) over exported package-level funcs.
    for _, name := range scope.Names() {
      obj := scope.Lookup(name)
      fn, ok := obj.(*types.Func)
      if !ok || !fn.Exported() {
        continue
      }
      sig := fn.Signature()
      if sig.Recv() != nil || sig.TypeParams() != nil {
        continue
      }
      if r.has(suffix, name) {
        continue
      }
      // ESCAPE: an exported type in this func's signature that isn't aliased —
      // a plugin could obtain/pass the value but cannot name its type. This must
      // cover free functions, not just methods: `func GetFoo() *UnexposedType`
      // is invisible to the FUNC check (its result isn't reachable) yet leaks an
      // unnameable type.
      for _, esc := range escapingTypes(sig, r) {
        findings = append(findings, finding{"ESCAPE", esc[0], esc[1],
          "appears in exported func " + name + " but is not aliased"})
      }
      // FUNC: every param/result already reachable — usable but not exposed.
      if tupleReachable(sig.Params(), r) && tupleReachable(sig.Results(), r) {
        findings = append(findings, finding{"FUNC", suffix, name,
          "all params/results already reachable — usable but not exposed"})
      }
    }

    // CHECK 3 (ESCAPE) + unexported pool, over the FULL method set of each
    // EXPOSED named type — including methods promoted from embedded types, which
    // named.Method(i) would miss (e.g. printer.NodeFactory embeds ast.NodeFactory).
    for _, name := range scope.Names() {
      tn, ok := scope.Lookup(name).(*types.TypeName)
      if !ok || !r.has(suffix, name) {
        continue // only types the shim already exposes
      }
      named, ok := tn.Type().(*types.Named)
      if !ok {
        continue
      }
      mset := types.NewMethodSet(types.NewPointer(named))
      for i := 0; i < mset.Len(); i++ {
        m, ok := mset.At(i).Obj().(*types.Func)
        if !ok {
          continue
        }
        if !m.Exported() {
          if isUsefulUnexported(m, r) {
            unexportedPool = append(unexportedPool, finding{"UNEXPORTED", suffix,
              name + "." + m.Name(), sigString(m.Signature())})
          }
          continue
        }
        // Exported methods of an exposed type are directly callable;
        // the gap is any escaping result/param type that isn't exposed.
        for _, esc := range escapingTypes(m.Signature(), r) {
          findings = append(findings, finding{"ESCAPE", esc[0], esc[1],
            "appears in exposed " + name + "." + m.Name() + " but is not aliased"})
        }
      }
    }
  }

  return dedupe(findings), dedupe(unexportedPool)
}

// escapingTypes returns [pkg,name] of exported internal named types in a
// signature that are not reachable through the shim.
func escapingTypes(sig *types.Signature, r reachable) [][2]string {
  var out [][2]string
  collect := func(t *types.Tuple) {
    if t == nil {
      return
    }
    for i := 0; i < t.Len(); i++ {
      walkNamed(t.At(i).Type(), func(ps, tn string, exported bool) {
        if exported && !r.has(ps, tn) {
          if _, ok := pkgIsShimmed(ps); ok {
            out = append(out, [2]string{ps, tn})
          }
        }
      })
    }
  }
  collect(sig.Params())
  collect(sig.Results())
  return out
}

func walkNamed(t types.Type, fn func(ps, tn string, exported bool)) {
  switch x := t.(type) {
  case *types.Pointer:
    walkNamed(x.Elem(), fn)
  case *types.Slice:
    walkNamed(x.Elem(), fn)
  case *types.Array:
    walkNamed(x.Elem(), fn)
  case *types.Map:
    walkNamed(x.Key(), fn)
    walkNamed(x.Elem(), fn)
  case *types.Chan:
    walkNamed(x.Elem(), fn)
  case *types.Named:
    if ps, tn, ok := namedInfo(x); ok {
      fn(ps, tn, x.Obj().Exported())
    }
  }
}

// isUsefulUnexported keeps unexported methods whose params/results are all
// reachable — i.e. ones a plugin could actually call if linknamed.
func isUsefulUnexported(m *types.Func, r reachable) bool {
  sig := m.Signature()
  if sig.TypeParams() != nil {
    return false
  }
  return tupleReachable(sig.Params(), r) && tupleReachable(sig.Results(), r)
}

func sigString(sig *types.Signature) string {
  return strings.ReplaceAll(types.TypeString(sig, func(p *types.Package) string {
    return p.Name()
  }), "func", "")
}

func dedupe(in []finding) []finding {
  seen := map[string]bool{}
  var out []finding
  for _, f := range in {
    k := f.kind + "|" + f.pkg + "|" + f.symbol
    if seen[k] {
      continue
    }
    seen[k] = true
    out = append(out, f)
  }
  sort.Slice(out, func(i, j int) bool {
    if out[i].pkg != out[j].pkg {
      return out[i].pkg < out[j].pkg
    }
    if out[i].kind != out[j].kind {
      return out[i].kind < out[j].kind
    }
    return out[i].symbol < out[j].symbol
  })
  return out
}

// tierOf maps a finding kind to a confidence tier. Tier 1 is the near-certain
// bug class (#230); higher tiers are progressively noisier candidate pools.
func tierOf(kind string) int {
  switch kind {
  case "ENUM": // partial enum — some members exposed, siblings missing
    return 1
  case "FUNC": // exported op over already-reachable types
    return 2
  case "ESCAPE": // type returned by an exposed op but not aliased
    return 3
  default: // ENUM? type-only enums
    return 4
  }
}

func report(findings, pool []finding, md bool) {
  tiers := map[int][]finding{}
  for _, f := range findings {
    t := tierOf(f.kind)
    tiers[t] = append(tiers[t], f)
  }
  h := func(s string) {
    if md {
      fmt.Printf("\n## %s\n\n", s)
    } else {
      fmt.Printf("\n=== %s ===\n", s)
    }
  }
  row := func(f finding) {
    if md {
      fmt.Printf("| %s | %s | `%s` | %s |\n", f.kind, f.pkg, f.symbol, f.detail)
    } else {
      fmt.Printf("[%-5s] %s.%s — %s\n", f.kind, f.pkg, f.symbol, f.detail)
    }
  }
  thead := func() {
    if md {
      fmt.Printf("| Kind | Pkg | Symbol | Detail |\n|------|-----|--------|--------|\n")
    }
  }

  if md {
    fmt.Printf("# Shim closure audit\n\n")
  } else {
    fmt.Printf("=== Shim closure audit ===\n")
  }
  fmt.Printf("Tier 1 PARTIAL-ENUM (near-certain bugs): %d | Tier 2 FUNC-over-exposed: %d | Tier 3 ESCAPE: %d | Tier 4 type-only enums: %d | Unexported demand pool: %d\n",
    len(tiers[1]), len(tiers[2]), len(tiers[3]), len(tiers[4]), len(pool))

  h("TIER 1 — partial enums (a sibling const is missing; this is the #230 class)")
  thead()
  for _, f := range tiers[1] {
    row(f)
  }

  h("TIER 2 — exported funcs whose params/results are all already reachable")
  thead()
  for _, f := range tiers[2] {
    row(f)
  }

  h("TIER 3 — escaping types (produced by an exposed op but not aliased)")
  thead()
  for _, f := range tiers[3] {
    row(f)
  }

  // Tier 4 (type-only enums) and the unexported pool are large/low-signal:
  // summarize by package rather than dumping every line.
  h("TIER 4 — type-only enums (no members exposed; likely intentional) — counts by pkg")
  fmt.Print(countByPkg(tiers[4]))

  h("UNEXPORTED demand pool (closure-invisible — needs consumer/agent signal) — counts by pkg")
  fmt.Print(countByPkg(pool))
  if !md {
    fmt.Printf("(re-run with a grep, e.g. `| grep '\\.getMin'`, to inspect specific candidates)\n")
  }
}

func countByPkg(in []finding) string {
  c := map[string]int{}
  for _, f := range in {
    c[f.pkg]++
  }
  keys := make([]string, 0, len(c))
  for k := range c {
    keys = append(keys, k)
  }
  sort.Strings(keys)
  var b strings.Builder
  for _, k := range keys {
    fmt.Fprintf(&b, "  %-16s %d\n", k, c[k])
  }
  return b.String()
}

// findingKey is the stable identity of a gap, used for baseline membership.
func findingKey(f finding) string { return f.kind + "|" + f.pkg + "|" + f.symbol }

// baselineFile is the on-disk schema of accepted TIER-2/3 gaps. TIER-1 enum
// gaps are never baselined — they are zero-tolerance and fixed by -fix.
type baselineFile struct {
  Note     string   `json:"note"`
  Accepted []string `json:"accepted"`
}

// shimPackageName reads the `package` clause from a .go file in dir.
func shimPackageName(dir string) string {
  paths, _ := filepath.Glob(filepath.Join(dir, "*.go"))
  fset := token.NewFileSet()
  for _, p := range paths {
    if f, err := parser.ParseFile(fset, p, nil, parser.PackageClauseOnly); err == nil {
      return f.Name.Name
    }
  }
  return filepath.Base(dir)
}

// runFix writes shim/<pkg>/enums_gen.go for every package carrying TIER-1 enum
// gaps, re-exporting each missing member so the family is complete. Const
// re-exports carry no behavior and no ABI risk, so closing the whole family is
// always safe — and makes the #230 class structurally impossible.
func runFix(findings []finding, shimRoot string) {
  byPkg := map[string][]string{}
  for _, f := range findings {
    if f.kind == "ENUM" {
      byPkg[f.pkg] = append(byPkg[f.pkg], f.symbol)
    }
  }
  if len(byPkg) == 0 {
    fmt.Println("shim_audit: no enum-family gaps; nothing to fix")
    return
  }
  pkgs := make([]string, 0, len(byPkg))
  for p := range byPkg {
    pkgs = append(pkgs, p)
  }
  sort.Strings(pkgs)
  for _, pkg := range pkgs {
    names := byPkg[pkg]
    sort.Strings(names)
    dir := filepath.Join(shimRoot, pkg)
    pkgName := shimPackageName(dir)
    alias := "inner" + pkgName
    var b strings.Builder
    b.WriteString("// Code generated by packages/ttsc/tools/shim_audit -fix. DO NOT EDIT.\n//\n")
    b.WriteString("// Closes every exposed enum family: re-exports each upstream member so a\n")
    b.WriteString("// plugin that can name the enum type can name all of its values. Prevents\n")
    b.WriteString("// the #230 class (a sibling const silently missing). Regenerate after a\n")
    b.WriteString("// typescript-go bump with `go run ./tools/shim_audit -fix`.\n\n")
    fmt.Fprintf(&b, "package %s\n\n", pkgName)
    fmt.Fprintf(&b, "import %s %q\n\n", alias, internalPrefix+pkg)
    b.WriteString("const (\n")
    for _, n := range names {
      fmt.Fprintf(&b, "\t%s = %s.%s\n", n, alias, n)
    }
    b.WriteString(")\n")
    out := filepath.Join(dir, "enums_gen.go")
    formatted, err := format.Source([]byte(b.String()))
    if err != nil {
      fmt.Fprintf(os.Stderr, "shim_audit: format %s: %v\n", out, err)
      formatted = []byte(b.String())
    }
    // Match the repo's gofmt-2spaces convention (see .vscode/gofmt-2spaces.sh)
    // so a later `pnpm format` does not churn these generated files.
    formatted = bytes.ReplaceAll(formatted, []byte("\t"), []byte("  "))
    if err := os.WriteFile(out, formatted, 0o644); err != nil {
      fmt.Fprintln(os.Stderr, "shim_audit:", err)
      os.Exit(1)
    }
    fmt.Printf("shim_audit: wrote %s (%d members)\n", out, len(names))
  }
}

// runWriteBaseline records the current TIER-2/3 gaps as accepted, so the gate
// fails only on NEW ones. The list can only shrink as gaps get exposed.
func runWriteBaseline(findings []finding, path string) {
  var keys []string
  for _, f := range findings {
    if f.kind == "FUNC" || f.kind == "ESCAPE" {
      keys = append(keys, findingKey(f))
    }
  }
  sort.Strings(keys)
  data, err := json.MarshalIndent(baselineFile{
    Note:     "Accepted TIER-2 (reachable funcs) and TIER-3 (escaping types) shim gaps. The gate fails on any gap NOT listed here; expose a symbol and remove its line, or run -write-baseline to accept new ones deliberately. TIER-1 enum gaps are never listed — they are zero-tolerance (run -fix).",
    Accepted: keys,
  }, "", "  ")
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  fmt.Printf("shim_audit: wrote %s (%d accepted gaps)\n", path, len(keys))
}

// runCheck is the CI gate. It fails on any TIER-1 enum gap (zero tolerance) or
// any TIER-2/3 gap not present in the baseline.
func runCheck(findings []finding, path string) {
  accepted := map[string]bool{}
  if data, err := os.ReadFile(path); err == nil {
    var bf baselineFile
    if err := json.Unmarshal(data, &bf); err != nil {
      fmt.Fprintf(os.Stderr, "shim_audit: parse %s: %v\n", path, err)
      os.Exit(2)
    }
    for _, k := range bf.Accepted {
      accepted[k] = true
    }
  } else {
    fmt.Fprintf(os.Stderr, "shim_audit: WARNING no baseline at %s; treating all func/type gaps as new\n", path)
  }

  var enumGaps, newGaps []finding
  live := map[string]bool{}
  for _, f := range findings {
    switch f.kind {
    case "ENUM":
      enumGaps = append(enumGaps, f)
    case "FUNC", "ESCAPE":
      live[findingKey(f)] = true
      if !accepted[findingKey(f)] {
        newGaps = append(newGaps, f)
      }
    }
  }
  // Non-failing hygiene note: baseline lines that no longer match a gap (the
  // symbol got exposed) are dead weight; the ratchet stays safe but suggest a prune.
  var stale int
  for k := range accepted {
    if !live[k] {
      stale++
    }
  }
  if stale > 0 {
    fmt.Fprintf(os.Stderr, "shim_audit: note: %d baseline entr(y/ies) no longer match a gap; prune with -write-baseline\n", stale)
  }

  if len(enumGaps) == 0 && len(newGaps) == 0 {
    fmt.Println("shim_audit: OK — every exposed enum family is complete and no new reachable gaps")
    return
  }
  if len(enumGaps) > 0 {
    fmt.Fprintf(os.Stderr, "\nshim_audit: FAIL — %d enum-family member(s) of an EXPOSED enum are not re-exported.\n", len(enumGaps))
    fmt.Fprintf(os.Stderr, "  This is the #230 class. Fix mechanically: `go run ./tools/shim_audit -fix`.\n")
    for _, f := range enumGaps {
      fmt.Fprintf(os.Stderr, "    ENUM   %s.%s\n", f.pkg, f.symbol)
    }
  }
  if len(newGaps) > 0 {
    fmt.Fprintf(os.Stderr, "\nshim_audit: FAIL — %d new reachable gap(s) not in the baseline.\n", len(newGaps))
    fmt.Fprintf(os.Stderr, "  Expose them in the shim, or accept deliberately: `go run ./tools/shim_audit -write-baseline`.\n")
    for _, f := range newGaps {
      fmt.Fprintf(os.Stderr, "    %-6s %s.%s — %s\n", f.kind, f.pkg, f.symbol, f.detail)
    }
  }
  fmt.Fprintln(os.Stderr)
  os.Exit(1)
}
