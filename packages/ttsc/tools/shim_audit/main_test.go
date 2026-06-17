package main

import (
  "go/token"
  "go/types"
  "reflect"
  "testing"
)

// TestLinknameRe pins the two //go:linkname target shapes the reachability scan
// must recognize — a package-level symbol and a (pointer-)receiver method — plus
// slashed (nested) package suffixes, and rejects non-typescript-go targets.
func TestLinknameRe(t *testing.T) {
  cases := []struct {
    line     string
    wantPkg  string
    wantName string
    wantHit  bool
  }{
    {"//go:linkname checkerGetMinArgumentCount github.com/microsoft/typescript-go/internal/checker.(*Checker).getMinArgumentCount", "checker", "getMinArgumentCount", true},
    {"//go:linkname x github.com/microsoft/typescript-go/internal/checker.(Checker).foo", "checker", "foo", true},
    {"//go:linkname GetSourceFileOfNode github.com/microsoft/typescript-go/internal/ast.getSourceFileOfNode", "ast", "getSourceFileOfNode", true},
    {"//go:linkname From github.com/microsoft/typescript-go/internal/vfs/cachedvfs.From", "vfs/cachedvfs", "From", true},
    {"//go:linkname FS github.com/microsoft/typescript-go/internal/vfs/osvfs.FS", "vfs/osvfs", "FS", true},
    {"//go:linkname foo runtime.bar", "", "", false}, // not a tsgo internal target
    {"// just a comment", "", "", false},
  }
  for _, c := range cases {
    m := linknameRe.FindStringSubmatch(c.line)
    if !c.wantHit {
      if m != nil {
        t.Errorf("expected no match for %q, got %v", c.line, m)
      }
      continue
    }
    if m == nil {
      t.Errorf("expected match for %q, got none", c.line)
      continue
    }
    if m[1] != c.wantPkg || m[2] != c.wantName {
      t.Errorf("for %q: got pkg=%q name=%q, want pkg=%q name=%q", c.line, m[1], m[2], c.wantPkg, c.wantName)
    }
  }
}

// TestDedupe locks the determinism guarantee: one entry per kind|pkg|symbol,
// keeping the lexicographically smallest detail, ordered by pkg, kind, symbol.
func TestDedupe(t *testing.T) {
  in := []finding{
    {"FUNC", "checker", "B", "detail-z"},
    {"FUNC", "checker", "B", "detail-a"}, // duplicate key, smaller detail wins
    {"FUNC", "ast", "A", "d2"},
    {"ENUM", "ast", "A", "d1"},
  }
  got := dedupe(in)
  want := []finding{
    {"ENUM", "ast", "A", "d1"},
    {"FUNC", "ast", "A", "d2"},
    {"FUNC", "checker", "B", "detail-a"},
  }
  if !reflect.DeepEqual(got, want) {
    t.Errorf("dedupe mismatch:\n got %+v\nwant %+v", got, want)
  }
}

// TestTierOf pins the kind→tier mapping the gate and report depend on.
func TestTierOf(t *testing.T) {
  cases := map[string]int{"ENUM": 1, "FUNC": 2, "ESCAPE": 3, "ENUM?": 4, "UNEXPORTED": 4}
  for kind, want := range cases {
    if got := tierOf(kind); got != want {
      t.Errorf("tierOf(%q) = %d, want %d", kind, got, want)
    }
  }
}

// TestCommonPrefix covers the helper feeding the abbreviation fallback.
func TestCommonPrefix(t *testing.T) {
  cases := []struct {
    in   []string
    want string
  }{
    {[]string{"OEKParentheses", "OEKTypeAssertions", "OEKSatisfies"}, "OEK"},
    {[]string{"TypeFlagsAny", "TypeFlagsObject"}, "TypeFlags"},
    {[]string{"Foo"}, "Foo"},
    {[]string{"abc", "xyz"}, ""},
    {nil, ""},
  }
  for _, c := range cases {
    if got := commonPrefix(c.in); got != c.want {
      t.Errorf("commonPrefix(%v) = %q, want %q", c.in, got, c.want)
    }
  }
}

// TestAttachUntypedConsts is the crux: it pins both the type-name attribution
// (longest wins) and the abbreviation fallback that closes the untyped+
// unprefixed blind spot (OuterExpressionKinds' OEKExcludeJSDocTypeAssertion),
// plus the negative twins that must NOT over-attach.
func TestAttachUntypedConsts(t *testing.T) {
  t.Run("abbreviation fallback (OEK blind spot)", func(t *testing.T) {
    enums := []string{"OuterExpressionKinds", "Kind"}
    typed := map[string][]string{
      "OuterExpressionKinds": {"OEKParentheses", "OEKTypeAssertions", "OEKNonNullAssertions", "OEKSatisfies"},
      "Kind":                 {"KindCallExpression", "KindIdentifier"},
    }
    untyped := []string{"OEKExcludeJSDocTypeAssertion", "KindFoo", "Unrelated"}
    got := attachUntypedConsts(enums, typed, untyped)
    want := map[string][]string{
      "OuterExpressionKinds": {"OEKExcludeJSDocTypeAssertion"},
      "Kind":                 {"KindFoo"},
    }
    if !reflect.DeepEqual(got, want) {
      t.Errorf("got %v, want %v", got, want)
    }
  })

  t.Run("longest type-name prefix wins", func(t *testing.T) {
    enums := []string{"Foo", "FooBar"}
    got := attachUntypedConsts(enums, nil, []string{"FooBarBaz", "FooQux"})
    want := map[string][]string{"FooBar": {"FooBarBaz"}, "Foo": {"FooQux"}}
    if !reflect.DeepEqual(got, want) {
      t.Errorf("got %v, want %v", got, want)
    }
  })

  t.Run("no abbreviation candidate when members are type-name-prefixed", func(t *testing.T) {
    enums := []string{"NodeFlags"}
    typed := map[string][]string{"NodeFlags": {"NodeFlagsNone", "NodeFlagsConst"}}
    // "NodeFlagsExtra" attaches via the type name; "NFXfoo" must NOT attach
    // (no spurious 2/3-char "NF"/"Nod" abbreviation candidate is created).
    got := attachUntypedConsts(enums, typed, []string{"NodeFlagsExtra", "NFXfoo"})
    want := map[string][]string{"NodeFlags": {"NodeFlagsExtra"}}
    if !reflect.DeepEqual(got, want) {
      t.Errorf("got %v, want %v", got, want)
    }
  })

  t.Run("lowercase boundary is not a member", func(t *testing.T) {
    got := attachUntypedConsts([]string{"Modifier"}, nil, []string{"Modifierabc"})
    if len(got) != 0 {
      t.Errorf("expected no attachment, got %v", got)
    }
  })

  t.Run("short shared prefix (<3) is not used as an abbreviation", func(t *testing.T) {
    // Tristate members share only "TS" (2 chars); an unrelated "TSConfig" const
    // must not be pulled in by an over-broad abbreviation.
    enums := []string{"Tristate"}
    typed := map[string][]string{"Tristate": {"TSUnknown", "TSFalse", "TSTrue"}}
    got := attachUntypedConsts(enums, typed, []string{"TSConfig"})
    if len(got) != 0 {
      t.Errorf("expected no attachment, got %v", got)
    }
  })
}

// TestIsReachable covers the structural recursion plus the decisive case: an
// internal named type is reachable only when the shim exposes it.
func TestIsReachable(t *testing.T) {
  fresh := func() map[types.Type]bool { return map[types.Type]bool{} }
  r := reachable{}

  if !isReachable(types.Typ[types.Int], r, fresh()) {
    t.Error("basic int should be reachable")
  }
  if !isReachable(types.NewPointer(types.NewSlice(types.Typ[types.String])), r, fresh()) {
    t.Error("pointer-to-slice-of-basic should be reachable")
  }

  pkg := types.NewPackage("github.com/microsoft/typescript-go/internal/checker", "checker")
  obj := types.NewTypeName(token.NoPos, pkg, "Foo", nil)
  named := types.NewNamed(obj, types.NewStruct(nil, nil), nil)
  if isReachable(named, reachable{}, fresh()) {
    t.Error("internal checker.Foo must be UNreachable when the shim does not expose it")
  }
  exposed := reachable{}
  exposed.add("checker", "Foo")
  if !isReachable(named, exposed, fresh()) {
    t.Error("internal checker.Foo must be reachable once the shim exposes it")
  }
}
