// typescript/ban-ts-comment: a faithful port of typescript-eslint's
// ban-ts-comment rule, including its recommended defaults, per-directive
// options, description thresholds, and description-format matching.
//
// The rule scans every parser-classified comment token (via
// forEachCommentToken)
// instead of reading `SourceFile.CommentDirectives`: the compiler-side
// list only carries the error-suppression directives (`@ts-expect-error`,
// `@ts-ignore`) and would miss `@ts-nocheck` / `@ts-check` entirely.
//
// Directive recognition mirrors the upstream rule (which in turn mirrors
// the TypeScript compiler's own regexes):
//
//   - `@ts-check` / `@ts-nocheck` are pragmas: line comments with two or
//     three leading slashes only. Block comments never activate them.
//   - `@ts-expect-error` / `@ts-ignore` match line comments (any number
//     of leading slashes) and the LAST line of a block comment — the only
//     line the compiler honors.
//   - `@ts-nocheck` is skipped when it appears at or after the first
//     statement's line, because the compiler ignores it there.
//
// Reference: https://typescript-eslint.io/rules/ban-ts-comment
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// tsCommentJSWhitespace is the ECMAScript `\s` character class. The
// upstream regexes run under JavaScript semantics where `\s` covers the
// Unicode space separators and the BOM; Go's `\s` is ASCII-only, so the
// class is spelled out to keep the port byte-faithful.
const tsCommentJSWhitespace = `[\t\n\v\f\r \x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]`

var (
  // tsPragmaLineRegex matches the `@ts-check` / `@ts-nocheck` pragma form
  // against the FULL line-comment text (`//...`): two or three leading
  // slashes, optional whitespace, then the directive. Mirrors upstream's
  // singleLinePragmaRegEx applied to `'//' + comment.value`.
  tsPragmaLineRegex = regexp.MustCompile(`^///?` + tsCommentJSWhitespace + `*@ts-(?P<directive>check|nocheck)(?P<description>.*)$`)

  // tsDirectiveLineRegex matches `@ts-expect-error` / `@ts-ignore` against
  // a line comment's value (text after the opening `//`): any number of
  // extra slashes, optional whitespace, then the directive.
  tsDirectiveLineRegex = regexp.MustCompile(`^/*` + tsCommentJSWhitespace + `*@ts-(?P<directive>expect-error|ignore)(?P<description>.*)`)

  // tsDirectiveBlockRegex matches `@ts-expect-error` / `@ts-ignore`
  // against the last line of a block comment's value.
  tsDirectiveBlockRegex = regexp.MustCompile(`^` + tsCommentJSWhitespace + `*(?:/|\*)*` + tsCommentJSWhitespace + `*@ts-(?P<directive>expect-error|ignore)(?P<description>.*)`)

  // tsCommentLineBreakRegex splits block-comment values on the ECMAScript
  // line terminators (upstream LINEBREAK_MATCHER).
  tsCommentLineBreakRegex = regexp.MustCompile(`\r\n|[\r\n\x{2028}\x{2029}]`)
)

// tsCommentDirective is one recognized directive with the raw description
// text that follows it (untrimmed, exactly as the upstream regex captures
// it — descriptionFormat patterns match against this raw text).
type tsCommentDirective struct {
  directive   string // "check" | "nocheck" | "expect-error" | "ignore"
  description string
}

// findTsDirectiveInComment classifies one comment token. `raw` is the full
// comment text including delimiters. Returns nil when the comment carries
// no supported directive.
func findTsDirectiveInComment(kind shimast.Kind, raw string) *tsCommentDirective {
  if kind == shimast.KindSingleLineCommentTrivia {
    if match := tsPragmaLineRegex.FindStringSubmatch(raw); match != nil {
      return &tsCommentDirective{directive: match[1], description: match[2]}
    }
    if match := tsDirectiveLineRegex.FindStringSubmatch(raw[2:]); match != nil {
      return &tsCommentDirective{directive: match[1], description: match[2]}
    }
    return nil
  }
  // Block comment: only the last line can carry an effective directive,
  // matching the compiler's scanner (and the upstream rule).
  value := strings.TrimSuffix(raw[2:], "*/")
  lines := tsCommentLineBreakRegex.Split(value, -1)
  if match := tsDirectiveBlockRegex.FindStringSubmatch(lines[len(lines)-1]); match != nil {
    return &tsCommentDirective{directive: match[1], description: match[2]}
  }
  return nil
}

// tsDirectivePolicy is the normalized evaluation mode for one directive.
// At most one of `ban` and `requireDescription` is set; `format` is only
// non-nil when `requireDescription` is set.
type tsDirectivePolicy struct {
  ban                bool
  requireDescription bool
  format             *regexp.Regexp
}

// banTsCommentOptions is the raw wire shape of the rule's options object.
// Directive values stay as raw JSON because each accepts a boolean,
// the string "allow-with-description", or `{ descriptionFormat }` — the
// upstream DirectiveConfig union.
type banTsCommentOptions struct {
  MinimumDescriptionLength *int            `json:"minimumDescriptionLength"`
  TsCheck                  json.RawMessage `json:"ts-check"`
  TsExpectError            json.RawMessage `json:"ts-expect-error"`
  TsIgnore                 json.RawMessage `json:"ts-ignore"`
  TsNocheck                json.RawMessage `json:"ts-nocheck"`
}

// resolvedBanTsCommentOptions is the per-run policy table after merging
// user options over the upstream recommended defaults.
type resolvedBanTsCommentOptions struct {
  minimumDescriptionLength int
  check                    tsDirectivePolicy
  expectError              tsDirectivePolicy
  ignore                   tsDirectivePolicy
  nocheck                  tsDirectivePolicy
}

func (o resolvedBanTsCommentOptions) policy(directive string) tsDirectivePolicy {
  switch directive {
  case "check":
    return o.check
  case "expect-error":
    return o.expectError
  case "ignore":
    return o.ignore
  case "nocheck":
    return o.nocheck
  }
  return tsDirectivePolicy{}
}

// resolveBanTsCommentOptions merges the decoded options over the upstream
// recommended defaults:
//
//  {
//    minimumDescriptionLength: 3,
//    "ts-check": false,
//    "ts-expect-error": "allow-with-description",
//    "ts-ignore": true,
//    "ts-nocheck": true,
//  }
//
// Absent keys keep their default; present keys replace it wholesale, the
// same per-key merge ESLint applies to defaultOptions.
func resolveBanTsCommentOptions(raw banTsCommentOptions) resolvedBanTsCommentOptions {
  resolved := resolvedBanTsCommentOptions{
    minimumDescriptionLength: 3,
    check:                    tsDirectivePolicy{},
    expectError:              tsDirectivePolicy{requireDescription: true},
    ignore:                   tsDirectivePolicy{ban: true},
    nocheck:                  tsDirectivePolicy{ban: true},
  }
  if raw.MinimumDescriptionLength != nil {
    resolved.minimumDescriptionLength = *raw.MinimumDescriptionLength
  }
  resolved.check = normalizeTsDirectiveConfig(raw.TsCheck, resolved.check)
  resolved.expectError = normalizeTsDirectiveConfig(raw.TsExpectError, resolved.expectError)
  resolved.ignore = normalizeTsDirectiveConfig(raw.TsIgnore, resolved.ignore)
  resolved.nocheck = normalizeTsDirectiveConfig(raw.TsNocheck, resolved.nocheck)
  return resolved
}

// normalizeTsDirectiveConfig turns one raw DirectiveConfig value into a
// policy. Upstream validates the shape through its JSON schema and rejects
// the whole config on mismatch; this host has no schema layer, so a value
// outside the documented union quietly keeps the directive's documented
// default rather than inventing a stricter policy.
func normalizeTsDirectiveConfig(raw json.RawMessage, def tsDirectivePolicy) tsDirectivePolicy {
  if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
    return def
  }
  var flag bool
  if json.Unmarshal(raw, &flag) == nil {
    return tsDirectivePolicy{ban: flag}
  }
  var literal string
  if json.Unmarshal(raw, &literal) == nil {
    if literal == "allow-with-description" {
      return tsDirectivePolicy{requireDescription: true}
    }
    return def
  }
  var object struct {
    DescriptionFormat *string `json:"descriptionFormat"`
  }
  if json.Unmarshal(raw, &object) == nil {
    // Upstream treats an object without a truthy descriptionFormat as
    // plain allowance: it neither bans nor demands a description.
    if object.DescriptionFormat == nil || *object.DescriptionFormat == "" {
      return tsDirectivePolicy{}
    }
    format, err := regexp.Compile(*object.DescriptionFormat)
    if err != nil {
      // The format cannot be enforced (upstream would have thrown while
      // constructing the RegExp). Keep the description-length gate the
      // object form implies instead of silently allowing everything.
      return tsDirectivePolicy{requireDescription: true}
    }
    return tsDirectivePolicy{requireDescription: true, format: format}
  }
  return def
}

// banTsComment implements typescript/ban-ts-comment.
type banTsComment struct{}

func (banTsComment) Name() string           { return "typescript/ban-ts-comment" }
func (banTsComment) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }

func (banTsComment) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  text := ctx.File.Text()
  // Cheap short-circuit: every supported directive contains this
  // substring, so directive-free files skip the comment re-scan entirely
  // (same strategy as parseLintInlineDirectives).
  if !strings.Contains(text, "@ts-") {
    return
  }

  var raw banTsCommentOptions
  if err := ctx.DecodeOptions(&raw); err != nil {
    return
  }
  options := resolveBanTsCommentOptions(raw)

  // The compiler only honors `@ts-nocheck` before the first statement;
  // upstream compares source lines, so a directive on the same line as
  // the first statement is inert too and stays unreported.
  firstStatementLine := -1
  if statements := ctx.File.Statements; statements != nil && len(statements.Nodes) > 0 && statements.Nodes[0] != nil {
    pos := shimscanner.SkipTrivia(text, statements.Nodes[0].Pos())
    firstStatementLine = shimscanner.GetECMALineOfPosition(ctx.File, pos)
  }

  forEachCommentToken(ctx.File, func(kind shimast.Kind, pos, end int) {
    matched := findTsDirectiveInComment(kind, text[pos:end])
    if matched == nil {
      return
    }
    if matched.directive == "nocheck" && firstStatementLine >= 0 &&
      firstStatementLine <= shimscanner.GetECMALineOfPosition(ctx.File, pos) {
      return
    }

    policy := options.policy(matched.directive)
    if policy.ban {
      if matched.directive == "ignore" {
        reportTsIgnoreInsteadOfExpectError(ctx, text, pos, end)
      } else {
        ctx.ReportRange(pos, end, fmt.Sprintf(
          "Do not use `@ts-%s` because it alters compilation errors.",
          matched.directive,
        ))
      }
    }
    if policy.requireDescription {
      if stringLength(strings.TrimSpace(matched.description)) < options.minimumDescriptionLength {
        ctx.ReportRange(pos, end, fmt.Sprintf(
          "Include a description after the `@ts-%[1]s` directive to explain why the @ts-%[1]s is necessary. The description must be %[2]d characters or longer.",
          matched.directive, options.minimumDescriptionLength,
        ))
      } else if policy.format != nil && !policy.format.MatchString(matched.description) {
        ctx.ReportRange(pos, end, fmt.Sprintf(
          "The description for the `@ts-%s` directive must match the %s format.",
          matched.directive, policy.format.String(),
        ))
      }
    }
  })
}

// reportTsIgnoreInsteadOfExpectError reports a banned `@ts-ignore` with the
// upstream suggestion attached as an autofix edit: rewrite the first
// `@ts-ignore` occurrence in the comment body to `@ts-expect-error`. The
// rewrite can never hide a compiler error — where `@ts-ignore` silently
// suppressed one, `@ts-expect-error` suppresses the same one, and where
// the next line was error-free the compiler now reports the unused
// directive instead of staying silent.
func reportTsIgnoreInsteadOfExpectError(ctx *Context, text string, pos, end int) {
  const message = "Use `@ts-expect-error` instead of `@ts-ignore`, as `@ts-ignore` will do nothing if the following line is error-free."
  // Search the comment body (both `//` and `/*` delimiters are two bytes),
  // mirroring upstream's comment.value.replace(/@ts-ignore/, ...) which
  // rewrites the first occurrence in the delimiter-free value.
  body := text[pos:end]
  index := strings.Index(body[2:], "@ts-ignore")
  if index < 0 {
    ctx.ReportRange(pos, end, message)
    return
  }
  editPos := pos + 2 + index
  ctx.ReportRangeFix(pos, end, message, TextEdit{
    Pos:  editPos,
    End:  editPos + len("@ts-ignore"),
    Text: "@ts-expect-error",
  })
}

func init() {
  Register(banTsComment{})
}
