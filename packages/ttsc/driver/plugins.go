package driver

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "sync"
)

// LinkedPluginsEnv is the environment variable ttsc sets to pass the JSON
// manifest of linked plugins to a natively-linked host binary. The value is
// a JSON array of PluginEntry objects; an empty or absent value means no
// linked plugins are active.
const LinkedPluginsEnv = "TTSC_LINKED_PLUGINS_JSON"

// PluginConfigDirEnv is the environment variable through which the ttsc
// launcher passes the project root that plugin config-file discovery and
// relative "configFile" resolution anchor at. The launcher sets it on every
// native plugin spawn; it matters when the compiled tsconfig is a generated
// wrapper outside the project — e.g. @ttsc/unplugin writes a compiler-options
// overlay into the system temp directory that `extends` the real project
// config — where the tsconfig directory no longer identifies the project and
// an unanchored discovery walk would climb the temp tree instead. It rides
// the environment rather than a CLI flag so third-party native hosts with
// strict flag sets are unaffected and linked plugins running inside them
// still receive it.
const PluginConfigDirEnv = "TTSC_PLUGIN_CONFIG_DIR"

// TsgoArgsEnv is the environment variable through which the ttsc launcher
// passes the tsgo CLI flags it did not consume itself (`--strict`,
// `--declaration`, the single-file lane's output containment, …) to a native
// sidecar. The value is a JSON array of argv tokens; an empty or absent value
// means nothing was forwarded.
//
// It rides the environment for the same reason PluginConfigDirEnv does, only
// with sharper consequences. A flag would have to be appended to the plugin
// protocol third-party hosts have already frozen, and a Go `flag.FlagSet`
// created with `flag.ContinueOnError` treats an undeclared flag as fatal: the
// sidecar would answer `flag provided but not defined: -tsgo-args` and exit 2,
// even on `ttsc <file.ts>`, where the launcher forwards its own
// output-containment flags and the user passed nothing at all. An unknown
// environment variable is inert to every host; an unknown flag is fatal to all
// of them. ttsc's own hosts still accept `--tsgo-args` so an older launcher
// paired with a newer host keeps working.
const TsgoArgsEnv = "TTSC_TSGO_ARGS"

// TsgoArgsFromEnv decodes the forwarded tsgo argv the launcher published in
// TsgoArgsEnv. An absent or whitespace-only value yields a nil slice and no
// error, so a host can call this unconditionally.
//
// Hosts that also declare a `--tsgo-args` flag should prefer the explicit flag
// value and fall back to this; LoadProgram already does that for every
// driver-based host.
//
// @evidence contracts/common.md#principled-implementation JSON argv decoding implements the declared environment protocol; LoadProgram owns explicit-flag precedence.
// @evidence contracts/common.md#clear-and-simple-design Empty input and JSON decoding preserve a named malformed-channel error.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The declared environment channel avoids adding unsupported flags to third-party hosts.
// @evidence contracts/common.md#meaningful-documentation Native prose explains empty input and explicit precedence following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation os.Getenv and JSON argv do not depend on shell quoting or native separators.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The parsed slice is returned to the caller and nothing is retained.
// @evidenceExclude contracts/performance.md#efficient-algorithms One environment read and one JSON.Unmarshal, linear in the payload size.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The payload is parsed afresh on each call and nothing is cached.
func TsgoArgsFromEnv() ([]string, error) {
  raw := strings.TrimSpace(os.Getenv(TsgoArgsEnv))
  if raw == "" {
    return nil, nil
  }
  var args []string
  if err := json.Unmarshal([]byte(raw), &args); err != nil {
    return nil, fmt.Errorf("ttsc driver: invalid %s: %w", TsgoArgsEnv, err)
  }
  return args, nil
}

// PluginConfigBaseDir returns the directory where a plugin anchors its
// config-file discovery walk and resolves relative "configFile" paths.
// The explicit PluginConfigDirEnv channel wins when set; otherwise the
// tsconfig's directory is used, falling back to cwd when no tsconfig is set.
//
// @evidence contracts/common.md#principled-implementation The project anchor keeps generated wrappers from moving discovery into the temporary-directory tree.
// @evidence contracts/common.md#clear-and-simple-design Environment, config-directory, and cwd branches state precedence directly.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Declared anchors replace guessed layouts or platform-specific temporary paths.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies precedence and relative resolution following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native filepath operations handle absolute, relative, and volume syntax without separator literals.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources PluginConfigBaseDir acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms PluginConfigBaseDir performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work PluginConfigBaseDir computes one result per call, so there is no repeated work to share.
func PluginConfigBaseDir(cwd, tsconfigPath string) string {
  if dir := strings.TrimSpace(os.Getenv(PluginConfigDirEnv)); dir != "" {
    if !filepath.IsAbs(dir) && cwd != "" {
      dir = filepath.Join(cwd, dir)
    }
    return filepath.Clean(dir)
  }
  if tsconfigPath != "" {
    resolved := tsconfigPath
    if !filepath.IsAbs(resolved) {
      resolved = filepath.Join(cwd, resolved)
    }
    return filepath.Dir(resolved)
  }
  return cwd
}

// PluginEntry is the manifest shape ttsc passes to driver-level plugins.
// The linked-host loader decodes JSON into this shape; Config is the decoded
// object (or nil for JSON null), not the original JavaScript object's identity
// or arbitrary non-JSON values. Standard Go JSON number decoding applies.
//
// @evidence contracts/common.md#principled-implementation Manifest labels/stage and decoded object configuration remain separate; registration pairing uses order rather than treating Name as executable or filesystem identity. The loader's JSON projection/decoding is distinct from preserving an original JavaScript object or its non-JSON values.
// @evidence contracts/common.md#clear-and-simple-design One serialized registration excludes runtime hook state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The schema has no fixture or plugin-package specialization.
// @evidence contracts/common.md#meaningful-documentation Native field comments and JSON tags explain the boundary following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Name/Stage labels and opaque decoded JSON configuration define no native executable, argument quoting or filesystem-identity policy. Hooks own any path interpretation of their configuration; this schema does not choose platform behavior.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type PluginEntry struct {
  // Config is the JSON-decoded configuration object, or nil for JSON null.
  Config map[string]any `json:"config"`

  // Name identifies the configured plugin entry; registration pairing uses order.
  Name string `json:"name"`

  // Stage carries the manifest's requested plugin execution stage.
  Stage string `json:"stage"`
}

// PluginContext is the per-entry context passed to registered linked plugins.
//
// @evidence contracts/common.md#principled-implementation Per-hook observations and per-plugin completeness have separate callback owners; one hook cannot prove another's inputs.
// @evidence contracts/common.md#clear-and-simple-design Public project context is separate from private report callbacks.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit reports avoid foreign globals or intercepted arbitrary filesystem calls.
// @evidence contracts/common.md#meaningful-documentation Field prose and reporting-method contracts explain context and proof following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Cwd/Tsconfig retain the host-supplied native anchors; context construction does not physically canonicalize them or establish case policy. Reporting methods resolve relative inputs with native filepath operations and serialize dependency coordinates through TransformOutputKey, while physical observations remain separately reported. No shell string or OS-name guess supplies identity proof.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type PluginContext struct {
  // Cwd anchors relative paths reported by this plugin.
  Cwd string

  // Entry is this registration's JSON-decoded manifest value.
  Entry PluginEntry

  // Tsconfig names the compiler configuration selected for this project.
  Tsconfig string

  reportHostInput                func(string)
  reportHostInputHash            func(string, *string)
  reportHostInputHashUnknown     func(string)
  reportHostInputRealpath        func(string, *string)
  reportHostInputRealpathUnknown func(string)
  reportObservationIncomplete    func()
  reportFileDependency           func(string, string)
  reportFileDependencyRejected   func(string)
  reportFileComplete             func(string)
  reportEveryFileComplete        func()
}

// ReportObservationIncomplete declares that this hook's input population could
// not be observed through its supported public observation API. The declaration
// is sticky for this hook and compiler generation. Fresh output may still be
// usable, but callers must decline reuse based on this incomplete population.
//
// Report actual input mutation and inconsistent hash or physical-path observations
// through their existing input callbacks. This declaration neither clears those
// failures nor authorizes their admission. A context without a driver callback
// ignores the report; its absence is not proof of complete observations.
//
// @evidence contracts/common.md#principled-implementation A declared unavailable observation boundary becomes a sticky per-hook state while existing individual input conflict evidence remains untouched.
// @evidence contracts/common.md#clear-and-simple-design One callback transfers the hook's known observation limitation to its owning generation without pretending to enumerate missing inputs.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Public API unavailability is distinguished from observed mutation; no blanket hash omission or fabricated input filename bypasses a real conflict.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs define hook scope, sticky lifetime, fresh output versus reuse and the prohibition on masking actual mutation following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This callback reports an observation limitation and performs no native filesystem operation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The callback marks an existing caller-owned hook scope sticky; this notifier neither acquires that scope nor controls its lifetime, and allocates no independent handle, buffer or historical cache. The marked state persists after return under its ledger owner.
// @evidenceExclude contracts/performance.md#efficient-algorithms This notifier selects no collection or input-processing strategy; it forwards a signal to the owning scope's mutex-protected boolean update, without enumerating missing inputs or constructing a proof population.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Declaring a known observation limitation is an effectful signal, not coordination of completed/in-flight computation or authority to reuse an artifact. Reuse admission belongs to consumers of the scope state.
func (ctx PluginContext) ReportObservationIncomplete() {
  if ctx.reportObservationIncomplete != nil {
    ctx.reportObservationIncomplete()
  }
}

// ReportHostInputHash declares the exact file state consumed by a native
// plugin. hash is a lowercase SHA-256 digest for an observed file and nil for
// a missing candidate. Conflicting observations are retained as host inputs
// but omitted from PluginHostInputHashes, forcing persistent adapters to
// decline narrow reuse without failing the transform.
// This reporter validates digest syntax and forwards the supplied observation;
// it does not read the file or independently authenticate consumption-time data.
//
// @evidence contracts/common.md#principled-implementation Invalid digest reports retain the input but withdraw proof instead of authorizing reuse.
// @evidence contracts/common.md#clear-and-simple-design Path normalization and digest validation precede one valid or unknown observation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No later reread or invented digest replaces evaluation-time evidence.
// @evidence contracts/common.md#meaningful-documentation Native prose defines digests, absence, and conflict consequences following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Relative paths use native Join and Clean against cwd without shell interpretation.
// @evidence contracts/performance.md#bound-retention-and-release-resources Normalized file text and the supplied hash value transfer to the caller-owned hook ledger; its callback copies the pointer value and retains per-path known/unknown state. Repeated paths fold into that scope, while distinct paths grow retained keys and metadata without a cap supplied here. No native handle is acquired, and this reporter controls neither scope lifetime nor disposal.
// @evidence contracts/performance.md#efficient-algorithms Blank/path guards and native Join/Clean process file/cwd text. Digest validation rejects non-64-byte strings by length and scans at most 64 bytes for lowercase hex; the callback adds map key hashing/comparison, locking and value copying. No file content read or hashing is performed by this syntax-validation reporter.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Publishing a supplied input observation is not coordination of a completed/in-flight artifact computation. The ledger merges evidence and consumers separately decide continued artifact validity; this reporter owns no cached computation or reuse permission.
func (ctx PluginContext) ReportHostInputHash(file string, hash *string) {
  if ctx.reportHostInputHash == nil || strings.TrimSpace(file) == "" {
    return
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  file = filepath.Clean(file)
  if hash != nil && !isLowerSHA256(*hash) {
    if ctx.reportHostInputHashUnknown != nil {
      ctx.reportHostInputHashUnknown(file)
    } else if ctx.reportHostInput != nil {
      ctx.reportHostInput(file)
    }
    return
  }
  ctx.reportHostInputHash(file, hash)
}

// ReportHostInputRealpath declares the physical path resolved while a native
// plugin consumed file. realpath is absolute for an observed path and nil for
// a missing candidate. Conflicting observations remain host inputs but are
// omitted from PluginHostInputRealpaths so adapters cannot attach an earlier
// result to a retargeted symlink or junction.
// This method validates supplied path syntax; it does not call Realpath or
// independently verify physical resolution, absence or alias equivalence.
//
// @evidence contracts/common.md#principled-implementation Consumption-time identity becomes unknown when invalid rather than defaulting to lexical identity.
// @evidence contracts/common.md#clear-and-simple-design Normalize and validate before delivering one ledger observation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Neither a later realpath read nor the lexical filename substitutes for missing proof.
// @evidence contracts/common.md#meaningful-documentation Native prose explains absolute identity and retarget safety following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation File spellings resolve against Cwd with native Join/Clean; supplied nonnil identity must have native absolute-path syntax and is cleaned without resolving links or guessing case policy. Nil is the caller's absence report, not a new stat result, and accepted absolute spelling alone does not authenticate physical identity.
// @evidence contracts/performance.md#bound-retention-and-release-resources Normalized file/identity strings transfer to the caller-owned hook ledger, whose callback copies pointer values and folds repeated-path conflicts into unknown state. Distinct paths retain keys and identity metadata without a cap imposed here. No native handle is acquired; scope lifetime and any separately retained context callbacks remain outside this reporter's disposal control.
// @evidence contracts/performance.md#efficient-algorithms Trimming, native absolute/path checks and Join/Clean process file/cwd/identity text; ledger delivery adds locking, key hashing and string comparison/value copying. There is no filesystem traversal or native identity query, but path-length work is not a fixed number of byte operations.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporting supplied identity metadata is not sharing an artifact computation; the ledger merges evidence and reuse consumers own validation/admission. This reporter caches no native query or output from a previous filesystem generation.
func (ctx PluginContext) ReportHostInputRealpath(file string, realpath *string) {
  if ctx.reportHostInputRealpath == nil || strings.TrimSpace(file) == "" {
    return
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  file = filepath.Clean(file)
  if realpath != nil {
    if strings.TrimSpace(*realpath) == "" || !filepath.IsAbs(*realpath) {
      if ctx.reportHostInputRealpathUnknown != nil {
        ctx.reportHostInputRealpathUnknown(file)
      } else if ctx.reportHostInput != nil {
        ctx.reportHostInput(file)
      }
      return
    }
    resolved := filepath.Clean(*realpath)
    realpath = &resolved
  }
  ctx.reportHostInputRealpath(file, realpath)
}

func isLowerSHA256(value string) bool {
  if len(value) != 64 {
    return false
  }
  for _, char := range value {
    if (char < '0' || char > '9') && (char < 'a' || char > 'f') {
      return false
    }
  }
  return true
}

// ReportHostInput declares an absolute file whose content or presence was
// consumed by the native plugin hook. Native transform
// envelopes expose the generation-wide union so persistent hosts can invalidate
// without re-evaluating plugin config on the JavaScript side.
//
// @evidence contracts/common.md#principled-implementation Input declarations persist for the generation even without content proof.
// @evidence contracts/common.md#clear-and-simple-design Guarded native-path normalization delegates to one observation owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual consumption reports replace guessed config names and fabricated hashes.
// @evidence contracts/common.md#meaningful-documentation Native prose separates input declaration from reevaluation following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native Join and Clean resolve against cwd without separator literals.
// @evidence contracts/performance.md#bound-retention-and-release-resources The cleaned path transfers into an existing caller-owned hook scope; distinct paths grow its retained declaration set, while repeated equal paths deduplicate there. This reporter opens no handle and supplies no path-count/byte cap or scope disposal policy; separately retained callbacks can preserve that state.
// @evidence contracts/performance.md#efficient-algorithms Trimming and native absolute/Join/Clean operations process file/cwd text, followed by the scope callback's lock and string-key insertion. No file is read or traversed, but path normalization and map hashing are not constant byte work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This effectful declaration adds an input candidate without proving content or coordinating a completed/in-flight artifact computation. The scope retains reports and artifact consumers separately establish reuse eligibility.
func (ctx PluginContext) ReportHostInput(file string) {
  if ctx.reportHostInput == nil || strings.TrimSpace(file) == "" {
    return
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  ctx.reportHostInput(filepath.Clean(file))
}

// ReportFileDependency declares one file whose content influenced this
// plugin's contribution to the transformed file file. Both are resolved
// against the plugin's cwd and keyed like every other envelope section, so a
// plugin reports the program's own file names and the host joins the sections
// by key.
//
// Reporting alone only widens what a consumer invalidates on; it is
// ReportFileDependenciesComplete that turns the reported set into the file's
// whole input set.
//
// A dependency this cannot resolve to a key is not silently forgotten: it
// withdraws this plugin's completeness claim for that file, because a complete
// list missing a member is exactly what serves stale output. The plugin's other
// files keep theirs.
//
// @evidence contracts/common.md#principled-implementation Unrepresentable dependencies revoke file completeness rather than silently dropping an input.
// @evidence contracts/common.md#clear-and-simple-design One key helper normalizes both paths before recording an edge or rejection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A partial set never implicitly becomes complete.
// @evidence contracts/common.md#meaningful-documentation Native prose explains widening, completeness, and failure following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Shared native cwd resolution and slash conversion preserve filename case.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ReportFileDependency acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms ReportFileDependency performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ReportFileDependency computes one result per call, so there is no repeated work to share.
func (ctx PluginContext) ReportFileDependency(file string, dependency string) {
  if ctx.reportFileDependency == nil {
    return
  }
  target, ok := ctx.transformKey(file)
  if !ok {
    return
  }
  input, ok := ctx.transformKey(dependency)
  if !ok {
    if ctx.reportFileDependencyRejected != nil {
      ctx.reportFileDependencyRejected(target)
    }
    return
  }
  ctx.reportFileDependency(target, input)
}

// ReportFileDependenciesComplete declares that everything this plugin's
// contribution to file consumed, beyond file's own text and the universal
// compiler-option chain, was reported through ReportFileDependency — possibly
// nothing at all.
//
// The declaration is per (plugin, file), the way the protocol's completeness
// contract defines it: the host lists a file in dependenciesComplete only when
// every plugin that can contribute to it declared it, because a consumer cannot
// attribute one plugin's entries back to it.
//
// @evidence contracts/common.md#principled-implementation Completeness belongs to each plugin and file, never one contributor on another's behalf.
// @evidence contracts/common.md#clear-and-simple-design One normalized target receives one explicit completeness declaration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Empty lists or successful transforms do not imply completeness.
// @evidence contracts/common.md#meaningful-documentation Native prose defines complete inputs and all contributors following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Shared native-path conversion replaces platform-specific prefix slicing.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ReportFileDependenciesComplete acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms ReportFileDependenciesComplete performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ReportFileDependenciesComplete computes one result per call, so there is no repeated work to share.
func (ctx PluginContext) ReportFileDependenciesComplete(file string) {
  if ctx.reportFileComplete == nil {
    return
  }
  target, ok := ctx.transformKey(file)
  if !ok {
    return
  }
  ctx.reportFileComplete(target)
}

// ReportDependenciesComplete makes the same declaration for every file in the
// program at once: this plugin's contribution to any transformed file is a
// function of that file's own text, whatever it reported for that file, its
// reported host inputs, and the compiler options.
//
// That is the honest claim of a syntactic transform — one that decides from the
// file in front of it and its own configuration rather than from the type
// system — and it is the only form available to a hook that never sees the
// program, such as SourcePreamble.
//
// @evidence contracts/common.md#principled-implementation Universal completeness includes host inputs and compiler options alongside file text and dependencies.
// @evidence contracts/common.md#clear-and-simple-design One callback records the plugin-wide declaration without boundary enumeration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Contributor declarations replace completeness inferred from syntax or test success.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the declaration and preamble-hook applicability following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Reporting this boolean policy performs no native operation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ReportDependenciesComplete acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms ReportDependenciesComplete performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ReportDependenciesComplete computes one result per call, so there is no repeated work to share.
func (ctx PluginContext) ReportDependenciesComplete() {
  if ctx.reportEveryFileComplete == nil {
    return
  }
  ctx.reportEveryFileComplete()
}

// transformKey resolves one plugin-reported path to the key convention every
// envelope section uses. A plugin reports the spellings its host handed it
// (absolute program file names, or paths relative to the plugin's cwd), and
// the compiler's own file names are slash-normalized on every platform, so
// both sides must pass through TransformOutputKey to meet.
//
// Separators and the project prefix reconcile, but the suffix keeps the case
// the caller wrote: report the program's own spelling of a file rather than a
// re-cased one, or the key will not match on a case-insensitive filesystem and
// the declaration is dropped.
func (ctx PluginContext) transformKey(file string) (string, bool) {
  if strings.TrimSpace(file) == "" {
    return "", false
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  return TransformOutputKey(ctx.Cwd, filepath.Clean(file)), true
}

// SourcePreamblePlugin can inject source text before TypeScript-Go parses the
// project. This is intentionally generic: the driver knows only the registered
// plugin name and the project plugin manifest.
//
// @evidence contracts/common.md#principled-implementation Source production precedes parsing rather than mutating a bound program.
// @evidence contracts/common.md#clear-and-simple-design One context-to-text capability excludes unrelated lifecycle methods.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit interfaces replace package-name dispatch or parser monkeypatching.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the parse boundary following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Concrete implementations own native configuration access; the interface only defines source production.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type SourcePreamblePlugin interface {
  // SourcePreamble produces source text for this plugin's preparse contribution.
  //
  // @evidence contracts/common.md#principled-implementation A context-owned source contribution enters before the compiler parses and binds the project.
  // @evidence contracts/common.md#clear-and-simple-design One text/error result expresses preparse production without a bound-program mutation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The supported hook avoids parser monkeypatches and package-name special cases.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies plugin-owned preparse text following the documentation skill.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation The capability declaration owns no native operation; concrete configuration readers own their platform boundary.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SourcePreamble declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms SourcePreamble declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work SourcePreamble declares a signature only; the implementation owns any shared work.
  SourcePreamble(PluginContext) (string, error)
}

// ProgramPlugin can mutate a loaded Program before source output or emit.
//
// @evidence contracts/common.md#principled-implementation Declared AST mutation lets the host distinguish it from reusable incremental checking.
// @evidence contracts/common.md#clear-and-simple-design One operation separates loaded-program mutation from preparse and emit phases.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported hook replaces globally altered compiler packages.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the mutation boundary following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The capability declaration performs no native operation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type ProgramPlugin interface {
  // ApplyProgram mutates this generation before source output or native emit.
  //
  // @evidence contracts/common.md#principled-implementation Explicit generation mutation lets the host distinguish fresh transform work from reusable clean checking.
  // @evidence contracts/common.md#clear-and-simple-design One program/context operation represents this phase separately from preambles and emit transforms.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Mutation uses the declared plugin seam rather than global compiler package replacement.
  // @evidence contracts/common.md#meaningful-documentation Native prose specifies generation and phase following the documentation skill.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation This method declaration owns no native filesystem or process operation.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ApplyProgram declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ApplyProgram declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ApplyProgram declares a signature only; the implementation owns any shared work.
  ApplyProgram(*Program, PluginContext) error
}

// EmitTransformPlugin contributes an emit-phase AST transformer. The returned
// PluginTransform runs first in tsgo's per-file emit chain, sharing the emit
// EmitContext with the builtin transformers, so a plugin returns AST instead of
// spliced text. For an injected import, allocate its binding once with
// ec.Factory.NewUniqueNameEx and the Optimistic | FileLevel flags, then reuse
// that identifier for every reference. NewGeneratedNameForNode on a string
// literal uses tsgo's temp-name channel and can be shadowed by downlevel temps.
// Tsgo's module-transform emits the require and aliases the references itself.
// This is the AST-integration replacement for the ProgramPlugin + RewriteSet
// text-splice model. A plugin whose returned transform is nil contributes
// nothing.
//
// @evidence contracts/common.md#principled-implementation EmitContext owns binding identity and builtin integration rather than a second textual module-resolution model.
// @evidence contracts/common.md#clear-and-simple-design One optional transformer leaves scheduling and printing with the host.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported factory names and original links replace hardcoded temporary identifiers.
// @evidence contracts/common.md#meaningful-documentation Native prose explains factory identity, nil behavior, and binding reuse following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This AST capability owns no native process or path operation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type EmitTransformPlugin interface {
  // EmitTransform produces an optional callback for the native per-file emit chain.
  //
  // @evidence contracts/common.md#principled-implementation The returned callback shares EmitContext identity with builtin transformations.
  // @evidence contracts/common.md#clear-and-simple-design Callback production is separate from per-source execution and printing.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The interface returns supported AST transformations instead of guessed downlevel import text.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies optional callback production following the documentation skill.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation The callback declaration defines AST work without a native path or process operation.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources EmitTransform declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms EmitTransform declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work EmitTransform declares a signature only; the implementation owns any shared work.
  EmitTransform(PluginContext) (PluginTransform, error)
}

type linkedPluginState struct {
  cwd          string
  declarations *pluginFileDeclarations
  entries      []PluginEntry
  inputs       *pluginHostInputScopes
  tsconfig     string
}

// pluginHostInputScopes keeps one observation set per plugin hook. A hash from
// one hook cannot prove another hook's same-file dependency when that hook only
// reported the path, while ReportHostInput followed by ReportHostInputHash in
// one hook remains one complete observation.
type pluginHostInputScopes struct {
  mu     sync.Mutex
  scopes []*pluginHostInputs
}

type pluginHostInputs struct {
  files                 map[string]struct{}
  hashes                map[string]pluginHostInputHash
  realpaths             map[string]pluginHostInputHash
  observationIncomplete bool
  mu                    sync.Mutex
}

func (inputs *pluginHostInputs) markObservationIncomplete() {
  inputs.mu.Lock()
  inputs.observationIncomplete = true
  inputs.mu.Unlock()
}

func (inputs *pluginHostInputScopes) hasIncompleteObservations() bool {
  for _, scope := range inputs.snapshot() {
    scope.mu.Lock()
    incomplete := scope.observationIncomplete
    scope.mu.Unlock()
    if incomplete {
      return true
    }
  }
  return false
}

type pluginHostInputHash struct {
  hash  *string
  known bool
}

func newPluginHostInputScopes() *pluginHostInputScopes {
  return &pluginHostInputScopes{}
}

func newPluginHostInputs() *pluginHostInputs {
  return &pluginHostInputs{
    files:     map[string]struct{}{},
    hashes:    map[string]pluginHostInputHash{},
    realpaths: map[string]pluginHostInputHash{},
  }
}

func (inputs *pluginHostInputScopes) newScope() *pluginHostInputs {
  scope := newPluginHostInputs()
  if inputs == nil {
    return scope
  }
  inputs.mu.Lock()
  inputs.scopes = append(inputs.scopes, scope)
  inputs.mu.Unlock()
  return scope
}

func (inputs *pluginHostInputScopes) snapshot() []*pluginHostInputs {
  if inputs == nil {
    return nil
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  return append([]*pluginHostInputs(nil), inputs.scopes...)
}

func (inputs *pluginHostInputs) addHash(file string, hash *string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  previous, exists := inputs.hashes[file]
  if !exists {
    inputs.hashes[file] = pluginHostInputHash{hash: cloneStringPointer(hash), known: true}
    return
  }
  if !previous.known || !sameStringPointer(previous.hash, hash) {
    inputs.hashes[file] = pluginHostInputHash{known: false}
  }
}

func (inputs *pluginHostInputs) invalidateHash(file string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  inputs.hashes[file] = pluginHostInputHash{known: false}
}

func (inputs *pluginHostInputs) addRealpath(file string, realpath *string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  previous, exists := inputs.realpaths[file]
  if !exists {
    inputs.realpaths[file] = pluginHostInputHash{hash: cloneStringPointer(realpath), known: true}
    return
  }
  if !previous.known || !sameStringPointer(previous.hash, realpath) {
    inputs.realpaths[file] = pluginHostInputHash{known: false}
  }
}

func (inputs *pluginHostInputs) invalidateRealpath(file string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  inputs.realpaths[file] = pluginHostInputHash{known: false}
}

func cloneStringPointer(value *string) *string {
  if value == nil {
    return nil
  }
  cloned := *value
  return &cloned
}

func sameStringPointer(left, right *string) bool {
  if left == nil || right == nil {
    return left == nil && right == nil
  }
  return *left == *right
}

func (inputs *pluginHostInputs) add(file string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  inputs.files[file] = struct{}{}
  inputs.mu.Unlock()
}

func (inputs *pluginHostInputs) snapshot() (map[string]struct{}, map[string]pluginHostInputHash, map[string]pluginHostInputHash) {
  if inputs == nil {
    return nil, nil, nil
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  files := make(map[string]struct{}, len(inputs.files))
  for file := range inputs.files {
    files[file] = struct{}{}
  }
  hashes := make(map[string]pluginHostInputHash, len(inputs.hashes))
  for file, observation := range inputs.hashes {
    hashes[file] = pluginHostInputHash{
      hash:  cloneStringPointer(observation.hash),
      known: observation.known,
    }
  }
  realpaths := make(map[string]pluginHostInputHash, len(inputs.realpaths))
  for file, observation := range inputs.realpaths {
    realpaths[file] = pluginHostInputHash{
      hash:  cloneStringPointer(observation.hash),
      known: observation.known,
    }
  }
  return files, hashes, realpaths
}

func (inputs *pluginHostInputScopes) list() []string {
  union := map[string]struct{}{}
  for _, scope := range inputs.snapshot() {
    files, _, _ := scope.snapshot()
    for file := range files {
      union[file] = struct{}{}
    }
  }
  files := make([]string, 0, len(union))
  for file := range union {
    files = append(files, file)
  }
  sort.Strings(files)
  return files
}

func (inputs *pluginHostInputScopes) hashList() map[string]*string {
  combined := map[string]pluginHostInputHash{}
  for _, scope := range inputs.snapshot() {
    files, hashes, _ := scope.snapshot()
    for file := range files {
      observation, exists := hashes[file]
      if !exists || !observation.known {
        combined[file] = pluginHostInputHash{known: false}
        continue
      }
      previous, exists := combined[file]
      if !exists {
        combined[file] = observation
      } else if !previous.known || !sameStringPointer(previous.hash, observation.hash) {
        combined[file] = pluginHostInputHash{known: false}
      }
    }
  }
  hashes := map[string]*string{}
  for file, observation := range combined {
    if observation.known {
      hashes[file] = cloneStringPointer(observation.hash)
    }
  }
  if len(hashes) == 0 {
    return nil
  }
  return hashes
}

func (inputs *pluginHostInputScopes) realpathList() map[string]*string {
  combined := map[string]pluginHostInputHash{}
  for _, scope := range inputs.snapshot() {
    files, _, realpaths := scope.snapshot()
    for file := range files {
      observation, exists := realpaths[file]
      if !exists || !observation.known {
        combined[file] = pluginHostInputHash{known: false}
        continue
      }
      previous, exists := combined[file]
      if !exists {
        combined[file] = observation
      } else if !previous.known || !sameStringPointer(previous.hash, observation.hash) {
        combined[file] = pluginHostInputHash{known: false}
      }
    }
  }
  realpaths := map[string]*string{}
  for file, observation := range combined {
    if observation.known {
      realpaths[file] = cloneStringPointer(observation.hash)
    }
  }
  if len(realpaths) == 0 {
    return nil
  }
  return realpaths
}

var pluginRegistry []any

// RegisterPlugin registers a driver-level plugin implementation. Linked Go
// packages call this from init(); ttsc pairs registrations with linked manifest
// entries by build order, not by package name.
// The guard rejects a nil interface, not every typed-nil implementation.
// Registry mutation has no concurrent-call synchronization or reset/cap policy.
//
// @evidence contracts/common.md#principled-implementation Init registration preserves ordered manifest pairing and rejects a nil interface. A nonnil interface wrapping a typed-nil implementation is not structurally validated by this append boundary.
// @evidence contracts/common.md#clear-and-simple-design One guarded append owns registration; dispatch owns capability classification.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Registry entries come from linked init calls rather than guessed names or test fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose states init use and order-based pairing following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation In-process insertion performs no native path or process operation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The process-global registry retains every appended interface and reachable implementation state for the process lifetime. Linked init calls normally determine the population, but this exported function enforces no registration-count/transitive-byte cap, deduplication or reset/release operation.
// @evidence contracts/performance.md#efficient-algorithms The nil-interface check precedes one ordered append. Appending is amortized constant entry work; capacity growth can allocate/copy the existing registration references, without cloning implementation payloads or scanning them for duplicate identity.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Registration performs no per-call computation that a later call could reuse.
func RegisterPlugin(plugin any) {
  if plugin == nil {
    panic("driver: RegisterPlugin called with nil plugin")
  }
  pluginRegistry = append(pluginRegistry, plugin)
}

// loadLinkedPluginState reads the linked-plugin manifest from the environment
// and returns the hydrated state. Returns a zero-entry state (not an error)
// when the environment variable is absent or empty.
func loadLinkedPluginState(cwd, tsconfigPath string) (linkedPluginState, error) {
  input := strings.TrimSpace(os.Getenv(LinkedPluginsEnv))
  if input == "" {
    return linkedPluginState{
      cwd:          cwd,
      declarations: newPluginFileDeclarations(),
      inputs:       newPluginHostInputScopes(),
      tsconfig:     tsconfigPath,
    }, nil
  }
  var entries []PluginEntry
  if err := json.Unmarshal([]byte(input), &entries); err != nil {
    return linkedPluginState{}, fmt.Errorf("ttsc driver: invalid %s: %w", LinkedPluginsEnv, err)
  }
  return linkedPluginState{
    cwd:          cwd,
    declarations: newPluginFileDeclarations(),
    entries:      entries,
    inputs:       newPluginHostInputScopes(),
    tsconfig:     tsconfigPath,
  }, nil
}

// sourcePreamble calls SourcePreamble on every SourcePreamblePlugin in
// registration order and concatenates the results. An entry that does not
// implement SourcePreamblePlugin is silently skipped.
func (state linkedPluginState) sourcePreamble() (string, error) {
  var out strings.Builder
  for index, entry := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      return "", fmt.Errorf("ttsc driver: linked plugin entry %d was requested but no linked plugin registered at that position", index)
    }
    preamble, ok := plugin.(SourcePreamblePlugin)
    if !ok {
      continue
    }
    text, err := preamble.SourcePreamble(state.contextAt(index, entry))
    if err != nil {
      return "", err
    }
    out.WriteString(text)
  }
  return out.String(), nil
}

// apply calls ApplyProgram on every ProgramPlugin in registration order.
// An entry that does not implement ProgramPlugin is silently skipped.
func (state linkedPluginState) apply(prog *Program) error {
  for index, entry := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      return fmt.Errorf("ttsc driver: linked plugin entry %d was requested but no linked plugin registered at that position", index)
    }
    transform, ok := plugin.(ProgramPlugin)
    if !ok {
      continue
    }
    if err := transform.ApplyProgram(prog, state.contextAt(index, entry)); err != nil {
      return err
    }
  }
  return nil
}

func (state linkedPluginState) hasProgramPlugins() bool {
  for index := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      continue
    }
    if _, ok := plugin.(ProgramPlugin); ok {
      return true
    }
  }
  return false
}

// emitTransforms collects an emit-phase PluginTransform from every registered
// EmitTransformPlugin, in registration order. Entries that do not implement
// EmitTransformPlugin, or whose transform is nil, are skipped.
func (state linkedPluginState) emitTransforms() ([]PluginTransform, error) {
  var out []PluginTransform
  for index, entry := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      return nil, fmt.Errorf("ttsc driver: linked plugin entry %d was requested but no linked plugin registered at that position", index)
    }
    emitter, ok := plugin.(EmitTransformPlugin)
    if !ok {
      continue
    }
    transform, err := emitter.EmitTransform(state.contextAt(index, entry))
    if err != nil {
      return nil, err
    }
    if transform != nil {
      out = append(out, transform)
    }
  }
  return out, nil
}

// registeredPlugin returns the plugin registered at position index, or
// (nil, false) when the index is out of range. Registration order matches
// the order of linked Go init() calls.
func registeredPlugin(index int) (any, bool) {
  if index < 0 || index >= len(pluginRegistry) {
    return nil, false
  }
  return pluginRegistry[index], true
}

// contextAt builds the PluginContext the driver passes to one plugin hook.
//
// Host-input observations are scoped per hook, because a hash one hook reported
// cannot prove another hook's dependency on the same path. Dependency
// declarations are scoped per plugin instead: completeness is a claim about
// everything one plugin contributes to a file, so the claims of its preamble
// and program hooks are the same plugin's claim and must not be attributed
// separately.
func (state linkedPluginState) contextAt(index int, entry PluginEntry) PluginContext {
  inputs := state.inputs.newScope()
  declaration := state.declarations.forPlugin(index)
  return PluginContext{
    Cwd:                            state.cwd,
    Entry:                          entry,
    Tsconfig:                       state.tsconfig,
    reportHostInput:                inputs.add,
    reportHostInputHash:            inputs.addHash,
    reportHostInputHashUnknown:     inputs.invalidateHash,
    reportHostInputRealpath:        inputs.addRealpath,
    reportHostInputRealpathUnknown: inputs.invalidateRealpath,
    reportObservationIncomplete:    inputs.markObservationIncomplete,
    reportFileDependency:           declaration.addDependency,
    reportFileDependencyRejected:   declaration.rejectDependency,
    reportFileComplete:             declaration.addComplete,
    reportEveryFileComplete:        declaration.completeEveryFile,
  }
}

// hostInputs returns the exact native configuration inputs reported in this
// generation.
func (state linkedPluginState) hostInputs() []string {
  return state.inputs.list()
}

func (state linkedPluginState) hostInputHashes() map[string]*string {
  return state.inputs.hashList()
}

func (state linkedPluginState) hostInputRealpaths() map[string]*string {
  return state.inputs.realpathList()
}
