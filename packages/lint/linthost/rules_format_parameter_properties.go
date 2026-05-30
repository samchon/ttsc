package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatParameterProperties breaks a constructor's parameter list onto
// one-parameter-per-line when it declares parameter properties, matching
// Prettier 3. Prettier forces the break whenever a constructor has more
// than one parameter and at least one carries an accessibility or
// `readonly` modifier (a parameter property), regardless of whether the
// flat form fits printWidth:
//
//  constructor(
//    private readonly repo: Repository,
//    private readonly logger: Logger,
//  ) {}
//
// A single parameter property stays inline (`constructor(private x: T)`),
// and a constructor with no parameter property is left to the ordinary
// width-driven reflow. The rule rewrites only the `(...)` parameter
// region and emits no trailing comma, format/trailing-comma adds it on
// the now-multi-line list, so the two rules stay disjoint. Idempotent:
// an already-broken list contains a newline and is skipped.
type formatParameterProperties struct{}

// formatParameterPropertiesOptions carries the indentation settings the
// rewrite needs. The config layer mirrors format.tabWidth/useTabs in.
type formatParameterPropertiesOptions struct {
  TabWidth *int  `json:"tabWidth"`
  UseTabs  *bool `json:"useTabs"`
}

func (formatParameterProperties) Name() string   { return "format/parameter-properties" }
func (formatParameterProperties) IsFormat() bool { return true }

func (formatParameterProperties) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConstructor}
}

func (formatParameterProperties) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  ctor := node.AsConstructorDeclaration()
  if ctor == nil || ctor.Parameters == nil {
    return
  }
  params := ctor.Parameters.Nodes
  // Prettier only force-breaks when there is more than one parameter; a
  // lone parameter property stays inline.
  if len(params) < 2 || !anyParameterProperty(params) {
    return
  }

  src := ctx.File.Text()
  // The constructor must be the first token on its line so its leading
  // whitespace is a sound base indent; otherwise abstain.
  ctorStart := shimscanner.SkipTrivia(src, node.Pos())
  if ctorStart < 0 || ctorStart > len(src) {
    return
  }
  lineStart := lineStartOffset(src, ctorStart)
  for i := lineStart; i < ctorStart; i++ {
    if src[i] != ' ' && src[i] != '\t' {
      return
    }
  }
  indent := src[lineStart:ctorStart]

  // Locate the `(` immediately preceding the first parameter (scanning
  // back over whitespace only, so a parameter decorator's own `(` is
  // never mistaken for it) and the matching `)`.
  firstStart := shimscanner.SkipTrivia(src, params[0].Pos())
  openPos := -1
  for i := firstStart - 1; i >= 0; i-- {
    c := src[i]
    if c == '(' {
      openPos = i
      break
    }
    if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
      return
    }
  }
  if openPos < 0 {
    return
  }
  closePos := findCloseTokenAfter(src, ctor.Parameters.End(), ')')
  if closePos < 0 {
    return
  }
  region := src[openPos : closePos+1]
  if strings.ContainsRune(region, '\n') {
    return // already multi-line
  }
  // A comment inside the region cannot survive the param-by-param
  // reconstruction, so abstain rather than drop it.
  if strings.Contains(region, "//") || strings.Contains(region, "/*") {
    return
  }

  var opts formatParameterPropertiesOptions
  _ = ctx.DecodeOptions(&opts)
  oneLevel := "  "
  if opts.UseTabs != nil && *opts.UseTabs {
    oneLevel = "\t"
  } else if opts.TabWidth != nil && *opts.TabWidth > 0 {
    oneLevel = strings.Repeat(" ", *opts.TabWidth)
  }
  inner := indent + oneLevel

  var b strings.Builder
  b.WriteString("(\n")
  for i, p := range params {
    if p == nil {
      return
    }
    ps := shimscanner.SkipTrivia(src, p.Pos())
    pe := p.End()
    if ps < 0 || pe < ps || pe > len(src) {
      return
    }
    b.WriteString(inner)
    b.WriteString(strings.TrimRight(src[ps:pe], " \t"))
    if i < len(params)-1 {
      b.WriteByte(',')
    }
    b.WriteByte('\n')
  }
  b.WriteString(indent)
  b.WriteByte(')')
  newText := b.String()
  if newText == region {
    return
  }
  ctx.ReportRangeFix(
    openPos,
    closePos+1,
    "Constructor with parameter properties should list one parameter per line.",
    TextEdit{Pos: openPos, End: closePos + 1, Text: newText},
  )
}

// anyParameterProperty reports whether any parameter carries an
// accessibility (`public`/`private`/`protected`) or `readonly` modifier,
// which makes it a parameter property.
func anyParameterProperty(params []*shimast.Node) bool {
  for _, p := range params {
    if p == nil {
      continue
    }
    mods := p.Modifiers()
    if mods == nil {
      continue
    }
    for _, m := range mods.Nodes {
      switch m.Kind {
      case shimast.KindPublicKeyword,
        shimast.KindPrivateKeyword,
        shimast.KindProtectedKeyword,
        shimast.KindReadonlyKeyword:
        return true
      }
    }
  }
  return false
}

func init() {
  Register(formatParameterProperties{})
}
