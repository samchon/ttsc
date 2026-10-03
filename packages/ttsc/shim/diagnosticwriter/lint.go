// Lint diagnostic helpers.
//
// Plugins that participate in `ttsc check` / `ttsc build` (e.g. `@ttsc/lint`)
// need to emit findings that ride the same color/context renderer as tsgo's
// own typecheck diagnostics. The plumbing has to live next to the existing
// shim so the renderer keeps its single owner of `internal/diagnosticwriter`
// and `internal/diagnostics`.
//
// Consumers construct a `LintDiagnostic` from `(file, pos, end, code,
// category, message)` and pass it to `FormatMixedDiagnostics` together with
// any raw tsgo diagnostics. The renderer treats both the same way.
package diagnosticwriter

import (
  "cmp"
  "io"
  "slices"
  "strings"

  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/diagnostics"
  inner "github.com/microsoft/typescript-go/internal/diagnosticwriter"
  "github.com/microsoft/typescript-go/internal/locale"
  "github.com/microsoft/typescript-go/internal/tspath"
)

// LintCategory selects warning vs error rendering. Warnings render yellow,
// errors render red; the exit-code decision lives in the caller.
// Any value other than LintCategoryError maps to warning.
//
// @evidence contracts/common.md#principled-implementation Separate category constants preserve error versus warning; Category and IsError share the exact error discriminator, so display and error counting agree even for other integer values.
// @evidence contracts/common.md#clear-and-simple-design One category value drives both rendering and caller error classification without coupling the diagnostic to a process exit.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Category constants express the renderer contract, not severity guesses based on message text or a rule's consumer.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies display categories, caller-owned exit decisions and the non-error fallback.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LintCategory int

const (
  LintCategoryWarning LintCategory = iota
  LintCategoryError
)

// NormalizeLintRange returns a renderer-safe half-open source span. Diagnostic
// producers are a plugin trust boundary, so offsets are clamped even when the
// caller's contract says they point inside the current file. Reversed and
// zero-width ranges select one byte when one exists at pos; EOF and empty-file
// ranges remain zero-width instead of manufacturing a byte past the source.
//
// @evidence contracts/common.md#principled-implementation Clamping both byte endpoints into [0, source length] and extending a nonpositive span only before EOF establishes 0 <= pos <= end <= length; nil source yields an empty project-wide span.
// @evidence contracts/common.md#clear-and-simple-design One boundary normalizer owns producer-range sanitation for every NewLintDiagnostic instead of requiring each renderer method to repair offsets.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Clamping addresses untrusted producer coordinates against the actual source length; it does not substitute canned diagnostic ranges or hide an out-of-file byte.
// @evidence contracts/common.md#meaningful-documentation Native prose states half-open units, why sanitation belongs at the producer boundary, and the reversed/EOF/empty-file effects.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NormalizeLintRange acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NormalizeLintRange performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NormalizeLintRange computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NormalizeLintRange computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NormalizeLintRange(file *ast.SourceFile, pos, end int) (int, int) {
  if file == nil {
    return 0, 0
  }
  sourceLen := len(file.Text())
  if pos < 0 {
    pos = 0
  } else if pos > sourceLen {
    pos = sourceLen
  }
  if end < 0 {
    end = 0
  } else if end > sourceLen {
    end = sourceLen
  }
  if end <= pos {
    end = pos
    if pos < sourceLen {
      end++
    }
  }
  return pos, end
}

// LintDiagnostic is a public, plugin-emittable diagnostic shaped like the
// `internal/diagnosticwriter.Diagnostic` interface. The upstream interface lives
// in an internal package that outside plugin modules cannot import directly.
// This public implementation lets their findings share the compiler renderer.
//
// The source file is retained, not copied; its text must remain the version the
// diagnostic range describes. Stored-field accessors require a nonnil
// receiver; File, Message and the empty-metadata accessors are nil-safe.
//
// @evidence contracts/common.md#principled-implementation Private source, normalized byte endpoints, severity and message implement the upstream Diagnostic methods without losing project-wide nil source or already-localized lint prose.
// @evidence contracts/common.md#clear-and-simple-design One immutable-by-public-API value implements the renderer boundary, with construction owning range validation and accessors supplying stored facts.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Lint findings enter the same formatter through an explicit interface implementation rather than modifying upstream diagnostics or injecting global output.
// @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain the internal-package import boundary, retained source version and nil-receiver limits; public accessors document units and optional metadata.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LintDiagnostic struct {
  file     *ast.SourceFile
  pos      int
  end      int
  code     int32
  category LintCategory
  message  string
}

// NewLintDiagnostic builds a lint diagnostic anchored at [pos, end) in the
// supplied source file. `code` shows up in the rendered banner; the
// convention is to give each rule its own stable integer.
// A nil file creates a project-wide message with an empty range.
//
// @evidence contracts/common.md#principled-implementation Construction normalizes the caller's byte span before storing it with source identity, stable code, category and message, preserving project-wide absence when file is nil.
// @evidence contracts/common.md#clear-and-simple-design One constructor establishes the range invariant for the private fields; renderer accessors need no repeated sanitation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The value contains actual producer findings; stable codes identify rules rather than synthesizing expected compiler messages.
// @evidence contracts/common.md#meaningful-documentation Native prose states half-open anchoring, code identity convention and nil-file meaning, with range normalization explained on its owner.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewLintDiagnostic acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewLintDiagnostic performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewLintDiagnostic computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewLintDiagnostic computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewLintDiagnostic(file *ast.SourceFile, pos, end int, code int32, category LintCategory, message string) *LintDiagnostic {
  pos, end = NormalizeLintRange(file, pos, end)
  return &LintDiagnostic{
    file:     file,
    pos:      pos,
    end:      end,
    code:     code,
    category: category,
    message:  message,
  }
}

// File supplies the retained source, or nil for a project-wide/nil diagnostic.
// Returning an untyped nil avoids a non-nil interface containing a nil pointer.
//
// @evidence contracts/common.md#principled-implementation The explicit nil branch preserves absent source at the interface boundary; present files retain their original compiler identity and text.
// @evidence contracts/common.md#clear-and-simple-design One accessor owns pointer-to-interface absence conversion without a wrapper file representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing source remains absent rather than a fabricated file used to satisfy the renderer.
// @evidence contracts/common.md#meaningful-documentation Native prose explains retained provenance, project-wide absence and the Go typed-nil interface consequence.
// @evidence contracts/performance.md#bound-retention-and-release-resources A nonnil returned interface borrows the stored SourceFile and can keep its source/AST/semantic graph reachable under the caller's lifetime. Nil cases carry no source. The diagnostic and compiler owners retain their existing graph ownership; this accessor allocates no independent source copy or history registry and does not release that graph on return.
// @evidence contracts/performance.md#efficient-algorithms Two nil checks select true interface absence or the existing source pointer; no source-content scan, wrapper file allocation or coordinate conversion is needed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Existing source identity belongs to the diagnostic/compiler owners; this accessor coordinates no completed/in-flight source producer or source-version cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation File computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) File() inner.FileLike {
  if d == nil || d.file == nil {
    return nil
  }
  return d.file
}

// Pos returns the normalized inclusive UTF-8 byte offset.
//
// @evidence contracts/common.md#principled-implementation Reading the constructor-normalized start preserves the source interval used by the renderer; the receiver must be non-nil.
// @evidence contracts/common.md#clear-and-simple-design The accessor supplies one stored endpoint without reinterpreting coordinates.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The offset remains producer/source data rather than a guessed JavaScript character position.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies normalized origin and byte units; the type states the non-nil receiver premise.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Pos acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms This accessor projects the constructor-normalized scalar start; it chooses no independent range-validation, source traversal or coordinate-conversion algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Stored endpoint state belongs to the diagnostic owner; this accessor coordinates no completed/in-flight producer or source-version cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Pos computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) Pos() int { return d.pos }

// End returns the normalized exclusive UTF-8 byte offset.
//
// @evidence contracts/common.md#principled-implementation Reading the constructor-normalized end retains the half-open interval and its source-length bound; the receiver must be non-nil.
// @evidence contracts/common.md#clear-and-simple-design One endpoint accessor keeps interval facts distinct from derived length.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The end is not extended past EOF to invent a visible diagnostic byte.
// @evidence contracts/common.md#meaningful-documentation Native prose states normalized exclusive endpoint and byte units, with receiver requirements on the type.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources End acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms This accessor projects the endpoint already normalized by construction; it chooses no independent range-validation, coordinate-conversion or traversal algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Stored endpoint state belongs to the diagnostic owner; this accessor coordinates no completed/in-flight producer or cache invalidation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation End computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) End() int { return d.end }

// Len returns the normalized span length in UTF-8 bytes, including zero at EOF.
//
// @evidence contracts/common.md#principled-implementation End minus start is a nonnegative byte length because construction establishes ordered endpoints within the source; the receiver must be non-nil.
// @evidence contracts/common.md#clear-and-simple-design Deriving length from the two stored endpoints avoids another mutable field that could diverge from them.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Zero-width spans remain real absence of covered bytes rather than a fabricated length beyond the source.
// @evidence contracts/common.md#meaningful-documentation Native prose states byte length and the EOF zero-width case before acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Len acquires no handle, buffer or cache and retains nothing after it returns.
// @evidence contracts/performance.md#efficient-algorithms Subtract the two constructor-normalized scalar endpoints directly; no source scan, repeated sanitation or byte-to-character conversion is required for the stored span length.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Stored range state belongs to the diagnostic owner; this scalar derived-value query coordinates no completed/in-flight producer or source-version cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Len computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) Len() int { return d.end - d.pos }

// Code returns the producer-supplied diagnostic identifier unchanged.
// The receiver must be nonnil; uniqueness and stability are producer policy.
//
// @evidence contracts/common.md#principled-implementation The stored int32 code passes through unchanged, retaining the rule identity used by formatter banners and consumers.
// @evidence contracts/common.md#clear-and-simple-design One accessor exposes producer identity independently from severity and message presentation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Codes are supplied by the producer rather than inferred from expected message text.
// @evidence contracts/common.md#meaningful-documentation Native prose names stable producer identity; construction explains the per-rule convention.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Code acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms This accessor projects a stored scalar chosen by the producer; it chooses no independent code lookup, validation, conversion or traversal algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Stored diagnostic identity belongs to the producer; this accessor coordinates no completed/in-flight computation or cache invalidation policy.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Code computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) Code() int32 { return d.code }

// Category translates the exact error discriminator; every other value is warning.
// The receiver must be nonnil; stored category values are not validated here.
//
// @evidence contracts/common.md#principled-implementation The same LintCategoryError comparison used by IsError maps stored categories to upstream error/warning values, keeping rendering and failure counting consistent.
// @evidence contracts/common.md#clear-and-simple-design One translation boundary adapts the public lint category to the internal formatter enum.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit category data determines severity without message heuristics or consumer-specific reclassification.
// @evidence contracts/common.md#meaningful-documentation Native prose states the exact discriminator and fallback, rather than implying arbitrary integers form validated enum values.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Category acquires no handle, buffer or cache and retains nothing after it returns.
// @evidence contracts/performance.md#efficient-algorithms One exact scalar comparison selects the upstream error category, with warning as the fallback; no message/path scan, lookup table or allocation is needed for translation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This stored-category projection coordinates no completed/in-flight producer or cache; the diagnostic owner controls the category value and its lifetime.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Category computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) Category() diagnostics.Category {
  if d.category == LintCategoryError {
    return diagnostics.CategoryError
  }
  return diagnostics.CategoryWarning
}

// Localize returns the producer's already-localized message; locale is unused.
// The receiver must be nonnil. The producer supplies final prose; this method
// does not verify its language or perform translation.
//
// @evidence contracts/common.md#principled-implementation Returning stored prose preserves the producer's chosen message without applying another locale transformation to an already-localized value.
// @evidence contracts/common.md#clear-and-simple-design One formatter adapter supplies stored prose while message creation stays with the rule.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The message is not replaced by a canned compiler diagnostic or inferred translation.
// @evidence contracts/common.md#meaningful-documentation Native prose explicitly states already-localized input and ignored locale semantics.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned string borrows the stored message backing bytes, which a caller can keep reachable after the diagnostic's own lifetime. No independent message copy, native handle or historical localization registry is acquired by this accessor; the producer and caller own those bytes and retention.
// @evidenceExclude contracts/performance.md#efficient-algorithms This accessor projects stored text without scanning, translating or validating it; the producer owns message construction and localization algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Already-produced message state belongs to the diagnostic owner; this accessor coordinates no completed/in-flight translation producer or locale-keyed cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Localize computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) Localize(_ locale.Locale) string { return d.message }

// MessageChain returns nil because this diagnostic contains one flat message.
//
// @evidence contracts/common.md#principled-implementation Nil represents the absent chain in the upstream interface; the value stores a flat message rather than structured children.
// @evidence contracts/common.md#clear-and-simple-design The adapter states its flat-message capability without an unused child-diagnostic hierarchy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing structured metadata remains absent rather than manufactured chain nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the absence and its representation premise.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources MessageChain acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms This capability projection supplies absent structured metadata and chooses no child-graph construction, traversal or formatting algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work No message-chain computation or completed/in-flight producer is coordinated here; structured metadata is absent in this diagnostic representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation MessageChain computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) MessageChain() []inner.Diagnostic { return nil }

// RelatedInformation returns nil; this value carries no auxiliary diagnostics.
//
// @evidence contracts/common.md#principled-implementation Nil preserves the absence of related diagnostics under the upstream formatter interface.
// @evidence contracts/common.md#clear-and-simple-design A focused flat diagnostic does not acquire an unused related-information store.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Auxiliary source sites are not fabricated from message spelling.
// @evidence contracts/common.md#meaningful-documentation Native prose states the unsupported auxiliary metadata capability directly.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RelatedInformation acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms This capability projection supplies absent auxiliary metadata and chooses no related-site construction, source lookup or diagnostic-graph traversal algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work No auxiliary-diagnostic computation or completed/in-flight producer is coordinated here; related information is absent in this flat representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RelatedInformation computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) RelatedInformation() []inner.Diagnostic { return nil }

// Message returns the already-localized lint message.
// It returns an empty string for a nil receiver.
//
// @evidence contracts/common.md#principled-implementation The accessor preserves producer prose on present diagnostics and supplies the documented empty absence value for a nil receiver.
// @evidence contracts/common.md#clear-and-simple-design The public string accessor is separate from the locale-shaped formatter method, while both use the same stored message.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Nil does not cause a fabricated finding or a guessed diagnostic message.
// @evidence contracts/common.md#meaningful-documentation Native prose names already-localized content and the nil-receiver result.
// @evidence contracts/performance.md#bound-retention-and-release-resources A present receiver returns borrowed message backing bytes that callers may retain after return; the nil branch returns the empty string. The accessor creates no independent text copy, native handle or historical message registry, and producer/caller owners determine the stored text's lifetime.
// @evidence contracts/performance.md#efficient-algorithms One receiver nil check chooses empty absence or a stored string projection; no message scan, formatting, localization or copy is required here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Stored producer text belongs to the diagnostic owner; this accessor coordinates no completed/in-flight message computation or localization cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Message computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) Message() string {
  if d == nil {
    return ""
  }
  return d.message
}

// IsError reports whether the diagnostic should fail the build. Lint plugins
// use this to compute their exit code separately from the renderer.
// The receiver must be nonnil; only the exact error discriminator is true.
//
// @evidence contracts/common.md#principled-implementation The exact error-category comparison matches Category's upstream mapping, so callers count the same diagnostics that render as errors.
// @evidence contracts/common.md#clear-and-simple-design A boolean category query leaves process exit-code policy with the caller instead of embedding it in a rendered diagnostic.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Stored category data determines failure classification without matching consumer or message names.
// @evidence contracts/common.md#meaningful-documentation Native prose explains caller-owned exit decisions and the separation from rendering.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsError acquires no handle, buffer or cache and retains nothing after it returns.
// @evidence contracts/performance.md#efficient-algorithms One exact stored-category comparison supplies the scalar classification without scanning message/path text or allocating state; caller build policy is not recomputed here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Diagnostic category state belongs to its producer; this predicate coordinates no completed/in-flight work or cross-version result cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsError computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (d *LintDiagnostic) IsError() bool { return d.category == LintCategoryError }

// FormatMixedDiagnostics renders raw tsgo diagnostics and lint diagnostics
// together with TypeScript-style colors and source context, followed by the
// `Found N errors` summary. Returns the count of error-level diagnostics so
// callers can decide on an exit code.
// Nil entries from either producer are ignored. Source files must remain the
// versions described by their diagnostic byte ranges throughout rendering.
// The writer and nonnil diagnostic graphs must satisfy upstream formatting
// premises. Individual write errors are not returned; the count classifies
// findings and is not a successful-output-delivery receipt.
//
// @evidence contracts/common.md#principled-implementation Upstream AST adapters and the lint interface implementation share one renderer; exact category comparisons count errors, and deterministic source/range/code/message ordering preserves both producers' complete findings.
// @evidence contracts/common.md#clear-and-simple-design One mixed rendering entry owns filtering, ordering and summary composition, with a private comparator centralizing tie-breaking and upstream owning snippet formatting.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Real findings flow through a caller-supplied writer rather than a swapped global stream; nil filtering does not drop present findings or manufacture successful diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native prose explains mixed source context, returned error count, nil-entry handling and retained source-version requirements before these tags.
// @evidence contracts/performance.md#bound-retention-and-release-resources The combined array, AST adapters, comparator-created message/related arrays and formatter/summary state are invocation-local and borrow diagnostic/source graphs. Writer buffers and source-owner caches can survive under their owners after return; this renderer does not close the writer, keep a historical batch registry or impose fixed byte/population limits. Unreferenced local state is eligible for collection rather than explicitly reclaimed at the last write.
// @evidence contracts/performance.md#efficient-algorithms Collect and count nonnil diagnostics, then sort by source/range/code/category and localized/nested content before rendering and summary construction. Sorting adds comparison-dependent work over path/message bytes and recursive diagnostic graphs; upstream snippets, location conversion, summary grouping/sort and writer operations add further work. A single formatting call does not remove those scans or make the total linear in diagnostic count.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This renderer coordinates no completed/in-flight formatted-batch cache. The combined array is rebuilt per invocation; upstream/source owners manage reusable localization or position state, while output reuse for an equivalent diagnostic/context snapshot belongs to callers.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This renderer sorts diagnostic data and delegates display-path formatting using supplied cwd; it does not establish native file identity or select an executable/filesystem capability. The supplied writer's native destination and lifetime belong to its caller, and display spelling is not certified as a case-policy answer.
func FormatMixedDiagnostics(
  output io.Writer,
  astDiags []*ast.Diagnostic,
  lintDiags []*LintDiagnostic,
  currentDirectory string,
) int {
  if len(astDiags) == 0 && len(lintDiags) == 0 {
    return 0
  }
  all := make([]inner.Diagnostic, 0, len(astDiags)+len(lintDiags))
  errors := 0
  for _, d := range astDiags {
    if d == nil {
      continue
    }
    all = append(all, inner.WrapASTDiagnostic(d))
    if d.Category() == diagnostics.CategoryError {
      errors++
    }
  }
  for _, d := range lintDiags {
    if d == nil {
      continue
    }
    all = append(all, d)
    if d.IsError() {
      errors++
    }
  }
  if len(all) == 0 {
    return 0
  }
  options := &inner.FormattingOptions{
    Locale: locale.Default,
    ComparePathsOptions: tspath.ComparePathsOptions{
      CurrentDirectory:          currentDirectory,
      UseCaseSensitiveFileNames: true,
    },
    NewLine: "\n",
  }
  slices.SortFunc(all, compareMixedDiagnostics)
  inner.FormatDiagnosticsWithColorAndContext(output, all, options)
  inner.WriteErrorSummaryText(output, all, options)
  return errors
}

// compareMixedDiagnostics imposes one deterministic source order on tsgo and
// lint diagnostics before the upstream renderer consumes them. The renderer
// intentionally writes its input order, while the two producers have separate
// collection paths; ordering here keeps neither producer's traversal visible
// in CLI output.
func compareMixedDiagnostics(a, b inner.Diagnostic) int {
  if c := strings.Compare(mixedDiagnosticFileName(a), mixedDiagnosticFileName(b)); c != 0 {
    return c
  }
  if c := cmp.Compare(a.Pos(), b.Pos()); c != 0 {
    return c
  }
  if c := cmp.Compare(a.End(), b.End()); c != 0 {
    return c
  }
  if c := cmp.Compare(a.Code(), b.Code()); c != 0 {
    return c
  }
  if c := cmp.Compare(a.Category(), b.Category()); c != 0 {
    return c
  }
  if c := strings.Compare(a.Localize(locale.Default), b.Localize(locale.Default)); c != 0 {
    return c
  }
  if c := compareMixedDiagnosticLists(a.MessageChain(), b.MessageChain()); c != 0 {
    return c
  }
  return compareMixedDiagnosticLists(a.RelatedInformation(), b.RelatedInformation())
}

func mixedDiagnosticFileName(d inner.Diagnostic) string {
  if file := d.File(); file != nil {
    return file.FileName()
  }
  return ""
}

func compareMixedDiagnosticLists(a, b []inner.Diagnostic) int {
  for i := 0; i < len(a) && i < len(b); i++ {
    if c := compareMixedDiagnostics(a[i], b[i]); c != 0 {
      return c
    }
  }
  return cmp.Compare(len(a), len(b))
}
