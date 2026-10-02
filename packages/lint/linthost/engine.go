// The lint plugin hosts the rule registry, the AST-walking engine, and the
// orchestration glue that the `@ttsc/lint` native plugin uses to run rules
// against a tsgo Program.
//
// Layering:
//
//   - `Rule` is the interface every rule implements. Rules are
//     registered at package init time and never mutated.
//   - `Engine` walks every user source file once, dispatching each visited
//     node to the rules that opted in via `Visits()`.
//   - `Context` is what a rule receives when it fires; it owns the
//     report channel back to the engine.
//
// Rules are stateless across files: each file/rule pair gets a fresh Context
// and may not retain references to the previous file. This keeps the
// file walks independent. AST-only rules may run across files in parallel;
// a shared type checker requires serial execution.
package linthost

import (
  "encoding/json"
  "errors"
  "fmt"
  "os"
  "runtime"
  "sort"
  "sync"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// Rule is the contract every lint rule satisfies.
//
// Metadata must remain stable after registration. Check may run concurrently
// for different files and must not retain a Context after the file's walk.
//
// @evidence contracts/common.md#principled-implementation Stable names and AST kind subscriptions identify a rule and the nodes on which its Check operation has meaning.
// @evidence contracts/common.md#clear-and-simple-design The interface separates identity, subscriptions and checking; options and checker requirements remain optional capabilities.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Rules enter through registration and explicit callbacks rather than replacing compiler methods or dispatch globals.
// @evidence contracts/common.md#meaningful-documentation The native comment states metadata stability, concurrent calls and Context lifetime; each method explains its role with separated prose and tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Rule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Rule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule is a declaration of data shape; the code that holds its values owns their lifetime.
type Rule interface {
  // Name is the stable identifier used in configuration and diagnostics.
  // Existing rule families keep their documented identifiers; registration
  // does not translate ESLint namespaces or aliases.
  //
  // @evidence contracts/common.md#principled-implementation A stable string gives configuration, registry lookup and findings the same rule identity.
  // @evidence contracts/common.md#clear-and-simple-design Identity is one metadata operation independent of checking or option decoding.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The identifier belongs to the rule contract rather than a consumer or fixture-specific mapping.
  // @evidence contracts/common.md#meaningful-documentation The comment distinguishes the registered identity from configuration alias normalization and requires stability.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Rule.Name is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Rule.Name is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule.Name is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule.Name is a method signature without a body; each implementation owns any retained state.
  Name() string

  // Visits returns the AST kinds the rule cares about. The engine only
  // dispatches to rules that registered for the visited node's kind,
  // which keeps the per-node hot path linear in active rules rather
  // than total rules.
  //
  // The returned metadata is read during engine construction and must stay
  // stable after registration; duplicate kinds are accepted and deduplicated.
  //
  // @evidence contracts/common.md#principled-implementation Subscriptions use the compiler's Kind discriminants, which match the visited AST node's Kind without textual inference.
  // @evidence contracts/common.md#clear-and-simple-design The method declares dispatch interests separately from Check, allowing the engine to bind fixed kind buckets once.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Subscription is a supported extension point; no AST or foreign visitor method is replaced.
  // @evidence contracts/common.md#meaningful-documentation Native prose explains dispatch cost, metadata lifetime and duplicate-kind treatment before the tags.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Rule.Visits is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Rule.Visits is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule.Visits is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule.Visits is a method signature without a body; each implementation owns any retained state.
  Visits() []shimast.Kind

  // Check is invoked once per relevant node. Use `ctx.Report` to emit
  // findings.
  //
  // The host contains a panic to this rule's current file. A rule must not
  // rewrite the shared AST or replace the engine-owned Context fields.
  // Checker access must use its supported query operations.
  //
  // @evidence contracts/common.md#principled-implementation Check receives an actual subscribed AST node and its file-resolved Context, so reports retain compiler positions and rule policy.
  // @evidence contracts/common.md#clear-and-simple-design One callback owns checking while Context owns diagnostics, leaving traversal and failure containment in the host.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The supported callback reports through Context and does not authorize mutation of compiler internals.
  // @evidence contracts/common.md#meaningful-documentation The comment supplies invocation, reporting, mutation and panic-lifetime constraints with paragraph separation.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Rule.Check is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Rule.Check is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule.Check is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule.Check is a method signature without a body; each implementation owns any retained state.
  Check(ctx *Context, node *shimast.Node)
}

// FormatRule is an optional marker interface that tags a Rule as a
// formatter. `ttsc fix` applies edits from both lint and format rules.
// `ttsc format`
// is the format-only convenience: it filters to FormatRule findings so
// lint-class rewrites are skipped. The marker exists so the format
// filter can pick the right half; fix needs no filter.
//
// FormatRule.IsFormat must return true unconditionally because the method
// is a structural marker. Returning false
// is treated by the engine as "not a format rule" and is equivalent to
// not implementing the interface at all.
//
// @evidence contracts/common.md#principled-implementation Embedding Rule plus an explicit true marker preserves the rule contract while distinguishing format findings for the format command.
// @evidence contracts/common.md#clear-and-simple-design The optional capability adds one classification operation rather than a separate registry or checking protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Command filtering uses the declared capability rather than special-casing formatter names.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain fix versus format, unconditional true and false-marker semantics before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation FormatRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms FormatRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work FormatRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FormatRule is a declaration of data shape; the code that holds its values owns their lifetime.
type FormatRule interface {
  Rule

  // IsFormat identifies a formatting rule. The value is stable after
  // registration; false keeps findings in the ordinary lint category.
  //
  // @evidence contracts/common.md#principled-implementation A boolean capability supplies the classification consumed when a file-rule Context is bound.
  // @evidence contracts/common.md#clear-and-simple-design The marker adds category information without changing Check or report signatures.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Classification is explicit metadata rather than inferred from rule names or expected edits.
  // @evidence contracts/common.md#meaningful-documentation The method comment states value stability and false behavior, separated from its tags.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation FormatRule.IsFormat is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms FormatRule.IsFormat is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work FormatRule.IsFormat is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FormatRule.IsFormat is a method signature without a body; each implementation owns any retained state.
  IsFormat() bool
}

// typeAwareRule marks rules that need a live TypeScript checker in Context.
// Rules that do not implement it are assumed AST-only.
type typeAwareRule interface {
  NeedsTypeChecker() bool
}

// ruleOptionsValidator is an optional rule capability for rejecting malformed
// configuration before the rule enters the dispatch table. The exported method
// lets rule implementations opt in without coupling the engine to specific rule
// names; a nil payload represents the rule's default options.
type ruleOptionsValidator interface {
  ValidateOptions(json.RawMessage) error
}

// ruleOptionsAcceptor is the structural declaration that a rule owns an
// options schema. The engine uses the capability instead of a rule-name list,
// so adding an options payload to a rule requires the implementation itself to
// opt in. A false result is equivalent to omitting the interface.
type ruleOptionsAcceptor interface {
  AcceptsTtscLintOptions() bool
}

// optionsRule is embedded by built-in rules whose public configuration accepts
// an options slot. Keeping the marker next to each implementation makes the
// registry the runtime source of truth without a parallel name table.
type optionsRule struct{}

func (optionsRule) AcceptsTtscLintOptions() bool { return true }

// isFormatRule reports whether `r` opts into the format category.
func isFormatRule(r Rule) bool {
  fr, ok := r.(FormatRule)
  return ok && fr.IsFormat()
}

func ruleNeedsTypeChecker(r Rule) bool {
  tr, ok := r.(typeAwareRule)
  return ok && tr.NeedsTypeChecker()
}

// ruleDiagnosticTags returns the diagnostic tags a rule classifies its findings
// with, or nil when the rule implements no marker or returns none. Read once per
// (file, rule) at dispatch and shared by its findings. TaggedRule metadata must
// remain immutable after registration.
func ruleDiagnosticTags(r Rule) []publicrule.DiagnosticTag {
  tagged, ok := r.(publicrule.TaggedRule)
  if !ok {
    return nil
  }
  return tagged.DiagnosticTags()
}

func ruleAcceptsOptions(r Rule) bool {
  acceptor, ok := r.(ruleOptionsAcceptor)
  return ok && acceptor.AcceptsTtscLintOptions()
}

func validateRuleOptions(r Rule, options json.RawMessage) error {
  if len(options) > 0 && !ruleAcceptsOptions(r) {
    return errors.New("rule does not accept options")
  }
  validator, ok := r.(ruleOptionsValidator)
  if !ok {
    return nil
  }
  return validator.ValidateOptions(options)
}

// Context is the per-(file, rule) handle the engine passes to `Check`.
//
// `Options` is the raw JSON payload resolved for this source file from the
// same config entries as Severity. One option slot preserves its scalar or
// object shape; multiple positional options are an array. It is nil for a
// bare severity. Rules decode the payload according to their public option
// type and fall back to defaults on nil.
//
// Engine-owned fields are read-only to rules. The Context and its file memo
// live for one file walk; Checker may be nil for an AST-only invocation.
//
// @evidence contracts/common.md#principled-implementation The handle binds source identity, checker, resolved severity and raw options to one file/rule pair, keeping reports under that pair's policy.
// @evidence contracts/common.md#clear-and-simple-design Public inputs describe rule evaluation; private collector, capability flags and memo keep dispatch and retention ownership inside the engine.
// @evidence contracts/common.md#prohibited-implementation-shortcuts File-invariant data is shared through an owned memo, not patched onto foreign AST nodes or global compiler objects.
// @evidence contracts/common.md#meaningful-documentation Native prose explains options shape, read-only ownership and lifetime; member comments describe nil checker, directory origin and severity.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context is a declaration of data shape; the code that holds its values owns their lifetime.
type Context struct {
  // File is the source whose text and byte positions reports use.
  File *shimast.SourceFile

  // Checker is the shared checker when required; AST-only calls may omit it.
  Checker *shimchecker.Checker

  // CurrentDirectory is the compiler's directory for resolving project paths.
  CurrentDirectory string

  // Severity is this file's resolved diagnostic policy for the current rule.
  Severity Severity

  // Options is the resolved JSON payload; nil selects the rule's defaults.
  Options json.RawMessage

  rule           Rule
  isFormat       bool
  tags           []publicrule.DiagnosticTag
  quarantined    bool
  collect        func(*Finding)
  projectResults publicrule.ProjectResultReader
  fileMemo       *fileMemo
}

// fileMemo caches file-invariant values that rules would otherwise
// recompute once per visited node. The engine binds one instance per
// source file and shares it across every Context it builds for that
// file's rules. Whole-file tables, such as security bindings or top-level
// JSX declarations, can be computed once instead of rescanned at every
// matching node. Each file's walk is serial and gets its own instance,
// so the map needs no locking. The memo becomes collectible after the walk;
// it is not reused across changed files or later runs.
//
// Keys are sentinel zero-size struct values whose distinct types make
// collisions impossible without a central registry; the engine never
// inspects them, keeping the hook general.
type fileMemo struct {
  values map[any]any
}

// fileValue returns the cached value stored under key, reporting whether
// one was present. A nil memo (a Context built outside the engine, e.g.
// in a focused unit test) always misses, so callers transparently fall
// back to recomputing.
func (c *Context) fileValue(key any) (any, bool) {
  if c == nil || c.fileMemo == nil || c.fileMemo.values == nil {
    return nil, false
  }
  value, ok := c.fileMemo.values[key]
  return value, ok
}

// setFileValue records value under key for the rest of this file's walk.
// A nil memo drops the write, leaving the caller to recompute on the next
// request. Missing cache storage changes cost rather than rule meaning.
func (c *Context) setFileValue(key, value any) {
  if c == nil || c.fileMemo == nil {
    return
  }
  if c.fileMemo.values == nil {
    c.fileMemo.values = map[any]any{}
  }
  c.fileMemo.values[key] = value
}

// DecodeOptions unmarshals the rule's options blob into `out`. Returns
// nil with no side effect when the rule was configured with severity
// alone, so callers can write
//
//  var opts myRuleOptions
//  ctx.DecodeOptions(&opts)
//  // opts now holds either the user's settings or the zero value.
//
// An invalid payload or destination returns encoding/json's error.
//
// @evidence contracts/common.md#principled-implementation encoding/json decodes the preserved payload into the rule's chosen schema; absent options leave initialized defaults intact.
// @evidence contracts/common.md#clear-and-simple-design The adapter owns JSON transport only, leaving schema defaults and validation with the rule.
// @evidence contracts/common.md#prohibited-implementation-shortcuts It uses the ordinary decoder and propagates its error rather than rewriting malformed input to satisfy a particular rule.
// @evidence contracts/common.md#meaningful-documentation The comment documents absent-payload behavior, a defaults example and decoder failures, separated from the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.DecodeOptions performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.DecodeOptions has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.DecodeOptions keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.DecodeOptions acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// Finding is one rule-emitted diagnostic before it gets converted into a
// driver Diagnostic. `IsFormat` mirrors the dispatching rule's category
// so the `format` subcommand's filter can route findings without
// re-querying the registry. The `fix` subcommand applies automatic edits
// from both categories.
//
// File is nil for project-wide diagnostics. Fixes and suggestions remain
// separate because only fixes participate in automatic rewriting.
//
// @evidence contracts/common.md#principled-implementation The record distinguishes rule identity, severity, source range, automatic edits, opt-in edits and project diagnostics without conflating their meanings.
// @evidence contracts/common.md#clear-and-simple-design One diagnostic record carries rendering and editing data; the private failure flag keeps host failures out of inline suppression.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Category and failure status come from dispatch and recovery, not inferred message text or consumer-specific rule names.
// @evidence contracts/common.md#meaningful-documentation Native prose and separated member comments explain byte units, nil file, edit ownership and command treatment.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Finding is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Finding is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Finding is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Finding is a declaration of data shape; the code that holds its values owns their lifetime.
type Finding struct {
  // Rule is the registered identity attached to the diagnostic.
  Rule string

  // Severity is the reporting policy, including errors produced by the host.
  Severity Severity

  // File owns the range; nil identifies a project-wide diagnostic.
  File *shimast.SourceFile

  // Pos is the inclusive starting byte offset within File.
  Pos int

  // End is the exclusive ending byte offset within File.
  End int

  // Message explains the finding to the user.
  Message string

  // Fix contains automatic replacements copied from the reporting rule.
  Fix []TextEdit

  // Suggestions contains separately selected editor actions with owned edits.
  Suggestions []Suggestion

  // IsFormat marks findings eligible for the format-only command.
  IsFormat bool

  // Tags classify what the finding is (unnecessary, deprecated), for an editor
  // to render it distinctively. Populated from the rule's TaggedRule marker at
  // dispatch and shared by that rule's findings; treat this metadata as read-only.
  Tags []publicrule.DiagnosticTag

  // RelatedInformation are secondary locations this finding points at, each with
  // a message. Positions are byte offsets into File, normalized against it at
  // report time, so the LSP renderer resolves them against File's text
  // and attaches File's own URI.
  RelatedInformation []publicrule.RelatedInformation

  engineFailure bool
}

// TextEdit is one byte-range source replacement used by a fix or suggestion.
// Positions use the same byte offsets as shim AST nodes and must point inside
// the finding's source file.
//
// @evidence contracts/common.md#principled-implementation A half-open byte interval and replacement text express deletion, insertion and replacement in the same units as compiler positions.
// @evidence contracts/common.md#clear-and-simple-design Three fields describe one edit without coupling it to automatic or user-selected application.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Edits target explicit source ranges rather than mutating foreign AST objects or substituting expected output.
// @evidence contracts/common.md#meaningful-documentation Native prose and separated member comments define interval bounds, insertion and replacement units.
// @evidenceExclude contracts/portability.md#os-neutral-implementation TextEdit is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms TextEdit is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work TextEdit is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TextEdit is a declaration of data shape; the code that holds its values owns their lifetime.
type TextEdit struct {
  // Pos is the inclusive starting byte offset; Pos == End inserts text.
  Pos int

  // End is the exclusive ending byte offset in the finding's source file.
  End int

  // Text replaces the selected bytes; empty text deletes the interval.
  Text string
}

// Suggestion is an opt-in editor action attached to a finding. Unlike Fix,
// suggestion edits are never consumed by `ttsc fix` or source.fixAll.ttsc;
// the LSP host exposes them as individual quick fixes selected by the user.
//
// Reporting omits actions with an empty title or edit list.
//
// @evidence contracts/common.md#principled-implementation A title and source edits represent a user-selected action, distinct from the diagnostic's automatic fix.
// @evidence contracts/common.md#clear-and-simple-design The record contains only editor presentation and replacements; reporting owns copying and omission of unusable actions.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Suggestions use the supported quick-fix path rather than disguising optional transformations as automatic fixes.
// @evidence contracts/common.md#meaningful-documentation Native prose states opt-in application, excluded automatic commands and member ownership with separated comments.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Suggestion is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Suggestion is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Suggestion is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Suggestion is a declaration of data shape; the code that holds its values owns their lifetime.
type Suggestion struct {
  // Title is the nonempty label presented for this quick fix.
  Title string

  // Edits are replacements in the finding's file, copied during reporting.
  Edits []TextEdit
}

// Report records a finding at the given node's source range. The pos is
// trimmed past leading trivia (whitespace + comments) so the renderer's
// `path:line:col` banner points at the offending token, not the start of
// the surrounding indentation. A finding is silently dropped if the
// configured severity is `off` (defensive: the engine already filters
// by severity before calling Check, but Report is the final gate).
//
// @evidence contracts/common.md#principled-implementation Delegating to ReportFix without edits preserves node range normalization and the current rule's severity gate.
// @evidence contracts/common.md#clear-and-simple-design The diagnostic-only convenience shares the node reporting implementation instead of duplicating collection policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Reports use compiler positions and the bound collector; no guessed location or special expected diagnostic is inserted.
// @evidence contracts/common.md#meaningful-documentation Native prose explains trivia trimming and disabled-rule behavior, with tags separated from the description.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.Report performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.Report has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.Report keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.Report acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) Report(node *shimast.Node, message string) {
  c.ReportFix(node, message)
}

// ReportFix records a node-scoped finding with optional autofix edits.
// The diagnostic range is bounded to File and trimmed past leading trivia.
// Edits are copied but their ranges are validated by the edit application path.
//
// @evidence contracts/common.md#principled-implementation nodeFindingRange bounds positions before reading trivia; collection preserves the configured severity and copies caller-owned edits.
// @evidence contracts/common.md#clear-and-simple-design One operation owns node diagnostics with automatic edits; the helper owns coordinate normalization independently of edit applicability.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The operation reports the actual node under the bound rule, leaving invalid edit rejection to its supported application boundary.
// @evidence contracts/common.md#meaningful-documentation The native comment distinguishes diagnostic normalization, edit copying and application-time validation before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportFix performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportFix has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportFix keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportFix acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportFix(node *shimast.Node, message string, edits ...TextEdit) {
  if c.Severity == SeverityOff || node == nil {
    return
  }
  pos, end := c.nodeFindingRange(node)
  c.collect(&Finding{
    Rule:     c.rule.Name(),
    Severity: c.Severity,
    File:     c.File,
    Pos:      pos,
    End:      end,
    Message:  message,
    Fix:      cloneTextEdits(edits),
    IsFormat: c.isFormat,
    Tags:     c.tags,
  })
}

// ReportSuggestion records a node-scoped finding with one opt-in editor
// action. The diagnostic is still reported when edits is empty, but no quick
// fix is advertised.
//
// An empty title also omits the action. Edits are copied when retained.
//
// @evidence contracts/common.md#principled-implementation The node range is normalized independently of newSuggestions, which retains only titled actions with copied edits while preserving the diagnostic.
// @evidence contracts/common.md#clear-and-simple-design The single-action method separates user-selected edits from automatic fixes and delegates action construction to one helper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Optional edits are explicitly suggestions and never promoted to automatic fixes to satisfy a consumer.
// @evidence contracts/common.md#meaningful-documentation Native prose explains diagnostic retention, omitted actions and edit copying, with separate descriptive and tag blocks.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportSuggestion performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportSuggestion has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportSuggestion keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportSuggestion acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportSuggestion(node *shimast.Node, message string, title string, edits ...TextEdit) {
  if c.Severity == SeverityOff || node == nil {
    return
  }
  pos, end := c.nodeFindingRange(node)
  c.collect(&Finding{
    Rule:        c.rule.Name(),
    Severity:    c.Severity,
    File:        c.File,
    Pos:         pos,
    End:         end,
    Message:     message,
    Suggestions: newSuggestions(title, edits),
    IsFormat:    c.isFormat,
    Tags:        c.tags,
  })
}

// ReportFixSuggestions records one node-scoped diagnostic with an optional
// automatic fix and any number of opt-in editor suggestions. Each slice is
// cloned before collection so a rule cannot mutate a previously reported
// finding through retained backing storage.
//
// @evidence contracts/common.md#principled-implementation One normalized node range anchors the diagnostic, while independent copies preserve automatic and opt-in edits under their distinct application semantics.
// @evidence contracts/common.md#clear-and-simple-design The combined report assembles one Finding using shared normalization and cloning helpers instead of emitting duplicate diagnostics.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Fix and suggestion channels remain explicit; optional actions are not hidden in automatic rewrite data.
// @evidence contracts/common.md#meaningful-documentation The comment explains the combined diagnostic and caller-slice ownership; Suggestion documents which empty actions cloning omits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportFixSuggestions performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportFixSuggestions has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportFixSuggestions keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportFixSuggestions acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportFixSuggestions(
  node *shimast.Node,
  message string,
  fix []TextEdit,
  suggestions ...Suggestion,
) {
  if c.Severity == SeverityOff || node == nil {
    return
  }
  pos, end := c.nodeFindingRange(node)
  c.collect(&Finding{
    Rule:        c.rule.Name(),
    Severity:    c.Severity,
    File:        c.File,
    Pos:         pos,
    End:         end,
    Message:     message,
    Fix:         cloneTextEdits(fix),
    Suggestions: cloneSuggestions(suggestions),
    IsFormat:    c.isFormat,
    Tags:        c.tags,
  })
}

// nodeFindingRange bounds an arbitrary rule-supplied node before reading the
// current file's source text. Contributors can accidentally report a node from
// another file, whose otherwise valid Pos may exceed this Context's source.
func (c *Context) nodeFindingRange(node *shimast.Node) (int, int) {
  if node == nil {
    return shimdw.NormalizeLintRange(c.File, 0, 0)
  }
  pos, end := shimdw.NormalizeLintRange(c.File, node.Pos(), node.End())
  if c.File != nil {
    pos = shimscanner.SkipTrivia(c.File.Text(), pos)
  }
  return shimdw.NormalizeLintRange(c.File, pos, end)
}

// ReportRange records a finding at an explicit byte range inside the
// current file. Use this when the rule wants to highlight a sub-token of
// a node (e.g. an operator inside a BinaryExpression).
//
// @evidence contracts/common.md#principled-implementation Delegating without edits to ReportRangeFix preserves half-open byte range normalization and severity handling for sub-node diagnostics.
// @evidence contracts/common.md#clear-and-simple-design The range-only convenience reuses the range collector rather than introducing another reporting policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The caller supplies actual source byte positions; reporting does not infer ranges from expected message text.
// @evidence contracts/common.md#meaningful-documentation The native comment defines explicit byte ranges and a sub-token use case before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRange performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportRange has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportRange keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportRange acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportRange(pos, end int, message string) {
  c.ReportRangeFix(pos, end, message)
}

// ReportRangeFix records an explicit-range finding with optional autofix edits.
// A missing File drops the report. Diagnostic coordinates are normalized;
// edit ranges are copied unchanged for validation during application.
//
// @evidence contracts/common.md#principled-implementation NormalizeLintRange bounds the explicit diagnostic to its file while copied replacements retain their own coordinates and application validation.
// @evidence contracts/common.md#clear-and-simple-design Explicit range reporting avoids constructing synthetic AST nodes and retains the same Finding transport as node reports.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source coordinates pass through the supported normalization helper rather than patched compiler node positions.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes missing-file behavior, diagnostic bounds and edit validation with separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeFix performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportRangeFix has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportRangeFix keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportRangeFix acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportRangeFix(pos, end int, message string, edits ...TextEdit) {
  if c.Severity == SeverityOff || c.File == nil {
    return
  }
  pos, end = shimdw.NormalizeLintRange(c.File, pos, end)
  c.collect(&Finding{
    Rule:     c.rule.Name(),
    Severity: c.Severity,
    File:     c.File,
    Pos:      pos,
    End:      end,
    Message:  message,
    Fix:      cloneTextEdits(edits),
    IsFormat: c.isFormat,
    Tags:     c.tags,
  })
}

// ReportRangeSuggestion records an explicit-range finding with one opt-in
// editor action. Suggestion edits stay separate from automatic fixes and are
// ignored by `ttsc fix` and source.fixAll.ttsc.
// Empty titles or edit lists omit the action while retaining the diagnostic.
//
// @evidence contracts/common.md#principled-implementation Normalized source coordinates and a separately copied titled action preserve diagnostic location and opt-in rewrite meaning.
// @evidence contracts/common.md#clear-and-simple-design The explicit-range counterpart uses the common suggestion constructor without fabricating a node or automatic fix.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The action stays in the supported suggestion channel; no command-specific automatic rewrite exception is added.
// @evidence contracts/common.md#meaningful-documentation Native prose states source scope, automatic-command exclusion and empty-action behavior before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeSuggestion performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportRangeSuggestion has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportRangeSuggestion keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportRangeSuggestion acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportRangeSuggestion(pos, end int, message string, title string, edits ...TextEdit) {
  if c.Severity == SeverityOff || c.File == nil {
    return
  }
  pos, end = shimdw.NormalizeLintRange(c.File, pos, end)
  c.collect(&Finding{
    Rule:        c.rule.Name(),
    Severity:    c.Severity,
    File:        c.File,
    Pos:         pos,
    End:         end,
    Message:     message,
    Suggestions: newSuggestions(title, edits),
    IsFormat:    c.isFormat,
    Tags:        c.tags,
  })
}

// ReportRangeSuggestions records a finding at an explicit range with several
// candidate suggestions. It is the range counterpart of ReportFixSuggestions,
// added so the public contributor surface can offer a choice at a sub-token
// range and not only at a whole node.
//
// Unusable actions with an empty title or edit list are omitted; retained
// actions own copies of their edits.
//
// @evidence contracts/common.md#principled-implementation Normalizing the primary range and cloning each usable action preserves a single diagnostic with independent user-selected alternatives.
// @evidence contracts/common.md#clear-and-simple-design A range report plus the shared multi-action cloning helper expresses alternatives without duplicate diagnostics or synthetic nodes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alternative edits remain explicit suggestions rather than a sequence of compensating automatic transformations.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain sub-token alternatives, omitted actions and owned edits with a separate tag block.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeSuggestions performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportRangeSuggestions has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportRangeSuggestions keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportRangeSuggestions acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportRangeSuggestions(pos, end int, message string, suggestions ...Suggestion) {
  if c.Severity == SeverityOff || c.File == nil {
    return
  }
  pos, end = shimdw.NormalizeLintRange(c.File, pos, end)
  c.collect(&Finding{
    Rule:        c.rule.Name(),
    Severity:    c.Severity,
    File:        c.File,
    Pos:         pos,
    End:         end,
    Message:     message,
    Suggestions: cloneSuggestions(suggestions),
    IsFormat:    c.isFormat,
    Tags:        c.tags,
  })
}

// ReportRelated records a node-scoped finding with related source locations.
// Each related location's Pos/End is normalized against the current file,
// like a range finding, so a rule that miscomputed an offset
// cannot point the editor outside the file.
//
// @evidence contracts/common.md#principled-implementation The primary node and copied secondary ranges are independently bounded to the same source, matching the renderer's single-file related-location model.
// @evidence contracts/common.md#clear-and-simple-design One Finding carries the primary message and related locations; normalizeRelated owns copying and coordinate policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Related locations use actual supplied positions and supported normalization rather than patched source identities.
// @evidence contracts/common.md#meaningful-documentation Native prose states same-file ownership, byte bounds and the reason for normalization before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRelated performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportRelated has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportRelated keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportRelated acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportRelated(node *shimast.Node, message string, related ...publicrule.RelatedInformation) {
  if c.Severity == SeverityOff || node == nil {
    return
  }
  pos, end := c.nodeFindingRange(node)
  c.collect(&Finding{
    Rule:               c.rule.Name(),
    Severity:           c.Severity,
    File:               c.File,
    Pos:                pos,
    End:                end,
    Message:            message,
    RelatedInformation: c.normalizeRelated(related),
    IsFormat:           c.isFormat,
    Tags:               c.tags,
  })
}

// ReportRangeRelated records an explicit-range finding with related source
// locations. Both the primary range and each related range are normalized
// against the current file.
//
// Related locations are copied; locations in other files require a different
// reporting API and cannot be represented by this method.
//
// @evidence contracts/common.md#principled-implementation Independent normalization bounds primary and secondary byte intervals to the renderer's common file identity, and copied locations isolate caller storage.
// @evidence contracts/common.md#clear-and-simple-design The explicit-range method reuses the related-location helper while keeping node-dependent trivia trimming out of this path.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The method exposes its single-file limitation rather than compensating with guessed foreign-file coordinates.
// @evidence contracts/common.md#meaningful-documentation Native prose supplies normalization, copying and the unsupported cross-file distinction before its separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeRelated performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context.ReportRangeRelated has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context.ReportRangeRelated keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context.ReportRangeRelated acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *Context) ReportRangeRelated(pos, end int, message string, related ...publicrule.RelatedInformation) {
  if c.Severity == SeverityOff || c.File == nil {
    return
  }
  pos, end = shimdw.NormalizeLintRange(c.File, pos, end)
  c.collect(&Finding{
    Rule:               c.rule.Name(),
    Severity:           c.Severity,
    File:               c.File,
    Pos:                pos,
    End:                end,
    Message:            message,
    RelatedInformation: c.normalizeRelated(related),
    IsFormat:           c.isFormat,
    Tags:               c.tags,
  })
}

// normalizeRelated copies the caller's related locations and bounds each range
// to the current file, so the stored Finding owns its slice and every position
// is already safe for the renderer. Returns nil for an empty input, keeping the
// Finding field nil rather than a zero-length slice.
func (c *Context) normalizeRelated(related []publicrule.RelatedInformation) []publicrule.RelatedInformation {
  if len(related) == 0 {
    return nil
  }
  out := make([]publicrule.RelatedInformation, 0, len(related))
  for _, item := range related {
    pos, end := shimdw.NormalizeLintRange(c.File, item.Pos, item.End)
    out = append(out, publicrule.RelatedInformation{
      Pos:     pos,
      End:     end,
      Message: item.Message,
    })
  }
  return out
}

// cloneTextEdits returns a shallow copy of `edits` so that the caller's
// variadic slice cannot be mutated through the stored Finding. Returns nil
// when the input is empty, keeping the Finding.Fix field nil rather than
// a zero-length slice.
func cloneTextEdits(edits []TextEdit) []TextEdit {
  if len(edits) == 0 {
    return nil
  }
  out := make([]TextEdit, len(edits))
  copy(out, edits)
  return out
}

func newSuggestions(title string, edits []TextEdit) []Suggestion {
  if title == "" || len(edits) == 0 {
    return nil
  }
  return []Suggestion{{Title: title, Edits: cloneTextEdits(edits)}}
}

func cloneSuggestions(suggestions []Suggestion) []Suggestion {
  if len(suggestions) == 0 {
    return nil
  }
  cloned := make([]Suggestion, 0, len(suggestions))
  for _, suggestion := range suggestions {
    if suggestion.Title == "" || len(suggestion.Edits) == 0 {
      continue
    }
    cloned = append(cloned, Suggestion{Title: suggestion.Title, Edits: cloneTextEdits(suggestion.Edits)})
  }
  if len(cloned) == 0 {
    return nil
  }
  return cloned
}

// registry stores the package-global rule list keyed by name. Tests can
// also reach into it via `LookupRule`.
type registry struct {
  rules map[string]Rule
}

var registered = &registry{rules: map[string]Rule{}}

// Register adds a rule to the global registry. Called from each rule's
// `init()`. Duplicate names are a programmer error and panic.
//
// Registration must finish before engines or registry readers run; the
// registry does not synchronize concurrent mutation.
//
// @evidence contracts/common.md#principled-implementation Checking and inserting the same captured name establishes unique rule identity; new contributor names invalidate the derived diagnostic-code table.
// @evidence contracts/common.md#clear-and-simple-design The init-time registry owns identity and cache invalidation together, leaving per-run configuration to Engine.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Registration is the declared extension boundary, with duplicate identities rejected rather than silently replacing an implementation.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain initialization ownership, duplicate panic and the absence of concurrent mutation support before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Register performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Register has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Register keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Register acquires no handle or task and retains nothing beyond the receiver's own fields.
func Register(rule Rule) {
  if rule == nil {
    panic("@ttsc/lint: Register called with nil rule")
  }
  name := rule.Name()
  if _, exists := registered.rules[name]; exists {
    panic("@ttsc/lint: rule " + name + " registered twice")
  }
  registered.rules[name] = rule
  if _, builtIn := builtInRuleCodes[name]; !builtIn {
    invalidateRuntimeRuleCodes()
  }
}

// LookupRule returns the registered rule by name, or nil if missing.
// The returned implementation is shared and must preserve its registered
// metadata; callers must not register rules concurrently with lookup.
//
// @evidence contracts/common.md#principled-implementation A map lookup retrieves the exact registered identity and Go's absent-entry zero value expresses a missing implementation.
// @evidence contracts/common.md#clear-and-simple-design The accessor performs identity lookup only, without configuration policy or rule instantiation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts It consults the owned registry rather than translating consumer-specific names or patching foreign implementations.
// @evidence contracts/common.md#meaningful-documentation Native prose supplies absence, shared implementation and registration-lifetime semantics before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation LookupRule performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms LookupRule has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work LookupRule keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources LookupRule acquires no handle or task and retains nothing beyond the receiver's own fields.
func LookupRule(name string) Rule { return registered.rules[name] }

// AllRuleNames returns the registry sorted alphabetically. Useful for
// `--list-rules` style introspection and stable test snapshots.
//
// The returned slice is owned by the caller. The registry must be frozen
// during enumeration, as it is during ordinary engine execution.
//
// @evidence contracts/common.md#principled-implementation Enumerating map keys and sorting strings produces the complete registered identity set in deterministic lexical order.
// @evidence contracts/common.md#clear-and-simple-design One enumeration operation returns an owned slice, keeping registry storage private and ordering policy local.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Names come from actual registrations rather than a copied list of known rules or expected snapshots.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state ordering, caller ownership and the frozen-registry premise before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation AllRuleNames lists registered rule names and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms The registry names are copied once and sorted once, O(rules log rules).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work AllRuleNames keeps no cache; every call lists the registry.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned slice is new and owned by the caller; no handle or task is acquired.
func AllRuleNames() []string {
  names := make([]string, 0, len(registered.rules))
  for n := range registered.rules {
    names = append(names, n)
  }
  sort.Strings(names)
  return names
}

// Engine binds a rule configuration to a Program and walks the AST once
// per source file, dispatching each visited node to its interested rules.
//
// `rules` is a fixed-size slice indexed by `shimast.Kind` value rather
// than a map. `KindCount` bounds the table, and each node selects its
// subscribed rules directly by kind. Entries for unused kinds are nil.
//
// The registry and resolver must remain stable while this engine is used;
// configure execution settings before Run and do not overlap runs.
//
// @evidence contracts/common.md#principled-implementation Kind-indexed subscriptions preserve the compiler's discriminants; separate configuration error, project settings and file-rule state distinguish binding failure from execution policy.
// @evidence contracts/common.md#clear-and-simple-design Engine owns immutable dispatch metadata and run settings; per-file Contexts own transient checking state, with a mutex confined to cross-file unknown-name collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Rules bind through the registry and resolver; no consumer-specific compiler mutation or expected-result table drives execution.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain dispatch representation, stable inputs and nonoverlapping execution, separating these usage premises from the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Engine is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Engine is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Engine is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Engine is a declaration of data shape; the code that holds its values owns their lifetime.
type Engine struct {
  config             RuleResolver
  rules              [][]Rule
  enabled            map[string]Severity
  unknown            []string
  unknownDirectives  map[string]struct{}
  unknownDirectiveMu sync.Mutex
  needsTypeChecker   bool
  serial             bool
  projectSettings    map[string]ProjectRuleSetting
  configError        error
  currentDirectory   string
}

// SetSerial forces Engine.Run to walk files one at a time. The host calls
// this when `--singleThreaded` reaches the lint sidecar so the benchmark
// (and any caller that wants a deterministic, low-overhead pass) can opt
// out of file-level parallelism. Type-aware rule sets always run serial
// regardless of this flag because their standalone checker is not concurrent,
// so callers do not need to force serial execution themselves.
//
// Set this flag before execution; concurrent changes are unsupported.
//
// @evidence contracts/common.md#principled-implementation The flag requests serial file execution while runsSerial retains the independent checker-safety requirement.
// @evidence contracts/common.md#clear-and-simple-design A single setting expresses caller scheduling policy without changing rule binding or checker detection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Serial execution uses the same checking path and does not substitute a benchmark-specific implementation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains mandatory checker serialization, caller choice and configuration timing before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Engine.SetSerial performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Engine.SetSerial has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Engine.SetSerial keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Engine.SetSerial acquires no handle or task and retains nothing beyond the receiver's own fields.
func (e *Engine) SetSerial(serial bool) {
  if e == nil {
    return
  }
  e.serial = serial
}

// SetCurrentDirectory supplies the compiler Program's current directory for
// rule options whose relative paths are project-rooted.
//
// Set the directory before execution. Empty leaves Run's working-directory
// fallback active; this setter neither resolves nor changes the process cwd.
//
// @evidence contracts/common.md#principled-implementation Retaining the compiler-supplied directory preserves the project origin used by rule path options instead of treating the launch directory as the project.
// @evidence contracts/common.md#clear-and-simple-design The setter carries directory context only; Run owns fallback and rules own resolution of their path options.
// @evidence contracts/common.md#prohibited-implementation-shortcuts It transports an explicit origin without changing global cwd or inserting machine-specific paths.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain project rooting, empty behavior, configuration timing and absence of process mutation before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Engine.SetCurrentDirectory performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Engine.SetCurrentDirectory has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Engine.SetCurrentDirectory keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Engine.SetCurrentDirectory acquires no handle or task and retains nothing beyond the receiver's own fields.
func (e *Engine) SetCurrentDirectory(currentDirectory string) {
  if e != nil {
    e.currentDirectory = currentDirectory
  }
}

// runsSerial reports whether Run must walk files one at a time: either because
// the caller asked for it or because a type-aware rule uses the standalone
// checker shared by every linted file.
func (e *Engine) runsSerial() bool {
  return e == nil || e.serial || e.needsTypeChecker
}

// NewEngine returns an engine configured for `config`. Rules whose
// severity is `off` are skipped entirely. Configuration entries that name
// an unknown rule are recorded so the caller can surface them as a
// configuration warning rather than a silent typo.
//
// Call ConfigError before execution; invalid declarations do not form a
// usable engine. The registry and configuration must remain stable afterward.
//
// @evidence contracts/common.md#principled-implementation RuleConfig implements the resolver contract, so delegation preserves flat severity semantics under the same validation and binding rules.
// @evidence contracts/common.md#clear-and-simple-design The flat-config constructor delegates to the single resolver-based constructor, avoiding a second dispatch implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flat configuration uses the supported resolver interface without exceptions for particular callers or rule names.
// @evidence contracts/common.md#meaningful-documentation Native prose explains disabled and unknown rules, the ConfigError requirement and input stability before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewEngine performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewEngine has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewEngine keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewEngine acquires no handle or task and retains nothing beyond the receiver's own fields.
func NewEngine(config RuleConfig) *Engine {
  return NewEngineWithResolver(config)
}

// NewEngineWithResolver returns an engine configured by a resolver that can
// vary rule severities per file.
//
// ResolveProjectRules failure stops construction before subsequent resolver
// and rule metadata calls. Option validation failures are collected in
// ConfigError; callers must reject that engine before execution.
//
// The resolver and registry must remain stable for the engine's lifetime.
// Identical option payloads for one rule are validated once. Deduplication
// tables exist only during construction; dispatch buckets live with Engine.
//
// @evidence contracts/common.md#principled-implementation Project resolution establishes valid global state before metadata projection; option validation excludes invalid bindings, and deduplicated Kind subscriptions preserve one invocation per rule/node.
// @evidence contracts/common.md#clear-and-simple-design Construction owns resolver validation, checker requirements and dispatch binding; per-file resolution remains in runFile rather than copied into global settings.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid project resolution returns at the owning boundary rather than deriving metadata from an invalid configuration; legacy option fallback is restricted to resolvers lacking per-file option resolution.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state file-scoped policy, initial failure effects, accumulated option errors and stable-input ownership before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewEngineWithResolver builds rule dispatch tables from rule names and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Each enabled rule is visited once and its node kinds are de-duplicated with a set before it is indexed by kind, so construction is O(rules plus kinds per rule) and per-file runs index rules by node kind instead of scanning every rule.
// @evidence contracts/performance.md#reuse-equivalent-work Identical option bytes for a rule are de-duplicated with a seen set so each distinct option variant is validated once per rule.
// @evidence contracts/performance.md#bound-retention-and-release-resources The engine owns its dispatch table and settings for its own lifetime; the table size is bounded by the node-kind count and the enabled rules, and no handle or task is acquired.
func NewEngineWithResolver(config RuleResolver) *Engine {
  if config == nil {
    config = RuleConfig{}
  }
  eng := &Engine{
    config:            config,
    rules:             make([][]Rule, int(shimast.KindCount)),
    enabled:           make(map[string]Severity),
    unknownDirectives: make(map[string]struct{}),
  }
  projectRuleNames := allProjectRuleNames()
  eng.projectSettings, eng.configError = config.ResolveProjectRules(projectRuleNames)
  if eng.configError != nil {
    return eng
  }
  for _, name := range projectRuleNames {
    setting := eng.projectSettings[name]
    if setting.Declared && len(setting.Options) > 0 && !registeredProjectRules[name].acceptsOptions {
      eng.configError = errors.Join(
        eng.configError,
        fmt.Errorf("@ttsc/lint: invalid options for rule %q: rule does not accept options", name),
      )
    }
    // A project rule shares the engine-wide checker decision with every file
    // rule, so one that declines the checker must not drag the whole run onto
    // the serial walk. An unmarked rule keeps the conservative default.
    if setting.Declared && setting.Severity != SeverityOff &&
      projectRuleNeedsTypeChecker(name) {
      eng.needsTypeChecker = true
    }
  }
  displaySeverities := config.EnabledRuleConfig()
  invalidRuleOptions := make(map[string]struct{})
  for _, name := range AllRuleNames() {
    rule := registered.rules[name]
    seenOptions := make(map[string]struct{})
    for _, options := range resolvedRuleOptionsVariants(config, name) {
      key := string(options)
      if _, duplicate := seenOptions[key]; duplicate {
        continue
      }
      seenOptions[key] = struct{}{}
      if err := validateRuleOptions(rule, options); err != nil {
        eng.configError = errors.Join(
          eng.configError,
          fmt.Errorf("@ttsc/lint: invalid options for rule %q: %w", name, err),
        )
        invalidRuleOptions[name] = struct{}{}
      }
    }
  }
  for _, name := range config.ActiveRuleNames() {
    rule, ok := registered.rules[name]
    if !ok {
      if _, isProjectRule := registeredProjectRules[name]; isProjectRule {
        continue
      }
      eng.unknown = append(eng.unknown, name)
      continue
    }
    if _, invalid := invalidRuleOptions[name]; invalid {
      continue
    }
    if ruleNeedsTypeChecker(rule) {
      eng.needsTypeChecker = true
    }
    eng.enabled[name] = displaySeverities.Severity(name)
    // Dedup kinds per rule so a contributor that accidentally lists the
    // same Kind twice in `Visits()` doesn't end up firing twice per node.
    seen := make(map[shimast.Kind]struct{})
    for _, kind := range rule.Visits() {
      if _, dup := seen[kind]; dup {
        continue
      }
      seen[kind] = struct{}{}
      idx := int(kind)
      if idx < 0 || idx >= len(eng.rules) {
        // Defensive: a contributor returning a Kind beyond the
        // shim's KindCount would otherwise panic on dispatch.
        continue
      }
      eng.rules[idx] = append(eng.rules[idx], rule)
    }
  }
  sort.Strings(eng.unknown)
  return eng
}

// UnknownRules returns the names of rules that appeared either in the
// config or in an inline `eslint-disable*` directive but have no
// registered implementation. Directive-side unknowns are deduped so the
// same misspelling on every page doesn't flood the warning channel.
//
// Callers must treat the returned slice as read-only: when no directive
// names have been collected, it may share the engine's configuration list.
//
// @evidence contracts/common.md#principled-implementation A locked snapshot of directive names is unioned with construction-time unknowns and sorted, preserving one warning identity per collected name.
// @evidence contracts/common.md#clear-and-simple-design The accessor merges the two sources of unknown identity while mutation remains in the narrowly locked directive collector.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown names come from resolver entries and parsed directives, not a whitelist of expected diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native prose explains both sources, deduplication and borrowed-slice ownership before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation UnknownRules merges rule-name lists and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms The configured and directive-discovered names are merged and de-duplicated with a set and sorted once, O((n+m) log (n+m)).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work UnknownRules keeps no cache; every call merges the current lists.
// @evidence contracts/performance.md#bound-retention-and-release-resources The directive mutex is held only while the discovered names are copied and is released before the merge; the returned slice is new when extras exist.
func (e *Engine) UnknownRules() []string {
  if e == nil {
    return nil
  }
  e.unknownDirectiveMu.Lock()
  extras := make([]string, 0, len(e.unknownDirectives))
  for name := range e.unknownDirectives {
    extras = append(extras, name)
  }
  e.unknownDirectiveMu.Unlock()
  if len(extras) == 0 {
    return e.unknown
  }
  seen := make(map[string]struct{}, len(e.unknown)+len(extras))
  out := make([]string, 0, len(e.unknown)+len(extras))
  for _, name := range e.unknown {
    if _, dup := seen[name]; dup {
      continue
    }
    seen[name] = struct{}{}
    out = append(out, name)
  }
  for _, name := range extras {
    if _, dup := seen[name]; dup {
      continue
    }
    seen[name] = struct{}{}
    out = append(out, name)
  }
  sort.Strings(out)
  return out
}

// collectUnknownDirectiveRules walks every directive's rule list and
// records names that don't resolve to a registered rule. Called once
// per file after `parseLintInlineDirectives`.
func (e *Engine) collectUnknownDirectiveRules(directives *lintInlineDirectives) {
  if e == nil || directives == nil {
    return
  }
  for _, rec := range directives.records {
    for _, raw := range rec.ruleList {
      name := normalizeDirectiveRuleName(raw)
      if name == "" {
        continue
      }
      if _, ok := registered.rules[name]; ok {
        continue
      }
      e.recordUnknownDirectiveRule(name)
    }
  }
}

// recordUnknownDirectiveRule remembers a rule name referenced by an
// `// eslint-disable*` directive that does not resolve to a registered
// rule. Each unique name is recorded once across the engine run.
func (e *Engine) recordUnknownDirectiveRule(name string) {
  if e == nil || name == "" {
    return
  }
  e.unknownDirectiveMu.Lock()
  defer e.unknownDirectiveMu.Unlock()
  if e.unknownDirectives == nil {
    e.unknownDirectives = make(map[string]struct{})
  }
  e.unknownDirectives[name] = struct{}{}
}

// NeedsTypeChecker reports whether any active rule requires Context.Checker.
//
// A nil receiver reports false. Project and file rules both contribute to
// the construction-time decision; invalid engines must be rejected first.
//
// @evidence contracts/common.md#principled-implementation The stored decision combines active project and file rule capabilities so callers construct the shared checker only when needed.
// @evidence contracts/common.md#clear-and-simple-design The accessor exposes the binding result without repeating capability inspection during file execution.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Checker demand derives from declared rule capabilities rather than a hardcoded family or consumer list.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies both contributors, nil behavior and invalid-engine preconditions before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Engine.NeedsTypeChecker performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Engine.NeedsTypeChecker has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Engine.NeedsTypeChecker keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Engine.NeedsTypeChecker acquires no handle or task and retains nothing beyond the receiver's own fields.
func (e *Engine) NeedsTypeChecker() bool {
  return e != nil && e.needsTypeChecker
}

// ConfigError reports an invalid project-rule declaration or rule option
// payload discovered while binding the resolver.
//
// Callers must check this result before execution. A nil receiver has no
// stored error; absence of an Engine is not proof of valid configuration.
//
// @evidence contracts/common.md#principled-implementation Returning the retained resolver or joined option-validation error preserves the failed construction state for the host's explicit rejection boundary.
// @evidence contracts/common.md#clear-and-simple-design One accessor exposes binding failure without mixing configuration errors into ordinary rule findings.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Errors remain visible to callers instead of being discarded or converted into default configuration.
// @evidence contracts/common.md#meaningful-documentation Native prose explains validation sources, required timing and nil-receiver meaning before the tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Engine.ConfigError performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Engine.ConfigError has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Engine.ConfigError keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Engine.ConfigError acquires no handle or task and retains nothing beyond the receiver's own fields.
func (e *Engine) ConfigError() error {
  if e == nil {
    return nil
  }
  return e.configError
}

// EnabledRules returns the engine's file-rule binding summary by name.
// Severities describe the resolver's display projection, not necessarily
// every file's resolved policy. The map is borrowed and must not be mutated.
//
// @evidence contracts/common.md#principled-implementation The stored display projection identifies bound file rules while per-file severity stays with ResolveRules, preserving the distinction between introspection and execution policy.
// @evidence contracts/common.md#clear-and-simple-design The accessor exposes the existing binding summary without resolving synthetic files or mixing project-rule settings into it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Introspection uses the actual bound metadata rather than a separately maintained rule list.
// @evidence contracts/common.md#meaningful-documentation Native prose states file-rule scope, projected severity and borrowed-map ownership before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation EnabledRules returns a rule map and touches no filesystem path or process.
// @evidenceExclude contracts/performance.md#efficient-algorithms EnabledRules is a single field read with no loop.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work EnabledRules keeps no cache and shares no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources EnabledRules returns the engine's own map without copying; the engine owns it.
func (e *Engine) EnabledRules() map[string]Severity { return e.enabled }

// Run walks the source files supplied by the caller and returns the collected
// findings. By default files are processed in parallel, bounded by
// `runtime.NumCPU()`; the engine falls back to a serial walk when
// SetSerial(true) was called or when a type-aware rule is active. Findings are
// merged in source-file order so the diagnostic stream is deterministic across
// runs even when the per-file work happens out of order.
//
// Call ConfigError first and supply a live checker when NeedsTypeChecker is
// true. Configure settings before execution and do not overlap calls.
// An unset directory uses os.Getwd; failure leaves directory context empty.
//
// Each file binds rule Contexts once and shares a memo for file-invariant
// work. Its pre-order walk costs one visit per node plus subscribed checks;
// rule algorithms add their own costs. No effectful Check result is cached.
// All workers finish before return. File bindings and memos then become
// collectible, while returned findings remain owned by the caller.
//
// @evidence contracts/common.md#principled-implementation A project cycle precedes file checks so file rules can read its results; per-file buckets are merged in input order, and shared checker use forces serial execution.
// @evidence contracts/common.md#clear-and-simple-design Run coordinates project evaluation, directory context and file execution; runFiles owns scheduling and runFile owns one walk's bindings and directives.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Serial and parallel paths invoke the same rules; os.Getwd supplies native cwd without platform-specific constants or global cwd mutation.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain scheduling, ordering, checker and configuration preconditions, cwd fallback, file memo validity and returned-data lifetime before the tags.
// @evidence contracts/portability.md#os-neutral-implementation The working directory comes from SetCurrentDirectory or, when unset, os.Getwd and is passed to the per-file pass as native path data; Run itself compares and normalizes no path.
// @evidenceExclude contracts/performance.md#efficient-algorithms Run orchestrates one project evaluation and one per-file pass; the algorithms live in evaluateProject and runFiles.
// @evidence contracts/performance.md#reuse-equivalent-work The project evaluation runs once per Run and its results are shared with every per-file run instead of being recomputed per file.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Run returns its findings to the caller and acquires no handle or task of its own.
func (e *Engine) Run(files []*shimast.SourceFile, checker *shimchecker.Checker) []*Finding {
  cycle := e.evaluateProject(publicrule.ProjectIdentity{}, files, checker)
  currentDirectory := e.currentDirectory
  if currentDirectory == "" {
    currentDirectory, _ = os.Getwd()
  }
  fileFindings := e.runFiles(files, checker, cycle.results, currentDirectory)
  return append(cycle.finalize(), fileFindings...)
}

func (e *Engine) runFiles(
  files []*shimast.SourceFile,
  checker *shimchecker.Checker,
  results publicrule.ProjectResultReader,
  currentDirectory string,
) []*Finding {
  if e.runsSerial() {
    var findings []*Finding
    for _, file := range files {
      if file == nil {
        continue
      }
      findings = append(findings, e.runFile(file, checker, results, currentDirectory)...)
    }
    return findings
  }

  perFile := make([][]*Finding, len(files))
  var wg sync.WaitGroup
  workers := runtime.NumCPU()
  if workers < 1 {
    workers = 1
  }
  sem := make(chan struct{}, workers)
  for i, file := range files {
    if file == nil {
      continue
    }
    wg.Add(1)
    sem <- struct{}{}
    go func(idx int, f *shimast.SourceFile) {
      defer wg.Done()
      defer func() { <-sem }()
      perFile[idx] = e.runFile(f, checker, results, currentDirectory)
    }(i, file)
  }
  wg.Wait()

  total := 0
  for _, fs := range perFile {
    total += len(fs)
  }
  if total == 0 {
    return nil
  }
  findings := make([]*Finding, 0, total)
  for _, fs := range perFile {
    findings = append(findings, fs...)
  }
  return findings
}

// boundRule pairs an active rule with the Context the engine reuses for
// every node it dispatches to that rule within one file. See runFile.
type boundRule struct {
  rule Rule
  ctx  *Context
}

// check invokes one bound rule unless an earlier invocation panicked in this
// file. Context is shared by every kind bucket for the same file/rule pair, so
// the quarantine covers later nodes and later registered kinds without leaking
// into the next source file.
func (b boundRule) check(node *shimast.Node, collect func(*Finding)) {
  if b.ctx == nil || b.ctx.quarantined {
    return
  }
  if runRuleCheck(b.rule, b.ctx, node, collect) {
    b.ctx.quarantined = true
  }
}

// lintFileWalker drives the per-file AST traversal. The ForEachChild callback
// is bound once as childCB and reused throughout the walk, keeping callback
// construction out of recursion.
type lintFileWalker struct {
  byKind  [][]boundRule
  collect func(*Finding)
  childCB func(*shimast.Node) bool
}

// walk dispatches a single node to every rule that registered for the
// node's Kind, then recurses into children via the cached childCB.
func (w *lintFileWalker) walk(node *shimast.Node) {
  if node == nil {
    return
  }
  if k := int(node.Kind); k >= 0 && k < len(w.byKind) {
    for _, bound := range w.byKind[k] {
      bound.check(node, w.collect)
    }
  }
  node.ForEachChild(w.childCB)
}

// visitChild is the cached ForEachChild callback. It is the method
// value stored in `childCB` so per-recursion closure allocation is
// avoided.
func (w *lintFileWalker) visitChild(child *shimast.Node) bool {
  w.walk(child)
  return false
}

// runFile is the per-file driver. The visitor is allocated once per file
// to reuse its child callback; it dispatches each parent before its children.
func (e *Engine) runFile(
  file *shimast.SourceFile,
  checker *shimchecker.Checker,
  results publicrule.ProjectResultReader,
  currentDirectory string,
) []*Finding {
  var collected []*Finding
  collect := func(f *Finding) { collected = append(collected, f) }
  resolved := e.config.ResolveRules(file.FileName())
  if resolved.Ignored {
    return collected
  }
  fileRules := resolved.Rules
  if !hasEnabledFileRules(fileRules) {
    return collected
  }

  // Bind each active rule to one Context per file. Its source, checker,
  // resolved policy, options and metadata remain invariant during that walk,
  // so each kind bucket can reuse the binding. Quarantine is the shared
  // per-file state that the host updates after a Check panic.
  //
  // Declaration files only bind rules that opt into them (see
  // declaration_rules.go): value-level rules can never fire on a `.d.ts`,
  // so dispatching to them is pure overhead on declaration-heavy trees.
  declarationFile := file.IsDeclarationFile
  bound := 0
  byKind := make([][]boundRule, len(e.rules))
  ctxByRule := make(map[string]*Context, len(e.enabled))
  // One memo per file, shared by every rule's Context below, so
  // file-invariant tables (security bindings, declared JSX names) are
  // built once per file instead of once per visited node.
  memo := &fileMemo{}
  for kind, rules := range e.rules {
    if len(rules) == 0 {
      continue
    }
    for _, rule := range rules {
      if declarationFile && !ruleVisitsDeclarationFiles(rule) {
        continue
      }
      name := rule.Name()
      ctx, built := ctxByRule[name]
      if !built {
        if severity := fileRules.Severity(name); severity != SeverityOff {
          options := resolved.RuleOptions(name)
          if len(options) == 0 && !resolved.OptionsResolved {
            // Compatibility for custom RuleResolver implementations compiled
            // against the original contract: until they opt into per-file
            // options, their file-agnostic RuleOptions method remains active.
            options = e.config.RuleOptions(name)
          }
          ctx = &Context{
            File:             file,
            Checker:          checker,
            CurrentDirectory: currentDirectory,
            Severity:         severity,
            Options:          options,
            rule:             rule,
            isFormat:         isFormatRule(rule),
            tags:             ruleDiagnosticTags(rule),
            collect:          collect,
            projectResults:   results,
            fileMemo:         memo,
          }
        }
        // A nil entry memoizes "off for this file" so a rule registered
        // for several kinds resolves its severity only once.
        ctxByRule[name] = ctx
      }
      if ctx == nil {
        continue
      }
      byKind[kind] = append(byKind[kind], boundRule{rule: rule, ctx: ctx})
      bound++
    }
  }

  // Bind the child callback once and reuse it for the whole walk.
  //
  // With no bound rules at all (every active rule was filtered out, e.g.
  // a declaration file where nothing opted in) the walk cannot produce a
  // finding, so it is skipped entirely; inline directives are still
  // parsed below so unknown-directive warnings stay file-complete.
  if bound != 0 {
    w := &lintFileWalker{byKind: byKind, collect: collect}
    w.childCB = w.visitChild

    // SourceFile dispatches into its statement list directly; we walk
    // statements explicitly so the file node itself can be inspected by
    // rules (e.g., `ban-ts-comment` scans the file's comment tokens once
    // per SourceFile).
    if k := int(shimast.KindSourceFile); k >= 0 && k < len(byKind) {
      for _, bound := range byKind[k] {
        bound.check(file.AsNode(), collect)
      }
    }

    statements := file.Statements
    if statements != nil {
      for _, stmt := range statements.Nodes {
        w.walk(stmt)
      }
    }
  }
  directives := parseLintInlineDirectives(file)
  e.collectUnknownDirectiveRules(directives)
  // Apply inline-disable filtering even for files with no statement
  // list. A SourceFile-level rule that fires on a `// ttsc-lint-disable`
  // comment must still honor the directive; early-returning before
  // the filter would silently leak those findings into the diagnostic
  // stream.
  return filterInlineDisabledFindingsWithDirectives(file, collected, directives)
}

func hasEnabledFileRules(rules RuleConfig) bool {
  for _, severity := range rules {
    if severity != SeverityOff {
      return true
    }
  }
  return false
}

// runRuleCheck invokes a rule's `Check` with a `recover()` barrier so a
// panicking rule does not abort the entire `ttsc fix` / `ttsc check`
// run. Built-in rules are not expected to panic, but contributor rules
// crossing into the public `rule.Context` adapter can be authored by
// anyone; protecting the engine is the only way to bound the blast
// radius of one bad rule. The recovered panic is surfaced as a
// SeverityError finding tagged with the rule's name so the user sees
// the failure in the normal diagnostic stream. The boolean result tells the
// per-file binding to quarantine the rule after recovery.
func runRuleCheck(rule Rule, ctx *Context, node *shimast.Node, collect func(*Finding)) (panicked bool) {
  defer func() {
    r := recover()
    if r == nil {
      return
    }
    panicked = true
    if ctx == nil || ctx.File == nil {
      // Without source context there is nowhere to anchor the
      // diagnostic. Surface to stderr so the panic is at least
      // visible to the operator.
      fmt.Fprintf(os.Stderr, "@ttsc/lint: rule %q panicked: %v\n", rule.Name(), r)
      return
    }
    pos := 0
    end := 1
    if node != nil {
      pos = node.Pos()
      end = node.End()
    }
    if end <= pos {
      end = pos + 1
    }
    pos, end = shimdw.NormalizeLintRange(ctx.File, pos, end)
    collect(&Finding{
      Rule:     rule.Name(),
      Severity: SeverityError,
      Pos:      pos,
      End:      end,
      Message: fmt.Sprintf(
        "Rule %q panicked while checking this node: %v. Report this to the rule's author; ttsc skipped the rule on this file.",
        rule.Name(), r,
      ),
      File:          ctx.File,
      engineFailure: true,
    })
  }()
  rule.Check(ctx, node)
  return false
}
