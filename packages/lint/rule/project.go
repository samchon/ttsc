package rule

import (
  "encoding/json"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// ProjectIdentity names one loaded TypeScript Program without conflating the
// caller's path spelling with the filesystem identity used by the compiler.
// Empty explicit fields mean the caller did not provide that channel.
// Path members carry native filesystem spellings, not file URLs. Logical
// members preserve caller-facing locations; physical members identify the
// compiler filesystem binding. The host resolves missing physical channels,
// retaining the original spelling if no alternate path can be established.
// Neither channel declares case policy.
//
// @evidence contracts/common.md#principled-implementation Separate logical and physical strings preserve caller-facing config identity independently from compiler filesystem identity within one lifecycle.
// @evidence contracts/common.md#clear-and-simple-design One identity record groups invocation, configuration, roots and optional origins used by project checks.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit identity channels avoid guessing a project binding from unrelated temporary paths.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes logical and physical identity; member comments explain the lifecycle and absent channels with separated tags under documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation The boundary separates native invocation/logical/physical paths and optional caller origins from protocol URLs. Host normalization uses filepath for missing logical members and actual symlink/ancestor resolution for missing physical members, including the explicit Windows short-name/junction boundary, preserving a cleaned original on failure or a cycle. Supplied channels remain caller-owned spellings; the record neither lowercases them nor infers case sensitivity from an OS name.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectIdentity is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectIdentity is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectIdentity is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectIdentity struct {
  // LifecycleID is minted by the host for each loaded Program cycle;
  // a supplied caller value is replaced during host normalization.
  LifecycleID         string `json:"lifecycleId"`

  // InvocationCwd is the caller's working directory.
  InvocationCwd       string `json:"invocationCwd"`

  // LogicalConfigPath is the caller-facing config path spelling.
  LogicalConfigPath   string `json:"logicalConfigPath"`

  // LogicalProjectRoot is the root used for caller-facing locations.
  LogicalProjectRoot  string `json:"logicalProjectRoot"`

  // PhysicalConfigPath is the config identity used by the compiler filesystem.
  PhysicalConfigPath  string `json:"physicalConfigPath"`

  // PhysicalProjectRoot anchors local dependency declarations.
  PhysicalProjectRoot string `json:"physicalProjectRoot"`

  // ExplicitProjectRoot is empty when no caller override was supplied.
  ExplicitProjectRoot string `json:"explicitProjectRoot,omitempty"`

  // PluginConfigOrigin is empty when no separate discovery origin was supplied.
  PluginConfigOrigin  string `json:"pluginConfigOrigin,omitempty"`
}

// ProjectRuleStatus describes whether a named project rule exists, was
// configured, and completed during the current Program cycle.
//
// @evidence contracts/common.md#principled-implementation Five named states distinguish registration, configuration and evaluation outcome instead of treating every unavailable result as passed.
// @evidence contracts/common.md#clear-and-simple-design One discriminant communicates project-rule status to file consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Status values are lifecycle vocabulary, not consumer-specific success exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the Program-cycle scope; the tag block follows documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRuleStatus is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectRuleStatus is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectRuleStatus is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectRuleStatus is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectRuleStatus string

const (
  ProjectRuleAbsent       ProjectRuleStatus = "absent"
  ProjectRuleOff          ProjectRuleStatus = "off"
  ProjectRuleNotEvaluated ProjectRuleStatus = "not_evaluated"
  ProjectRulePassed       ProjectRuleStatus = "passed"
  ProjectRuleFailed       ProjectRuleStatus = "failed"
)

// ProjectFinding is a non-file finding retained in a project rule's cycle
// result. Project findings never contain edits or source ranges.
//
// @evidence contracts/common.md#principled-implementation Message and severity represent a Program-wide finding without pretending it has a file location or fix.
// @evidence contracts/common.md#clear-and-simple-design Two members carry the non-file finding while file diagnostics retain their separate type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No synthetic file or range is invented to route project findings through file diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native comments explain the absent range and edit semantics; member and tag boundaries follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectFinding is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectFinding is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectFinding is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectFinding is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectFinding struct {
  // Message describes the project-wide finding.
  Message  string

  // Severity is the reported level, which can differ from the rule default.
  Severity Severity
}

// ProjectRuleResult is one snapshot of a named project rule in the current
// Program cycle. State is the contributor-owned value attached during the
// project check; the host neither interprets nor synchronizes its contents.
// Findings is returned as a defensive copy by host result readers.
//
// Evaluated results retain a cycle-scoped failure channel through file-rule
// dispatch. Call Report or Fail immediately before a guarded operation, then
// call Context.ProjectResult again when the updated status is needed. Absent,
// off, and not-evaluated results have no state or live failure channel.
//
// @evidence contracts/common.md#principled-implementation The status and copied findings are a snapshot while the private reporter preserves the evaluated cycle's guarded failure channel.
// @evidence contracts/common.md#clear-and-simple-design Snapshot data and live mutation are separated within one result, keeping reporter ownership with the host.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unevaluated results expose no invented successful state; live failure uses the supported reporter boundary.
// @evidence contracts/common.md#meaningful-documentation Native prose explains snapshot freshness, contributor synchronization and failure-channel lifetime; member and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRuleResult is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectRuleResult is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectRuleResult is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectRuleResult is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectRuleResult struct {
  // Status is the rule outcome when this snapshot was read.
  Status   ProjectRuleStatus

  // State is the exact contributor-owned value, without a deep copy.
  State    any

  // Findings contains copied project findings at the snapshot boundary.
  Findings []ProjectFinding

  reporter ProjectReporter
}

// NewProjectRuleResult constructs one host-owned project-result snapshot.
// Contributor code normally receives this value from Context.ProjectResult
// and does not construct it.
//
// @evidence contracts/common.md#principled-implementation Copying findings prevents callers from changing the host slice while state and reporter retain their documented ownership.
// @evidence contracts/common.md#clear-and-simple-design The constructor owns defensive snapshot creation in one place.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Host-supplied inputs are preserved without inferred success or fabricated state.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies host construction and normal contributor access; the separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewProjectRuleResult performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Copying n findings takes O(n) record work and O(n) output storage, while status, state and reporter transfer in constant field work. Message strings remain shared immutable bytes; contributor state is not traversed or deep-copied.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation intentionally returns independent mutable finding storage for its supplied snapshot; the caller controls snapshot freshness and may not share that backing slice between readers. State and reporter references retain their declared shared identity.
// @evidence contracts/performance.md#bound-retention-and-release-resources The constructor transfers a newly copied finding slice to the returned snapshot owner, proportional to input findings. Exact contributor state and the host reporter remain borrowed references; a retained snapshot can retain those objects, but reporter finalization owns mutation closure. No handle or task is acquired and no process-global history is stored.
func NewProjectRuleResult(
  status ProjectRuleStatus,
  state any,
  findings []ProjectFinding,
  reporter ProjectReporter,
) ProjectRuleResult {
  return ProjectRuleResult{
    Status:   status,
    State:    state,
    Findings: append([]ProjectFinding(nil), findings...),
    reporter: reporter,
  }
}

// Fail marks this evaluated project result failed without adding a finding.
// It is a no-op after file dispatch or for a result that was not evaluated.
//
// @evidence contracts/common.md#principled-implementation A nonnil cycle reporter receives the failure; absent reporters leave unevaluated snapshots inert and the host enforces finalization.
// @evidence contracts/common.md#clear-and-simple-design One optional reporter call separates live failure from immutable snapshot fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Failure is propagated through the supported reporter rather than rewriting snapshot status to feign host state.
// @evidence contracts/common.md#meaningful-documentation Native prose states missing and finalized channel behavior; tags are separated under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRuleResult.Fail performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms One nil check and optional reporter callback avoid copying or scanning the snapshot. The standard host reporter locks and sets its active failure flag in constant field work; a supplied reporter owns any additional callback cost and mutex contention is not a fixed latency.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Fail performs the requested mutation through the retained cycle reporter rather than computing a reusable snapshot. Reporter identity and finalization own validity; arbitrary reporter effects cannot be suppressed by treating a previous call as equivalent work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Fail forwards through the snapshot's existing borrowed reporter without acquiring or retaining a new resource. The reporter owns its lock and active-cycle lifetime, while the snapshot owner controls retention of its references.
func (r ProjectRuleResult) Fail() {
  if r.reporter != nil {
    r.reporter.Fail()
  }
}

// Report records one project finding and marks this evaluated result failed.
// Equal messages are deduplicated by the host. It is a no-op after file
// dispatch or for a result that was not evaluated.
//
// @evidence contracts/common.md#principled-implementation A present reporter records the message and failure in the live cycle; the host owns deduplication and finalization.
// @evidence contracts/common.md#clear-and-simple-design The result forwards one finding without duplicating host aggregation policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Live failure remains a supported callback, not a mutation of foreign host storage.
// @evidence contracts/common.md#meaningful-documentation Native prose documents deduplication and no-op lifetime boundaries; the tag block follows documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRuleResult.Report performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms One nil check forwards the message without copying findings. The standard host reporter locks and deduplicates by keyed message lookup, with hashing proportional to message bytes and amortized insertion work; another supplied reporter owns its callback algorithm and contention cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporting is an effect on the retained cycle channel, not a reusable snapshot computation. The standard reporter owns equal-message deduplication and active/finalized validity; this wrapper must preserve each supported callback invocation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper borrows the snapshot's reporter and retains no message independently. The standard host reporter owns unique message strings for the active cycle, closes mutations at finalization and can remain retained through externally held snapshots; this method introduces no separate historical cache or handle.
func (r ProjectRuleResult) Report(message string) {
  if r.reporter != nil {
    r.reporter.Report(message)
  }
}

// ProjectResultReader supplies live project state to later file-rule contexts.
// Hosts return ProjectRuleAbsent for names with no registered project rule.
//
// @evidence contracts/common.md#principled-implementation Name lookup returns the current cycle's snapshot, preserving absent as a distinct outcome.
// @evidence contracts/common.md#clear-and-simple-design One reader method decouples file contexts from the host's project-result storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported lookup boundary avoids contributor access to internal result maps.
// @evidence contracts/common.md#meaningful-documentation Native prose explains live lookup and absent names; the separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectResultReader is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectResultReader is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectResultReader is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectResultReader is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectResultReader interface {
  // ProjectResult snapshots the named rule in the current Program cycle.
  //
  // @evidence contracts/common.md#principled-implementation The named snapshot preserves registration and evaluation distinctions required before consuming project state.
  // @evidence contracts/common.md#clear-and-simple-design The method exposes only lookup rather than the host's mutable storage.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Consumers obtain state through declared lookup instead of injecting assumed project results.
  // @evidence contracts/common.md#meaningful-documentation The native method comment identifies cycle scope with a separated tag block under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectResultReader.ProjectResult is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectResultReader.ProjectResult is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectResultReader.ProjectResult is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectResultReader.ProjectResult is a method signature without a body; each implementation owns any retained state.
  ProjectResult(name string) ProjectRuleResult
}

// ProjectRule is a contributor check that runs once for a loaded Program
// before any node rule dispatch. It has no AST visit list or synthetic file.
//
// @evidence contracts/common.md#principled-implementation Name and whole-Program Check represent project validation independently of node visitation.
// @evidence contracts/common.md#clear-and-simple-design A two-method interface separates identity from project checking without synthetic AST dispatch.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Project rules use their dedicated lifecycle rather than a fabricated source node to run once.
// @evidence contracts/common.md#meaningful-documentation Native prose states invocation ordering and the lack of a visit list; method and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectRule is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectRule interface {
  // Name is the rules-map identity of this project check.
  //
  // @evidence contracts/common.md#principled-implementation A stable string maps configuration and results to the same registered project rule.
  // @evidence contracts/common.md#clear-and-simple-design Identity is one method separate from effectful checking.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The registered name is a public key rather than an inferred fixture identifier.
  // @evidence contracts/common.md#meaningful-documentation The native comment explains configuration identity with a separated tag block under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRule.Name is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectRule.Name is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectRule.Name is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectRule.Name is a method signature without a body; each implementation owns any retained state.
  Name() string

  // Check evaluates the loaded Program and publishes findings or state through ctx.
  //
  // @evidence contracts/common.md#principled-implementation The project context supplies the Program binding and reporter for one whole-project evaluation.
  // @evidence contracts/common.md#clear-and-simple-design One operation owns project validation before file dispatch.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Findings and state use context APIs without replacing host dispatch.
  // @evidence contracts/common.md#meaningful-documentation The native comment states evaluation and publication responsibility; the tag boundary follows documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRule.Check is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectRule.Check is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectRule.Check is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectRule.Check is a method signature without a body; each implementation owns any retained state.
  Check(ctx *ProjectContext)
}

// ProjectInputKind distinguishes one exact local path from a glob population.
// Both kinds are resolved against ProjectIdentity.PhysicalProjectRoot by the
// host. Remote URLs are not project inputs.
//
// @evidence contracts/common.md#principled-implementation File and glob discriminants distinguish a persistent exact dependency from a changing local population.
// @evidence contracts/common.md#clear-and-simple-design One shared kind type selects the interpretation of a ProjectInput pattern.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported local dependency kinds do not fabricate remote watch support.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies the physical-root anchor and URL exclusion; tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation The file/glob discriminant defines exact native-file versus native-rooted population observation. ProjectInput carries the path representation and the host uses filepath plus actual ancestor resolution before publication; the kind itself does not infer filesystem case policy or invent remote polling support.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInputKind is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInputKind is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInputKind is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectInputKind string

const (
  ProjectInputFile ProjectInputKind = "file"
  ProjectInputGlob ProjectInputKind = "glob"
)

// ProjectInput declares one local filesystem dependency of a ProjectRule.
// Pattern may be absolute or relative to the physical project root. Glob
// patterns support path-segment `*`, `?`, and `**`; exact files remain
// dependencies while missing. Outer pattern whitespace is trimmed; names that
// require trailing pattern whitespace are not represented by this channel.
//
// @evidence contracts/common.md#principled-implementation A kind and path pattern describe dependency topology even when exact files are missing or glob populations are empty.
// @evidence contracts/common.md#clear-and-simple-design One declarative record separates dependency publication from filesystem observation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Dependencies are declared from configured topology rather than successful reads alone.
// @evidence contracts/common.md#meaningful-documentation Native prose explains root anchoring, glob grammar and missing-file persistence; member and tag spacing follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation Pattern carries a native absolute/relative path or supported path-segment glob, anchored to the physical project root; outer whitespace is trimmed and an empty pattern is rejected, so literal trailing pattern whitespace is not preserved. Host normalization converts slash spelling with filepath.FromSlash, resolves actual existing/symlink ancestors while retaining missing suffixes, and publishes slash-normalized native identities without lowercasing Windows paths. HTTP(S) URLs are rejected as non-filesystem dependencies; URL/protocol spelling does not define local case policy.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInput is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInput is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInput is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectInput struct {
  // Kind chooses exact-file or glob-population observation.
  Kind    ProjectInputKind `json:"kind"`

  // Pattern is a native path or glob resolved from the physical project root.
  Pattern string           `json:"pattern"`
}

// ProjectInputRule is the optional dependency-publication contract for a
// ProjectRule. The host calls ProjectInputs after resolving the rule's options
// and physical project identity, without loading a TypeScript Program.
//
// @evidence contracts/common.md#principled-implementation The dependency method receives resolved identity and options before Program loading so watchers can observe failed and missing inputs too.
// @evidence contracts/common.md#clear-and-simple-design A separate optional interface declares inputs without expanding the mandatory Check interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Watch topology uses a supported declaration hook rather than patching file observation after successful checking.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies pre-Program invocation and configuration readiness; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectInputRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInputRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInputRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInputRule is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectInputRule interface {
  // ProjectInputs declares local dependency topology for the resolved rule options.
  //
  // @evidence contracts/common.md#principled-implementation Returned file and glob declarations describe all local inputs relevant to the configured check before evaluation succeeds.
  // @evidence contracts/common.md#clear-and-simple-design One declarative method keeps dependency selection separate from checking and watcher mechanics.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit dependency channel avoids inventing successful-read-only watch coverage.
  // @evidence contracts/common.md#meaningful-documentation The native comment explains options-based topology with a separated tag block under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectInputRule.ProjectInputs is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInputRule.ProjectInputs is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInputRule.ProjectInputs is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInputRule.ProjectInputs is a method signature without a body; each implementation owns any retained state.
  ProjectInputs(ctx *ProjectInputContext) []ProjectInput
}

// ProjectInputContext contains the immutable configuration available while a
// ProjectRule declares its local filesystem dependencies.
//
// @evidence contracts/common.md#principled-implementation Identity, severity and raw options represent the configuration available before a Program exists.
// @evidence contracts/common.md#clear-and-simple-design The input-only context omits checker and source fields unavailable during dependency discovery.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Dependency publication uses actual resolved configuration instead of manufacturing a partial Program.
// @evidence contracts/common.md#meaningful-documentation Native prose and members identify immutable configuration and absent Program access; member and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectInputContext is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInputContext is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInputContext is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInputContext is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectInputContext struct {
  // Identity names the invocation and physical dependency root.
  Identity ProjectIdentity

  // Severity is the resolved project-rule level.
  Severity Severity

  // Options is the raw configured payload; DecodeOptions preserves defaults when empty.
  Options  json.RawMessage
}

// NewProjectInputContext constructs the context passed to
// ProjectInputRule.ProjectInputs. Contributor code normally receives this value
// and does not construct it.
//
// @evidence contracts/common.md#principled-implementation Copying raw option bytes prevents later mutation of the host's options slice while preserving identity and severity values.
// @evidence contracts/common.md#clear-and-simple-design One constructor owns dependency-context construction and its defensive copy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The constructor forwards host-resolved values without inferred project identity or altered options.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies host construction and normal contributor access; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewProjectInputContext performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewProjectInputContext has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewProjectInputContext keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewProjectInputContext acquires no handle or task and retains nothing beyond the receiver's own fields.
func NewProjectInputContext(
  identity ProjectIdentity,
  severity Severity,
  options json.RawMessage,
) *ProjectInputContext {
  return &ProjectInputContext{
    Identity: identity,
    Severity: severity,
    Options:  append(json.RawMessage(nil), options...),
  }
}

// DecodeOptions unmarshals the configured project-rule options into out. A
// missing options tuple leaves out unchanged and returns nil.
//
// @evidence contracts/common.md#principled-implementation A nil or empty context leaves defaults untouched; present raw JSON is decoded by encoding/json with its error returned.
// @evidence contracts/common.md#clear-and-simple-design An absence guard and standard decoder keep dependency option interpretation local.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Decoding has no rule-specific bypass or fabricated fallback payload.
// @evidence contracts/common.md#meaningful-documentation The native comment documents absent-options behavior; prose and tags are separated under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectInputContext.DecodeOptions performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInputContext.DecodeOptions has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInputContext.DecodeOptions keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInputContext.DecodeOptions acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *ProjectInputContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// ProjectReporter is the cycle-scoped failure channel available to project
// helpers. Report records a deterministic project finding and also marks the
// current rule failed; Fail marks failure without adding a finding.
//
// @evidence contracts/common.md#principled-implementation Separate failure and finding methods distinguish invalid project state from a user-facing diagnostic while sharing one cycle channel.
// @evidence contracts/common.md#clear-and-simple-design A two-method reporter hides aggregation and lifecycle storage from project helpers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Project failure uses a declared callback rather than a synthetic file diagnostic.
// @evidence contracts/common.md#meaningful-documentation Native prose explains failure versus finding; method and tag boundaries follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectReporter is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectReporter is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectReporter is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectReporter is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectReporter interface {
  // Fail marks the project rule failed without adding a finding.
  //
  // @evidence contracts/common.md#principled-implementation The channel can invalidate a result even when no additional message is appropriate.
  // @evidence contracts/common.md#clear-and-simple-design A distinct method separates state failure from diagnostic creation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Failure remains explicit instead of manufacturing a message or a passed result.
  // @evidence contracts/common.md#meaningful-documentation Native prose states the diagnostic-free effect; the tag block follows documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectReporter.Fail is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectReporter.Fail is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectReporter.Fail is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectReporter.Fail is a method signature without a body; each implementation owns any retained state.
  Fail()

  // Report adds one project finding and marks the current rule failed.
  //
  // @evidence contracts/common.md#principled-implementation A message-bearing failure is delivered to the host's cycle aggregator.
  // @evidence contracts/common.md#clear-and-simple-design One reporter method owns the finding-plus-failure operation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The supported project channel avoids fabricated file ranges or direct host-map mutation.
  // @evidence contracts/common.md#meaningful-documentation The native method comment states both effects with separated tags under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectReporter.Report is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectReporter.Report is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectReporter.Report is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectReporter.Report is a method signature without a body; each implementation owns any retained state.
  Report(message string)
}

// ProjectSeverityReporter optionally accepts a severity for each finding.
// Reporting still marks the rule failed, including for warnings, so consumers
// cannot treat an incomplete project result as a clean one.
//
// @evidence contracts/common.md#principled-implementation An optional explicit-level reporter preserves the distinction between finding severity and project-state failure.
// @evidence contracts/common.md#clear-and-simple-design One optional interface adds level control without breaking existing ProjectReporter hosts.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Capability detection uses interface satisfaction rather than host-name checks or foreign mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains warning-induced failure; method and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectSeverityReporter is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectSeverityReporter is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectSeverityReporter is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectSeverityReporter is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectSeverityReporter interface {
  // ReportSeverity records a project finding at its explicitly supplied level.
  //
  // @evidence contracts/common.md#principled-implementation The finding's level is represented separately from the rule's default severity.
  // @evidence contracts/common.md#clear-and-simple-design One optional operation extends reporting without a second project-result store.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit severity travels through a declared interface rather than patched reporter internals.
  // @evidence contracts/common.md#meaningful-documentation The native comment names explicit-level reporting with a separated tag block under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectSeverityReporter.ReportSeverity is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ProjectSeverityReporter.ReportSeverity is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectSeverityReporter.ReportSeverity is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectSeverityReporter.ReportSeverity is a method signature without a body; each implementation owns any retained state.
  ReportSeverity(severity Severity, message string)
}

// ProjectContext contains the immutable inputs for one project-rule check.
//
// Sources is a defensive copy of the user sources the host read for this cycle:
// the project's own tsconfig-selected files plus every TypeScript source the
// Program pulled in through an import, minus globally ignored paths. A rule
// that declares a population by glob therefore sees a first-party sibling
// workspace package the same way the type-check pass does, instead of an empty
// population that would silently report full coverage.
//
// A format run is the exception. It writes files and reports nothing, so it
// walks the project's own file list alone and a rule evaluated there receives
// that narrower population. Draw a conclusion that must hold across the
// workspace from a lint or check run.
//
// @evidence contracts/common.md#principled-implementation The context binds loaded sources and checker to identity, resolved settings and cycle reporters; sources differ deliberately for a writing format run.
// @evidence contracts/common.md#clear-and-simple-design Public check inputs are separated from private state publication and reporting capabilities.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Program sources come from the host rather than an artificial population chosen to make project validation pass.
// @evidence contracts/common.md#meaningful-documentation Native prose explains source population and the format-run exception; members document ownership and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectContext is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectContext is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectContext is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectContext is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectContext struct {
  // Identity binds the check to one loaded Program cycle.
  Identity ProjectIdentity

  // Sources copies the slice, not the AST objects; contributors must not mutate the Program.
  Sources  []*shimast.SourceFile

  // Checker is the host's Program checker, when the rule requests type information.
  Checker  *shimchecker.Checker

  // Severity is the resolved rule level.
  Severity Severity

  // Options carries the raw resolved payload; decode it into contributor-owned values.
  Options  json.RawMessage

  reporter    ProjectReporter
  stateSetter projectStateSetter
}

type projectStateSetter interface {
  SetState(state any)
}

// NewProjectContext constructs the context a host passes to ProjectRule.Check.
// Contributor code normally receives this value and does not construct it.
//
// @evidence contracts/common.md#principled-implementation Source and option slices are defensively copied while checker and reporter retain their host-owned cycle identity; state publication is enabled only by a matching reporter capability.
// @evidence contracts/common.md#clear-and-simple-design One constructor establishes the public input snapshot and private reporting capabilities together.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported interface assertion supplies state publication without mutating foreign reporter methods.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes host construction from contributor consumption; member ownership and separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewProjectContext performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewProjectContext has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewProjectContext keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewProjectContext acquires no handle or task and retains nothing beyond the receiver's own fields.
func NewProjectContext(
  identity ProjectIdentity,
  sources []*shimast.SourceFile,
  checker *shimchecker.Checker,
  severity Severity,
  options json.RawMessage,
  reporter ProjectReporter,
) *ProjectContext {
  copiedSources := append([]*shimast.SourceFile(nil), sources...)
  stateSetter, _ := reporter.(projectStateSetter)
  return &ProjectContext{
    Identity:    identity,
    Sources:     copiedSources,
    Checker:     checker,
    Severity:    severity,
    Options:     append(json.RawMessage(nil), options...),
    reporter:    reporter,
    stateSetter: stateSetter,
  }
}

// DecodeOptions unmarshals the configured project-rule options into out. A
// missing options tuple leaves out unchanged and returns nil.
//
// @evidence contracts/common.md#principled-implementation Empty options preserve caller defaults; present JSON delegates shape validation to encoding/json and returns its error.
// @evidence contracts/common.md#clear-and-simple-design One guard and decoder own the option-read operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No rule-specific payload or fallback is synthesized.
// @evidence contracts/common.md#meaningful-documentation The native method comment states absent-options behavior with a separated tag block under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectContext.DecodeOptions performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectContext.DecodeOptions has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectContext.DecodeOptions keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectContext.DecodeOptions acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *ProjectContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// SetState attaches one contributor-owned value to this rule's evaluated
// result. The exact value is returned to file rules in the same Program cycle;
// contributors own any synchronization needed inside it. The host does not
// serialize the value or retain it for a later watch or LSP rebuild.
//
// @evidence contracts/common.md#principled-implementation Only an active context with a state-setter capability publishes the exact supplied value into the current evaluated cycle.
// @evidence contracts/common.md#clear-and-simple-design The context delegates state ownership to the host and keeps contributor synchronization explicit.
// @evidence contracts/common.md#prohibited-implementation-shortcuts State travels through the supported publication callback instead of replacing host internals or fabricating later-cycle state.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies exact-value semantics, synchronization and rebuild lifetime; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectContext.SetState performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectContext.SetState has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectContext.SetState keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectContext.SetState acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *ProjectContext) SetState(state any) {
  if c == nil || c.stateSetter == nil || c.Severity == SeverityOff {
    return
  }
  c.stateSetter.SetState(state)
}

// Fail marks the current project rule failed without adding a diagnostic.
//
// @evidence contracts/common.md#principled-implementation Nil, missing-reporter and off contexts are inert; an active reporter receives a diagnostic-free failure.
// @evidence contracts/common.md#clear-and-simple-design A single guard centralizes the allowed failure boundary before forwarding.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Failure is explicit and never replaced by a synthetic success or file diagnostic.
// @evidence contracts/common.md#meaningful-documentation Native prose names the diagnostic-free effect with a separated tag block under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectContext.Fail performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectContext.Fail has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectContext.Fail keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectContext.Fail acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *ProjectContext) Fail() {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.Fail()
}

// Report records one non-file project finding and marks the rule failed.
//
// @evidence contracts/common.md#principled-implementation An active context forwards a non-file finding while nil, absent or off channels stay silent.
// @evidence contracts/common.md#clear-and-simple-design The method delegates aggregation and failure-state storage to one host reporter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Findings use their dedicated project channel rather than fabricated source ranges.
// @evidence contracts/common.md#meaningful-documentation Native prose states finding scope and failure effect; the tag block follows documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectContext.Report performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectContext.Report has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectContext.Report keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectContext.Report acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *ProjectContext) Report(message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.Report(message)
}

// ReportSeverity records a finding at an explicit level. An off rule or off
// finding remains silent. Hosts without this extension use the rule's level.
//
// @evidence contracts/common.md#principled-implementation Off contexts and off findings are suppressed; capable hosts receive the supplied level while legacy hosts receive the same message at their configured rule level.
// @evidence contracts/common.md#clear-and-simple-design One capability branch keeps explicit severity compatible with the original reporting interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy fallback addresses an actual supported reporter difference rather than hiding a failed project result.
// @evidence contracts/common.md#meaningful-documentation Native prose explains suppression and legacy severity fallback; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectContext.ReportSeverity performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectContext.ReportSeverity has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectContext.ReportSeverity keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectContext.ReportSeverity acquires no handle or task and retains nothing beyond the receiver's own fields.
func (c *ProjectContext) ReportSeverity(severity Severity, message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || severity == SeverityOff {
    return
  }
  if reporter, ok := c.reporter.(ProjectSeverityReporter); ok {
    reporter.ReportSeverity(severity, message)
  } else {
    c.reporter.Report(message)
  }
}

var projectRegistry []ProjectRule

// RegisterProject adds a contributor project rule to the global registry.
// Hosts validate duplicate names after all contributor init functions finish.
//
// @evidence contracts/common.md#principled-implementation Rejecting a nil interface and appending during package initialization records contributed checks for later host name validation.
// @evidence contracts/common.md#clear-and-simple-design The registry owns collection while host bootstrap owns cross-contributor validation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Registration is the supported extension point; no consumer-specific rule list replaces it.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies initialization-time registration and deferred duplicate validation; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RegisterProject appends to an in-memory registry and touches no filesystem path or process.
// @evidenceExclude contracts/performance.md#efficient-algorithms RegisterProject appends one element and has no loop.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RegisterProject keeps no cache and shares no computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The registry retains one entry per registered project rule for the process lifetime; its size is bounded by the number of rules registered at initialization and it has no release.
func RegisterProject(r ProjectRule) {
  if r == nil {
    panic("rule: RegisterProject called with nil rule")
  }
  projectRegistry = append(projectRegistry, r)
}

// RegisteredProjects returns a defensive copy of all registered project rules.
// The slice is independent; its rule objects remain shared and must be treated
// as immutable after registration.
//
// @evidence contracts/common.md#principled-implementation Allocating and copying the registry slice prevents callers from changing registry membership through the returned slice; rule objects themselves remain shared.
// @evidence contracts/common.md#clear-and-simple-design One accessor exposes registered values without exposing backing storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Registry access uses a supported defensive read instead of foreign storage mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the defensive slice from shared immutable rule objects; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RegisteredProjects copies an in-memory registry and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms One slice copy, O(project rules).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RegisteredProjects keeps no cache and shares no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RegisteredProjects returns a copy so callers cannot mutate the retained registry; no handle or task is acquired.
func RegisteredProjects() []ProjectRule {
  out := make([]ProjectRule, len(projectRegistry))
  copy(out, projectRegistry)
  return out
}
