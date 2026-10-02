// Package rule is the public API for `@ttsc/lint` rule contributors.
//
// Third-party lint rule packages ("contributors") import this package and
// register their rules in an `init()`. At build time, ttsc copies a
// contributor's Go source into a sub-package of the `@ttsc/lint` Go module
// and synthesizes a blank-import in the host binary, which triggers the
// contributor's `init()` and populates the registry below.
//
// The host (`@ttsc/lint`) walks this registry during engine bootstrap and
// adapts each contributor rule onto the same dispatch table that drives
// the built-in rules.
//
// Contributors operate on the same shim AST the host and linked transform
// plugins use (`github.com/microsoft/typescript-go/shim/ast` and friends)
// — there is no facade layer in between. The shim packages are the
// publicly maintained boundary ttsc already exposes; adding another
// wrapper here would duplicate that maintenance burden without earning
// any extra stability. Contributors get the full AST surface the host
// has, so authoring a contributor rule and authoring a built-in rule are
// the same exercise.
//
// Example contributor:
//
//  package myrules
//
//  import (
//      shimast "github.com/microsoft/typescript-go/shim/ast"
//      "github.com/samchon/ttsc/packages/lint/rule"
//  )
//
//  func init() { rule.Register(noTodoComment{}) }
//
//  type noTodoComment struct{}
//
//  func (noTodoComment) Name() string             { return "demo/no-todo-comment" }
//  func (noTodoComment) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindSourceFile} }
//  func (noTodoComment) Check(ctx *rule.Context, node *shimast.Node) {
//      // ctx.File, ctx.Checker, ctx.Severity available; ctx.Report(node, msg)
//      // or ctx.ReportRange(pos, end, msg) push a finding through the engine.
//  }
package rule

import (
  "encoding/json"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// Severity mirrors the engine's three-level severity ladder. The
// constants are kept value-compatible with the engine's internal
// `Severity` type so the adapter layer can cast safely.
//
// @evidence contracts/common.md#principled-implementation The integer ladder uses the same off, warning and error values as the host adapter.
// @evidence contracts/common.md#clear-and-simple-design One named type centralizes contributor severity without exposing engine storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The ordinal constants are protocol values rather than consumer-specific outcomes.
// @evidence contracts/common.md#meaningful-documentation Native comments explain adapter compatibility and each level's command effect; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Severity is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Severity is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Severity is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Severity is a declaration of data shape; the code that holds its values owns their lifetime.
type Severity int

const (
  // SeverityOff means the rule is disabled. Engine skips dispatch.
  SeverityOff Severity = iota
  // SeverityWarn produces a warning diagnostic (does not change exit
  // code).
  SeverityWarn
  // SeverityError produces an error diagnostic and fails the command.
  SeverityError
)

// Rule is the contract every contributor rule satisfies. Mirrors the
// internal host interface so the host can dispatch via a thin adapter
// without re-implementing the engine.
//
// @evidence contracts/common.md#principled-implementation Identity, visit kinds and node checking match the host dispatch contract over the shared shim AST.
// @evidence contracts/common.md#clear-and-simple-design Three methods separate configuration identity, dispatch selection and inspection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Contributors use the declared registry and context instead of replacing engine methods.
// @evidence contracts/common.md#meaningful-documentation Native method comments describe namespacing, kind dispatch and reporting; member and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Rule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Rule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule is a declaration of data shape; the code that holds its values owns their lifetime.
type Rule interface {
  // Name is the identifier users put in their `rules` map.
  // Conventionally namespaced as "<plugin-namespace>/<rule-name>" to
  // avoid colliding with built-in rule names.
  //
  // @evidence contracts/common.md#principled-implementation The stable rule identifier binds configuration to the registered implementation.
  // @evidence contracts/common.md#clear-and-simple-design A dedicated method exposes identity separately from dispatch and checking.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The registered name is a public configuration key rather than a fixture-specific selector.
  // @evidence contracts/common.md#meaningful-documentation Native prose documents the namespaced convention; tags follow documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Rule.Name is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Rule.Name is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule.Name is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule.Name is a method signature without a body; each implementation owns any retained state.
  Name() string

  // Visits returns the AST kinds the rule cares about. The engine only
  // dispatches to rules that registered for the visited node's kind.
  //
  // @evidence contracts/common.md#principled-implementation The returned AST kinds describe exactly which nodes the rule's Check operation accepts.
  // @evidence contracts/common.md#clear-and-simple-design Dispatch selection is declared once per rule instead of repeated in every file walk.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Selection uses supported AST kinds without a consumer-name branch or foreign dispatch patch.
  // @evidence contracts/common.md#meaningful-documentation Native prose states kind-based dispatch; tags follow documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Rule.Visits is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Rule.Visits is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule.Visits is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule.Visits is a method signature without a body; each implementation owns any retained state.
  Visits() []shimast.Kind

  // Check is invoked for selected nodes while this rule remains active in
  // the current file. Use `ctx.Report` or `ctx.ReportRange` to emit findings.
  // A panic becomes an error finding and disables this rule for the rest
  // of that file, including its other selected kinds. Other rules and later
  // files remain eligible for dispatch.
  //
  // @evidence contracts/common.md#principled-implementation The context and selected AST node provide the file binding and reporting channel for one node inspection.
  // @evidence contracts/common.md#clear-and-simple-design Checking is one responsibility separate from rule identity and visit registration.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Findings flow through the supported context rather than patched compiler diagnostics.
  // @evidence contracts/common.md#meaningful-documentation Native prose states invocation scope and reporting APIs; tags follow documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Rule.Check is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Rule.Check is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Rule.Check is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rule.Check is a method signature without a body; each implementation owns any retained state.
  Check(ctx *Context, node *shimast.Node)
}

// FormatRule is an optional marker contributors implement when a rule
// belongs to the "format" category instead of the default "lint"
// category. `ttsc fix` is the run-everything entry point and applies
// edits from BOTH lint-class and format-class rules. `ttsc format` is
// the format-only convenience: it filters to FormatRule findings so
// lint-class rewrites are skipped. Lint rules (rules that do not
// implement FormatRule) participate only in `ttsc fix` (and in
// diagnostics during `ttsc check`).
//
// `IsFormat` exists as a structural marker, not a runtime toggle:
// returning `false` is equivalent to not implementing the interface at
// all, and the host treats either form the same way.
//
// @evidence contracts/common.md#principled-implementation The embedded Rule plus boolean marker lets the host distinguish format-category findings without changing normal rule dispatch.
// @evidence contracts/common.md#clear-and-simple-design One optional marker extends category selection while reusing the mandatory Rule interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Format selection is a supported capability rather than a host-name patch.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes fix and format commands and false-marker behavior; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation FormatRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms FormatRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work FormatRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FormatRule is a declaration of data shape; the code that holds its values owns their lifetime.
type FormatRule interface {
  Rule

  // IsFormat marks findings as belonging to the formatter category.
  //
  // @evidence contracts/common.md#principled-implementation A true result requests format-category handling; false retains ordinary lint behavior.
  // @evidence contracts/common.md#clear-and-simple-design One marker conveys category without another rule implementation interface.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The category uses declared capability detection rather than name matching.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies category selection; the tag boundary follows documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation FormatRule.IsFormat is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms FormatRule.IsFormat is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work FormatRule.IsFormat is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FormatRule.IsFormat is a method signature without a body; each implementation owns any retained state.
  IsFormat() bool
}

// DeclarationFileRule is an optional marker contributors implement to
// control whether their rule runs on declaration-file inputs (`.d.ts`,
// `.d.mts`, `.d.cts`). The engine skips most built-in rules on declaration
// files when their inspected grammar is not relevant there; contributor rules
// keep the conservative default (they run on declaration files) since
// the host cannot infer a third-party rule's shape (mirror of the implicit
// checker default). A contributor whose rule inspects executable code only
// can implement this with `return false` to skip declaration files and
// save the dispatch on declaration-heavy projects; returning `true` is
// equivalent to not implementing the interface at all.
//
// FormatRule with IsFormat returning true takes precedence: formatting
// rules always visit declaration files, even when this marker returns false.
//
// @evidence contracts/common.md#principled-implementation The marker selects declaration-file inputs for ordinary lint rules; a true FormatRule capability takes precedence so formatting still covers declarations.
// @evidence contracts/common.md#clear-and-simple-design One optional method refines input selection while keeping the original Rule contract intact.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Skipping is capability-based and never inferred from a particular contributor name.
// @evidence contracts/common.md#meaningful-documentation Native prose describes declaration extensions, conservative default and opt-out consequences; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation DeclarationFileRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms DeclarationFileRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work DeclarationFileRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DeclarationFileRule is a declaration of data shape; the code that holds its values owns their lifetime.
type DeclarationFileRule interface {
  Rule

  // VisitsDeclarationFiles selects declaration-file dispatch for lint rules.
  // A true FormatRule marker takes precedence over a false answer here.
  //
  // @evidence contracts/common.md#principled-implementation The boolean selects declaration grammar for a lint rule; the host gives true FormatRule classification precedence over an explicit false answer.
  // @evidence contracts/common.md#clear-and-simple-design One input capability expresses the selection policy directly.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts A declared capability replaces rule-name exceptions.
  // @evidence contracts/common.md#meaningful-documentation The native comment identifies dispatch selection with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation DeclarationFileRule.VisitsDeclarationFiles is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms DeclarationFileRule.VisitsDeclarationFiles is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work DeclarationFileRule.VisitsDeclarationFiles is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DeclarationFileRule.VisitsDeclarationFiles is a method signature without a body; each implementation owns any retained state.
  VisitsDeclarationFiles() bool
}

// DiagnosticTag classifies what a finding IS, orthogonally to how severe it is.
// The values match the LSP DiagnosticTag enum. Clients may fade unnecessary
// code or strike through deprecated code; presentation remains client policy.
//
// @evidence contracts/common.md#principled-implementation The numeric values match LSP's unnecessary and deprecated classifications independently from severity.
// @evidence contracts/common.md#clear-and-simple-design One type owns visual classification without coupling it to command failure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Values are protocol discriminants rather than a workaround for diagnostic severity.
// @evidence contracts/common.md#meaningful-documentation Native constants explain deletion and migration meaning, preventing an unfinished-work misclassification; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation DiagnosticTag is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms DiagnosticTag is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work DiagnosticTag is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DiagnosticTag is a declaration of data shape; the code that holds its values owns their lifetime.
type DiagnosticTag int

const (
  // DiagnosticTagUnnecessary marks code that is safe to delete, such as an unused
  // import or an unreachable branch. A client may fade it.
  //
  // This is a claim about what the code is, not how bad it is, and the
  // distinction bites: "unnecessary" says "remove this." A finding that means
  // "this is not done yet" is the opposite and must never carry it, or the
  // editor tells the author to delete the work they have not finished. Tag by
  // what deletion would mean, never by severity.
  DiagnosticTagUnnecessary DiagnosticTag = 1
  // DiagnosticTagDeprecated marks code that still works but should be migrated
  // away from. A client may strike it through.
  DiagnosticTagDeprecated DiagnosticTag = 2
)

// TaggedRule is an optional marker a rule implements to classify its findings
// with DiagnosticTags. Every diagnostic reported through its Context carries
// the returned tags. This rule-level classification fits a rule that
// reports only unused code. Host-generated rule-panic errors are untagged.
//
// It is separate from severity on purpose. Severity is how much a finding
// matters and is the user's to configure; a tag is what the finding is and is
// the rule's to state. A host that does not read tags loses the greying, not the
// diagnostic, as with the other optional markers.
//
// Return nil, or do not implement it, for a rule whose findings are neither
// unnecessary nor deprecated. Most findings are neither, and guessing wrong is
// worse than saying nothing: a spurious Unnecessary tells the author to delete
// correct code.
//
// Tags are registration metadata. Return a stable slice and do not mutate
// its backing storage after registration: the host shares the captured tags
// with ordinary findings rather than cloning them for each report.
//
// @evidence contracts/common.md#principled-implementation A rule-level tag slice describes classification shared by its findings while severity remains user configured.
// @evidence contracts/common.md#clear-and-simple-design One optional method adds classification without changing the main checking interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Interface capability supplies tags without replacing reporter logic or guessing from severity.
// @evidence contracts/common.md#meaningful-documentation Native prose documents no-tag defaults, classification scope, immutable metadata and harmful unnecessary-code guesses; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation TaggedRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms TaggedRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work TaggedRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TaggedRule is a declaration of data shape; the code that holds its values owns their lifetime.
type TaggedRule interface {
  // DiagnosticTags returns immutable registration metadata for diagnostics
  // reported through this rule's Context. Rule-panic errors do not inherit it.
  //
  // @evidence contracts/common.md#principled-implementation The returned tags classify findings independently from their configured level.
  // @evidence contracts/common.md#clear-and-simple-design One method supplies the rule's shared classification metadata.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Classification uses explicit tags rather than deriving deletion advice from severity.
  // @evidence contracts/common.md#meaningful-documentation Native prose states the report scope, panic exception and immutable metadata lifetime with a separated tag block.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation TaggedRule.DiagnosticTags is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms TaggedRule.DiagnosticTags is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work TaggedRule.DiagnosticTags is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TaggedRule.DiagnosticTags is a method signature without a body; each implementation owns any retained state.
  DiagnosticTags() []DiagnosticTag
}

// TypeAwareRule is an optional marker contributors implement to declare
// whether their rule reads `Context.Checker`. The host cannot infer a
// third-party rule's shape, so a contributor that does not implement this
// marker keeps the conservative default: it is treated as type-aware and
// receives a live checker.
//
// Being treated as type-aware is not free. The host creates a standalone
// checker spanning every source file, and the engine walks files serially so
// that checker is never accessed concurrently. A purely syntactic rule that
// never touches `Context.Checker` pays both costs for nothing.
//
// A contributor whose rule is AST-only can implement this with
// `NeedsTypeChecker() bool { return false }` to opt out of the checker path,
// allowing a checker-free parallel walk when no other active rule requires
// a checker and the caller has not requested serial execution. Returning true is
// equivalent
// to not implementing the interface at all. A rule that returns `false` must
// not read `Context.Checker`: the host is free to leave it nil.
//
// The method name is domain-specific so an unrelated generic method on an
// existing contributor cannot opt out by accident. ProjectRule implementations
// may use the same marker; the serial walk it governs is engine-wide, so one
// type-aware project rule serializes every file rule in the run.
//
// @evidence contracts/common.md#principled-implementation The explicit checker requirement lets the host enforce checker availability and its serial-access constraint.
// @evidence contracts/common.md#clear-and-simple-design One optional capability separates syntactic inspection from type-checker dependence.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Opt-out is declared by the contributor instead of inferred from unrelated method names or rule identities.
// @evidence contracts/common.md#meaningful-documentation Native prose documents conservative defaults, nil-checker consequences and serialization; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation TypeAwareRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms TypeAwareRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work TypeAwareRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TypeAwareRule is a declaration of data shape; the code that holds its values owns their lifetime.
type TypeAwareRule interface {
  // NeedsTypeChecker declares whether checking reads Context.Checker.
  //
  // @evidence contracts/common.md#principled-implementation The boolean binds checker availability to the rule's actual inspection needs.
  // @evidence contracts/common.md#clear-and-simple-design A single capability exposes the checker dependency without changing Check's arguments.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Capability detection avoids rule-name shortcuts and accidental generic-method matches.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies the dependency declaration with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation TypeAwareRule.NeedsTypeChecker is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms TypeAwareRule.NeedsTypeChecker is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work TypeAwareRule.NeedsTypeChecker is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TypeAwareRule.NeedsTypeChecker is a method signature without a body; each implementation owns any retained state.
  NeedsTypeChecker() bool
}

// OptionsRule is an optional marker contributors implement to declare whether
// their rule accepts an options slot in its `[severity, options]` setting.
// Contributor rules default to accepting options for backward compatibility
// with the original public Context.Options contract. Return false for a
// genuinely optionless rule so the host can reject accidental payloads before
// linting. The domain-specific method name prevents an unrelated generic
// AcceptsOptions method on an existing contributor from changing its options
// acceptance by accident.
// ProjectRule implementations may use the same marker.
//
// @evidence contracts/common.md#principled-implementation The marker distinguishes a genuine options slot from an optionless rule so the host rejects unsupported payloads before checking.
// @evidence contracts/common.md#clear-and-simple-design One optional capability covers file and project rules without introducing parallel option-name lists.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The domain-specific method avoids accidentally capturing unrelated contributor methods.
// @evidence contracts/common.md#meaningful-documentation Native prose states legacy defaults, early rejection and method-name rationale; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation OptionsRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms OptionsRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work OptionsRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources OptionsRule is a declaration of data shape; the code that holds its values owns their lifetime.
type OptionsRule interface {
  // AcceptsTtscLintOptions declares whether a setting may include an options payload.
  //
  // @evidence contracts/common.md#principled-implementation The boolean identifies the supported setting shape before rule execution.
  // @evidence contracts/common.md#clear-and-simple-design One named capability makes option acceptance independent from rule-name tables.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit marker avoids unvalidated special-case payload acceptance.
  // @evidence contracts/common.md#meaningful-documentation Native prose documents the setting-shape capability with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation OptionsRule.AcceptsTtscLintOptions is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms OptionsRule.AcceptsTtscLintOptions is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work OptionsRule.AcceptsTtscLintOptions is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources OptionsRule.AcceptsTtscLintOptions is a method signature without a body; each implementation owns any retained state.
  AcceptsTtscLintOptions() bool
}

// Reporter is the engine-supplied callback that records a finding. The
// host implements this and passes it to `NewContext` when invoking a
// contributor rule.
//
// @evidence contracts/common.md#principled-implementation Node and byte-range reporting both bind findings to the currently inspected source file.
// @evidence contracts/common.md#clear-and-simple-design Two reporting forms separate AST-node ranges from explicit sub-token ranges while hiding aggregation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Findings use the supported host callback instead of compiler-internal mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies host ownership and member range semantics; member and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Reporter is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Reporter is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporter is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Reporter is a declaration of data shape; the code that holds its values owns their lifetime.
type Reporter interface {
  // Report records a finding at the given node's source range.
  //
  // @evidence contracts/common.md#principled-implementation The source node supplies the finding's byte range in the current file.
  // @evidence contracts/common.md#clear-and-simple-design Node reporting is one operation separate from manual range selection.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The declared callback routes findings without replacing compiler methods.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies node-range reporting with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Reporter.Report is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Reporter.Report is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporter.Report is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Reporter.Report is a method signature without a body; each implementation owns any retained state.
  Report(node *shimast.Node, message string)

  // ReportRange records a finding at an explicit byte range inside the
  // current file. Use this when the rule wants to highlight a
  // sub-token.
  //
  // @evidence contracts/common.md#principled-implementation Explicit byte positions identify a finding range within the bound source file.
  // @evidence contracts/common.md#clear-and-simple-design Range reporting keeps sub-token location choice with the rule while the host aggregates findings.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The supported callback avoids inventing AST nodes solely to carry a diagnostic.
  // @evidence contracts/common.md#meaningful-documentation Native prose documents current-file byte positions and sub-token use; tags follow documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Reporter.ReportRange is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Reporter.ReportRange is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporter.ReportRange is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Reporter.ReportRange is a method signature without a body; each implementation owns any retained state.
  ReportRange(pos, end int, message string)
}

// FixReporter is the optional extension a host implements to receive
// autofix edits alongside a finding. The public `rule.Context`
// type-asserts against this shape so any host whose reporter exposes
// both methods opts into fix support without depending on a private
// interface name.
//
// Rule implementations submit edits through ctx.ReportFix or
// ctx.ReportRangeFix. A custom host or test reporter passed to NewContext
// must satisfy Reporter to provide diagnostics. To receive edits as well,
// it must implement both FixReporter methods; implementing only one leaves
// the optional capability absent and Context falls back to plain reporting.
// A var _ rule.FixReporter = &myReporter{} assertion checks only this optional
// fix surface, not the separate Reporter requirement.
//
// @evidence contracts/common.md#principled-implementation Optional node and range methods extend a finding with atomic byte edits without changing its original location semantics.
// @evidence contracts/common.md#clear-and-simple-design Fix support is one optional extension separate from mandatory diagnostic reporting.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Structural capability detection preserves legacy reporters rather than patching their methods.
// @evidence contracts/common.md#meaningful-documentation Native prose explains context access and complete interface satisfaction; method and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation FixReporter is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms FixReporter is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work FixReporter is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FixReporter is a declaration of data shape; the code that holds its values owns their lifetime.
type FixReporter interface {
  // ReportFix records a node finding with its candidate edit group.
  //
  // @evidence contracts/common.md#principled-implementation One call associates all byte edits with the same node finding for atomic conflict handling.
  // @evidence contracts/common.md#clear-and-simple-design One operation keeps diagnostic and fix association explicit.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Fixes use a supported extension instead of direct source mutation during checking.
  // @evidence contracts/common.md#meaningful-documentation Native prose describes the associated edit group with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation FixReporter.ReportFix is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms FixReporter.ReportFix is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work FixReporter.ReportFix is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FixReporter.ReportFix is a method signature without a body; each implementation owns any retained state.
  ReportFix(node *shimast.Node, message string, edits ...TextEdit)

  // ReportRangeFix records an explicit-range finding with its candidate edit group.
  //
  // @evidence contracts/common.md#principled-implementation The finding range and edit ranges are distinct byte positions associated in one report.
  // @evidence contracts/common.md#clear-and-simple-design One method extends range reporting without requiring a synthetic AST node.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Edits travel through the declared fix boundary rather than foreign source mutation.
  // @evidence contracts/common.md#meaningful-documentation Native prose explains explicit-range fix association with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation FixReporter.ReportRangeFix is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms FixReporter.ReportRangeFix is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work FixReporter.ReportRangeFix is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FixReporter.ReportRangeFix is a method signature without a body; each implementation owns any retained state.
  ReportRangeFix(pos, end int, message string, edits ...TextEdit)
}

// RelatedReporter is the optional extension a host implements to receive a
// finding's related source locations. Like FixReporter, the public
// `rule.Context` type-asserts against this shape, so any host whose reporter
// exposes both methods opts into related locations without depending on a
// private interface name. A host without this capability still receives the
// primary diagnostic, without its optional related locations.
//
// Rule implementations submit locations through ctx.ReportRelated or
// ctx.ReportRangeRelated. A custom host or test reporter passed to NewContext
// must satisfy Reporter; implementing both RelatedReporter methods also
// enables related locations. The optional interface alone does not satisfy
// the separate Reporter parameter.
//
// @evidence contracts/common.md#principled-implementation Optional related locations attach explanatory current-file ranges while the primary finding remains independently reportable.
// @evidence contracts/common.md#clear-and-simple-design The related-location extension remains separate from fix and mandatory reporter interfaces.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Capability-based degradation preserves real findings without patching old reporters.
// @evidence contracts/common.md#meaningful-documentation Native prose explains direct context access and absent-capability behavior; method and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RelatedReporter is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RelatedReporter is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RelatedReporter is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RelatedReporter is a declaration of data shape; the code that holds its values owns their lifetime.
type RelatedReporter interface {
  // ReportRelated records a node finding with additional current-file locations.
  //
  // @evidence contracts/common.md#principled-implementation Related ranges explain the node finding while retaining the same bound file identity.
  // @evidence contracts/common.md#clear-and-simple-design One operation attaches related information without adding another result store.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Related locations use the supported extension rather than fabricated cross-file identities.
  // @evidence contracts/common.md#meaningful-documentation Native prose states same-file location scope with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RelatedReporter.ReportRelated is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RelatedReporter.ReportRelated is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RelatedReporter.ReportRelated is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RelatedReporter.ReportRelated is a method signature without a body; each implementation owns any retained state.
  ReportRelated(node *shimast.Node, message string, related ...RelatedInformation)

  // ReportRangeRelated records a range finding with additional current-file locations.
  //
  // @evidence contracts/common.md#principled-implementation Explicit primary and related ranges share the bound source-file byte coordinate system.
  // @evidence contracts/common.md#clear-and-simple-design The range form avoids creating a synthetic node for sub-token findings.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The declared extension routes locations without changing host internals.
  // @evidence contracts/common.md#meaningful-documentation Native prose documents range reporting and location scope; tags follow documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RelatedReporter.ReportRangeRelated is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RelatedReporter.ReportRangeRelated is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RelatedReporter.ReportRangeRelated is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RelatedReporter.ReportRangeRelated is a method signature without a body; each implementation owns any retained state.
  ReportRangeRelated(pos, end int, message string, related ...RelatedInformation)
}

// RelatedInformation is a secondary current-file location paired with a
// message naming its connection to the primary finding. For example, a
// duplicate-definition diagnostic can also identify the first definition.
// An LSP client may expose these locations as navigation targets.
//
// Pos and End are byte offsets into the finding's source file, in the same
// coordinate system as shim AST nodes and ReportRange. The host normalizes
// these ranges and supplies that file's URI during LSP serialization. This
// value carries no URI or source identity for locations in another file.
//
// @evidence contracts/common.md#principled-implementation Byte positions and message represent a secondary location in the current file; the API deliberately carries no cross-file URI.
// @evidence contracts/common.md#clear-and-simple-design A three-member value separates location and explanatory text without adding unsupported cross-file navigation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Same-file coordinates are explicit instead of fabricating a URI from unrelated paths.
// @evidence contracts/common.md#meaningful-documentation Native prose documents byte units and the same-file limitation; member and tag boundaries follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RelatedInformation is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RelatedInformation is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RelatedInformation is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RelatedInformation is a declaration of data shape; the code that holds its values owns their lifetime.
type RelatedInformation struct {
  // Pos is the inclusive byte start in the current source file.
  Pos     int

  // End is the exclusive byte end in the current source file.
  End     int

  // Message explains why this secondary range relates to the finding.
  Message string
}

// TextEdit is one byte-range replacement offered by an autofixable finding.
// Positions use the same byte offsets as shim AST nodes and must point inside
// the current source file. An empty `Text` deletes the range; positions are
// in lexer byte order, not visual order, so a UTF-8 multi-byte sequence must
// be replaced as a whole.
//
// Application policy: a rule may emit several `TextEdit`s in one
// `ReportFix` / `ReportRangeFix` call, in any order. The unit the host
// resolves conflicts on is the FINDING, not the individual edit. Within one
// fix pass the host considers each finding's edits as one group, earliest
// group first, and accepts a group only when every member coexists with the
// edits already accepted. If any member would be dropped, the whole group is
// skipped, so a multi-edit fix never half-applies. The skipped finding is not
// lost: a later cascade pass may re-evaluate it against rewritten source.
// Application is not guaranteed; the cascade can finish without that edit or
// reach its pass limit and report non-convergence.
//
// A finding's own edits must therefore not overlap each other either, or the
// finding can never apply. Exact duplicates within one finding are collapsed
// rather than treated as a conflict, so repeating an identical edit is
// harmless. Nothing diagnoses a skipped group, and the host does not report
// when a comment falls inside a deletion range.
//
// Emit the narrowest edits that express the rewrite. Several small
// non-overlapping edits contend for less source than one wide replacement and
// are the shape the atomic applier exists to support. Built-ins that ship
// multi-edit fixes include `typescript/no-import-type-side-effects`,
// `format/whitespace`, `format/indent`, `unicorn/prevent-abbreviations`, and
// `unicorn/template-indent`.
//
// @evidence contracts/common.md#principled-implementation A half-open byte range and replacement string describe insertion, deletion or replacement without confusing UTF-8 bytes with visual columns.
// @evidence contracts/common.md#clear-and-simple-design One minimal edit value serves fixes and suggestions; conflict policy remains with the host applier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Edits describe supported source rewrites rather than mutating foreign AST or compiler internals during checking.
// @evidence contracts/common.md#meaningful-documentation Native prose explains byte units, atomic groups, overlap and narrow-edit guidance; members and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation TextEdit is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms TextEdit is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work TextEdit is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TextEdit is a declaration of data shape; the code that holds its values owns their lifetime.
type TextEdit struct {
  // Pos is the inclusive byte start; equal Pos and End insert text.
  Pos  int

  // End is the exclusive byte end and must not split a UTF-8 sequence.
  End  int

  // Text replaces the range; an empty value deletes it.
  Text string
}

// Suggestion is one author-selected edit group with its own title. Use it when
// a change needs an explicit choice, including a single repair that automatic
// fixing must withhold or several alternatives among which the rule cannot
// choose. Automatic fix and fix-all operations do not apply suggestions.
//
// The lint host omits choices with an empty title or no edits, while keeping
// the primary diagnostic. Each advertised choice must contain distinct,
// non-overlapping, in-bounds edits. The LSP application rejects a choice if
// edit validation drops any member, including an exact duplicate; the
// automatic-fix group's internal duplicate collapsing does not apply here.
//
// @evidence contracts/common.md#principled-implementation Title and edit group express one author-selected alternative rather than imposing an arbitrary valid repair.
// @evidence contracts/common.md#clear-and-simple-design One value groups display text with the candidate's edits independently from the finding.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit alternatives do not silently replace a required fix with a guessed consumer preference.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes suggestions from automatic fixes and documents empty edits; member and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Suggestion is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Suggestion is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Suggestion is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Suggestion is a declaration of data shape; the code that holds its values owns their lifetime.
type Suggestion struct {
  // Title is what the editor shows for this choice, e.g. "Rename to `frames`".
  Title string

  // Edits apply this choice after selection. The lint host omits a choice
  // with no edits rather than advertising a label-only action.
  Edits []TextEdit
}

// SuggestionReporter is the optional reporter extension that carries
// author-selected edit choices. A host without it still receives the primary
// finding through Reporter, without the choices.
//
// This channel is separate from FixReporter because explicit selection and
// automatic application have different policies. One suggestion may require
// consent even when it is the only available repair; several suggestions may
// offer alternatives. Rules submit them through Context.ReportSuggestion or
// ReportRangeSuggestion, and the host decides which choices it can publish.
//
// @evidence contracts/common.md#principled-implementation Optional suggestion reporting keeps multiple candidate repairs attached to the finding while legacy reporters retain the diagnostic alone.
// @evidence contracts/common.md#clear-and-simple-design A separate extension represents author choice without conflating it with an automatic fix.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Optional capability handling preserves existing reporters through their supported interfaces.
// @evidence contracts/common.md#meaningful-documentation Native prose explains fallback and the fix-versus-choice boundary; method and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SuggestionReporter is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms SuggestionReporter is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work SuggestionReporter is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SuggestionReporter is a declaration of data shape; the code that holds its values owns their lifetime.
type SuggestionReporter interface {
  // ReportSuggestion associates author-selectable repairs with a node finding.
  //
  // @evidence contracts/common.md#principled-implementation Each suggestion remains a separate candidate edit group for the same primary node finding.
  // @evidence contracts/common.md#clear-and-simple-design One method groups alternatives without selecting or applying them during checking.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives use the public reporter instead of imposing an arbitrary fixture-driven choice.
  // @evidence contracts/common.md#meaningful-documentation Native prose states candidate association with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation SuggestionReporter.ReportSuggestion is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms SuggestionReporter.ReportSuggestion is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work SuggestionReporter.ReportSuggestion is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SuggestionReporter.ReportSuggestion is a method signature without a body; each implementation owns any retained state.
  ReportSuggestion(node *shimast.Node, message string, suggestions ...Suggestion)

  // ReportRangeSuggestion associates author-selectable repairs with a range finding.
  //
  // @evidence contracts/common.md#principled-implementation Explicit byte-range findings receive distinct candidate groups without synthetic node identity.
  // @evidence contracts/common.md#clear-and-simple-design One range variant reuses the same suggestion values and host aggregation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Candidates travel through a declared extension rather than direct edits during validation.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies range-based candidate reporting with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation SuggestionReporter.ReportRangeSuggestion is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms SuggestionReporter.ReportRangeSuggestion is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work SuggestionReporter.ReportRangeSuggestion is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SuggestionReporter.ReportRangeSuggestion is a method signature without a body; each implementation owns any retained state.
  ReportRangeSuggestion(pos, end int, message string, suggestions ...Suggestion)
}

// Context is the per-(file, rule) handle the engine passes to `Check`.
// The `Reporter` is supplied by the host when constructing the context;
// contributors call `ctx.Report` / `ctx.ReportRange` directly through
// this Context rather than touching the reporter.
//
// @evidence contracts/common.md#principled-implementation File, checker, resolved settings and private cycle channels bind every contributor inspection to the host's current file and Program.
// @evidence contracts/common.md#clear-and-simple-design Public inspection inputs are separated from reporter and project-result capabilities behind context methods.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The context provides supported reporting and project-state access without foreign engine mutation.
// @evidence contracts/common.md#meaningful-documentation Native members document source availability, checker dependence and raw options; member gaps and separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Context is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Context is a declaration of data shape; the code that holds its values owns their lifetime.
type Context struct {
  // File is the source file currently being walked. Always non-nil
  // when `Check` is invoked.
  File *shimast.SourceFile

  // Checker is the host's tsgo type checker. Available for type-aware
  // rules when requested. A checker-free invocation may leave it nil.
  Checker *shimchecker.Checker

  // Severity is the rule's resolved severity for this file. Already
  // filtered by the engine, so rules do not need to check for
  // SeverityOff.
  Severity Severity

  // Options is this source file's effective raw JSON payload. One option slot
  // retains its value shape; multiple positional slots form an array, and a
  // severity-only override may inherit a matching earlier payload. Nil means
  // no effective payload. Constructors copy the bytes, so local mutation does
  // not alter resolver storage or another invocation. DecodeOptions reads it
  // into the contributor's own destination.
  Options json.RawMessage

  reporter Reporter
  results  ProjectResultReader
}

// NewContext constructs a Context for the engine to pass into a
// contributor rule's `Check`. Reserved for host code; contributors
// should not need to call this.
//
// @evidence contracts/common.md#principled-implementation Delegating with a nil project reader preserves the original context semantics while reusing defensive option copying.
// @evidence contracts/common.md#clear-and-simple-design The legacy constructor has one delegation point to the fuller constructor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The nil-reader path is supported backwards compatibility rather than a fabricated project result.
// @evidence contracts/common.md#meaningful-documentation Native prose names host ownership and normal contributor usage; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewContext performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Delegation copies b raw option bytes and allocates the returned context, O(1+b) work and storage; the absence of a wrapper loop does not make the fuller constructor fixed-cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Construction creates invocation-local mutable option storage, not a shared computation coordinator. The caller owns snapshot validity and any immutable input reuse; sharing the resulting writable options across invocations would violate their ownership.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned context owns its copied option bytes and retains borrowed file, checker and reporter references until callers release it. The host owns Program/checker resource closure; this constructor stores no global context history and acquires no handle or running task.
func NewContext(
  file *shimast.SourceFile,
  checker *shimchecker.Checker,
  severity Severity,
  options json.RawMessage,
  reporter Reporter,
) *Context {
  return NewContextWithProjectResults(file, checker, severity, options, reporter, nil)
}

// NewContextWithProjectResults constructs a file-rule Context with the live
// project results for the same loaded Program cycle.
//
// @evidence contracts/common.md#principled-implementation The constructor keeps the host's file, checker and live readers while copying raw option bytes to prevent slice alias mutation.
// @evidence contracts/common.md#clear-and-simple-design One constructor establishes all per-file inputs and private channels together.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Live state is supplied through its declared reader instead of inferred from unrelated Program identities.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the same-cycle binding and members document ownership; the tag boundary follows documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewContextWithProjectResults performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Copying b raw option bytes and constructing one context costs O(1+b) work and storage. File, checker, reporter and result-reader references are passed through without traversal or copying their underlying Program and cycle.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This constructor creates a separate writable option buffer per invocation and coordinates no requests or shared result cache. The host establishes same-cycle validity for the borrowed source/checker/reader; equal bytes do not authorize sharing their mutable option destination.
// @evidence contracts/performance.md#bound-retention-and-release-resources The caller receives a context with b owned option bytes and borrowed file/checker/reporter/result-reader references, which can keep those objects reachable while the context is retained. The host owns their live Program/cycle and resource closure. This constructor has no historical-context cache, handle or task of its own.
func NewContextWithProjectResults(
  file *shimast.SourceFile,
  checker *shimchecker.Checker,
  severity Severity,
  options json.RawMessage,
  reporter Reporter,
  results ProjectResultReader,
) *Context {
  return &Context{
    File:     file,
    Checker:  checker,
    Severity: severity,
    Options:  append(json.RawMessage(nil), options...),
    reporter: reporter,
    results:  results,
  }
}

// ProjectResult returns a current snapshot for a named project rule in this
// file's Program cycle. Missing registrations return ProjectRuleAbsent.
//
// @evidence contracts/common.md#principled-implementation Nil contexts and missing readers return absent; a live reader supplies the named rule's current snapshot without caching stale status locally.
// @evidence contracts/common.md#clear-and-simple-design One lookup method hides the project-result storage and lifecycle.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing project bindings are explicit absent results rather than invented passed results.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies current-cycle lookup and absent semantics; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ProjectResult performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Local absence guards and direct delegation choose no lookup or snapshot algorithm. ProjectResultReader owns the dominant work, including any finding-copy or locking cost; the wrapper does not certify a fixed total cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This lookup delegates to the live cycle reader and owns no cross-query memo. The reader establishes current rule/cycle identity and snapshot validity; a cached result based only on this context or name could hide a changed status.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned snapshot can contain finding storage and producer-owned State references; the reader and caller own their lifetime. This wrapper adds no stored result history, handle or task, and it does not close or mutate the producer's state.
func (c *Context) ProjectResult(name string) ProjectRuleResult {
  if c == nil || c.results == nil {
    return ProjectRuleResult{Status: ProjectRuleAbsent}
  }
  return c.results.ProjectResult(name)
}

// DecodeOptions unmarshals the rule's options blob into `out`. Returns
// nil with no side effect when the rule was configured with severity
// alone, so contributors can write:
//
//  var opts myRuleOptions
//  _ = ctx.DecodeOptions(&opts)
//  // opts now holds either the user's settings or the zero value.
//
// @evidence contracts/common.md#principled-implementation A nil or empty options payload preserves caller defaults; encoding/json decodes present input and returns its error.
// @evidence contracts/common.md#clear-and-simple-design One context helper owns raw JSON decoding without independent rule-specific parsing policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No arbitrary payload substitute or fixture-specific options bypass is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose and the example describe default-preserving decoding; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.DecodeOptions performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms The absence check is constant work; present options delegate validation and decoding to encoding/json, with work driven by JSON bytes and destination shape and storage allocated as required by decoded values. A destination custom unmarshaler can add its own work; absence of a wrapper loop does not make decoding fixed-cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Decoding updates the supplied destination, preserves its omitted defaults and can invoke destination-defined unmarshaling effects. Equal JSON alone does not make different destinations or calls interchangeable; this helper owns no cross-request result cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Decoded values and their allocations belong to the caller-supplied destination; custom unmarshaler retention is owned by that implementation. This helper neither stores destination history nor acquires native handles or tasks, and its receiver owner controls the existing raw option bytes.
func (c *Context) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// Report records a finding at the given node's source range. Silently
// ignored when severity is `off` (the engine already filters
// by severity before invoking Check) or when no reporter is attached.
//
// @evidence contracts/common.md#principled-implementation Nil context, missing reporter, off severity and nil node are inert; valid active calls forward the actual node and message.
// @evidence contracts/common.md#clear-and-simple-design A single defensive boundary protects the host callback before delegation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Findings flow through the supported reporter without synthetic nodes or foreign mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose describes disabled and absent reporter behavior; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.Report performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper chooses no finding algorithm beyond guards and reporter delegation. A reporter may scan node trivia, normalize positions and collect a finding; its dominant cost remains the reporter owner's responsibility, not a fixed-total-cost guarantee.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporting is an effectful invocation, not a completed-work or in-flight coordinator. Equal node and message inputs do not authorize suppressing another report; the reporter owns collection identity and deduplication policy.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper stores no finding history or new handle/task. Reporter-owned collection may retain the message and resulting finding for its run; that owner controls population and release after this synchronous delegation.
func (c *Context) Report(node *shimast.Node, message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || node == nil {
    return
  }
  c.reporter.Report(node, message)
}

// ReportFix records a finding at the given node's source range with optional
// autofix edits. Older hosts that do not implement fix reporting receive the
// diagnostic without edits.
// Treat edits as best-effort: design the rule so the diagnostic alone is useful.
//
// @evidence contracts/common.md#principled-implementation Active node calls preserve the diagnostic when edits are absent or fix capability is unavailable; capable reporters receive the complete candidate group.
// @evidence contracts/common.md#clear-and-simple-design Guards and one capability branch separate ordinary reporting from the optional edit channel.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy degradation addresses an actual supported reporter difference without patching foreign methods or suppressing the finding.
// @evidence contracts/common.md#meaningful-documentation Native prose explains best-effort edits and legacy fallback; the tag boundary follows documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportFix performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Guards, edit presence and one capability assertion choose no edit-processing algorithm. The selected reporter owns range work, edit conversion/copy and collection cost; this wrapper passes the slice through without certifying fixed total work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This is an effectful reporting call, not a request coordinator. The reporter owns finding identity and edit collection; matching node/message/edit values do not authorize suppressing a separate invocation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This wrapper stores no report history or new handle/task and forwards the caller edit slice synchronously. A reporter that retains edits owns copying and collection lifetime; the hosted adapter converts records and its collector owns resulting finding/edit storage.
func (c *Context) ReportFix(node *shimast.Node, message string, edits ...TextEdit) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || node == nil {
    return
  }
  if len(edits) == 0 {
    c.reporter.Report(node, message)
    return
  }
  fixer, ok := c.reporter.(FixReporter)
  if !ok {
    c.reporter.Report(node, message)
    return
  }
  fixer.ReportFix(node, message, edits...)
}

// ReportRange records a finding at an explicit byte range inside the
// current file.
//
// @evidence contracts/common.md#principled-implementation Active contexts forward the supplied current-file byte range; absent or off channels remain inert.
// @evidence contracts/common.md#clear-and-simple-design A guard and one callback keep range reporting separate from node construction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit ranges use the supported API rather than synthetic AST nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose states the range's byte units and file scope; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRange performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Guards and direct range delegation choose no collection algorithm. Reporter-side normalization and callback work remain that owner's cost; an arbitrary Reporter implementation is not certified fixed-cost by this wrapper.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each report is an observable collection effect rather than a reusable query. The reporter owns any finding identity or deduplication policy, so equal coordinates and message do not alone permit sharing or suppressing calls.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This method adds no retained history, handle or task to the context. The delegated reporter owns retained message/finding storage and its run lifetime; the wrapper does not release or bound that collection.
func (c *Context) ReportRange(pos, end int, message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.ReportRange(pos, end, message)
}

// ReportRangeFix records a finding at an explicit byte range with optional
// autofix edits. Older hosts that do not implement fix reporting receive the
// diagnostic without edits.
// Treat edits as best-effort: design the rule so the diagnostic alone is useful.
//
// @evidence contracts/common.md#principled-implementation Active range calls attach all edits when supported and retain the plain finding when edits or fix capability are absent.
// @evidence contracts/common.md#clear-and-simple-design One optional capability branch reuses range reporting without exposing host storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported legacy fallback preserves diagnostics rather than hiding a failed fix or replacing reporter internals.
// @evidence contracts/common.md#meaningful-documentation Native prose explains optional edits and fallback; separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeFix performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Guards and one optional-capability branch select delegation, not an edit-processing algorithm. Reporter-side coordinate normalization, edit conversion/copy and collection remain that owner's cost; passing through a variadic slice is not a fixed-total-cost guarantee.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Range-fix reporting performs an observable collection effect and coordinates no shared request result. The reporter owns identity/deduplication; equal range/message/edit inputs alone do not permit suppressing another call.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper adds no stored finding history, handle or task and forwards the supplied edit slice synchronously. Retained edit/finding storage and copying belong to the reporter; the hosted adapter converts records before handing them to its run-owned collector.
func (c *Context) ReportRangeFix(pos, end int, message string, edits ...TextEdit) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  if len(edits) == 0 {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  fixer, ok := c.reporter.(FixReporter)
  if !ok {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  fixer.ReportRangeFix(pos, end, message, edits...)
}

// ReportSuggestion records a finding with candidate fixes selected explicitly
// by the caller, rather than automatically applied. A host without
// SuggestionReporter receives the diagnostic alone. A single candidate can
// still require deliberate selection when automatic repair is inappropriate;
// several alternatives leave that selection to the caller.
//
// @evidence contracts/common.md#principled-implementation Valid active node calls attach candidate choices when supported; absent choices or optional capability preserve the diagnostic alone.
// @evidence contracts/common.md#clear-and-simple-design One capability branch separates author choice from mandatory reporting and automatic fixing.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual reporter compatibility governs fallback; no arbitrary candidate is imposed to satisfy a known consumer.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes explicit selection from automatic repair and states legacy behavior; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportSuggestion performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Guards and capability selection delegate without choosing candidate processing. The hosted adapter converts s suggestions and e nested edits before node-range and collection work; the reporter owns that variable cost, not a fixed total guaranteed here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Candidate reporting is an observable collection effect, not a shared request coordinator. Reporter identity and policy govern duplicate findings; equal node/message/candidates alone do not authorize omitting another invocation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This wrapper forwards candidate slices synchronously without storing report history or acquiring a handle/task. The retaining reporter owns candidate/edit copies and run-lifetime storage; the hosted adapter converts nested edits and the collector retains the resulting finding.
func (c *Context) ReportSuggestion(node *shimast.Node, message string, suggestions ...Suggestion) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || node == nil {
    return
  }
  if len(suggestions) == 0 {
    c.reporter.Report(node, message)
    return
  }
  suggester, ok := c.reporter.(SuggestionReporter)
  if !ok {
    c.reporter.Report(node, message)
    return
  }
  suggester.ReportSuggestion(node, message, suggestions...)
}

// ReportRangeSuggestion records a finding at an explicit byte range with a
// choice of candidate fixes. See `ReportSuggestion`.
//
// @evidence contracts/common.md#principled-implementation Active explicit ranges receive suggestions when the reporter supports them; otherwise the same finding is preserved without choices.
// @evidence contracts/common.md#clear-and-simple-design The range variant shares suggestion values without manufacturing an AST node.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compatibility branch uses a supported optional interface instead of patching reporter implementations.
// @evidence contracts/common.md#meaningful-documentation Native prose names range-based choices and its shared reporting contract; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeSuggestion performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper selects a capability but chooses no candidate algorithm. The hosted reporter converts s choices and e nested edits and normalizes the range before collection; its variable work is not certified fixed-cost by direct delegation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Range candidate reporting is an effectful call, not a completed/in-flight result coordinator. Reporter collection identity controls duplicate policy; equal coordinates/message/candidates alone cannot justify sharing or suppressing calls.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This method adds no result history, handle or task and forwards caller candidate storage synchronously. The reporter owns any retained nested edit/candidate copies and collection lifetime; hosted storage is run-owned rather than bounded by this wrapper.
func (c *Context) ReportRangeSuggestion(pos, end int, message string, suggestions ...Suggestion) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  if len(suggestions) == 0 {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  suggester, ok := c.reporter.(SuggestionReporter)
  if !ok {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  suggester.ReportRangeSuggestion(pos, end, message, suggestions...)
}

// ReportRelated records a finding at the given node's source range with related
// source locations. Older hosts that do not implement RelatedReporter receive
// the diagnostic without them, so design the rule to read well from the message
// alone. With no related locations it is exactly `Report`.
//
// @evidence contracts/common.md#principled-implementation Valid active node calls attach related ranges only through a capable reporter and always preserve the plain finding when that channel is unavailable.
// @evidence contracts/common.md#clear-and-simple-design Guards and one optional branch keep primary reporting independent from location enrichment.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy compatibility uses explicit capability detection rather than altering host reporter internals.
// @evidence contracts/common.md#meaningful-documentation Native prose explains same-finding fallback and empty-location equivalence; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRelated performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Guards and capability selection choose no related-location algorithm. The hosted reporter performs node-trivia range work and copies/normalizes r related records before collection; reporter-owned variable work is not certified fixed-cost here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Related reporting is an observable collection effect rather than a shared query coordinator. Reporter identity and duplicate policy determine valid collection; matching inputs alone do not authorize suppressing another report.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This wrapper stores no finding history, handle or task and passes related records synchronously. The reporter owns any retained location/message copies and finding population; hosted storage lives with its run-owned collection.
func (c *Context) ReportRelated(node *shimast.Node, message string, related ...RelatedInformation) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || node == nil {
    return
  }
  if len(related) == 0 {
    c.reporter.Report(node, message)
    return
  }
  reporter, ok := c.reporter.(RelatedReporter)
  if !ok {
    c.reporter.Report(node, message)
    return
  }
  reporter.ReportRelated(node, message, related...)
}

// ReportRangeRelated records a finding at an explicit byte range with related
// source locations. Falls back to a plain range finding on a host without
// RelatedReporter, and equals `ReportRange` when no related locations are given.
//
// @evidence contracts/common.md#principled-implementation Active range reporting preserves the primary finding and forwards related ranges only when provided and supported.
// @evidence contracts/common.md#clear-and-simple-design One range form reuses the enrichment capability without constructing synthetic nodes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported legacy path degrades optional locations while keeping the diagnostic intact.
// @evidence contracts/common.md#meaningful-documentation Native prose explicitly states both fallback conditions; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Context.ReportRangeRelated performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper chooses only a reporting capability, not location processing. The hosted reporter normalizes coordinates and copies r related records before collection; that variable cost belongs to the reporter and is not fixed by delegation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Range-related reporting is effectful collection, not completed/in-flight result coordination. Reporter identity and duplicate policy control reuse permission; equal coordinates/message/locations alone cannot justify suppressing calls.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No finding history, new handle or task is stored in this wrapper. A retaining reporter owns related-record copies and diagnostic storage/lifetime; the hosted collector owns its run population rather than this delegated method.
func (c *Context) ReportRangeRelated(pos, end int, message string, related ...RelatedInformation) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  if len(related) == 0 {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  reporter, ok := c.reporter.(RelatedReporter)
  if !ok {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  reporter.ReportRangeRelated(pos, end, message, related...)
}

var registry []Rule

// Register adds a contributor rule during its package's init, before host
// bootstrap reads the registry. Runtime or concurrent registration is
// unsupported: the slice is not synchronized and the host publishes adapters
// once. Duplicate names remain registered here; bootstrap drops collisions
// with a warning.
//
// @evidence contracts/common.md#principled-implementation A nonnil Rule is appended during package initialization, while the completed contributor set is validated for name collisions by the host.
// @evidence contracts/common.md#clear-and-simple-design Registration owns collection and leaves cross-rule validation to bootstrap.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The registry is the declared contributor extension point rather than a patched engine rule list.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies init-time use and deferred duplicate checks; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Register appends to an in-memory registry and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Appending one rule is amortized O(1); a capacity growth copies the existing n rule references, O(n) for that call. The registry stores O(n) entries without an extra per-registration traversal.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Registration records an initialization effect, not a completed/in-flight query coordinator. The host owns one-time bootstrap and name collision policy; equal Rule values do not authorize suppressing a registration here.
// @evidence contracts/performance.md#bound-retention-and-release-resources The registry retains O(n) rule references and slice capacity for the process lifetime with no release. Supported registration ends at initialization, so n is the configured contributor population; the function enforces no numeric cap or runtime reclamation and the host later shares those rule objects.
func Register(r Rule) {
  if r == nil {
    panic("rule: Register called with nil rule")
  }
  registry = append(registry, r)
}

// Registered returns every contributor rule registered via `Register`.
// Called once by the host during engine bootstrap. The returned slice is
// a defensive copy so the host cannot mutate the registry.
// Rule objects remain shared; callers must not mutate registered implementations.
//
// @evidence contracts/common.md#principled-implementation Allocating and copying the registry slice isolates membership from caller slice writes while sharing the registered rule values.
// @evidence contracts/common.md#clear-and-simple-design One accessor exposes registration results without backing-slice ownership.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Callers read through the supported defensive accessor instead of replacing registry entries.
// @evidence contracts/common.md#meaningful-documentation Native prose states bootstrap use and distinguishes slice copying from shared rule values; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Registered copies an in-memory registry and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Allocating and copying n Rule references costs O(n) work and returned storage. It copies slice membership only, without traversing or cloning implementations.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor creates caller-owned mutable slice membership, not a request cache or coordinator. Rule objects remain shared, but reusing one writable slice for separate callers would expose their membership mutations to each other.
// @evidence contracts/performance.md#bound-retention-and-release-resources Each call transfers O(n) owned slice storage to its caller while retaining references to shared rule objects. Caller release reclaims its slice; the registry and implementations remain process-owned. No historical copy cache, handle or running task is created.
func Registered() []Rule {
  out := make([]Rule, len(registry))
  copy(out, registry)
  return out
}
