// no_marker_comment is the option-aware companion of no_todo_comment.
//
// Same comment-scanning shape, but the marker list is configurable via
// the `[severity, { markers: [...] }]` tuple form a user writes in
// `lint.config.ts`. Exists so the contributor protocol's per-rule
// options surface (rule.Context.Options + rule.Context.DecodeOptions)
// is exercised end-to-end alongside the existing diagnostic-stream
// demo.
package demo

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"

  "github.com/samchon/ttsc/packages/lint/rule"
)

func init() {
  rule.Register(noMarkerComment{})
}

// noMarkerComment flags any comment that contains one of the
// configured marker strings. Defaults to the same set
// `no_todo_comment` hard-codes (TODO, FIXME) so a user who enables
// the rule without options gets the obvious behavior.
type noMarkerComment struct{}

// noMarkerCommentOptions mirrors the TS-side interface that augments
// `ITtscLintRuleOptionsMap["demo/no-marker-comment"]` in `src/index.ts`.
// The JSON tag matches the TS field name exactly — this is the
// JSON-↔-interface parity contract every option-aware rule depends on.
type noMarkerCommentOptions struct {
  Markers []string `json:"markers"`
}

func (noMarkerComment) Name() string { return "demo/no-marker-comment" }

func (noMarkerComment) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (noMarkerComment) Check(ctx *rule.Context, _ *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  var opts noMarkerCommentOptions
  _ = ctx.DecodeOptions(&opts)
  markers := opts.Markers
  if len(markers) == 0 {
    markers = []string{"TODO", "FIXME"}
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(ctx.File.Text())
  scanner.SetSkipTrivia(false)
  for {
    kind := scanner.Scan()
    if kind == shimast.KindEndOfFile {
      return
    }
    if kind != shimast.KindSingleLineCommentTrivia &&
      kind != shimast.KindMultiLineCommentTrivia {
      continue
    }
    token := scanner.TokenText()
    start := scanner.TokenStart()
    for _, marker := range markers {
      offset := strings.Index(token, marker)
      if offset < 0 {
        continue
      }
      ctx.ReportRange(
        start+offset,
        start+offset+len(marker),
        marker+" marker is not allowed.",
      )
    }
  }
}
