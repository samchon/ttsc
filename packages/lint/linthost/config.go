package linthost

import (
  "bytes"
  "context"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "net/url"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
  "sync"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// Severity is the `error | warning | off` ladder.
//
// @evidence contracts/common.md#principled-implementation Ordered constants represent disabled, warning and error states; unknown integers remain distinguishable through String.
// @evidence contracts/common.md#clear-and-simple-design One scalar severity keeps reporting policy independent from each rule's option shape.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The constants define the public severity ladder rather than consumer-specific outcomes.
// @evidence contracts/common.md#meaningful-documentation The native comment names the three supported states, with prose separated from acknowledgment tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Severity is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Severity is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Severity is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Severity is a declaration of data shape; the code that holds its values owns their lifetime.
type Severity int

const (
  SeverityOff Severity = iota
  SeverityWarn
  SeverityError
)

// String returns the configuration spelling, or "unknown" for an unsupported value.
//
// @evidence contracts/common.md#principled-implementation The exhaustive supported-state switch maps each severity to its config spelling without treating unknown integers as off.
// @evidence contracts/common.md#clear-and-simple-design A local switch owns the display mapping and requires no rule-specific formatter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Literal spellings are the severity protocol, not replacements for evaluated rule results.
// @evidence contracts/common.md#meaningful-documentation The native comment states both supported conversion and the unknown-value result in a separate paragraph from tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Severity.String performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Severity.String has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Severity.String keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Severity.String acquires no handle or task and retains nothing beyond the receiver's own fields.
func (s Severity) String() string {
  switch s {
  case SeverityError:
    return "error"
  case SeverityWarn:
    return "warning"
  case SeverityOff:
    return "off"
  }
  return "unknown"
}

// PluginEntry mirrors the shape ttsc serializes into `--plugins-json`.
//
// `Config` carries the original tsconfig plugin entry. `Name` and `Stage`
// come from the JS plugin descriptor returned to the ttsc host.
//
// @evidence contracts/common.md#principled-implementation JSON field names match the compiler's serialized descriptor envelope while Config preserves arbitrary plugin-entry values for boundary validation.
// @evidence contracts/common.md#clear-and-simple-design The original entry and evaluated descriptor identity remain separate fields because they have different producers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This DTO preserves host input and adds no plugin-specific execution or foreign mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies each field's producer, and spaced field comments explain their roles without property acknowledgments.
// @evidenceExclude contracts/portability.md#os-neutral-implementation PluginEntry is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms PluginEntry is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work PluginEntry is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources PluginEntry is a declaration of data shape; the code that holds its values owns their lifetime.
type PluginEntry struct {
  // Config is the original tsconfig plugin entry, including configFile.
  Config map[string]any `json:"config"`

  // Name is the identity returned by the evaluated plugin descriptor.
  Name string `json:"name"`

  // Stage is the descriptor's host execution stage.
  Stage string `json:"stage"`
}

// ParsePlugins decodes the `--plugins-json` payload.
// Empty or whitespace-only input means no entries; malformed JSON returns a contextual error.
// Parsing examines the supplied payload and allocates decoded records and their
// configuration values. The caller owns the returned records.
//
// @evidence contracts/common.md#principled-implementation encoding/json decodes the host envelope into PluginEntry records; the explicit empty-input case represents an absent descriptor list.
// @evidence contracts/common.md#clear-and-simple-design Parsing and contextual error wrapping form one boundary operation, leaving lint selection to FindLintEntry.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The absence case follows the host protocol and does not fabricate entries to satisfy a consumer.
// @evidence contracts/common.md#meaningful-documentation Native prose states absence and malformed-input effects, with a blank comment line before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ParsePlugins performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Trimming, byte conversion and JSON decoding scale with payload size; decoded entries and configuration values determine result storage. One complete parse is necessary to validate and decode this supplied envelope without a second custom traversal.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ParsePlugins keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ParsePlugins owns no retained state, handle or running task; decoded records are transferred to the caller and temporary results from a failed parse are not retained.
func ParsePlugins(text string) ([]PluginEntry, error) {
  if strings.TrimSpace(text) == "" {
    return nil, nil
  }
  var entries []PluginEntry
  if err := json.Unmarshal([]byte(text), &entries); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: invalid --plugins-json: %w", err)
  }
  return entries, nil
}

// FindLintEntry returns the active lint entry. ttsc orders check plugins before
// transform plugins before invoking native sidecars, so lint inspects authored
// source even when transform plugins are also configured.
// The returned pointer refers to the caller's slice; absence returns nil without an error.
//
// @evidence contracts/common.md#principled-implementation A declaration-order scan selects the descriptor with the public lint package identity and returns its actual record.
// @evidence contracts/common.md#clear-and-simple-design Selection uses the descriptor Name and leaves host staging and config evaluation with their existing owners.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The package identity is the supported descriptor protocol; no consumer or fixture name alters selection.
// @evidence contracts/common.md#meaningful-documentation Native prose explains host ordering, alias ownership and the absent result, separated visibly from tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation FindLintEntry compares plugin names and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms A linear scan that stops at the first @ttsc/lint entry, O(entries).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work FindLintEntry keeps no cache and shares no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FindLintEntry returns a pointer into the caller's slice and allocates nothing.
func FindLintEntry(entries []PluginEntry) (*PluginEntry, error) {
  for i := range entries {
    if entries[i].Name == "@ttsc/lint" {
      return &entries[i], nil
    }
  }
  return nil, nil
}

// RuleConfig captures the resolved per-rule severity. The map is keyed by
// rule name (e.g. "no-var").
// ResolveProjectRules validates duplicate canonical identities before the engine
// reads this map. Direct metadata consumers must perform that validation first.
//
// @evidence contracts/common.md#principled-implementation A name-keyed map represents one severity per rule; ResolveProjectRules rejects colliding canonical identities before engine projections can detach severity from options.
// @evidence contracts/common.md#clear-and-simple-design The severity-only representation also implements RuleResolver without requiring option or file-scope storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The map represents supplied policy rather than cached diagnostics or expected outputs.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the severity-only role and the validation prerequisite for direct metadata consumers.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleConfig is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RuleConfig is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleConfig is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleConfig is a declaration of data shape; the code that holds its values owns their lifetime.
type RuleConfig map[string]Severity

// RuleOptionsMap captures the rule-specific options payload, keyed by rule
// name. Severity-only rules never appear here. A single option slot preserves
// its JSON shape; multiple positional slots are encoded as an array. Each rule
// decodes the payload according to its public option type on demand.
//
// @evidence contracts/common.md#principled-implementation Raw JSON preserves each rule's option representation independently from severity storage; the owning rule interprets the payload and owns any option validation it supports.
// @evidence contracts/common.md#clear-and-simple-design A parallel name-keyed map keeps heterogeneous option types out of the engine-facing severity representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Option payloads remain supplied configuration, with no hardcoded result or foreign decoder patch.
// @evidence contracts/common.md#meaningful-documentation Native prose explains absent options and single-versus-multiple-slot encoding, then separates the acknowledgments.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptionsMap is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RuleOptionsMap is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleOptionsMap is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleOptionsMap is a declaration of data shape; the code that holds its values owns their lifetime.
type RuleOptionsMap map[string]json.RawMessage

// ProjectRuleSetting is the global declaration resolved for one registered
// project rule. Declared distinguishes a missing entry from an explicit off.
//
// @evidence contracts/common.md#principled-implementation An independent presence bit preserves the distinction between an absent project rule and an explicitly disabled rule.
// @evidence contracts/common.md#clear-and-simple-design Presence, severity and optional raw options form one resolved project setting without retaining file-specific scope.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The presence distinction models supported config semantics rather than inferring declaration from a severity default.
// @evidence contracts/common.md#meaningful-documentation The type and spaced member comments explain absence and payload meaning without property tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ProjectRuleSetting is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectRuleSetting is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectRuleSetting is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectRuleSetting is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectRuleSetting struct {
  // Declared reports whether a matching global entry explicitly named the rule.
  Declared bool

  // Severity is meaningful as a declaration only when Declared is true.
  Severity Severity

  // Options is the resolved raw payload, possibly inherited from an earlier
  // global declaration. It is nil when no payload was contributed.
  Options json.RawMessage
}

// ResolvedRuleConfig is the complete rule setting that applies to one source
// file. Built-in config-store resolution folds Rules and Options from the
// same matching entries. Custom resolvers must preserve that ownership rather
// than borrowing an option tuple from an entry outside the file's scope.
//
// `Ignored` means an `ignores`-only config entry matched the file and the
// engine should skip linting it entirely. `OutOfScope` means the store has at
// least one rule-bearing entry but none applies to this file. Keeping the two
// states distinct lets wrappers preserve entry-local ignores: one entry may
// reject a file while another matching entry still contributes rules.
//
// @evidence contracts/common.md#principled-implementation Paired severity and option maps carry the resolver's matching-entry policy without encoding one field into the other; separate ignored and out-of-scope states distinguish exclusion from no contributing declaration.
// @evidence contracts/common.md#clear-and-simple-design The value carries a single file's resolution with an explicit authority bit for compatibility with older custom resolvers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts OptionsResolved distinguishes a real interface capability instead of substituting an empty map for unresolved data.
// @evidence contracts/common.md#meaningful-documentation Native prose explains scope and compatibility states; each public field has its own spaced comment and no checklist tag.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ResolvedRuleConfig is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ResolvedRuleConfig is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ResolvedRuleConfig is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ResolvedRuleConfig is a declaration of data shape; the code that holds its values owns their lifetime.
type ResolvedRuleConfig struct {
  // Rules contains the severities contributed by matching entries.
  Rules RuleConfig

  // Options contains payloads inherited only through the same matching entries.
  Options RuleOptionsMap

  // OptionsResolved distinguishes an authoritative empty per-file option map
  // from a legacy custom resolver that still supplies options exclusively via
  // RuleResolver.RuleOptions.
  OptionsResolved bool

  // Ignored requests skipping this file entirely after a global ignore match.
  Ignored bool

  // OutOfScope reports that rule-bearing entries exist but none selects this file.
  OutOfScope bool
}

// RuleOptions returns the file-resolved option payload for name. Built-in
// aliases are normalized on lookup so the same key selects both severity and
// options.
// The returned slice is the stored payload, so callers must treat it as read-only.
// The supplying resolver must reject colliding canonical keys before execution.
//
// @evidence contracts/common.md#principled-implementation Exact, canonical and unique normalized-alias lookup read the file's authoritative option map without falling back to another file's declaration.
// @evidence contracts/common.md#clear-and-simple-design Lookup remains on the resolved value so execution need not repeat config-entry folding.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Namespace normalization follows the rule naming contract and does not select a payload by consumer identity.
// @evidence contracts/common.md#meaningful-documentation Native prose states normalization, absence and borrowed slice ownership with tags in a separate comment paragraph.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptions looks up option bytes by rule name and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Exact and canonical keys use an expected constant number of map probes, with hashing and normalization proportional to query-name bytes. Only a miss scans n stored names, paying their normalization/comparison byte costs; option bytes are returned without decoding or copying.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleOptions keeps no cache and shares no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleOptions returns the stored message without copying; the resolved configuration owns it.
func (r ResolvedRuleConfig) RuleOptions(name string) json.RawMessage {
  if raw := r.Options[name]; len(raw) > 0 {
    return raw
  }
  canonical := normalizeBuiltinRuleName(name)
  if raw := r.Options[canonical]; len(raw) > 0 {
    return raw
  }
  for storedName, raw := range r.Options {
    if normalizeBuiltinRuleName(storedName) == canonical {
      return raw
    }
  }
  return nil
}

// RuleResolver is the engine-facing view of a resolved lint configuration.
// Implementations include RuleConfig (severity-only, no options),
// InlineRuleResolver (a severity map plus per-rule options), and *ConfigStore
// (a parsed lint config file, with per-file glob resolution for both severity
// and options).
//
// @evidence contracts/common.md#principled-implementation Separate per-file and global operations express which config decisions have a file identity and which build dispatch or project state.
// @evidence contracts/common.md#clear-and-simple-design The interface exposes resolution behavior rather than parsed entries, allowing flat and scoped implementations to share the engine boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compatibility lookup is an explicit supported interface method, not a patch of another resolver's internals.
// @evidence contracts/common.md#meaningful-documentation Native prose names implementations and method comments describe scope, absence and precedence with blank lines between members.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleResolver is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RuleResolver is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleResolver is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleResolver is a declaration of data shape; the code that holds its values owns their lifetime.
type RuleResolver interface {
  // ResolveRules returns the effective severities and option payloads for the
  // given source file. Implementations that support `files`/`ignores`
  // patterns apply both halves of each rule setting here; flat RuleConfig
  // returns all severities with canonical built-in keys and no options.
  //
  // @evidence contracts/common.md#principled-implementation Returning severity and options together makes one file-selection decision authoritative for both parts of a setting.
  // @evidence contracts/common.md#clear-and-simple-design One resolution call exposes the file-bound value without requiring engine access to entry storage.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The interface delegates scope through a supported method rather than probing concrete resolver internals.
  // @evidence contracts/common.md#meaningful-documentation The native method comment explains flat versus scoped semantics before a separate tag paragraph.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RuleResolver.ResolveRules is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RuleResolver.ResolveRules is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleResolver.ResolveRules is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleResolver.ResolveRules is a method signature without a body; each implementation owns any retained state.
  ResolveRules(fileName string) ResolvedRuleConfig

  // ActiveRuleNames returns the sorted names of every rule that is not SeverityOff
  // in at least one config entry. Used to build the engine's dispatch table.
  //
  // @evidence contracts/common.md#principled-implementation The union of potentially enabled names lets dispatch construction retain rules that apply to only some files.
  // @evidence contracts/common.md#clear-and-simple-design The method supplies ordered identities rather than exposing a second executable config model.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The activity definition follows declarations, not whether a known fixture produced a diagnostic.
  // @evidence contracts/common.md#meaningful-documentation Native prose states sorting, potential activity and the dispatch consumer with separated tags.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RuleResolver.ActiveRuleNames is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RuleResolver.ActiveRuleNames is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleResolver.ActiveRuleNames is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleResolver.ActiveRuleNames is a method signature without a body; each implementation owns any retained state.
  ActiveRuleNames() []string

  // EnabledRuleConfig returns the project-wide severity map for rules that are
  // not SeverityOff. Where multiple entries disagree, SeverityError wins.
  //
  // @evidence contracts/common.md#principled-implementation The aggregate severity map represents potential project reporting, while file execution remains owned by ResolveRules.
  // @evidence contracts/common.md#clear-and-simple-design Global metadata has a named operation distinct from per-file resolution.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Severity aggregation is an explicit interface policy rather than an inferred result from test outputs.
  // @evidence contracts/common.md#meaningful-documentation The method comment states off filtering and error precedence in native prose before tags.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RuleResolver.EnabledRuleConfig is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RuleResolver.EnabledRuleConfig is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleResolver.EnabledRuleConfig is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleResolver.EnabledRuleConfig is a method signature without a body; each implementation owns any retained state.
  EnabledRuleConfig() RuleConfig

  // RuleOptions is the file-agnostic compatibility lookup used by flat and
  // metadata-only consumers. Runtime file binding reads
  // ResolveRules(fileName).RuleOptions(name), which is authoritative for
  // scoped resolvers. Returns nil for severity-only and unknown rules.
  //
  // @evidence contracts/common.md#principled-implementation This file-agnostic lookup supports older flat consumers without overriding authoritative per-file option resolution.
  // @evidence contracts/common.md#clear-and-simple-design The compatibility boundary is visible as one method instead of hidden fallback state inside the engine.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Retaining this method addresses supported resolver compatibility rather than compensating for a false scope assumption.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies the compatibility consumer and nil result, separate from the acknowledgment paragraph.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RuleResolver.RuleOptions is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RuleResolver.RuleOptions is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleResolver.RuleOptions is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleResolver.RuleOptions is a method signature without a body; each implementation owns any retained state.
  RuleOptions(name string) json.RawMessage

  // ResolveProjectRules folds global declarations for registered project-rule
  // names. A mention under a files selector is rejected because project state
  // has no file identity, except when the same built-in name also owns a file
  // rule; that scoped declaration remains exclusively file-local.
  //
  // @evidence contracts/common.md#principled-implementation Project settings have no file identity, so the operation rejects file-only declarations except a shared name whose file companion owns that scope.
  // @evidence contracts/common.md#clear-and-simple-design A single project-resolution boundary owns global policy and errors before rule-state construction.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The built-in companion exception represents an actual dual registration, not a consumer-specific whitelist.
  // @evidence contracts/common.md#meaningful-documentation Native prose explains the scope rejection and companion distinction with a separate tag paragraph.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RuleResolver.ResolveProjectRules is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RuleResolver.ResolveProjectRules is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleResolver.ResolveProjectRules is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleResolver.ResolveProjectRules is a method signature without a body; each implementation owns any retained state.
  ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error)
}

// RuleOptionsVariantsResolver is an optional extension for resolvers that can
// expose more than one option payload a rule may receive. Engine construction
// checks each distinct payload through the rule's supported option-validation
// capability before any file is visited. Scoped resolvers expose declarations;
// command adapters may substitute reachable defaults for absent payloads.
// Custom resolvers that omit this interface remain compatible through the
// single RuleResolver.RuleOptions fallback.
//
// @evidence contracts/common.md#principled-implementation Optional structural interface satisfaction exposes the option variants reachable through each resolver's policy without requiring every existing resolver to implement it.
// @evidence contracts/common.md#clear-and-simple-design One capability method extends validation independently from the required engine resolver interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Go interface assertion uses a supported extension boundary, not foreign method replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose explains supported eager checks, scoped declarations, command defaults and legacy fallback before tags; the member documents returned ownership.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptionsVariantsResolver is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RuleOptionsVariantsResolver is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleOptionsVariantsResolver is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleOptionsVariantsResolver is a declaration of data shape; the code that holds its values owns their lifetime.
type RuleOptionsVariantsResolver interface {
  // RuleOptionsVariants returns independently owned payloads name may receive.
  //
  // @evidence contracts/common.md#principled-implementation Enumerating resolver-policy variants permits eager checks of scoped tuples and reachable command defaults before any file execution.
  // @evidence contracts/common.md#clear-and-simple-design The operation returns raw payloads for the existing rule decoder rather than adding another option schema.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Variant discovery follows declarations and does not manufacture payloads to match observed diagnostics.
  // @evidence contracts/common.md#meaningful-documentation Native member prose states population and slice ownership separately from tags.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptionsVariantsResolver.RuleOptionsVariants is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RuleOptionsVariantsResolver.RuleOptionsVariants is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleOptionsVariantsResolver.RuleOptionsVariants is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleOptionsVariantsResolver.RuleOptionsVariants is a method signature without a body; each implementation owns any retained state.
  RuleOptionsVariants(name string) []json.RawMessage
}

// resolvedRuleOptionsVariants returns every option shape a rule may receive.
// File-scoped resolvers expose all declarations through the internal
// extension; flat and external resolvers retain the RuleOptions fallback.
func resolvedRuleOptionsVariants(resolver RuleResolver, name string) []json.RawMessage {
  if variants, ok := resolver.(RuleOptionsVariantsResolver); ok {
    if values := variants.RuleOptionsVariants(name); len(values) > 0 {
      return values
    }
  }
  return []json.RawMessage{append(json.RawMessage(nil), resolver.RuleOptions(name)...)}
}

// boundProjectRuleResolver retains the one project-wide resolution performed
// while loading a config. Engine construction reads a defensive copy instead
// of folding the extends chain a second time.
type boundProjectRuleResolver struct {
  RuleResolver
  settings map[string]ProjectRuleSetting
}

func bindProjectRuleResolver(resolver RuleResolver) (RuleResolver, error) {
  if resolver == nil {
    resolver = RuleConfig{}
  }
  settings, err := resolver.ResolveProjectRules(allProjectRuleNames())
  if err != nil {
    return nil, err
  }
  return boundProjectRuleResolver{RuleResolver: resolver, settings: settings}, nil
}

func (r boundProjectRuleResolver) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  settings := make(map[string]ProjectRuleSetting, len(names))
  for _, name := range names {
    setting := r.settings[name]
    setting.Options = append(json.RawMessage(nil), setting.Options...)
    settings[name] = setting
  }
  return settings, nil
}

func (r boundProjectRuleResolver) RuleOptionsVariants(name string) []json.RawMessage {
  return resolvedRuleOptionsVariants(r.RuleResolver, name)
}

func (r boundProjectRuleResolver) ConfigPaths() []string {
  resolver, ok := r.RuleResolver.(interface{ ConfigPaths() []string })
  if !ok {
    return nil
  }
  return resolver.ConfigPaths()
}

func (r boundProjectRuleResolver) ConfigDirectories() []string {
  resolver, ok := r.RuleResolver.(interface{ ConfigDirectories() []string })
  if !ok {
    return nil
  }
  return resolver.ConfigDirectories()
}

func (r boundProjectRuleResolver) residentRuleConfigState() residentRuleConfigState {
  resolver, ok := r.RuleResolver.(interface {
    residentRuleConfigState() residentRuleConfigState
  })
  if !ok {
    return residentRuleConfigState{}
  }
  return resolver.residentRuleConfigState()
}

// ResolveRules implements RuleResolver. A flat RuleConfig has no glob scoping,
// so every file receives the full map with canonical built-in names.
// Call ResolveProjectRules first to reject colliding canonical identities.
//
// @evidence contracts/common.md#principled-implementation After project-boundary identity validation, canonicalizing the severity map gives every file the same global policy and marks the absence of options as authoritative.
// @evidence contracts/common.md#clear-and-simple-design A flat adapter constructs one resolved value and delegates key policy to the shared normalization helper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No file name or diagnostic result changes the global map; normalization only implements supported rule aliases.
// @evidence contracts/common.md#meaningful-documentation Native prose explains flat scope, normalization and prerequisite identity validation before separate tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleConfig.ResolveRules performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Canonicalization scans n severity entries into a new map, requiring O(n) map operations plus name normalization/hashing bytes and O(n) result entries. Empty maps are returned without rebuilding.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This stateless projection reads a caller-owned map for one call; it owns no cross-call identity or invalidation protocol for sharing projections after caller mutations.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle, task or historical state is retained. The caller owns the nonempty canonical map returned by this projection; an empty receiver may be reused.
func (c RuleConfig) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{
    Rules:           normalizeRuleConfigKeys(c),
    OptionsResolved: true,
  }
}

// ActiveRuleNames implements RuleResolver. Returns rule names whose severity
// is not SeverityOff, sorted for deterministic engine dispatch-table construction.
//
// @evidence contracts/common.md#principled-implementation Normalization followed by non-off filtering and sorting produces the potential dispatch identities under the no-duplicate-alias premise.
// @evidence contracts/common.md#clear-and-simple-design Shared key normalization and name sorting keep identity policy outside the dispatch consumer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Enabled names come from declared severities, without fixture-specific activation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains off filtering and deterministic order, with a separate acknowledgment paragraph.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleConfig.ActiveRuleNames performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Normalization and filtering scan n entries, then sort k active names: O(n+k log k) name operations plus normalization, hashing and comparison bytes. The temporary normalized map and returned slice reserve O(n) entries.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This stateless projection reads current caller-owned severities and owns no cross-call identity or invalidation protocol for sharing results after caller mutations.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle, task or historical state is retained; the normalized temporary map is local and the caller owns the returned name slice.
func (c RuleConfig) ActiveRuleNames() []string {
  return sortedRuleNames(normalizeRuleConfigKeys(c), func(sev Severity) bool { return sev != SeverityOff })
}

// EnabledRuleConfig implements RuleResolver. Returns a copy containing only the
// non-off entries; used to populate engine state and diagnostic reporting.
//
// @evidence contracts/common.md#principled-implementation A fresh canonical-key map retains each non-off global severity; direct maps must avoid colliding aliases.
// @evidence contracts/common.md#clear-and-simple-design One map projection supplies metadata without mutating the caller's severity map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Filtering follows the explicit disabled state rather than recorded diagnostics or consumer identities.
// @evidence contracts/common.md#meaningful-documentation Native prose states copy ownership, filtering and the metadata consumer before separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation EnabledRuleConfig filters rule severities and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms One pass over n severity entries writes k non-off canonical keys, O(n) entry operations plus name normalization/hashing bytes and O(k) returned entries.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call projects current caller-owned severities and owns no cross-call mutation identity for sharing results after caller changes.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned map is new and owned by the caller; no handle or task is acquired.
func (c RuleConfig) EnabledRuleConfig() RuleConfig {
  out := RuleConfig{}
  for name, sev := range c {
    if sev != SeverityOff {
      out[normalizeBuiltinRuleName(name)] = sev
    }
  }
  return out
}

// RuleOptions on a bare RuleConfig is always nil because this representation
// contains severities only. Use InlineRuleResolver for supplied option payloads.
//
// @evidence contracts/common.md#principled-implementation Returning nil expresses the absence of option storage in a severity-only map.
// @evidence contracts/common.md#clear-and-simple-design The method adapts the existing flat representation without allocating unused option maps.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The empty result follows the representation's production contract rather than a test-only execution path.
// @evidence contracts/common.md#meaningful-documentation Native prose explains absence and the option-bearing alternative with a blank line before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleConfig.RuleOptions performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms RuleConfig.RuleOptions has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleConfig.RuleOptions keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleConfig.RuleOptions acquires no handle or task and retains nothing beyond the receiver's own fields.
func (RuleConfig) RuleOptions(string) json.RawMessage { return nil }

// ResolveProjectRules treats a flat RuleConfig as one global declaration.
// It rejects distinct keys for the same canonical rule even when their values agree.
//
// @evidence contracts/common.md#principled-implementation Whole-map identity validation rejects alias collisions before canonical lookup; membership remains independent from severity, so explicit off stays declared.
// @evidence contracts/common.md#clear-and-simple-design Requested project names are projected from one normalized flat map without introducing file scope.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alias collisions return an error rather than arbitrary iteration-order precedence; missing names remain absent rather than fabricated defaults.
// @evidence contracts/common.md#meaningful-documentation Native prose states global interpretation; ProjectRuleSetting documents absence and option meaning used by the return value.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ResolveProjectRules reads rule names and severities and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Validation sorts n stored names, then normalization and p requested lookups require O(n log n+p) name operations plus normalization, hashing and comparison bytes. Temporary maps/name lists scale with n and the result map with p.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call validates and projects current caller-owned severities; it owns no cross-call mutation identity. The native loadRules boundary separately binds one project resolution for reuse during engine construction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned map is new and owned by the caller; no handle or task is acquired.
func (c RuleConfig) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  if err := validateCanonicalRuleNames(c); err != nil {
    return nil, err
  }
  normalized := normalizeRuleConfigKeys(c)
  out := make(map[string]ProjectRuleSetting, len(names))
  for _, name := range names {
    severity, declared := normalized[normalizeBuiltinRuleName(name)]
    out[name] = ProjectRuleSetting{Declared: declared, Severity: severity}
  }
  return out, nil
}

func normalizeRuleConfigKeys(c RuleConfig) RuleConfig {
  if len(c) == 0 {
    return c
  }
  out := RuleConfig{}
  for name, sev := range c {
    out[normalizeBuiltinRuleName(name)] = sev
  }
  return out
}

// validateCanonicalRuleNames rejects distinct spellings of the same rule in
// one map before canonicalization can detach a severity from its option tuple.
// Sorting only the keys makes the reported conflicting pair deterministic.
func validateCanonicalRuleNames[V any](entries map[string]V) error {
  names := make([]string, 0, len(entries))
  for name := range entries {
    names = append(names, name)
  }
  sort.Strings(names)
  seen := make(map[string]string, len(names))
  for _, name := range names {
    canonical := normalizeBuiltinRuleName(name)
    if previous, duplicate := seen[canonical]; duplicate {
      return fmt.Errorf(
        "@ttsc/lint: rule keys %q and %q both resolve to %q; declare each rule once",
        previous, name, canonical,
      )
    }
    seen[canonical] = name
  }
  return nil
}

// InlineRuleResolver pairs global severities with raw option payloads.
// Callers may construct it directly for an already-resolved flat configuration;
// ResolveProjectRules validates both maps before engine use or direct metadata
// projection; alias duplicates are rejected even when their payloads agree.
//
// @evidence contracts/common.md#principled-implementation Parallel maps represent global identities with distinct severity and payload types; project-boundary validation rejects duplicate canonical identities in either map before engine projection.
// @evidence contracts/common.md#clear-and-simple-design The flat resolver adds options to RuleConfig without carrying unused file-pattern or extends state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Public construction supports engine integrations and is not a special path for tests.
// @evidence contracts/common.md#meaningful-documentation Native prose explains direct construction, required validation and ownership with spaced member comments and no property tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation InlineRuleResolver is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms InlineRuleResolver is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work InlineRuleResolver is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources InlineRuleResolver is a declaration of data shape; the code that holds its values owns their lifetime.
type InlineRuleResolver struct {
  // Rules supplies global severities and remains owned by the caller.
  Rules RuleConfig

  // Options supplies global raw JSON payloads; callers must not mutate them during use.
  Options RuleOptionsMap
}

// ResolveRules implements RuleResolver. Inline rules have no glob scoping;
// the full map applies to every file.
//
// @evidence contracts/common.md#principled-implementation Shared canonicalization projects both maps into an authoritative global resolution, copying raw option bytes and requiring nonconflicting aliases.
// @evidence contracts/common.md#clear-and-simple-design The adapter delegates map policy to existing helpers and avoids recreating file-scoping logic.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Every file uses supplied global policy, with no source-name special cases or diagnostic-driven defaults.
// @evidence contracts/common.md#meaningful-documentation Native prose states global scope; the owning type documents input ownership and alias assumptions before its tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation InlineRuleResolver.ResolveRules performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Both maps are normalized in one pass each over n severity and m option entries, plus name normalization/hashing and b copied payload bytes. Result storage scales with n+m+b; empty option storage stays nil and an empty severity map may be reused.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call projects current caller-owned maps and owns no cross-call identity or invalidation protocol for sharing results after caller mutations.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle, task or historical state is retained. Nonempty normalized maps and copied option bytes are transferred to the caller; an empty severity receiver may remain shared.
func (r InlineRuleResolver) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{
    Rules:           normalizeRuleConfigKeys(r.Rules),
    Options:         normalizeRuleOptionsKeys(r.Options),
    OptionsResolved: true,
  }
}

func normalizeRuleOptionsKeys(options RuleOptionsMap) RuleOptionsMap {
  if len(options) == 0 {
    return nil
  }
  normalized := make(RuleOptionsMap, len(options))
  for name, raw := range options {
    normalized[normalizeBuiltinRuleName(name)] = append(json.RawMessage(nil), raw...)
  }
  return normalized
}

// ActiveRuleNames implements RuleResolver by delegating to the inner RuleConfig.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves the severity map's non-off, canonical and sorted dispatch-name policy.
// @evidence contracts/common.md#clear-and-simple-design The wrapper reuses the severity owner instead of duplicating activity selection beside the options map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Option presence does not fabricate activity for a rule disabled by supplied severity.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the policy owner; RuleConfig documents filtering and sorting, and tags remain separate.
// @evidenceExclude contracts/portability.md#os-neutral-implementation InlineRuleResolver.ActiveRuleNames performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Delegation normalizes and filters n severity entries, then sorts k active names, O(n+k log k) name operations plus name bytes. The normalized temporary map and returned slice reserve O(n) entries; options are not traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Activity is a projection of the caller's current severity map, not a shared producer with a cross-call mutation identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Delegation returns a caller-owned name slice and retains no historical state, handle or task in this wrapper.
func (r InlineRuleResolver) ActiveRuleNames() []string {
  return r.Rules.ActiveRuleNames()
}

// EnabledRuleConfig implements RuleResolver by delegating to the inner RuleConfig.
//
// @evidence contracts/common.md#principled-implementation Delegating to Rules preserves the non-off global severity projection regardless of optional payload presence.
// @evidence contracts/common.md#clear-and-simple-design Severity aggregation has one implementation and the wrapper adds no redundant map state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Options cannot activate a disabled rule through a compatibility exception.
// @evidence contracts/common.md#meaningful-documentation The native delegation comment makes the behavior owner apparent, with a blank comment line before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation InlineRuleResolver.EnabledRuleConfig performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Delegation scans n severity entries and writes k non-off canonical keys, O(n) entry operations plus normalization/hashing bytes and O(k) returned entries. The options map is not inspected.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call projects current caller-owned severities; the wrapper does not coordinate a shared result or cross-call mutation identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Delegation returns a new caller-owned severity map and retains no historical state, handle or task in this wrapper.
func (r InlineRuleResolver) EnabledRuleConfig() RuleConfig {
  return r.Rules.EnabledRuleConfig()
}

// RuleOptions implements RuleResolver. Returns the raw JSON options blob for
// `name`, or nil when the rule was configured without options or the name is
// unknown.
// The returned slice is borrowed from Options and must remain read-only.
//
// @evidence contracts/common.md#principled-implementation Exact, canonical and unique normalized-alias lookup return only the supplied global payload and preserve nil for missing option storage after identity validation.
// @evidence contracts/common.md#clear-and-simple-design One lookup method adapts the options map without merging or decoding rule-specific payloads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alias normalization is supported naming policy and does not select options from expected diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native prose explains nil results and borrowed byte ownership before separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptions looks up option bytes by rule name and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Exact and canonical keys use an expected constant number of map probes, with hashing and normalization proportional to query-name bytes. Only a miss scans n stored names, paying their normalization/comparison byte costs; option bytes are borrowed without decoding or copying.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleOptions keeps no cache and shares no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RuleOptions returns the stored message without copying; the resolver owns it.
func (r InlineRuleResolver) RuleOptions(name string) json.RawMessage {
  if r.Options == nil {
    return nil
  }
  if raw := r.Options[name]; len(raw) > 0 {
    return raw
  }
  canonical := normalizeBuiltinRuleName(name)
  if raw := r.Options[canonical]; len(raw) > 0 {
    return raw
  }
  for storedName, raw := range r.Options {
    if normalizeBuiltinRuleName(storedName) == canonical {
      return raw
    }
  }
  return nil
}

// ResolveProjectRules treats inline rules as global and preserves their
// explicit options tuple.
// Both maps are validated for duplicate canonical identities before any setting folds.
//
// @evidence contracts/common.md#principled-implementation Both maps reject canonical identity collisions before severity declaration bits and defensive payload copies are folded into requested global settings.
// @evidence contracts/common.md#clear-and-simple-design Severity resolution is reused and only the option-bearing part is added by this wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The global adapter introduces no file-dependent project state or special consumer branch.
// @evidence contracts/common.md#meaningful-documentation Native prose states global interpretation and tuple preservation, with acknowledgments in a separate paragraph.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ResolveProjectRules reads rule names, severities and option bytes and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Validation sorts n severity names and m option names before p requested lookups. Exact/canonical option keys need one lookup and fallback can scan m names per request, giving O(n log n+m log m+p(1+m)) name operations in the worst case plus name bytes and copied payload bytes. Temporary/result containers scale with n+m+p and returned payload size.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call validates and projects current caller-owned maps; it owns no cross-call mutation identity. The native loadRules boundary separately binds one project resolution for reuse during engine construction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Each option message is copied into the returned settings so they do not alias resolver memory; no handle or task is acquired.
func (r InlineRuleResolver) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  if err := validateCanonicalRuleNames(r.Options); err != nil {
    return nil, err
  }
  settings, err := r.Rules.ResolveProjectRules(names)
  if err != nil {
    return nil, err
  }
  for _, name := range names {
    setting := settings[name]
    setting.Options = append(json.RawMessage(nil), r.RuleOptions(name)...)
    settings[name] = setting
  }
  return settings, nil
}

// ConfigStore holds the parsed representation of a lint config file. It
// implements RuleResolver with per-file glob scoping: ResolveRules walks the
// entries in declaration order and folds each matching rule's severity and
// options together. A later option tuple replaces the inherited payload; a
// later severity-only declaration preserves options from an earlier matching
// entry and cannot borrow them from an entry that did not match the file.
// https://eslint.org/docs/latest/use/configure/rules#using-configuration-files
//
// A config file is a single `ITtscLintConfig` object. Its `extends` field
// names another config file to fold in first. A file may contribute a
// global-ignore entry and a scoped rule entry, or no entry when it has neither.
// Extends-target entries precede the extending file's entries so local rules
// win on collision; format settings join the same scoped rule entry.
// Duplicate aliases within one rules object are rejected before entries are stored.
//
// @evidence contracts/common.md#principled-implementation Ordered entries preserve extends precedence and matching-file ownership of severities and options; global-ignore entries distinguish whole-file exclusion from local selection.
// @evidence contracts/common.md#clear-and-simple-design Parsed entries are the policy source of truth, while paths and fingerprints separately carry watch and resident-cache provenance.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compatibility option lookup derives from entries rather than a second flattened state; the parser rejects duplicate canonical identities instead of choosing map-order precedence.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain matching, inheritance, ignores and alias limits; public methods document copy ownership and metadata-only semantics.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ConfigStore is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ConfigStore is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ConfigStore is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ConfigStore is a declaration of data shape; the code that holds its values owns their lifetime.
type ConfigStore struct {
  cacheDependencies []configDependencyFingerprint
  cacheFiles        []string
  directories       []string
  entries           []ConfigEntry
  paths             []string
  resolutionRoot    string
}

// ConfigPaths returns the config, extends and evaluated public dependency files
// that produced this store. Private resident-cache fingerprints remain separate.
// The paths are retained as exact dependencies even when no rule declares
// additional project inputs.
// The returned slice is a copy, so callers can change its membership.
//
// @evidence contracts/common.md#principled-implementation Copying the stored path slice preserves config provenance while preventing callers from changing store membership.
// @evidence contracts/common.md#clear-and-simple-design Watch-input exposure is separate from entry resolution and private executable-cache fingerprints.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Paths come from actual config evaluation and inheritance, not a fixture-specific watch list.
// @evidence contracts/common.md#meaningful-documentation Native prose explains retained provenance and defensive slice ownership with separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ConfigPaths returns config path strings the store already holds; it opens no file and compares no path.
// @evidence contracts/performance.md#efficient-algorithms One slice copy, O(paths).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ConfigPaths keeps no cache and shares no computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The store retains its path list for its own lifetime and ConfigPaths returns a copy, so a caller cannot mutate or extend the retained slice.
func (s *ConfigStore) ConfigPaths() []string {
  if s == nil {
    return nil
  }
  return append([]string(nil), s.paths...)
}

// ConfigDirectories returns resolution-topology directories whose immediate
// entries can change which executable-config module Node selects. Consumers
// watch these as cold configuration inputs rather than ordinary rule data.
// The returned slice is a copy; a nil store has no directory inputs.
//
// @evidence contracts/common.md#principled-implementation Exposing copied topology directories permits consumers to observe resolution changes without mutating store state.
// @evidence contracts/common.md#clear-and-simple-design Module-selection inputs have a distinct accessor because they are not source files or rule data.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directories are tracked resolver inputs rather than assumed fixed Node search locations.
// @evidence contracts/common.md#meaningful-documentation Native prose explains topology relevance, nil behavior and copy ownership before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ConfigDirectories returns directory strings the store already holds; it opens no file and compares no path.
// @evidence contracts/performance.md#efficient-algorithms One slice copy, O(directories).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ConfigDirectories keeps no cache and shares no computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The store retains its directory list for its own lifetime and ConfigDirectories returns a copy, so a caller cannot mutate or extend the retained slice.
func (s *ConfigStore) ConfigDirectories() []string {
  if s == nil {
    return nil
  }
  return append([]string(nil), s.directories...)
}

// residentRuleConfigState returns the private cache proof for the configuration
// that produced this store. Executable configs retain their complete dependency
// fingerprints, including package implementation files that must invalidate a
// resident answer without becoming public project-watch inputs. JSON configs
// retain the actual raw-byte fingerprint captured by their decoding read; no
// later hash substitutes for the consumed input.
func (s *ConfigStore) residentRuleConfigState() residentRuleConfigState {
  if s == nil {
    return residentRuleConfigState{}
  }
  dependencies := make([]configDependencyFingerprint, len(s.cacheDependencies))
  for index, dependency := range s.cacheDependencies {
    dependencies[index] = dependency
    dependencies[index].Realpath = cloneConfigDependencyRealpath(dependency.Realpath)
  }
  return residentRuleConfigState{
    dependencies: dependencies,
    files:        append([]string(nil), s.cacheFiles...),
  }
}

// RuleOptions implements the file-agnostic RuleResolver compatibility method.
// Engine execution does not use this representative value: ResolveRules
// carries the matching file's options. Callers that only understand the older
// interface observe the final declared tuple, preserving the former flat
// resolver behavior without storing a second source of truth.
// The returned bytes are copied and remain independent of the stored payload.
//
// @evidence contracts/common.md#principled-implementation Declaration-order traversal selects the final explicit tuple for metadata compatibility without claiming that it applies to a particular file.
// @evidence contracts/common.md#clear-and-simple-design The representative payload is derived from entries instead of maintained in a duplicate flattened option map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback exists for supported file-agnostic consumers and cannot override ResolveRules execution scope.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes metadata compatibility from file execution and documents copied ownership with separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptions selects option bytes by rule name and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Normalize the input name, then scan entries for its last nonempty payload and copy the winner; work includes name normalization and hashing plus O(entries + winning payload bytes), with output storage proportional to the copied payload.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work RuleOptions keeps no cache; every call reads the store's entries.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The winning message is copied so the caller cannot mutate store memory; no handle or task is acquired.
func (s *ConfigStore) RuleOptions(name string) json.RawMessage {
  if s == nil {
    return nil
  }
  canonical := normalizeBuiltinRuleName(name)
  var selected json.RawMessage
  for _, entry := range s.entries {
    if raw := entry.Options[canonical]; len(raw) > 0 {
      selected = raw
    }
  }
  return append(json.RawMessage(nil), selected...)
}

// flattenOptions returns the final declared payload for each rule without
// claiming that it applies to any particular file. Metadata-only consumers
// use this to enumerate option-bearing rules; execution always uses
// ResolveRules instead.
func (s *ConfigStore) flattenOptions() RuleOptionsMap {
  if s == nil {
    return nil
  }
  options := RuleOptionsMap{}
  for _, entry := range s.entries {
    for name, raw := range entry.Options {
      options[normalizeBuiltinRuleName(name)] = append(json.RawMessage(nil), raw...)
    }
  }
  return options
}

// RuleOptionsVariants exposes each non-ignore entry's declared payload,
// including nil for a severity-only declaration. Engine construction can check
// all files/extends variants through the rule's supported validation capability
// rather than selecting only the last parsed tuple.
// Returned payloads are independent byte copies; nil marks a severity-only declaration.
//
// @evidence contracts/common.md#principled-implementation Every non-ignore entry declaring the canonical name contributes its own payload, including nil, so eager validation does not skip scoped variants.
// @evidence contracts/common.md#clear-and-simple-design The optional capability projects existing entries and reuses the rule decoder rather than introducing another configuration model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Variant enumeration uses declared settings, not which examples happened to execute a rule.
// @evidence contracts/common.md#meaningful-documentation Native prose states full declaration population, severity-only nil and independent byte ownership before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleOptionsVariants selects option bytes by rule name and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms One pass over e entries probes the canonical name and copies b bytes across v declared variants, O(e) map probes plus name hashing and b copy work, with O(v+b) result storage. The declaration list is the source of truth, so eager discovery must inspect entries even when their file selectors differ.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This projection owns no shared producer or invalidation identity. Engine construction separately deduplicates identical payload bytes before invoking supported validation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned slice and nonempty payload copies belong to the caller; nil payloads carry no bytes. This call retains no historical result, handle or task in the store.
func (s *ConfigStore) RuleOptionsVariants(name string) []json.RawMessage {
  if s == nil {
    return nil
  }
  canonical := normalizeBuiltinRuleName(name)
  variants := make([]json.RawMessage, 0)
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    if _, declared := entry.Rules[canonical]; !declared {
      continue
    }
    variants = append(variants, append(json.RawMessage(nil), entry.Options[canonical]...))
  }
  return variants
}

// ConfigEntry is one parsed selection or global-ignore entry from a config file.
// BaseDir anchors glob resolution; Files and Ignores are the pattern lists.
// IgnoreOnly represents a global-ignore entry derived from an ignores list
// without a nonempty files restriction. These entries are evaluated first in
// ResolveRules and short-circuit the walk when matched.
//
// @evidence contracts/common.md#principled-implementation One entry binds relative patterns and paired rule maps to the config file that owns them, while selector presence remains distinct from an empty pattern list.
// @evidence contracts/common.md#clear-and-simple-design Entry-local scope and global-ignore state are explicit fields, avoiding parallel flattened policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Presence bits model actual config syntax instead of guessing scope from a nonempty collection.
// @evidence contracts/common.md#meaningful-documentation Native prose and spaced field comments explain pattern anchoring, presence and ignore meaning without property tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ConfigEntry is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ConfigEntry is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ConfigEntry is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ConfigEntry is a declaration of data shape; the code that holds its values owns their lifetime.
type ConfigEntry struct {
  // BaseDir anchors this config file's relative selectors.
  BaseDir string

  // Files lists positive patterns; an empty list imposes no file restriction.
  Files []string

  // HasFilesSelector preserves explicit selector syntax for project-rule validation.
  HasFilesSelector bool

  // Ignores subtracts files from this entry, or globally when IgnoreOnly is true.
  Ignores []string

  // Rules contains this entry's declarations, including explicit off states.
  Rules RuleConfig

  // Options contains this entry's option tuples, folded with its matching severities.
  Options RuleOptionsMap

  // IgnoreOnly makes a matching ignore skip the file before ordinary entries fold.
  IgnoreOnly bool
}

// ResolveRules implements RuleResolver. Ignore-only entries are checked first;
// if one matches, the file is marked Ignored and linting is skipped entirely.
// Otherwise the entries are walked in declaration order and the last matching
// entry wins (later entries shadow earlier ones for the same rule name).
// A later severity-only declaration retains the most recent options from a matching entry.
//
// @evidence contracts/common.md#principled-implementation Global ignores precede ordered entry matching; paired maps are folded only from matching entries, retaining inherited tuples when a later matching declaration has no options.
// @evidence contracts/common.md#clear-and-simple-design A global-ignore phase precedes the ordered file-scope fold; ConfigEntry owns pattern predicates and the result distinguishes ignored from out-of-scope.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No options are borrowed from nonmatching entries and no consumer name bypasses selection.
// @evidence contracts/common.md#meaningful-documentation Native prose documents global-ignore ordering, precedence and severity-only inheritance before a separate tag paragraph.
// @evidence contracts/portability.md#os-neutral-implementation Selector helpers use native filepath identities and symlink/junction ancestor resolution, then slash-normalized glob spelling. Stored-case fallback requires the actual path to exist and a unique on-disk case-fold match; it does not infer case policy from the OS name. Relative paths escaping the resolved base are rejected; resolution failures preserve lexical spelling, and a failed relative-path calculation disables stored-case fallback.
// @evidence contracts/performance.md#efficient-algorithms Up to two passes inspect e entries and merge q matching rule declarations, with name hashing/normalization and b copied payload bytes. Selector work includes pattern matching, native ancestor resolution and eligible stored-case directory scans; output holds u distinct rules and their final payload bytes. Global ignores return early.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call projects current entries and filesystem identities; it has no cross-call invalidation proof for memoizing matching after native topology changes.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned maps are new and owned by the caller and option bytes are copied; no handle or task is acquired.
func (s *ConfigStore) ResolveRules(fileName string) ResolvedRuleConfig {
  if s == nil {
    return ResolvedRuleConfig{Rules: RuleConfig{}, OptionsResolved: true}
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly && entry.matchesIgnores(fileName) {
      return ResolvedRuleConfig{Rules: RuleConfig{}, OptionsResolved: true, Ignored: true}
    }
  }
  out := RuleConfig{}
  options := RuleOptionsMap{}
  hasEntries := false
  matchedEntry := false
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    hasEntries = true
    if !entry.matchesFile(fileName) {
      continue
    }
    matchedEntry = true
    for name, sev := range entry.Rules {
      canonical := normalizeBuiltinRuleName(name)
      out[canonical] = sev
      if raw := entry.Options[canonical]; len(raw) > 0 {
        options[canonical] = append(json.RawMessage(nil), raw...)
      }
    }
  }
  return ResolvedRuleConfig{
    Rules:           out,
    Options:         options,
    OptionsResolved: true,
    OutOfScope:      hasEntries && !matchedEntry,
  }
}

// ActiveRuleNames implements RuleResolver. Returns the sorted union of all rule
// names that are not SeverityOff across every non-ignore-only config entry,
// regardless of which files they apply to. The engine uses this to build the
// per-rule dispatch table before file iteration begins.
//
// @evidence contracts/common.md#principled-implementation Unioning non-off declarations from every ordinary entry retains potentially active rules regardless of current file scope, then sorts their canonical identities.
// @evidence contracts/common.md#clear-and-simple-design Dispatch metadata is derived from entries without executing file matching or caching a duplicate activity list.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Activity follows supported config declarations instead of sampled source diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native prose explains ignore-only exclusion, potential activity and the pre-file dispatch consumer before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ActiveRuleNames collects rule names and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Scanning e entries and q ordinary rule declarations builds u distinct active names, then sorts them: O(e+q+u log u) entry/name operations plus normalization, hashing and comparison bytes. The temporary union and returned slice hold O(u) entries; no file selectors or option payloads are evaluated.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This metadata projection owns no shared producer or cross-call invalidation identity; engine construction separately uses its result to build dispatch once.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The temporary union is local and the caller owns the returned name slice. No historical metadata, handle or task is retained by this call.
func (s *ConfigStore) ActiveRuleNames() []string {
  if s == nil {
    return nil
  }
  active := RuleConfig{}
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for name, sev := range entry.Rules {
      if sev != SeverityOff {
        active[normalizeBuiltinRuleName(name)] = sev
      }
    }
  }
  return sortedRuleNames(active, func(Severity) bool { return true })
}

// EnabledRuleConfig implements RuleResolver. Returns the project-wide severity
// map for non-off rules. Where multiple entries configure the same rule,
// SeverityError is sticky — it cannot be downgraded by a later warning entry.
//
// @evidence contracts/common.md#principled-implementation Aggregating non-off entries with sticky error severity conservatively represents potential project reporting without replacing file-specific resolution.
// @evidence contracts/common.md#clear-and-simple-design The metadata projection is computed from the same entries rather than stored as independent execution policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Error precedence is the documented aggregate policy, not a special case for a diagnostic fixture.
// @evidence contracts/common.md#meaningful-documentation Native prose states global aggregation and sticky error semantics with a separate acknowledgment paragraph.
// @evidenceExclude contracts/portability.md#os-neutral-implementation EnabledRuleConfig merges rule severities and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Scanning e entries and q ordinary rule declarations writes u distinct non-off canonical names, O(e+q) entry/name operations plus normalization/hashing bytes and O(u) returned entries. No file selectors or payload bytes are evaluated.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This metadata projection owns no shared producer or cross-call invalidation identity; engine construction separately retains the aggregate reporting state it needs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the new severity map, including the empty nil-store result. This call retains no historical metadata, handle or task.
func (s *ConfigStore) EnabledRuleConfig() RuleConfig {
  out := RuleConfig{}
  if s == nil {
    return out
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for name, sev := range entry.Rules {
      if sev == SeverityOff {
        continue
      }
      canonical := normalizeBuiltinRuleName(name)
      if out[canonical] != SeverityError {
        out[canonical] = sev
      }
    }
  }
  return out
}

// ResolveProjectRules folds the extends-expanded entries base-first. Only
// global entries participate. A project-only rule mentioned under files is an
// invalid configuration, including off declarations and option tuples. A
// built-in companion sharing a file-rule name ignores that scoped declaration
// so the file rule can retain its existing per-file configuration.
//
// @evidence contracts/common.md#principled-implementation Base-first global folding preserves declaration presence and inherited options; file-only project declarations are rejected unless a registered file companion owns that scoped mention.
// @evidence contracts/common.md#clear-and-simple-design Requested identities form a lookup set and project validation stays with the store that knows entry scope.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The companion exception checks actual LookupRule registration rather than a hand-maintained consumer whitelist.
// @evidence contracts/common.md#meaningful-documentation Native prose states project-scope rejection and the registered-companion distinction before separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ResolveProjectRules resolves rule names and option bytes and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms A wanted-name index is built for p requests, e entries are visited and q configured rules in participating entries are scanned once. This costs O(p+e+q) entry/name operations plus normalization/hashing bytes and the total option bytes copied by matching inherited updates; lookup/result maps reserve O(p) entries and results retain the final resolved payloads.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This method owns one fold of the current store. The native loadRules boundary binds its project resolution into boundProjectRuleResolver so engine construction can reuse the settings instead of folding the store again.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned map is new and owned by the caller and option bytes are copied; no handle or task is acquired.
func (s *ConfigStore) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  out := make(map[string]ProjectRuleSetting, len(names))
  wanted := make(map[string]string, len(names))
  for _, name := range names {
    canonical := normalizeBuiltinRuleName(name)
    wanted[canonical] = name
    out[name] = ProjectRuleSetting{}
  }
  if s == nil {
    return out, nil
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for configuredName, severity := range entry.Rules {
      name, projectRule := wanted[normalizeBuiltinRuleName(configuredName)]
      if !projectRule {
        continue
      }
      if entry.HasFilesSelector {
        // A built-in project companion shares its public name with a file
        // rule. Keep the file-scoped declaration for that file rule, but do
        // not turn it into project-wide state: only a global declaration can
        // activate the companion and its consumers.
        if LookupRule(name) != nil {
          continue
        }
        return nil, fmt.Errorf(
          "@ttsc/lint: project rule %q cannot be configured in an entry with files",
          name,
        )
      }
      setting := out[name]
      setting.Declared = true
      setting.Severity = severity
      if raw := entry.Options[normalizeBuiltinRuleName(configuredName)]; len(raw) > 0 {
        setting.Options = append(json.RawMessage(nil), raw...)
      }
      out[name] = setting
    }
  }
  return out, nil
}

// Flatten returns a new severity map for all non-ignore-only entries,
// including SeverityOff rules. Used by LoadRuleConfig (callers that expect a
// plain RuleConfig). Later entries shadow earlier ones for the same rule name.
//
// @evidence contracts/common.md#principled-implementation Declaration-order folding retains explicit off states and intentionally discards file scope to represent the documented unconstrained union.
// @evidence contracts/common.md#clear-and-simple-design A derived map adapts legacy severity consumers without becoming another source of execution truth.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flattening is an explicit metadata API and is not substituted for scoped engine execution.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the loss of scope, inclusion of off and precedence before a separate tag paragraph.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Flatten merges rule severities and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms One fold visits e entries and q rules in participating entries, with O(e+q) entry/map operations plus rule-name trimming, normalization and hashing bytes. A full fold is needed for the unconstrained union and later-entry precedence. The returned map holds u distinct canonical names and severities in O(u) map entries; normalized names can share their source string backing storage.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Flatten owns one severity projection of the store, not a cross-request computation coordinator. Its fresh writable result gives each caller independent map membership; callers establish equivalence and ownership before reusing a projection.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned map is new and owned by the caller; no handle or task is acquired.
func (s *ConfigStore) Flatten() RuleConfig {
  out := RuleConfig{}
  if s == nil {
    return out
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for name, sev := range entry.Rules {
      out[normalizeBuiltinRuleName(name)] = sev
    }
  }
  return out
}

func (e ConfigEntry) matchesFile(fileName string) bool {
  if len(e.Files) > 0 && !matchAnyPattern(e.BaseDir, e.Files, fileName) {
    return false
  }
  if e.matchesIgnores(fileName) {
    return false
  }
  return true
}

func (e ConfigEntry) matchesIgnores(fileName string) bool {
  return len(e.Ignores) > 0 && matchAnyPattern(e.BaseDir, e.Ignores, fileName)
}

// ParseRules projects a decoded rule object to a severity map, preserving
// supplied key spelling and rejecting duplicate canonical aliases.
//
// Nil means no rules. Entries accept "off", "warn"/"warning", "error" or
// JSON-decoded float64 values 0, 1, 2, either bare or in a severity/options tuple.
// Unsupported severities, empty tuples and unencodable options return an error.
//
// Tuples are checked and option payloads encoded by the shared parser, then
// discarded from this severity-only result; use ParseRulesWithOptions to retain them.
//
// @evidence contracts/common.md#principled-implementation Delegating to the tuple-aware parser preserves severity validation while intentionally discarding option storage for this severity-only API.
// @evidence contracts/common.md#clear-and-simple-design One parser owns entry decoding; this wrapper only projects the severity result.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid severity is returned as an error rather than silently disabled to satisfy a consumer.
// @evidence contracts/common.md#meaningful-documentation Native prose describes decoded input, nil, complete severity vocabulary, tuple errors, key spelling and the option-bearing alternative before separate tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ParseRules performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms The shared parser sorts n stored names, scans entries and encodes supplied option bytes, O(n log n) name comparisons plus name and payload bytes. Delegation preserves the same strict tuple/error semantics; only the severity map is transferred, while temporary option maps and bytes become reclaimable after return.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This decoded-value projection owns no shared producer or cross-call identity for mutable caller inputs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the new severity map; temporary discarded option storage is not retained by this wrapper. No handle or task is acquired.
func ParseRules(raw any) (RuleConfig, error) {
  cfg, _, err := ParseRulesWithOptions(raw)
  return cfg, err
}

// ParseRulesWithOptions accepts either a severity literal or a
// `[severity, ...options]` tuple per rule and returns the severity map
// alongside an options map keyed by rule name. The options map only
// contains entries for rules whose configuration carries option slots.
// Keys retain their supplied spelling. Distinct keys for one canonical rule are
// rejected, including duplicate aliases with equal severities or payloads.
// JSON-loaded option slots retain nested object-entry order; an ordinary Go map
// has no authored member order for this boundary to recover.
//
// @evidence contracts/common.md#principled-implementation Canonical identity validation rejects ambiguous maps before entry decoding separates severity and JSON option slots, preserving each tuple and one-slot shape.
// @evidence contracts/common.md#clear-and-simple-design The boundary validates a raw object once and returns paired maps for existing severity and option consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Ambiguous aliases are errors regardless of equal values, rather than iteration-order precedence; invalid entries do not receive fabricated defaults.
// @evidence contracts/common.md#meaningful-documentation Native prose explains tuple shape, option-map population and preserved key spelling with a blank line before tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ParseRulesWithOptions decodes an already-loaded rules value and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Canonical-name validation sorts n rule names before a linear entry pass, requiring O(n log n) name comparisons plus hashing/name-byte work. Option encoding examines the supplied payload bytes and allocates the returned JSON; result maps scale with rule and option counts.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ParseRulesWithOptions keeps no cache; every call decodes its argument.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned maps are new and owned by the caller; no handle or task is acquired.
func ParseRulesWithOptions(raw any) (RuleConfig, RuleOptionsMap, error) {
  if raw == nil {
    return RuleConfig{}, RuleOptionsMap{}, nil
  }
  dict, ok := raw.(map[string]any)
  if !ok {
    return nil, nil, fmt.Errorf("@ttsc/lint: \"rules\" must be an object, got %T", raw)
  }
  if err := validateCanonicalRuleNames(dict); err != nil {
    return nil, nil, err
  }
  cfg := make(RuleConfig, len(dict))
  opts := make(RuleOptionsMap)
  for name, value := range dict {
    sev, raw, err := parseRuleEntry(value)
    if err != nil {
      return nil, nil, fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
    }
    cfg[name] = sev
    if len(raw) > 0 {
      opts[name] = raw
    }
  }
  return cfg, opts, nil
}

// parseRuleEntry splits a rule entry into its severity and optional positional
// options. A single option keeps its JSON shape for existing object-option
// rules. Two or more options become a JSON array so canonical ESLint rules
// with several positional slots can decode them without parser special cases.
func parseRuleEntry(value any) (Severity, json.RawMessage, error) {
  if tuple, ok := value.([]any); ok {
    if len(tuple) == 0 {
      return SeverityOff, nil, fmt.Errorf("severity tuple must not be empty")
    }
    sev, err := parseSeverity(tuple[0])
    if err != nil {
      return SeverityOff, nil, err
    }
    if len(tuple) == 1 {
      return sev, nil, nil
    }
    if len(tuple) == 2 && tuple[1] == nil {
      return sev, nil, nil
    }
    var payload any = tuple[1]
    if len(tuple) > 2 {
      payload = tuple[1:]
    }
    encoded, err := json.Marshal(payload)
    if err != nil {
      return SeverityOff, nil, fmt.Errorf("encode options: %w", err)
    }
    return sev, encoded, nil
  }
  sev, err := parseSeverity(value)
  return sev, nil, err
}

// parseExternalConfigRules is a convenience wrapper used by unit tests that
// only need a flat RuleConfig from an already-deserialized config object. Glob
// scoping and options are discarded.
func parseExternalConfigRules(raw any) (RuleConfig, error) {
  store, err := parseExternalConfigStore(raw, "")
  if err != nil {
    return nil, err
  }
  return store.Flatten(), nil
}

// parseExternalConfigStore parses a single `ITtscLintConfig` object into a
// *ConfigStore. `configDir` anchors glob resolution and `extends` lookups; it
// is empty for in-memory inputs that do not load from a real file.
func parseExternalConfigStore(raw any, configDir string) (*ConfigStore, error) {
  return collectConfigStore(raw, configDir, "")
}

// collectConfigStore parses a single `ITtscLintConfig` object into a fresh
// *ConfigStore. `rootPath` is the absolute path of the file `raw` was loaded
// from, or "" for in-memory inputs; when set it seeds the `extends` cycle
// guard so a config that `extends` itself (directly or transitively) is
// rejected.
func collectConfigStore(raw any, configDir, rootPath string) (*ConfigStore, error) {
  return collectConfigStoreWithin(raw, configDir, rootPath, configDir)
}

func collectConfigStoreWithin(
  raw any,
  configDir string,
  rootPath string,
  resolutionRoot string,
) (*ConfigStore, error) {
  store := &ConfigStore{resolutionRoot: filepath.Clean(resolutionRoot)}
  var chain []string
  if rootPath != "" {
    rootPath = filepath.Clean(rootPath)
    chain = []string{rootPath}
    store.paths = append(store.paths, rootPath)
  }
  if err := collectConfigObject(store, raw, configDir, "config", chain); err != nil {
    return nil, err
  }
  return store, nil
}

// extendsDepthLimit caps how many `extends` hops collectConfigObject will
// follow. The cycle check in appendExtendsLink already rejects every loop;
// this is a backstop so a config chain that escapes that check (e.g. a future
// change that resolves the same file under two different cleaned paths) still
// fails fast instead of spawning an unbounded run of `ttsx`/`node`
// config-loader subprocesses — one per hop.
const extendsDepthLimit = 32

// appendExtendsLink validates that following the `extends` target at `next`
// neither closes a cycle nor exceeds extendsDepthLimit, then returns `chain`
// extended by `next`. `chain` holds the resolved absolute paths of every
// config file already on the current `extends` lineage, root first. The guard
// runs before loadConfigFile so a cyclic chain fails fast instead of
// re-reading files (and re-spawning subprocesses) without bound.
func appendExtendsLink(chain []string, next string) ([]string, error) {
  for i, prior := range chain {
    if prior == next {
      // chain[i:] capped at its own length so append allocates a fresh
      // backing array rather than mutating the caller's `chain`.
      cycle := append(chain[i:len(chain):len(chain)], next)
      return nil, fmt.Errorf(
        "@ttsc/lint: extends cycle detected: %s",
        strings.Join(cycle, " -> "),
      )
    }
  }
  if len(chain) >= extendsDepthLimit {
    return nil, fmt.Errorf(
      "@ttsc/lint: extends chain exceeds the depth limit of %d: %s -> ...",
      extendsDepthLimit,
      strings.Join(chain, " -> "),
    )
  }
  extended := make([]string, len(chain)+1)
  copy(extended, chain)
  extended[len(chain)] = next
  return extended, nil
}

// collectConfigObject parses one `ITtscLintConfig` object into `store`,
// appending one ConfigEntry for the object's own rules (and, recursively, the
// entries of any `extends`-named config file). The extends-target's entries
// are appended first so the extending file's local rules win on collision.
//
// `chain` carries the resolved absolute paths of the config files already on
// the current `extends` lineage (root first); appendExtendsLink consults it to
// reject cyclic or pathologically deep chains before another file is read.
func collectConfigObject(store *ConfigStore, raw any, baseDir, path string, chain []string) error {
  if raw == nil {
    return nil
  }
  obj, ok := raw.(map[string]any)
  if !ok {
    return fmt.Errorf("@ttsc/lint: %s must be an ITtscLintConfig object, got %T", path, raw)
  }
  if err := rejectUnknownConfigKeys(obj, path); err != nil {
    return err
  }

  if extended, hasExtends := obj["extends"]; hasExtends && extended != nil {
    extendsStr, ok := extended.(string)
    if !ok {
      return fmt.Errorf("@ttsc/lint: %s.extends must be a string path to another config file, got %T", path, extended)
    }
    if strings.TrimSpace(extendsStr) == "" {
      return fmt.Errorf("@ttsc/lint: %s.extends must not be empty", path)
    }
    location := extendsStr
    if !filepath.IsAbs(location) {
      location = filepath.Join(baseDir, location)
    }
    location = filepath.Clean(location)
    extendedChain, err := appendExtendsLink(chain, location)
    if err != nil {
      return err
    }
    if !containsPath(store.paths, location) {
      store.paths = append(store.paths, location)
    }
    evaluated, err := loadConfigFileEvaluationWithin(
      location,
      store.resolutionRoot,
    )
    if err != nil {
      return err
    }
    appendConfigPaths(store, evaluated.dependencies)
    appendConfigDirectories(store, evaluated.dependencyDirectories)
    appendResidentConfigEvaluation(store, location, evaluated)
    if err := collectConfigObject(store, evaluated.value, filepath.Dir(location), path+".extends", extendedChain); err != nil {
      return err
    }
  }

  _, hasFilesSelector := obj["files"]
  files, err := parsePatternList(obj["files"], path+".files")
  if err != nil {
    return err
  }
  ignores, err := parsePatternList(obj["ignores"], path+".ignores")
  if err != nil {
    return err
  }

  // An `ignores` list without a `files` filter is a GLOBAL ignore: a config
  // file is a single ITtscLintConfig object, so its top-level `ignores` is
  // the only way an author can say "never lint these files". It must
  // therefore exclude the matched files from every entry of the resolved
  // chain — including entries folded in via `extends`, which otherwise
  // carry no ignores of their own and would keep linting the excluded
  // files (samchon/ttsc: `extends` + `ignores` + `rules` leaked the base
  // config's rules onto ignored paths). When `files` IS present the
  // ignores only refine that entry's selection, matching ESLint's
  // entry-scoped semantics, and no global entry is added.
  if len(files) == 0 && len(ignores) > 0 {
    store.entries = append(store.entries, ConfigEntry{
      BaseDir:    baseDir,
      Ignores:    ignores,
      IgnoreOnly: true,
    })
  }

  rulesValue, hasRules := obj["rules"]
  formatValue, hasFormat := obj["format"]
  if hasRules || hasFormat {
    // Expand the format block (if any) into a rules-shaped map, then
    // overlay the user's explicit `rules` entries. Formatter settings live
    // exclusively in the `format` block: any `format/*` key in `rules` is
    // dropped below (never activates, never overrides the format block), so
    // the overlay only ever layers lint-rule severities on top.
    var formatRulesRaw map[string]any
    if hasFormat {
      formatMap, ok := formatValue.(map[string]any)
      if !ok {
        return fmt.Errorf("@ttsc/lint: %s.format must be an object, got %T", path, formatValue)
      }
      expanded, err := expandFormatBlock(formatMap)
      if err != nil {
        return err
      }
      formatRulesRaw = expanded
    }
    var rulesMap map[string]any
    if hasRules {
      typedMap, ok := rulesValue.(map[string]any)
      if !ok {
        return fmt.Errorf("@ttsc/lint: %s.rules must be a rule severity map, got %T", path, rulesValue)
      }
      if err := validateCanonicalRuleNames(typedMap); err != nil {
        return fmt.Errorf("%s.rules: %w", path, err)
      }
      // `format/*` rules are configured exclusively through the `format`
      // block; they are never valid keys in `rules`. Silently drop any that
      // appear, the same way an unknown rule name is ignored (see
      // parseExternalRuleMapInto): a config must not carry a formatter
      // setting in two places, and a stray `format/*` here is simply not the
      // formatting surface, so it has no effect rather than erroring.
      // Evaluated objects can be shared by concurrent cache readers. Filter
      // into owned storage instead of deleting from the cached source map.
      rulesMap = make(map[string]any, len(typedMap))
      for key, value := range typedMap {
        if !isFormatRuleName(normalizeBuiltinRuleName(key)) {
          rulesMap[key] = value
        }
      }
    }
    merged := mergeRuleMaps(formatRulesRaw, rulesMap)
    if len(merged) > 0 {
      parsed, entryOptions, err := parseExternalRuleMapInto(merged, path+".rules")
      if err != nil {
        return err
      }
      store.entries = append(store.entries, ConfigEntry{
        BaseDir:          baseDir,
        Files:            files,
        HasFilesSelector: hasFilesSelector,
        Ignores:          ignores,
        Rules:            parsed,
        Options:          entryOptions,
      })
    }
  }
  return nil
}

// parseExternalRuleMapInto parses one entry's rules and option tuples. Options
// stay on the ConfigEntry that owns their files/ignores scope; no project-wide
// mirror is created.
func parseExternalRuleMapInto(raw any, path string) (RuleConfig, RuleOptionsMap, error) {
  out := RuleConfig{}
  entryOptions := RuleOptionsMap{}
  if err := collectExternalRuleMapWithOptions(out, entryOptions, raw, path); err != nil {
    return nil, nil, err
  }
  return out, entryOptions, nil
}

// collectExternalRuleMapWithOptions also records the rule's option payload
// when the entry is a `[severity, ...options]` tuple. `opts` may be nil when
// the caller does not need option capture.
func collectExternalRuleMapWithOptions(out RuleConfig, opts RuleOptionsMap, raw any, path string) error {
  dict, ok := raw.(map[string]any)
  if !ok {
    return fmt.Errorf("@ttsc/lint: %s must be a rules object, got %T", path, raw)
  }
  if err := validateCanonicalRuleNames(dict); err != nil {
    return fmt.Errorf("%s: %w", path, err)
  }
  for name, value := range dict {
    sev, ruleOpts, err := parseExternalRuleEntry(value)
    if err != nil {
      return fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
    }
    canonical := normalizeBuiltinRuleName(name)
    out[canonical] = sev
    if opts != nil && len(ruleOpts) > 0 {
      opts[canonical] = ruleOpts
    }
  }
  return nil
}

// rejectUnknownConfigKeys surfaces typos in top-level config-file keys at the
// boundary rather than silently ignoring them. The key set mirrors
// `ITtscLintConfig` exactly.
func rejectUnknownConfigKeys(value map[string]any, path string) error {
  allowed := map[string]struct{}{
    "files":   {},
    "ignores": {},
    "extends": {},
    "plugins": {},
    "rules":   {},
    "format":  {},
  }
  for key := range value {
    if _, ok := allowed[key]; !ok {
      return fmt.Errorf("@ttsc/lint: %s has unknown key %q; a lint config file must be an ITtscLintConfig object (files, ignores, extends, plugins, rules, format)", path, key)
    }
  }
  return nil
}

// parsePatternList coerces a raw config value to a string slice for use as a
// `files` or `ignores` pattern list. Accepts a bare string (single-pattern
// shorthand) or a string array. Empty patterns are rejected eagerly.
func parsePatternList(raw any, path string) ([]string, error) {
  if raw == nil {
    return nil, nil
  }
  switch typed := raw.(type) {
  case string:
    if strings.TrimSpace(typed) == "" {
      return nil, fmt.Errorf("@ttsc/lint: %s must not contain an empty pattern", path)
    }
    return []string{typed}, nil
  case []any:
    out := make([]string, 0, len(typed))
    for i, item := range typed {
      pattern, ok := item.(string)
      if !ok {
        return nil, fmt.Errorf("@ttsc/lint: %s[%d] must be a string, got %T", path, i, item)
      }
      if strings.TrimSpace(pattern) == "" {
        return nil, fmt.Errorf("@ttsc/lint: %s[%d] must not be empty", path, i)
      }
      out = append(out, pattern)
    }
    return out, nil
  default:
    return nil, fmt.Errorf("@ttsc/lint: %s must be a string or string array, got %T", path, raw)
  }
}

// LoadRuleConfig resolves the lint config for one plugin entry and flattens it
// to a plain RuleConfig (no glob scoping). Metadata consumers can use the
// unconstrained severity union; file execution should use LoadConfigResolver.
//
// @evidence contracts/common.md#principled-implementation The loader delegates config evaluation and projects the resolver's supported severity view, preserving store off declarations through Flatten.
// @evidence contracts/common.md#clear-and-simple-design One adapter owns the legacy severity-only return shape while the scoped loader owns discovery and parsing.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Resolver type handling corresponds to real supported representations and does not bypass per-file execution policy.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies metadata use and directs file execution to the scoped resolver, with separated tags.
// @evidence contracts/portability.md#os-neutral-implementation LoadRuleConfig carries native cwd/tsconfig/config paths through LoadConfigResolver. That boundary uses filepath-based project anchoring and native discovery/evaluation helpers, while file URLs and executable argument forms belong to their loader owners; this projection introduces no case-folding or shell command text.
// @evidence contracts/performance.md#efficient-algorithms LoadRuleConfig includes the delegated discovery, config-byte parsing/evaluation, dependency validation and store construction costs of LoadConfigResolver. Store projection adds Flatten entry/rule/name work and a fresh severity map; alternate resolver representations supply their own severity view. A fixed type switch does not make the owning load constant-cost.
// @evidence contracts/performance.md#reuse-equivalent-work Executable config evaluation reuses the dependency-validated memory/disk producer reached through LoadConfigResolver; this adapter adds no projection cache. The ConfigStore branch returns fresh writable severity membership, so evaluation reuse does not imply sharing caller-mutable projection maps.
// @evidence contracts/performance.md#bound-retention-and-release-resources The delegated loader owns temporary files and synchronous evaluator children; its shared evaluation cache outlives this adapter. The returned severity map belongs to the caller: ConfigStore produces new membership while a RuleConfig resolver is returned directly. Temporary parsed store metadata becomes reclaimable when otherwise unreferenced; this function imposes no cache eviction or result-size bound.
func LoadRuleConfig(entry *PluginEntry, cwd, tsconfigPath string) (RuleConfig, error) {
  resolver, err := LoadConfigResolver(entry, cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  switch typed := resolver.(type) {
  case RuleConfig:
    return typed, nil
  case *ConfigStore:
    return typed.Flatten(), nil
  default:
    return resolver.EnabledRuleConfig(), nil
  }
}

// LoadConfigResolver resolves one plugin entry into the engine-facing config
// model.
//
// The tsconfig plugin entry carries exactly one optional lint-specific key:
// `configFile`, a path (relative to the tsconfig directory, or absolute) to
// the lint config file. When `configFile` is set, that file is loaded; when it
// is absent, a `lint.config.*` / `ttsc-lint.config.*` file is discovered by
// walking upward from the tsconfig directory and then from the working
// directory (see discoveryConfigBaseDirs for the embedder-declared origin).
//
// All rules, format options, and contributor plugins live in the config file
// itself; the tsconfig entry has no inline rule/format/plugin surface.
//
// Executable configs are cached against their recorded module dependencies,
// not arbitrary environment, network or user-performed filesystem reads.
// Set TTSC_LINT_DISABLE_CONFIG_CACHE for configs that depend on such inputs.
// Extends chains are bounded to 32 files; dependency tracking is not a sandbox.
//
// @evidence contracts/common.md#principled-implementation Explicit or discovered config paths use the project-root channel and extension-specific evaluator; base-first entry collection preserves inheritance and file scope under the documented dependency and depth limits.
// @evidence contracts/common.md#clear-and-simple-design The public boundary validates configFile and delegates discovery, evaluation and entry folding to their owners rather than supporting parallel inline policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Node's supported hooks track module resolution without replacing foreign fs methods; the bounded extends guard is a documented limit, while cache use for untracked external inputs must be disabled.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain project anchoring, config ownership, cache premises and limits, with a blank comment line before tags.
// @evidence contracts/portability.md#os-neutral-implementation LoadConfigResolver owns native config discovery/loading through its helpers. The launcher project-root channel wins over wrapper tsconfig origins; filepath preserves native path spelling and discovery probes actual candidates without assuming case policy from OS names. JSON uses native reads, JS uses explicit Node arguments/stdin, and TS uses loader-owned file URLs, argument vectors and platform temp/module-link boundaries rather than shell interpolation.
// @evidence contracts/performance.md#efficient-algorithms Discovery probes fourteen names per visited ancestor directory across the selected origins. Loading includes config bytes, executable evaluator work when needed, dependency digest validation, recursive extends and parsed entries/rules/options; each extends lineage is capped at thirty-two files, not total branch population. Provenance helpers perform membership scans and sorting of stored paths/directories, so additional work can be quadratic in their population plus comparison/path bytes. Returned store and temporary evaluation space scale with these inputs; no fixed total time or unmeasured speedup is claimed.
// @evidence contracts/performance.md#reuse-equivalent-work Executable evaluation delegates to a memory/disk cache keyed by version, absolute entry path/content and resolution-root namespace, with recorded dependency fingerprints revalidated on hits. Failed evaluations are not stored; dependency changes cause new work. JSON is read directly, and entry folding is performed for each load. Environment, network and arbitrary user filesystem effects are outside tracked equivalence and require the documented cache opt-out; no single-flight coordination is claimed.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned parsed store owns entries/options and public/resident dependency provenance until its consumer releases it. Loader helpers wait for each evaluator child and defer temporary-directory cleanup on success/error; their background contexts provide no caller deadline or external cancellation, and cleanup errors are not surfaced. Memory evaluation entries live for the process and disk entries have no eviction policy here, growing with distinct versioned content/dependency payloads. This loader imposes no total config-byte, branch-population or evaluator-runtime bound.
func LoadConfigResolver(entry *PluginEntry, cwd, tsconfigPath string) (RuleResolver, error) {
  if entry == nil {
    return RuleConfig{}, nil
  }
  inline := entry.Config
  if inline == nil {
    inline = map[string]any{}
  }
  resolutionRoot := tsconfigBaseDir(cwd, tsconfigPath)

  if configFileValue, ok := inline["configFile"]; ok {
    configFile, ok := configFileValue.(string)
    if !ok {
      return nil, fmt.Errorf("@ttsc/lint: \"configFile\" must be a string path, got %T", configFileValue)
    }
    if strings.TrimSpace(configFile) == "" {
      return nil, fmt.Errorf("@ttsc/lint: \"configFile\" must not be empty")
    }
    location := resolveConfigFilePath(configFile, cwd, tsconfigPath)
    return loadConfigResolver(location, resolutionRoot)
  }

  discovered, err := findLintConfigFile(cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  if discovered == "" {
    return nil, fmt.Errorf(
      "%w (searched upward from %s); create one or set \"configFile\" on the tsconfig plugin entry",
      errNoLintConfigFile,
      strings.Join(discoveryConfigBaseDirs(cwd, tsconfigPath), ", then from "),
    )
  }
  return loadConfigResolver(discovered, resolutionRoot)
}

// loadConfigResolver loads and parses the lint config file at `location` into
// a *ConfigStore and returns it as a RuleResolver.
func loadConfigResolver(
  location string,
  resolutionRoot string,
) (RuleResolver, error) {
  evaluated, err := loadConfigFileEvaluationWithin(location, resolutionRoot)
  if err != nil {
    return nil, err
  }
  store, err := collectConfigStoreWithin(
    evaluated.value,
    filepath.Dir(location),
    location,
    resolutionRoot,
  )
  if err != nil {
    return nil, err
  }
  appendConfigPaths(store, evaluated.dependencies)
  appendConfigDirectories(store, evaluated.dependencyDirectories)
  appendResidentConfigEvaluation(store, location, evaluated)
  return store, nil
}

func appendResidentConfigEvaluation(
  store *ConfigStore,
  location string,
  evaluated evaluatedConfigFile,
) {
  if evaluated.dependenciesTracked {
    for _, dependency := range evaluated.dependencyDigests {
      cloned := dependency
      cloned.Realpath = cloneConfigDependencyRealpath(dependency.Realpath)
      store.cacheDependencies = append(store.cacheDependencies, cloned)
    }
    // JSON retains its existing timestamp-window resident guard as well as
    // the new consumed-byte proof. Executable evaluations keep their own
    // dependency population and never acquire this JSON-only path guard.
    if !strings.EqualFold(filepath.Ext(location), ".json") {
      return
    }
  }
  location = filepath.Clean(location)
  if !containsPath(store.cacheFiles, location) {
    store.cacheFiles = append(store.cacheFiles, location)
    sort.Strings(store.cacheFiles)
  }
}

func appendConfigPaths(store *ConfigStore, paths []string) {
  for _, location := range paths {
    location = filepath.Clean(location)
    if !containsPath(store.paths, location) {
      store.paths = append(store.paths, location)
    }
  }
  sort.Strings(store.paths)
}

func appendConfigDirectories(store *ConfigStore, directories []string) {
  for _, location := range directories {
    location = filepath.Clean(location)
    if !containsPath(store.directories, location) {
      store.directories = append(store.directories, location)
    }
  }
  sort.Strings(store.directories)
}

func findLintConfigFile(cwd, tsconfigPath string) (string, error) {
  for _, origin := range discoveryConfigBaseDirs(cwd, tsconfigPath) {
    discovered, err := findLintConfigFileFrom(origin)
    if err != nil {
      return "", err
    }
    if discovered != "" {
      return discovered, nil
    }
  }
  return "", nil
}

// findLintConfigFileFrom walks upward from `dir` and returns the first
// directory level holding exactly one lint config file. Two or more candidates
// in the same directory is ambiguous and a hard error; an exhausted walk
// returns "" so the caller can try the next discovery origin.
func findLintConfigFileFrom(dir string) (string, error) {
  for {
    matches := make([]string, 0, 1)
    for _, name := range []string{
      "lint.config.json",
      "lint.config.js",
      "lint.config.mjs",
      "lint.config.cjs",
      "lint.config.ts",
      "lint.config.mts",
      "lint.config.cts",
      "ttsc-lint.config.json",
      "ttsc-lint.config.js",
      "ttsc-lint.config.mjs",
      "ttsc-lint.config.cjs",
      "ttsc-lint.config.ts",
      "ttsc-lint.config.mts",
      "ttsc-lint.config.cts",
    } {
      candidate := filepath.Join(dir, name)
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        matches = append(matches, candidate)
      }
    }
    if len(matches) > 1 {
      names := make([]string, 0, len(matches))
      for _, m := range matches {
        names = append(names, filepath.Base(m))
      }
      return "", fmt.Errorf("@ttsc/lint: multiple lint config files found in %s (%s); set \"configFile\" explicitly", dir, strings.Join(names, ", "))
    }
    if len(matches) == 1 {
      return matches[0], nil
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return "", nil
    }
    dir = parent
  }
}

// pluginConfigDirEnv mirrors driver.PluginConfigDirEnv from
// `packages/ttsc/driver`: the environment variable through which the ttsc
// launcher passes the project root that plugin config-file discovery and
// relative "configFile" resolution anchor at. It matters when the compiled
// tsconfig is a generated wrapper outside the project (e.g. @ttsc/unplugin's
// compiler-options overlay in the system temp directory) — the tsconfig
// directory then no longer identifies the project. The constant is inlined
// here instead of imported because @ttsc/lint deliberately avoids a
// dependency on the in-tree ttsc module (see host.go).
const pluginConfigDirEnv = "TTSC_PLUGIN_CONFIG_DIR"

// explicitPluginConfigDir returns the launcher-provided config anchor from
// pluginConfigDirEnv, resolved against cwd, or "" when the channel is unset.
func explicitPluginConfigDir(cwd string) string {
  dir := strings.TrimSpace(os.Getenv(pluginConfigDirEnv))
  if dir == "" {
    return ""
  }
  if !filepath.IsAbs(dir) && cwd != "" {
    dir = filepath.Join(cwd, dir)
  }
  return filepath.Clean(dir)
}

// resolveConfigFilePath resolves a user-supplied config path to an absolute
// path. Absolute paths are returned unchanged; relative paths are joined to the
// tsconfig directory (or cwd when no tsconfig is set).
func resolveConfigFilePath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(tsconfigBaseDir(cwd, tsconfigPath), configPath)
}

// discoveryConfigBaseDirs returns the ordered directories from which
// auto-discovery walks upward when no explicit config path is provided. The
// launcher's explicit project-root channel (pluginConfigDirEnv) is the single
// origin when set: it names the real project even when the tsconfig is a
// generated wrapper in a temp directory, and keeps the wrapper's temp-tree
// ancestry out of the walk. Otherwise the tsconfig directory comes first so
// that nested package configs are found relative to the tsconfig that
// triggered the lint run; the working directory follows as a fallback so a
// caller that points at an out-of-tree tsconfig still discovers the project's
// lint config instead of failing on the tsconfig dir's empty ancestry.
func discoveryConfigBaseDirs(cwd, tsconfigPath string) []string {
  if explicit := explicitPluginConfigDir(cwd); explicit != "" {
    return []string{explicit}
  }
  origins := make([]string, 0, 2)
  if tsconfigPath != "" {
    resolvedTsconfig := tsconfigPath
    if !filepath.IsAbs(resolvedTsconfig) {
      resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
    }
    origins = append(origins, filepath.Dir(resolvedTsconfig))
  }
  if cwd != "" && !containsPath(origins, cwd) {
    origins = append(origins, filepath.Clean(cwd))
  }
  return origins
}

// containsPath reports whether paths already holds candidate's cleaned spelling.
// Preserve distinct spellings even on Windows: directory case sensitivity and
// alias topology cannot be inferred from the operating system alone.
func containsPath(paths []string, candidate string) bool {
  cleaned := filepath.Clean(candidate)
  for _, existing := range paths {
    if existing == cleaned {
      return true
    }
  }
  return false
}

// tsconfigBaseDir returns the base directory for relative config paths
// supplied in the tsconfig plugin entry. The launcher's explicit project-root
// channel (pluginConfigDirEnv) wins when set — the tsconfig may be a
// generated wrapper in a temp directory that no longer identifies the
// project — otherwise the directory containing the tsconfig is used, falling
// back to cwd when tsconfigPath is empty.
func tsconfigBaseDir(cwd, tsconfigPath string) string {
  if explicit := explicitPluginConfigDir(cwd); explicit != "" {
    return explicit
  }
  if tsconfigPath == "" {
    return cwd
  }
  resolvedTsconfig := tsconfigPath
  if !filepath.IsAbs(resolvedTsconfig) {
    resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
  }
  return filepath.Dir(resolvedTsconfig)
}

// loadConfigFile loads and deserializes a lint config file at `location`.
// The file format is determined by extension: .json is parsed natively;
// .js/.cjs/.mjs run through a Node subprocess; .ts/.cts/.mts run through ttsx.
// The two subprocess-backed forms go through loadCachedConfigFile so that a
// monorepo build — which spawns one `ttsc` process per package — evaluates a
// shared lint config once instead of once per package.
func loadConfigFile(location string) (any, error) {
  evaluated, err := loadConfigFileEvaluation(location)
  return evaluated.value, err
}

type configDependencyFingerprint struct {
  Path           string  `json:"path"`
  Digest         string  `json:"digest"`
  IdentityStable bool    `json:"identityStable"`
  Kind           string  `json:"kind"`
  Realpath       *string `json:"realpath"`
  Scope          string  `json:"scope"`
}

const (
  configDependencyCache        = "cache"
  configDependencyWatch        = "watch"
  configDependencyFile         = "file"
  configDependencyDir          = "directory"
  configDependencyEntry        = "entry"
  configDependencyOptionalFile = "optional-file"
)

type evaluatedConfigFile struct {
  value                 any
  dependencies          []string
  dependencyDirectories []string
  dependencyDigests     []configDependencyFingerprint
  dependenciesTracked   bool
  // Private correlation only; cachedConfigEvaluation serializes none of it.
  traceInvocation *lintTraceInvocation
}

type cachedConfigEvaluation struct {
  Value               any                           `json:"value"`
  Dependencies        []configDependencyFingerprint `json:"dependencies"`
  DependenciesTracked bool                          `json:"dependenciesTracked"`
}

func loadConfigFileEvaluation(location string) (evaluatedConfigFile, error) {
  return loadConfigFileEvaluationWithin(location, filepath.Dir(location))
}

func loadConfigFileEvaluationWithin(
  location string,
  resolutionRoot string,
) (evaluatedConfigFile, error) {
  if strings.TrimSpace(resolutionRoot) == "" {
    resolutionRoot = filepath.Dir(location)
  }
  if absolute, err := filepath.Abs(resolutionRoot); err == nil {
    resolutionRoot = absolute
  }
  resolutionRoot = filepath.Clean(resolutionRoot)
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    return loadJSONConfigEvaluation(location)
  case ".js", ".cjs", ".mjs":
    return loadCachedConfigEvaluationForRoot(
      location,
      resolutionRoot,
      func(location string) (evaluatedConfigFile, error) {
        return loadScriptConfigEvaluationWithin(location, resolutionRoot)
      },
    )
  case ".ts", ".cts", ".mts":
    return loadCachedConfigEvaluationForRoot(
      location,
      resolutionRoot,
      func(location string) (evaluatedConfigFile, error) {
        return loadTypeScriptConfigEvaluationWithin(location, resolutionRoot)
      },
    )
  default:
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: unsupported config file extension %q for %s", ext, location)
  }
}

// configCacheVersion namespaces the on-disk config cache. Bump it whenever
// the cached shape or dependency interpretation changes, so entries written
// by an older @ttsc/lint binary are misses rather than silently reused.
// v8 rechecks recorded dependencies after evaluation. A recorded transient
// digest or path that differs from the final observation prevents caching;
// equal observations do not prove absence of intervening replacements.
// v9 invalidates module graphs whose identity and package-boundary decisions
// used lexical case folding instead of actual filesystem identity.
// v11 preserves rule option object-entry order through evaluation and disk reuse.
// v12 makes the JS contributor evaluator preserve typed-base project ownership.
const configCacheVersion = "v12"

// configEvalCache memoizes evaluated .ts/.js lint config objects for the
// lifetime of one process; the on-disk cache (configCacheDir) extends the
// same memoization across the separate `ttsc` processes a monorepo build
// spawns. Guarded by configEvalCacheMu.
var (
  configEvalCacheMu sync.Mutex
  configEvalCache   = map[string]cachedConfigEvaluation{}
)

// configCacheDir is the directory shared by this Go sidecar and the JS
// plugin factory (packages/lint/src/index.ts) for cached lint configs.
// Evaluating a .ts/.js config means spawning a ttsx/node subprocess; the
// cache keeps every `ttsc` invocation after the first from re-paying it.
func configCacheDir() string {
  return filepath.Join(os.TempDir(), "ttsc-lint-config-cache")
}

// configCacheDisabled reports whether the env opt-out is set — an escape
// hatch for configs whose behavior depends on state outside their local module
// graph, such as environment variables, network responses, or arbitrary file
// reads.
func configCacheDisabled() bool {
  return os.Getenv("TTSC_LINT_DISABLE_CONFIG_CACHE") != ""
}

// configCacheKey derives the cache key for a config file from a version
// tag, a namespace `kind`, the file's absolute path, and its exact
// contents. Content-addressing means an edited config invalidates cleanly
// with no clock-resolution race; the absolute path keeps two projects with
// byte-identical configs distinct; `kind` separates this sidecar's
// evaluated-config namespace from the JS factory's plugin-entry namespace.
func configCacheKey(kind, absPath string, content []byte) string {
  h := sha256.New()
  h.Write([]byte(configCacheVersion))
  h.Write([]byte{0})
  h.Write([]byte(kind))
  h.Write([]byte{0})
  h.Write([]byte(absPath))
  h.Write([]byte{0})
  h.Write(content)
  return hex.EncodeToString(h.Sum(nil))
}

// loadCachedConfigFile preserves the historical value-only test seam around
// the two-tier (in-process + on-disk) cache. Production executable-config
// loaders use loadCachedConfigEvaluation so their complete local module graph
// participates in validation. Errors are never cached: a failed evaluation
// re-runs next time.
func loadCachedConfigFile(location string, eval func(string) (any, error)) (any, error) {
  evaluated, err := loadCachedConfigEvaluationWithPolicy(
    location,
    func(location string) (evaluatedConfigFile, error) {
      value, err := eval(location)
      return evaluatedConfigFile{value: value}, err
    },
    false,
    "",
  )
  return evaluated.value, err
}

func loadCachedConfigEvaluation(
  location string,
  eval func(string) (evaluatedConfigFile, error),
) (evaluatedConfigFile, error) {
  return loadCachedConfigEvaluationWithPolicy(location, eval, true, "")
}

func loadCachedConfigEvaluationForRoot(
  location string,
  resolutionRoot string,
  eval func(string) (evaluatedConfigFile, error),
) (evaluatedConfigFile, error) {
  return loadCachedConfigEvaluationWithPolicy(
    location,
    eval,
    true,
    filepath.Clean(resolutionRoot),
  )
}

func loadCachedConfigEvaluationWithPolicy(
  location string,
  eval func(string) (evaluatedConfigFile, error),
  dependenciesRequired bool,
  cacheNamespace string,
) (evaluatedConfigFile, error) {
  if configCacheDisabled() {
    evaluated, err := eval(location)
    evaluated.traceInvocation.record("config-cache-outcome", map[string]any{
      "location": location, "outcome": "disabled", "success": err == nil,
      "dependencies": evaluated.dependencyDigests,
    })
    return evaluated, err
  }
  content, err := os.ReadFile(location)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, err)
  }
  abs := location
  if resolved, absErr := filepath.Abs(location); absErr == nil {
    abs = resolved
  }
  kind := "config-value"
  if dependenciesRequired {
    kind = "config-graph"
  }
  if cacheNamespace != "" {
    kind += "\x00" + cacheNamespace
  }
  key := configCacheKey(kind, abs, content)

  configEvalCacheMu.Lock()
  cached, ok := configEvalCache[key]
  configEvalCacheMu.Unlock()
  if ok &&
    cached.DependenciesTracked == dependenciesRequired &&
    cachedConfigEvaluationIsCurrent(cached) {
    newLintTraceInvocation().record("config-cache-outcome", map[string]any{
      "location": location, "key": key, "outcome": "memory-hit",
      "dependencies": cached.Dependencies, "dependenciesTracked": cached.DependenciesTracked,
    })
    return evaluatedConfigFileFromCache(cached), nil
  }
  if disk, hit := readConfigDiskCache(key); hit &&
    disk.DependenciesTracked == dependenciesRequired &&
    cachedConfigEvaluationIsCurrent(disk) {
    configEvalCacheMu.Lock()
    configEvalCache[key] = disk
    configEvalCacheMu.Unlock()
    newLintTraceInvocation().record("config-cache-outcome", map[string]any{
      "location": location, "key": key, "outcome": "disk-hit",
      "dependencies": disk.Dependencies, "dependenciesTracked": disk.DependenciesTracked,
    })
    return evaluatedConfigFileFromCache(disk), nil
  }

  var evaluated evaluatedConfigFile
  for attempt := 0; attempt < 3; attempt++ {
    evaluated, err = eval(location)
    if err != nil {
      evaluated.traceInvocation.record("config-cache-outcome", map[string]any{
        "location": location, "key": key, "attempt": attempt + 1,
        "outcome": "evaluation-error", "error": err.Error(),
      })
      return evaluatedConfigFile{}, err
    }
    if evaluated.dependenciesTracked != dependenciesRequired {
      evaluated.traceInvocation.record("config-cache-outcome", map[string]any{
        "location": location, "key": key, "attempt": attempt + 1,
        "outcome": "tracking-policy-mismatch", "dependenciesTracked": evaluated.dependenciesTracked,
        "dependenciesRequired": dependenciesRequired,
      })
      return evaluatedConfigFile{}, fmt.Errorf(
        "@ttsc/lint: config evaluator for %s returned dependenciesTracked=%t, want %t",
        location,
        evaluated.dependenciesTracked,
        dependenciesRequired,
      )
    }
    if (!evaluated.dependenciesTracked ||
      len(evaluated.dependencyDigests) != 0) &&
      configDependencyDigestsAreCurrent(evaluated.dependencyDigests) {
      cached = cachedConfigEvaluation{
        Value:               evaluated.value,
        Dependencies:        append([]configDependencyFingerprint(nil), evaluated.dependencyDigests...),
        DependenciesTracked: evaluated.dependenciesTracked,
      }
      configEvalCacheMu.Lock()
      configEvalCache[key] = cached
      configEvalCacheMu.Unlock()
      writeConfigDiskCache(key, cached)
      evaluated.traceInvocation.record("config-cache-outcome", map[string]any{
        "location": location, "key": key, "attempt": attempt + 1,
        "outcome": "memory-published", "diskWriteAttempted": true,
        "dependencies": cached.Dependencies, "dependenciesTracked": cached.DependenciesTracked,
      })
      return evaluated, nil
    }
    evaluated.traceInvocation.record("config-cache-outcome", map[string]any{
      "location": location, "key": key, "attempt": attempt + 1,
      "outcome": "not-current", "returnedUncached": attempt == 2,
      "dependencies": evaluated.dependencyDigests, "dependenciesTracked": evaluated.dependenciesTracked,
    })
  }
  return evaluated, nil
}

// readConfigDiskCache returns the cached config object for `key`, or
// (nil, false) on any miss — a missing file, an unreadable file, or
// content that no longer parses as a config object. Every failure is a
// soft miss: the caller re-evaluates rather than surfacing a cache fault.
func evaluatedConfigFileFromCache(cached cachedConfigEvaluation) evaluatedConfigFile {
  dependencies := make([]string, 0, len(cached.Dependencies))
  directories := make([]string, 0, len(cached.Dependencies))
  for _, dependency := range cached.Dependencies {
    if dependency.Scope == configDependencyWatch {
      if dependency.Kind == configDependencyDir {
        directories = append(directories, dependency.Path)
      } else {
        dependencies = append(dependencies, dependency.Path)
      }
    }
  }
  return evaluatedConfigFile{
    value:                 cached.Value,
    dependencies:          dependencies,
    dependencyDirectories: directories,
    dependencyDigests:     append([]configDependencyFingerprint(nil), cached.Dependencies...),
    dependenciesTracked:   cached.DependenciesTracked,
  }
}

func configDependencyDigestsAreCurrent(
  dependencies []configDependencyFingerprint,
) bool {
  for _, dependency := range dependencies {
    if !dependency.IdentityStable ||
      !sameConfigDependencyRealpath(dependency.Realpath, configDependencyRealpath(dependency.Path)) {
      return false
    }
    digest, err := configDependencyDigest(dependency)
    if err != nil {
      return false
    }
    if digest != dependency.Digest {
      return false
    }
  }
  return true
}

func configDependencyRealpath(location string) *string {
  absolute, err := filepath.Abs(location)
  if err != nil {
    return nil
  }
  resolved := realProjectPath(absolute)
  if _, statErr := os.Stat(resolved); statErr != nil {
    return nil
  }
  resolved = filepath.Clean(resolved)
  return &resolved
}

func configDependencyDigest(
  dependency configDependencyFingerprint,
) (string, error) {
  if dependency.Kind == configDependencyDir {
    entries, err := os.ReadDir(dependency.Path)
    if err != nil {
      return "", err
    }
    h := sha256.New()
    for index, entry := range entries {
      kind := "other"
      info, err := entry.Info()
      if err != nil {
        return "", err
      }
      target := ""
      entryPath := filepath.Join(dependency.Path, entry.Name())
      if linked, linkErr := os.Readlink(entryPath); linkErr == nil {
        // Node reports Windows junctions as symbolic links even though Go's
        // FileMode does not carry ModeSymlink for the same reparse point. The
        // loader writes Node's classification, so validation must ask the link
        // itself before falling back to FileMode or an unchanged junction will
        // make every cache lookup miss.
        kind = "symlink"
        target = linked
      } else {
        switch {
        case info.Mode()&os.ModeSymlink != 0:
          kind = "symlink"
        case info.IsDir():
          kind = "directory"
        case info.Mode().IsRegular():
          kind = "file"
        }
      }
      if kind == "symlink" && target == "" {
        target, err = os.Readlink(entryPath)
        if err != nil {
          target = "<unreadable>"
        }
      }
      h.Write([]byte(entry.Name()))
      h.Write([]byte{0})
      h.Write([]byte(kind))
      h.Write([]byte{0})
      h.Write([]byte(target))
      if index+1 != len(entries) {
        h.Write([]byte{0})
      }
    }
    return hex.EncodeToString(h.Sum(nil)), nil
  }
  // The `entry` digest observes one path's own existence and link topology.
  // It must reproduce the loader script's encoding byte for byte, because the
  // script writes the fingerprint and this function is what later decides the
  // cached evaluation is still current.
  if dependency.Kind == configDependencyEntry {
    if target, err := os.Readlink(dependency.Path); err == nil {
      // Keep the entry form in the same Windows-junction vocabulary as the
      // directory form above and the Node loader that produced the digest.
      h := sha256.New()
      h.Write([]byte("symlink\x00"))
      h.Write([]byte(target))
      return hex.EncodeToString(h.Sum(nil)), nil
    }
    info, err := os.Lstat(dependency.Path)
    if err != nil {
      digest := sha256.Sum256([]byte("missing\x00"))
      return hex.EncodeToString(digest[:]), nil
    }
    if info.Mode()&os.ModeSymlink != 0 {
      target, err := os.Readlink(dependency.Path)
      if err != nil {
        target = "<unreadable>"
      }
      h := sha256.New()
      h.Write([]byte("symlink\x00"))
      h.Write([]byte(target))
      return hex.EncodeToString(h.Sum(nil)), nil
    }
    kind := "other"
    switch {
    case info.IsDir():
      kind = "directory"
    case info.Mode().IsRegular():
      kind = "file"
    }
    digest := sha256.Sum256([]byte(kind + "\x00"))
    return hex.EncodeToString(digest[:]), nil
  }
  if dependency.Kind == configDependencyOptionalFile {
    info, err := os.Stat(dependency.Path)
    if err != nil || !info.Mode().IsRegular() {
      digest := sha256.Sum256([]byte("missing\x00"))
      return hex.EncodeToString(digest[:]), nil
    }
    body, err := os.ReadFile(dependency.Path)
    if err != nil {
      digest := sha256.Sum256([]byte("missing\x00"))
      return hex.EncodeToString(digest[:]), nil
    }
    h := sha256.New()
    h.Write([]byte("file\x00"))
    h.Write(body)
    return hex.EncodeToString(h.Sum(nil)), nil
  }
  body, err := os.ReadFile(dependency.Path)
  if err != nil {
    return "", err
  }
  digest := sha256.Sum256(body)
  return hex.EncodeToString(digest[:]), nil
}

func cachedConfigEvaluationIsCurrent(cached cachedConfigEvaluation) bool {
  if !cached.DependenciesTracked {
    return len(cached.Dependencies) == 0
  }
  normalized, ok := normalizeConfigDependencyFingerprints(cached.Dependencies)
  return ok && configDependencyDigestsAreCurrent(normalized)
}

func readConfigDiskCache(key string) (cachedConfigEvaluation, bool) {
  body, err := os.ReadFile(filepath.Join(configCacheDir(), key+".json"))
  if err != nil {
    return cachedConfigEvaluation{}, false
  }
  var envelope struct {
    Value               json.RawMessage               `json:"value"`
    Dependencies        []configDependencyFingerprint `json:"dependencies"`
    DependenciesTracked bool                          `json:"dependenciesTracked"`
  }
  if err := json.Unmarshal(body, &envelope); err != nil {
    return cachedConfigEvaluation{}, false
  }
  value, err := decodeConfigJSON(envelope.Value)
  if err != nil {
    return cachedConfigEvaluation{}, false
  }
  cached := cachedConfigEvaluation{
    Value:               value,
    Dependencies:        envelope.Dependencies,
    DependenciesTracked: envelope.DependenciesTracked,
  }
  if !isConfigObject(cached.Value) {
    return cachedConfigEvaluation{}, false
  }
  if cached.DependenciesTracked {
    normalized, ok := normalizeConfigDependencyFingerprints(cached.Dependencies)
    if !ok {
      return cachedConfigEvaluation{}, false
    }
    cached.Dependencies = normalized
  } else if len(cached.Dependencies) != 0 {
    return cachedConfigEvaluation{}, false
  }
  return cached, true
}

// writeConfigDiskCache stores `value` under `key`. It is best-effort: a
// failure to create the directory or write the file leaves the cache cold
// (the next run re-evaluates) rather than failing the lint run. The write
// goes through a temp file + rename so a concurrent reader in a sibling
// `ttsc` process never observes a half-written entry.
func writeConfigDiskCache(key string, cached cachedConfigEvaluation) {
  body, err := json.Marshal(cached)
  if err != nil {
    return
  }
  dir := configCacheDir()
  if err := os.MkdirAll(dir, 0o755); err != nil {
    return
  }
  tmp, err := os.CreateTemp(dir, key+".*.tmp")
  if err != nil {
    return
  }
  tmpName := tmp.Name()
  if _, err := tmp.Write(body); err != nil {
    tmp.Close()
    os.Remove(tmpName)
    return
  }
  if err := tmp.Close(); err != nil {
    os.Remove(tmpName)
    return
  }
  if err := os.Rename(tmpName, filepath.Join(dir, key+".json")); err != nil {
    os.Remove(tmpName)
  }
}

// loadJSONConfigFile reads and JSON-parses a lint config file. A leading UTF-8
// BOM is stripped before parsing so files saved by Windows editors are accepted.
func loadJSONConfigFile(location string) (any, error) {
  evaluated, err := loadJSONConfigEvaluation(location)
  return evaluated.value, err
}

// loadJSONConfigEvaluation retains the raw bytes actually decoded by this call
// beside its native identity. The BOM affects the byte witness even though JSON
// decoding strips it. Read failures never produce a complete config proof.
func loadJSONConfigEvaluation(location string) (evaluatedConfigFile, error) {
  beforePhysical := configDependencyRealpath(location)
  file, err := os.Open(location)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, err)
  }
  before, beforeErr := file.Stat()
  body, readErr := io.ReadAll(file)
  after, afterErr := file.Stat()
  closeErr := file.Close()
  if readErr != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, readErr)
  }
  if closeErr != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: close config file %s: %w", location, closeErr)
  }
  digest := sha256.Sum256(body)
  selected, selectedErr := os.Stat(location)
  physical := configDependencyRealpath(location)
  stable := beforeErr == nil && afterErr == nil && selectedErr == nil && os.SameFile(before, after) && os.SameFile(after, selected) &&
    before.Mode() == after.Mode() && before.Size() == after.Size() && before.ModTime().Equal(after.ModTime()) &&
    sameConfigDependencyRealpath(beforePhysical, physical)
  body = bytes.TrimPrefix(body, []byte{0xEF, 0xBB, 0xBF})
  out, err := decodeConfigJSON(body)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: parse config file %s: %w", location, err)
  }
  if !isConfigObject(out) {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: config file %s must export an ITtscLintConfig object", location)
  }
  return evaluatedConfigFile{value: out, dependencies: []string{location}, dependenciesTracked: true,
    dependencyDigests: []configDependencyFingerprint{{Path: filepath.Clean(location), Digest: hex.EncodeToString(digest[:]), IdentityStable: stable, Kind: configDependencyFile, Realpath: physical, Scope: configDependencyWatch}}}, nil
}

// serializableConfigKeys is the single source of truth for the ITtscLintConfig
// keys that survive the JSON round trip from a config-loader subprocess back to
// the Go sidecar. Both the .js/.cjs/.mjs loader (loadScriptConfigFile) and the
// .ts/.cts/.mts loader (typeScriptConfigLoaderSource) splice this list into the
// `toSerializableConfig` key whitelist of their generated scripts, so the set
// of copied keys is defined here once rather than duplicated per loader.
var serializableConfigKeys = []string{"files", "ignores", "extends", "plugins", "rules", "format"}

// serializableConfigKeysLiteral renders serializableConfigKeys as a
// JS/TS array literal (e.g. `"files", "ignores", ...`) for splicing into the
// generated loader scripts' `toSerializableConfig` whitelist.
func serializableConfigKeysLiteral() string {
  quoted := make([]string, len(serializableConfigKeys))
  for i, key := range serializableConfigKeys {
    quoted[i] = fmt.Sprintf("%q", key)
  }
  return strings.Join(quoted, ", ")
}

// runConfigLoaderCommand runs a prepared config-loader subprocess (`cmd`),
// then turns its result into a parsed config object. It owns the shared tail
// of both subprocess-backed loaders: discarding user stdout, streaming user
// stderr through, reading the private result file, JSON-parsing its envelope,
// and rejecting a non-object result. `location` is the config file
// path for error messages; `label` is the human-readable subject (e.g. "config
// file" or "TypeScript config file") spliced into the load/parse error
// prefixes so each loader keeps its own wording.
// Opt-in observation retains the exact bytes read and the actual normalized
// dependencies under one invocation. It never supplies a replacement result.
func runConfigLoaderCommand(
  cmd *exec.Cmd,
  location string,
  label string,
  outputPath string,
) (evaluated evaluatedConfigFile, resultErr error) {
  // The child's stderr is human output and goes straight to this process's
  // stderr as it is written. Collecting it only to replay it afterwards is what
  // made a long evaluation print nothing at all, and what would make a loud one
  // grow this process's memory without bound.
  cmd.Stdout = io.Discard
  cmd.Stderr = os.Stderr
  observation := newLintTraceInvocation()
  var rawCapture map[string]any
  readOutcome := "not-read"
  normalizationAttempted := false
  normalizationAccepted := false
  if observation != nil {
    defer func() {
      data := map[string]any{
        "location":               location,
        "label":                  label,
        "raw":                    rawCapture,
        "readOutcome":            readOutcome,
        "normalizationAttempted": normalizationAttempted,
        "normalizationAccepted":  normalizationAccepted,
        "dependencies":           evaluated.dependencyDigests,
        "dependenciesTracked":    evaluated.dependenciesTracked,
        "success":                resultErr == nil,
      }
      if resultErr != nil {
        data["error"] = resultErr.Error()
      }
      evaluated.traceInvocation = observation
      observation.record("config-loader-result", data)
    }()
  }
  var lower time.Time
  if observation != nil {
    lower = time.Now().UTC()
    observation.record("process-attempt", map[string]any{
      "pid": 0, "argv": cmd.Args, "cwd": cmd.Dir, "cwdInherited": cmd.Dir == "",
      "startLowerBound": lower.Format(time.RFC3339Nano), "owner": "lint-config-loader",
    })
  }
  err := cmd.Run()
  if observation != nil {
    upper := time.Now().UTC()
    pid := 0
    if cmd.Process != nil {
      pid = cmd.Process.Pid
    }
    data := map[string]any{
      "pid": pid, "started": pid > 0, "exitObserved": cmd.ProcessState != nil,
      "argv": cmd.Args, "cwd": cmd.Dir, "cwdInherited": cmd.Dir == "",
      "startLowerBound": lower.Format(time.RFC3339Nano),
      "startUpperBound": upper.Format(time.RFC3339Nano), "owner": "lint-config-loader",
      "method": "Run", "success": err == nil,
    }
    if cmd.ProcessState != nil {
      data["exitCode"] = cmd.ProcessState.ExitCode()
      data["stateSuccess"] = cmd.ProcessState.Success()
      data["state"] = cmd.ProcessState.String()
    }
    if err != nil {
      data["error"] = err.Error()
    }
    observation.record("process-result", data)
  }
  if err != nil {
    // The loader's stack already reached the user's stderr as it was written.
    // What it could not put there is a reason a caller can act on, so that
    // arrives through the result file instead.
    if reason := loaderFailureReason(outputPath, func(raw []byte, readErr error) {
      if observation != nil {
        readOutcome = "complete"
        if readErr != nil {
          readOutcome = "IO-failed"
        }
        rawCapture = observation.capture("loader-raw", raw)
      }
    }); reason != "" {
      return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: load %s %s: %s", label, location, reason)
    }
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: load %s %s: %w", label, location, err)
  }
  output, err := os.ReadFile(outputPath)
  if observation != nil {
    readOutcome = "complete"
    if err != nil {
      readOutcome = "IO-failed"
    }
    rawCapture = observation.capture("loader-raw", output)
  }
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: read %s %s result: %w", label, location, err)
  }
  var envelope struct {
    Dependencies []configDependencyFingerprint `json:"dependencies"`
    Value        json.RawMessage               `json:"value"`
  }
  if err := json.Unmarshal(output, &envelope); err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: parse %s %s output: %w", label, location, err)
  }
  var value any
  if len(envelope.Value) != 0 {
    value, err = decodeConfigJSON(envelope.Value)
    if err != nil {
      return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: parse %s %s output: %w", label, location, err)
    }
  }
  if !isConfigObject(value) {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: config file %s must export an ITtscLintConfig object", location)
  }
  normalized, ok := normalizeConfigDependencyFingerprints(envelope.Dependencies)
  normalizationAttempted = true
  normalizationAccepted = ok
  if !ok {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: %s %s returned malformed dependency fingerprints", label, location)
  }
  dependencies := make([]string, 0, len(normalized))
  directories := make([]string, 0, len(normalized))
  for _, dependency := range normalized {
    if dependency.Scope == configDependencyWatch {
      if dependency.Kind == configDependencyDir {
        directories = append(directories, dependency.Path)
      } else {
        dependencies = append(dependencies, dependency.Path)
      }
    }
  }
  return evaluatedConfigFile{
    value:                 value,
    dependencies:          dependencies,
    dependencyDirectories: directories,
    dependencyDigests:     normalized,
    dependenciesTracked:   true,
  }, nil
}

func normalizeConfigDependencyFingerprints(
  input []configDependencyFingerprint,
) ([]configDependencyFingerprint, bool) {
  if len(input) == 0 {
    return nil, false
  }
  seen := make(map[string]configDependencyFingerprint, len(input))
  normalized := make([]configDependencyFingerprint, 0, len(input))
  for _, dependency := range input {
    if strings.TrimSpace(dependency.Path) == "" ||
      !filepath.IsAbs(dependency.Path) ||
      (dependency.Realpath != nil && !filepath.IsAbs(*dependency.Realpath)) ||
      (dependency.Digest != "" && len(dependency.Digest) != sha256.Size*2) ||
      strings.ToLower(dependency.Digest) != dependency.Digest ||
      (dependency.Kind != configDependencyFile &&
        dependency.Kind != configDependencyDir &&
        dependency.Kind != configDependencyEntry &&
        dependency.Kind != configDependencyOptionalFile) ||
      (dependency.Scope != configDependencyCache &&
        dependency.Scope != configDependencyWatch) {
      return nil, false
    }
    if dependency.Digest != "" {
      if _, err := hex.DecodeString(dependency.Digest); err != nil {
        return nil, false
      }
    }
    absolute := filepath.Clean(dependency.Path)
    key := dependency.Kind + "\x00" + absolute
    if previous, exists := seen[key]; exists {
      if previous.Digest != dependency.Digest ||
        previous.IdentityStable != dependency.IdentityStable ||
        previous.Kind != dependency.Kind ||
        !sameConfigDependencyRealpath(previous.Realpath, dependency.Realpath) ||
        previous.Scope != dependency.Scope {
        return nil, false
      }
      continue
    }
    fingerprint := configDependencyFingerprint{
      Path:           absolute,
      Digest:         dependency.Digest,
      IdentityStable: dependency.IdentityStable,
      Kind:           dependency.Kind,
      Realpath:       cloneConfigDependencyRealpath(dependency.Realpath),
      Scope:          dependency.Scope,
    }
    seen[key] = fingerprint
    normalized = append(normalized, fingerprint)
  }
  sort.Slice(normalized, func(left, right int) bool {
    return normalized[left].Path < normalized[right].Path
  })
  return normalized, true
}

func cloneConfigDependencyRealpath(value *string) *string {
  if value == nil {
    return nil
  }
  cloned := filepath.Clean(*value)
  return &cloned
}

func sameConfigDependencyRealpath(left, right *string) bool {
  if left == nil || right == nil {
    return left == nil && right == nil
  }
  return filepath.Clean(*left) == filepath.Clean(*right)
}

// loadScriptConfigFile evaluates a .js/.cjs/.mjs config file by running a
// Node subprocess that dynamic-imports the file, resolves the exported config
// through the same 8-hop default/config normalization used by the TS loader,
// and serializes the result into a private result file.
func loadScriptConfigFile(location string) (any, error) {
  evaluated, err := loadScriptConfigEvaluation(location)
  return evaluated.value, err
}

func loadScriptConfigEvaluation(location string) (evaluatedConfigFile, error) {
  return loadScriptConfigEvaluationWithin(location, filepath.Dir(location))
}

func loadScriptConfigEvaluationWithin(
  location string,
  resolutionRoot string,
) (evaluatedConfigFile, error) {
  tempDir, err := os.MkdirTemp("", "ttsc-lint-script-config-")
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: create script config result directory: %w", err)
  }
  defer os.RemoveAll(tempDir)
  outputPath := filepath.Join(tempDir, "result.json")
  script := scriptConfigLoaderSource()
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()
  cmd := exec.CommandContext(
    ctx,
    node,
    "--input-type=commonjs",
    "-",
    location,
    outputPath,
    resolutionRoot,
  )
  // Windows limits the whole process command line to roughly 32 KiB. The
  // dependency-tracking loader is intentionally larger than that, so keep only
  // an explicit CommonJS stdin program and remove Node's stdin sentinel before
  // the loader runs. This preserves the historical process.argv layout seen by
  // both the loader and the imported user config without using string eval.
  cmd.Stdin = strings.NewReader("process.argv.splice(1, 1);\n" + script)
  return runConfigLoaderCommand(cmd, location, "config file", outputPath)
}

// scriptConfigLoaderSource returns the CommonJS source of the loader script
// Node executes to evaluate a .js/.cjs/.mjs lint config file. It is a named
// function for the same reason as typeScriptConfigLoaderSource: the source is
// a fmt.Sprintf format string, so every literal percent sign inside it must be
// doubled, and only a callable generator lets a regression prove the emitted
// script carries no formatting artifact.
func scriptConfigLoaderSource() string {
  return fmt.Sprintf(`
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { registerHooks } = require("node:module");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const CONFIG_KEYS = new Set([%s]);
const configUrl = pathToFileURL(process.argv[1]).href;
const outputPath = process.argv[2];
const resolutionRoot = path.resolve(process.argv[3]);
const dependencies = new Map();
const graphNodes = new Map();
const graphEdges = [];
const configLocation = fileURLToPath(configUrl);
// Every spelling of this config the module system might key an edge under.
//
// Which one it uses is not knowable from here, and guessing has failed in both
// directions. A path handed in by another producer can be escaped by a rule
// Node does not share. Node respells a resolved file module through its real
// path unless "--preserve-symlinks" is set, so a config reached through a
// symlinked directory is keyed by its target. And a Windows 8.3 short name is
// not a symlink: fs.realpathSync expands it, the module resolver does not, so
// asking the volume there produces a spelling no edge carries.
//
// A seed that names a URL no edge was keyed under sits on a node with no
// outgoing edges, the walk ends immediately, and every dependency recorded
// after the first import is demoted from watch to cache. That failure is
// silent: the build still succeeds and simply stops reacting. Seeding every
// spelling costs one extra queue entry and cannot be wrong.
const configUrlSpellings = [
  ...new Set([
    configUrl,
    pathToFileURL(configLocation).href,
    pathToFileURL(realConfigLocation()).href,
  ]),
];
for (const spelling of configUrlSpellings) {
  graphNodes.set(spelling, configLocation);
}
recordDependency(
  "file",
  configLocation,
  createHash("sha256").update(fs.readFileSync(configLocation)).digest("hex"),
  configUrlSpellings,
);
recordPackageManifests(configLocation, configUrlSpellings);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (typeof resolved.url !== "string" || !resolved.url.startsWith("file:")) {
      return resolved;
    }
    const url = new URL(resolved.url).href;
    const parent = context.parentURL && new URL(context.parentURL).href;
    const location = fileURLToPath(url);
    // The entry is recognized by what was asked for, not only by what came
    // back. A module URL is assigned by whoever loaded it: a compiling loader
    // can serve the config from its emitted output, and a platform can hand
    // back a different spelling of the same file. Either way the URL bears no
    // resemblance to the one this process was given, so the config's own
    // imports would be rejected here — their parent is a URL no node was
    // recorded under — and the graph would collapse to the records made before
    // the first import. The request itself is unambiguous, so it decides.
    const entry =
      specifier === configUrl ||
      url === configUrl ||
      samePhysicalPath(location, configLocation);
    if (!entry && (parent === undefined || !graphNodes.has(parent))) {
      return resolved;
    }
    graphNodes.set(url, location);
    if (parent !== undefined) {
      graphEdges.push({
        child: url,
        packageBoundary:
          pathHasNodeModules(location) && !isLocalModuleSpecifier(specifier),
        parent,
      });
      recordResolutionTopology(
        specifier,
        parent,
        url,
        location,
        context.conditions,
      );
    }
    try {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        [url],
      );
    } catch {
      recordDependency("file", location, "", [url]);
    }
    return resolved;
  },
});

(async () => {
  try {
    const mod = await import(configUrl);
    const value = await resolveConfig(mod, true);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("config file must export an ITtscLintConfig object");
    }
    fs.writeFileSync(outputPath, JSON.stringify({
      dependencies: finalizeDependencies(),
      value: toSerializableConfig(value),
    }), "utf8");
  } finally {
    hooks.deregister();
  }
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  // The stack above is for the reader. This is for the caller: the parent reads
  // the result file either way, so a failure reason travels as data rather than
  // as text scraped back out of a captured stream.
  try {
    fs.writeFileSync(outputPath, JSON.stringify({ __ttscLoaderError: error && error.message ? String(error.message) : String(error) }), "utf8");
  } catch {}
  process.exit(1);
});

async function resolveConfig(value, allowNamedConfig) {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (typeof current === "function") {
      current = await current();
      allowNamedConfig = false;
      continue;
    }
    if (current !== null && typeof current === "object" && !Array.isArray(current)) {
      if (Object.prototype.hasOwnProperty.call(current, "default")) {
        const defaultValue = current.default;
        if (isModuleNamespace(current) || !hasConfigKey(current)) {
          current = defaultValue;
          allowNamedConfig = false;
          continue;
        }
        const normalizedDefault = await resolveConfig(defaultValue, false);
        if (normalizedDefault !== null && typeof normalizedDefault === "object" && !Array.isArray(normalizedDefault)) {
          current = mergeConfigObjects(normalizedDefault, current);
          allowNamedConfig = false;
          continue;
        }
      }
      if (allowNamedConfig && Object.prototype.hasOwnProperty.call(current, "config")) {
        current = current.config;
        allowNamedConfig = false;
        continue;
      }
    }
    break;
  }
  return current;
}

function isModuleNamespace(value) {
  return Object.prototype.toString.call(value) === "[object Module]";
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function missingPathError(error) {
  return error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

function dependencyMetadataSignature(location) {
  const requested = path.resolve(location);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try { target = fs.statSync(current, { bigint: true }); }
        catch { return undefined; }
      }
      return [path.relative(current, requested), link.dev, link.ino, link.mode, link.size, link.mtimeNs, link.ctimeNs, target.dev, target.ino, target.mode, target.size, target.mtimeNs, target.ctimeNs].join(":");
    } catch (error) {
      if (!missingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function currentDependencyDigest(kind, location) {
  try {
    if (kind === "directory") return directoryDigest(location);
    if (kind === "entry") return entryDigest(location);
    if (kind === "optional-file") return optionalFileDigest(location);
    return createHash("sha256").update(fs.readFileSync(location)).digest("hex");
  } catch {
    return "";
  }
}

function recordDependency(kind, location, digest, owners) {
  const key = kind + "\0" + location;
  const previous = dependencies.get(key);
  const mergedOwners = previous ? previous.owners : new Set();
  for (const owner of owners) mergedOwners.add(owner);
  const beforeSignature = dependencyMetadataSignature(location);
  const observedDigest = currentDependencyDigest(kind, location);
  const realpath = dependencyRealpath(location);
  const afterSignature = dependencyMetadataSignature(location);
  const identityStable =
    (!previous || previous.identityStable) &&
    beforeSignature !== undefined &&
    afterSignature !== undefined &&
    beforeSignature === afterSignature &&
    digest === observedDigest &&
    (!previous || previous.realpath === realpath) &&
    (!previous || previous.signature === afterSignature);
  dependencies.set(key, {
    digest: !identityStable || (previous && previous.digest !== digest) ? "" : digest,
    identityStable,
    kind,
    owners: mergedOwners,
    path: location,
    realpath,
    signature: afterSignature,
  });
}

function dependencyRealpath(location) {
  try {
    return realPath(location);
  } catch {
    return null;
  }
}

function isLocalModuleSpecifier(specifier) {
  return specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(specifier);
}

function pathHasNodeModules(location) {
  return location.replaceAll("\\", "/").split("/").includes("node_modules");
}

function recordResolutionTopology(
  specifier,
  parentUrl,
  childUrl,
  childLocation,
  conditions,
) {
  const owners = [parentUrl, childUrl];
  const parentLocation = graphNodes.get(parentUrl);
  if (parentLocation !== undefined && isLocalModuleSpecifier(specifier)) {
    recordDirectoryDependency(path.dirname(parentLocation), owners);
  }
  recordDirectoryDependency(path.dirname(childLocation), owners);
  recordPackageManifests(childLocation, owners);
  if (parentLocation !== undefined && !isLocalModuleSpecifier(specifier)) {
    recordNodeModulesSearchDirectories(
      parentLocation,
      specifier,
      childLocation,
      owners,
      conditions,
    );
  }
}

function recordDirectoryDependency(location, owners) {
  try {
    recordDependency("directory", location, directoryDigest(location), owners);
  } catch {
    recordDependency("directory", location, "", owners);
  }
}

// Observe one path's own existence and link topology instead of enumerating the
// directory that contains it. A resolution trace passes through ancestors it
// does not own -- /var on macOS is a symlink whose parent is the filesystem
// root -- and digesting that parent both reaches outside the project boundary
// and reads the whole directory to learn one entry's state.
// A path candidate is observed through the directory that would own a
// competing resolution, so a sibling winning extension resolution still
// invalidates. That reasoning is what the parent digest is for and it stays.
//
// It does not reach the filesystem root. The root owns no candidate this trace
// could pick, and a resolution path routinely passes through an ancestor
// directly beneath it -- /var on macOS is a symlink whose parent is the root --
// so digesting the parent there enumerates the entire filesystem root on every
// config load, outside the project boundary. Record that one ancestor instead.
function recordAncestorDependency(parent, entry, root, owners) {
  if (parent === root) recordEntryDependency(entry, owners);
  else recordDirectoryDependency(parent, owners);
}

function recordEntryDependency(location, owners) {
  recordDependency("entry", location, entryDigest(location), owners);
}

function entryDigest(location) {
  let entry;
  try {
    entry = fs.lstatSync(location);
  } catch {
    return createHash("sha256").update("missing\0").digest("hex");
  }
  if (entry.isSymbolicLink()) {
    let target;
    try {
      target = fs.readlinkSync(location, { encoding: "buffer" });
    } catch {
      target = Buffer.from("<unreadable>");
    }
    return createHash("sha256")
      .update(Buffer.concat([Buffer.from("symlink\0"), target]))
      .digest("hex");
  }
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : "other";
  return createHash("sha256").update(kind + "\0").digest("hex");
}

function directoryDigest(location) {
  const entries = [];
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = Buffer.from(
            fs.readlinkSync(path.join(location, entry.name)),
            "utf8",
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(Buffer.from(entry.name), entry, target));
    }
  } else {
    for (const entry of fs.readdirSync(
      location,
      { encoding: "buffer", withFileTypes: true },
    )) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = fs.readlinkSync(
            Buffer.concat([
              Buffer.from(location),
              Buffer.from(path.sep),
              entry.name,
            ]),
            { encoding: "buffer" },
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(entry.name, entry, target));
    }
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function directoryDigestRecord(name, entry, target) {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

function optionalFileDigest(location) {
  try {
    if (fs.statSync(location).isFile()) {
      return createHash("sha256")
        .update(Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]))
        .digest("hex");
    }
  } catch {
  }
  return createHash("sha256").update("missing\0").digest("hex");
}

function recordOptionalFileDependency(location, owners) {
  try {
    if (fs.statSync(location).isFile()) {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        owners,
      );
      return true;
    }
  } catch {
  }
  recordDependency("optional-file", location, optionalFileDigest(location), owners);
  return false;
}

function recordPackageManifests(location, owners) {
  let current = path.dirname(location);
  while (true) {
    const manifest = path.join(current, "package.json");
    if (recordOptionalFileDependency(manifest, owners)) return;
    const parent = path.dirname(current);
    if (parent === current || path.basename(current) === "node_modules") return;
    current = parent;
  }
}

function recordNodeModulesSearchDirectories(
  parentLocation,
  specifier,
  childLocation,
  owners,
  conditions,
) {
  const packageName = modulePackageName(specifier);
  const scope =
    specifier.startsWith("@") && specifier.includes("/")
      ? specifier.slice(0, specifier.indexOf("/"))
      : undefined;
  let current = path.dirname(parentLocation);
  while (true) {
    recordDirectoryDependency(current, owners);
    const modules = path.join(current, "node_modules");
    try {
      if (fs.statSync(modules).isDirectory()) {
        recordDirectoryDependency(modules, owners);
        if (scope !== undefined) {
          const scoped = path.join(modules, scope);
          try {
            if (fs.statSync(scoped).isDirectory()) {
              recordDirectoryDependency(scoped, owners);
            }
          } catch {
          }
        }
        if (packageName !== undefined) {
          const selected = recordPackageCandidateTopology(
            modules,
            packageName,
            specifier,
            childLocation,
            owners,
            conditions,
          );
          if (
            selected ||
            resolvedPackageContains(modules, packageName, childLocation)
          ) {
            return;
          }
        }
      }
    } catch {
    }
    if (
      packageName === undefined &&
      samePhysicalPath(current, resolutionRoot)
    ) {
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function recordPackageCandidateTopology(
  modules,
  packageName,
  specifier,
  childLocation,
  owners,
  conditions,
) {
  const packageRoot = path.join(modules, packageName);
  try {
    if (!fs.statSync(packageRoot).isDirectory()) return false;
  } catch {
    return false;
  }
  const subpath = specifier
    .slice(packageName.length)
    .replace(/^[/\\]+/, "");
  const rootTopology = recordPackageRootTopology(
    packageRoot,
    owners,
    subpath === "",
    subpath === "" ? "." : "./" + subpath.replaceAll("\\", "/"),
    childLocation,
    conditions,
  );
  if (subpath !== "" && !rootTopology.hasExports) {
    return (
      recordPackageSubpathTopology(
        packageRoot,
        subpath,
        childLocation,
        owners,
      ) || rootTopology.selected
    );
  }
  return rootTopology.selected;
}

function recordPackageRootTopology(
  packageRoot,
  owners,
  useMain,
  packageSubpath,
  childLocation,
  conditions,
) {
  const normalizedRoot = path.resolve(packageRoot);
  const manifest = path.join(normalizedRoot, "package.json");
  const legacySelected = () =>
    useMain &&
    packagePathCandidateMatchesChild(normalizedRoot, childLocation, true);
  if (!recordOptionalFileDependency(manifest, owners)) {
    const selected = legacySelected();
    if (!selected) {
      recordPackageIndexCandidates(normalizedRoot, useMain, owners);
    }
    return { hasExports: false, selected };
  }
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const hasExports =
        value.exports !== undefined && value.exports !== null;
      if (hasExports) {
        const target = selectPackageExportsTarget(
          value.exports,
          packageSubpath,
          new Set(conditions),
        );
        const candidate =
          typeof target === "string"
            ? packageExportsTarget(normalizedRoot, target)
            : undefined;
        const selected =
          candidate !== undefined &&
          packagePathCandidateMatchesChild(
            candidate,
            childLocation,
            false,
          );
        if (selected) {
          recordPackagePathCandidate(candidate, owners);
        } else if (candidate !== undefined) {
          // A nearer package the search skipped starts winning the moment its
          // own active target appears, and neither the parent node_modules
          // listing nor the manifest changes when only that file is created.
          recordOptionalFileDependency(candidate, owners);
        }
        return { hasExports: true, selected };
      }
      let selected = legacySelected();
      if (useMain && typeof value.main === "string") {
        const main = path.resolve(normalizedRoot, value.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
      if (!selected) {
        recordPackageIndexCandidates(normalizedRoot, useMain, owners);
      }
      return { hasExports: false, selected };
    }
  } catch {
  }
  const rootSelected = legacySelected();
  if (!rootSelected) {
    recordPackageIndexCandidates(normalizedRoot, useMain, owners);
  }
  return { hasExports: false, selected: rootSelected };
}

// recordPackageIndexCandidates pins the LOAD_INDEX fallbacks of a package root
// this resolution walked past without selecting. An empty package directory, or
// one whose manifest declares no usable entry, becomes resolvable as soon as one
// of these files exists, and that creation changes neither the parent directory
// listing nor the manifest digest already recorded for the candidate.
function recordPackageIndexCandidates(packageRoot, useMain, owners) {
  if (!useMain) return;
  for (const name of ["index.js", "index.json", "index.node"]) {
    recordOptionalFileDependency(path.join(packageRoot, name), owners);
  }
}

function selectPackageExportsTarget(
  exportsValue,
  packageSubpath,
  conditions,
) {
  let mappings = exportsValue;
  if (
    typeof mappings === "string" ||
    Array.isArray(mappings) ||
    (isObject(mappings) &&
      Object.keys(mappings).every((key) => !key.startsWith(".")))
  ) {
    if (packageSubpath !== ".") return undefined;
    return selectPackageTarget(mappings, "", false, conditions);
  }
  if (!isObject(mappings)) return undefined;
  if (
    Object.prototype.hasOwnProperty.call(mappings, packageSubpath) &&
    !packageSubpath.includes("*") &&
    !packageSubpath.endsWith("/")
  ) {
    return selectPackageTarget(
      mappings[packageSubpath],
      "",
      false,
      conditions,
    );
  }
  let bestMatch = "";
  let bestSubpath = "";
  for (const key of Object.keys(mappings)) {
    const wildcard = key.indexOf("*");
    if (
      wildcard === -1 ||
      key.lastIndexOf("*") !== wildcard ||
      !packageSubpath.startsWith(key.slice(0, wildcard))
    ) {
      continue;
    }
    const trailer = key.slice(wildcard + 1);
    if (
      packageSubpath.length < key.length ||
      !packageSubpath.endsWith(trailer) ||
      packagePatternKeyCompare(bestMatch, key) !== 1
    ) {
      continue;
    }
    bestMatch = key;
    bestSubpath = packageSubpath.slice(
      wildcard,
      packageSubpath.length - trailer.length,
    );
  }
  return bestMatch === ""
    ? undefined
    : selectPackageTarget(
        mappings[bestMatch],
        bestSubpath,
        true,
        conditions,
      );
}

function selectPackageTarget(target, subpath, pattern, conditions) {
  if (typeof target === "string") {
    const selected = pattern ? target.replaceAll("*", subpath) : target;
    return validPackageExportsTarget(selected) ? selected : undefined;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const selected = selectPackageTarget(
        item,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined && selected !== null) return selected;
    }
    return null;
  }
  if (isObject(target)) {
    for (const [condition, value] of Object.entries(target)) {
      if (condition !== "default" && !conditions.has(condition)) continue;
      const selected = selectPackageTarget(
        value,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined) return selected;
    }
    return undefined;
  }
  return target === null ? null : undefined;
}

function packagePatternKeyCompare(left, right) {
  const leftWildcard = left.indexOf("*");
  const rightWildcard = right.indexOf("*");
  const leftBase =
    leftWildcard === -1 ? left.length : leftWildcard + 1;
  const rightBase =
    rightWildcard === -1 ? right.length : rightWildcard + 1;
  if (leftBase > rightBase) return -1;
  if (rightBase > leftBase) return 1;
  if (leftWildcard === -1) return 1;
  if (rightWildcard === -1) return -1;
  if (left.length > right.length) return -1;
  if (right.length > left.length) return 1;
  return 0;
}

function packageExportsTarget(packageRoot, target) {
  if (!validPackageExportsTarget(target)) return undefined;
  try {
    // Node resolves an exports target as a URL against the package manifest,
    // so percent escapes, query strings, and fragments all take part in the
    // path it finally loads. Joining the raw target by hand diverges from that
    // whenever the target is anything but a plain relative path, and a target
    // Node resolves while this model rejects loses the selected file's
    // fingerprint, leaving a retargeted symlink cached as fresh.
    const packageUrl = pathToFileURL(path.join(packageRoot, "package.json"));
    const resolved = new URL(target, packageUrl);
    const packagePath = new URL(".", packageUrl).pathname;
    if (!resolved.pathname.startsWith(packagePath)) return undefined;
    return fileURLToPath(resolved);
  } catch {
    return undefined;
  }
}

function validPackageExportsTarget(target) {
  if (!target.startsWith("./") || /%%2f|%%5c/i.test(target)) return false;
  const components = target
    .slice(2)
    .replaceAll("\\", "/")
    .split("/");
  if (
    components.some(
      (component) => {
        try {
          const decoded = decodeURIComponent(component);
          return (
            decoded === "." ||
            decoded === ".." ||
            decoded.includes("/") ||
            decoded.includes("\\") ||
            decoded.toLowerCase() === "node_modules"
          );
        } catch {
          return true;
        }
      },
    )
  ) {
    return false;
  }
  return true;
}

function packagePathCandidateMatchesChild(
  candidate,
  childLocation,
  legacy,
) {
  let child;
  try {
    child = fs.realpathSync.native(childLocation);
  } catch {
    child = path.resolve(childLocation);
  }
  const candidates = legacy
    ? [
        candidate,
        candidate + ".js",
        candidate + ".json",
        candidate + ".node",
        path.join(candidate, "index.js"),
        path.join(candidate, "index.json"),
        path.join(candidate, "index.node"),
      ]
    : [candidate];
  return candidates.some((location) => {
    try {
      return sameResolutionPath(fs.realpathSync.native(location), child);
    } catch {
      return false;
    }
  });
}

function recordPackageSubpathTopology(
  packageRoot,
  subpath,
  childLocation,
  owners,
) {
  const candidate = boundedPackageTarget(packageRoot, subpath);
  if (candidate === undefined) return false;
  recordPackagePathCandidate(candidate, owners);
  let selected = packagePathCandidateMatchesChild(
    candidate,
    childLocation,
    true,
  );
  try {
    if (!fs.statSync(candidate).isDirectory()) return selected;
  } catch {
    return selected;
  }
  const manifest = path.join(candidate, "package.json");
  if (!recordOptionalFileDependency(manifest, owners)) return selected;
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      if (typeof value.main === "string") {
        const main = path.resolve(candidate, value.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
    }
  } catch {
  }
  return selected;
}

function boundedPackageTarget(
  packageRoot,
  target,
) {
  const candidate = path.resolve(packageRoot, target);
  const relative = path.relative(packageRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return candidate;
}

function recordPackagePathCandidate(
  candidate,
  owners,
  visited = new Set(),
  depth = 0,
) {
  const normalized = path.resolve(candidate);
  // The depth bound owns termination. A platform-wide case fold would merge
  // paths that differ only by case, which a per-directory case-sensitive
  // Windows tree keeps distinct, and would truncate a valid symlink chain.
  if (depth >= 64 || visited.has(normalized)) return;
  visited.add(normalized);
  const parsed = path.parse(normalized);
  const components = normalized
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const next = path.join(current, component);
    let entry;
    try {
      entry = fs.lstatSync(next);
    } catch {
      recordAncestorDependency(current, next, parsed.root, owners);
      return;
    }
    if (entry.isSymbolicLink()) {
      recordAncestorDependency(current, next, parsed.root, owners);
      try {
        const target = fs.readlinkSync(next);
        const remainder = components.slice(index + 1);
        recordPackagePathCandidate(
          path.join(path.resolve(current, target), ...remainder),
          owners,
          visited,
          depth + 1,
        );
      } catch {
      }
    }
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDirectory = fs.statSync(next).isDirectory();
      } catch {
        return;
      }
    }
    if (index === components.length - 1) {
      if (isDirectory) recordDirectoryDependency(next, owners);
      else recordAncestorDependency(current, next, parsed.root, owners);
      return;
    }
    if (!isDirectory) {
      recordAncestorDependency(current, next, parsed.root, owners);
      return;
    }
    current = next;
  }
  // Reached only when the candidate resolved to the filesystem root itself,
  // which names no package. Record its existence, not its listing.
  if (current === parsed.root) recordEntryDependency(current, owners);
  else recordDirectoryDependency(current, owners);
}

function modulePackageName(specifier) {
  if (specifier.startsWith("@")) {
    const components = specifier.split("/");
    return components.length >= 2
      ? components[0] + "/" + components[1]
      : undefined;
  }
  const [name] = specifier.split("/");
  return name && !name.startsWith("#") ? name : undefined;
}

function resolvedPackageContains(modules, packageName, childLocation) {
  try {
    const packageRoot = fs.realpathSync(path.join(modules, packageName));
    const child = fs.realpathSync(childLocation);
    const relative = path.relative(packageRoot, child);
    if (relative === "") return sameResolutionPath(packageRoot, child);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    ) return false;
    let ancestor = child;
    for (let remaining = relative.split(path.sep).length; remaining !== 0; --remaining)
      ancestor = path.dirname(ancestor);
    return sameResolutionPath(packageRoot, ancestor);
  } catch {
    return false;
  }
}

function sameResolutionPath(left, right) {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  if (resolvedLeft === resolvedRight) return true;
  if (path.relative(resolvedLeft, resolvedRight) !== "") return false;
  try {
    const leftIdentity = fs.statSync(resolvedLeft, { bigint: true });
    const rightIdentity = fs.statSync(resolvedRight, { bigint: true });
    return leftIdentity.ino !== 0n &&
      leftIdentity.dev === rightIdentity.dev &&
      leftIdentity.ino === rightIdentity.ino;
  } catch {
    return false;
  }
}

function samePhysicalPath(left, right) {
  try {
    return sameResolutionPath(realPath(left), realPath(right));
  } catch {
    return sameResolutionPath(left, right);
  }
}

/**
 * The config's real path, or its declared one when the volume will not say.
 *
 * A config can disappear between the host reading it and this loader starting,
 * and a throw here would replace a precise report from the import below with a
 * crash in bookkeeping. Seeding lexically instead only risks the demotion this
 * value exists to prevent, on a file that is already gone.
 */
function realConfigLocation() {
  try {
    return realPath(configLocation);
  } catch {
    return configLocation;
  }
}

function realPath(location) {
  return fs.realpathSync.native
    ? fs.realpathSync.native(location)
    : fs.realpathSync(location);
}

function finalizeDependencies() {
  for (const dependency of [...dependencies.values()]) {
    recordDependency(
      dependency.kind,
      dependency.path,
      currentDependencyDigest(dependency.kind, dependency.path),
      [...dependency.owners],
    );
  }
  const watched = graphWatchReachability();
  return [...dependencies.values()].map((dependency) => ({
    digest: dependency.digest,
    identityStable: dependency.identityStable,
    kind: dependency.kind,
    path: dependency.path,
    realpath: dependency.realpath,
    scope: [...dependency.owners].some((owner) => watched.has(owner))
      ? "watch"
      : "cache",
  }));
}

function graphWatchReachability() {
  const adjacency = new Map();
  for (const edge of graphEdges) {
    const outgoing = adjacency.get(edge.parent) || [];
    outgoing.push(edge);
    adjacency.set(edge.parent, outgoing);
  }
  const queue = configUrlSpellings.map((url) => ({
    url,
    watched: true,
  }));
  const visited = new Set();
  const watched = new Set();
  while (queue.length !== 0) {
    const state = queue.shift();
    const key = state.url + "\0" + (state.watched ? "1" : "0");
    if (visited.has(key)) continue;
    visited.add(key);
    if (state.watched) watched.add(state.url);
    for (const edge of adjacency.get(state.url) || []) {
      const childLocation = graphNodes.get(edge.child);
      const childWatched = edge.packageBoundary
        ? false
        : childLocation !== undefined && !pathHasNodeModules(childLocation)
          ? true
          : state.watched;
      queue.push({ url: edge.child, watched: childWatched });
    }
  }
  return watched;
}

function hasConfigKey(value) {
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return true;
    }
  }
  return false;
}

function mergeConfigObjects(base, override) {
  const out = toSerializableConfig(base);
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      out[key] = override[key];
    }
  }
  return out;
}

// toSerializableConfig copies every ITtscLintConfig key onto a plain object so
// it survives the JSON round trip to the Go sidecar. Every key is copied
// verbatim — files, ignores, extends, plugins, rules, AND format — so a config
// whose only key is `+"`"+`format`+"`"+` is not silently dropped.
function toSerializableConfig(value) {
  const out = {};
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      out[key] = value[key];
    }
  }
  return out;
}
`, serializableConfigKeysLiteral())
}

// loadTypeScriptConfigFile evaluates a .ts/.cts/.mts config file by writing
// an ephemeral loader script and tsconfig into a temp directory, symlinking the
// nearest node_modules, then running `ttsx`.
// The loader script imports the config file, resolves it through the same
// normalization chain used by loadScriptConfigFile, and writes a private JSON
// result file so user stdout cannot corrupt the protocol.
func loadTypeScriptConfigFile(location string) (any, error) {
  evaluated, err := loadTypeScriptConfigEvaluation(location)
  return evaluated.value, err
}

func loadTypeScriptConfigEvaluation(location string) (evaluatedConfigFile, error) {
  return loadTypeScriptConfigEvaluationWithin(location, filepath.Dir(location))
}

func loadTypeScriptConfigEvaluationWithin(
  location string,
  resolutionRoot string,
) (evaluatedConfigFile, error) {
  tempDir, err := os.MkdirTemp(loaderTempBase(location, os.TempDir()), "ttsc-lint-config-")
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: create config loader tempdir: %w", err)
  }
  tempDir = realpathIfPossible(tempDir)
  defer os.RemoveAll(tempDir)

  if err := linkNearestNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return evaluatedConfigFile{}, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  outputPath := filepath.Join(tempDir, "result.json")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importLiteral, err := json.Marshal(fileURL(location))
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: encode config import %s: %w", location, err)
  }
  outputLiteral, err := json.Marshal(outputPath)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: encode config result path %s: %w", outputPath, err)
  }
  resolutionRootLiteral, err := json.Marshal(filepath.Clean(resolutionRoot))
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf(
      "@ttsc/lint: encode config resolution root %s: %w",
      resolutionRoot,
      err,
    )
  }
  if err := os.WriteFile(
    loader,
    []byte(typeScriptConfigLoaderSource(
      string(importLiteral),
      string(outputLiteral),
      string(resolutionRootLiteral),
    )),
    0o644,
  ); err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: write config loader: %w", err)
  }
  if err := os.WriteFile(tsconfig, []byte(typeScriptConfigLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: write config loader tsconfig: %w", err)
  }

  args := []string{
    "--project", tsconfig,
    "--cwd", tempDir,
    "--cache-dir", filepath.Join(tempDir, "cache"),
    // The loader only needs to type-check and execute the user's
    // `*.config.ts`; it must NOT load the host project's transform /
    // check plugins. Discovering them (`@nestia/core`, `typia`, …)
    // would run their project checks against this ephemeral loader
    // tsconfig — which is deliberately lenient (`strict: false`) — so a
    // plugin like `@nestia/core` that demands strict mode would fail
    // the build and abort config evaluation. `--no-plugins` makes the
    // ttsx build hermetic.
    "--no-plugins",
  }
  anchors := configToolAnchors(location, resolutionRoot)
  if tsgo := resolveConfigTsgo(anchors); tsgo != "" {
    args = append(args, "--binary", tsgo)
  }
  args = append(args, loader)

  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()
  cmd := ttsxCommandContext(ctx, anchors, args...)
  cmd.Env = nodeConfigLoaderEnv(location)
  return runConfigLoaderCommand(cmd, location, "TypeScript config file", outputPath)
}

// isConfigObject reports whether `value` is a top-level config object. A lint
// config file always exports a single `ITtscLintConfig` object; arrays and
// scalars are rejected so users get a clear error instead of an opaque parse
// failure downstream.
func isConfigObject(value any) bool {
  _, ok := value.(map[string]any)
  return ok
}

func fileURL(location string) string {
  volume := filepath.VolumeName(location)
  if volume != "" {
    volumePath := filepath.ToSlash(volume)
    rest := strings.TrimPrefix(filepath.ToSlash(location[len(volume):]), "/")
    if strings.HasPrefix(volumePath, "//?/UNC") {
      return uncFileURL(rest)
    }
    if strings.HasPrefix(volumePath, "//?/") {
      pathname := "/" + strings.TrimPrefix(volumePath, "//?/")
      if rest != "" {
        pathname += "/" + rest
      }
      return (&url.URL{Scheme: "file", Path: pathname}).String()
    }
    if strings.HasPrefix(volumePath, "//") {
      return uncFileURL(strings.TrimPrefix(volumePath, "//") + "/" + rest)
    }
  }
  pathname := filepath.ToSlash(location)
  if volume != "" && !strings.HasPrefix(pathname, "/") {
    pathname = "/" + pathname
  }
  return (&url.URL{Scheme: "file", Path: pathname}).String()
}

func uncFileURL(pathname string) string {
  server, remainder, ok := strings.Cut(pathname, "/")
  if !ok || server == "" {
    return (&url.URL{Scheme: "file", Path: "/" + strings.TrimPrefix(pathname, "/")}).String()
  }
  share, tail, _ := strings.Cut(remainder, "/")
  if share == "" {
    return (&url.URL{Scheme: "file", Path: "/" + strings.TrimPrefix(pathname, "/")}).String()
  }
  urlPath := "/" + share
  if tail != "" {
    urlPath += "/" + tail
  }
  return (&url.URL{Scheme: "file", Host: server, Path: urlPath}).String()
}

// typeScriptConfigLoaderSource returns the TypeScript source of the ephemeral
// loader script that ttsx executes to evaluate a TypeScript lint config file.
// `importLiteral` is a JSON-encoded file URL (produced by json.Marshal). It is
// assigned to a variable before `import(configUrl)` so tsgo does not try to
// statically resolve the file URL during the loader build.
func typeScriptConfigLoaderSource(
  importLiteral string,
  outputLiteral string,
  resolutionRootLiteral string,
) string {
  return fmt.Sprintf(`// @ts-ignore -- internal loader must not require user-installed Node typings.
import * as fs from "node:fs";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { Buffer } from "node:buffer";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { createHash } from "node:crypto";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { registerHooks } from "node:module";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import * as path from "node:path";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { fileURLToPath, pathToFileURL } from "node:url";

const configUrl = %s;
const outputPath = %s;
const resolutionRoot = path.resolve(%s);
const CONFIG_KEYS = new Set<string>([%s]);
const dependencies = new Map<string, {
  digest: string;
  identityStable: boolean;
  kind: "directory" | "entry" | "file" | "optional-file";
  path: string;
  owners: Set<string>;
  realpath: string | null;
  signature: string | undefined;
}>();
const graphNodes = new Map<string, string>();
const graphEdges: Array<{
  child: string;
  packageBoundary: boolean;
  parent: string;
}> = [];
const configLocation = fileURLToPath(configUrl);
// Every spelling of this config the module system might key an edge under.
//
// Which one it uses is not knowable from here, and guessing has failed in both
// directions. A path handed in by another producer can be escaped by a rule
// Node does not share. Node respells a resolved file module through its real
// path unless "--preserve-symlinks" is set, so a config reached through a
// symlinked directory is keyed by its target. And a Windows 8.3 short name is
// not a symlink: fs.realpathSync expands it, the module resolver does not, so
// asking the volume there produces a spelling no edge carries.
//
// A seed that names a URL no edge was keyed under sits on a node with no
// outgoing edges, the walk ends immediately, and every dependency recorded
// after the first import is demoted from watch to cache. That failure is
// silent: the build still succeeds and simply stops reacting. Seeding every
// spelling costs one extra queue entry and cannot be wrong.
const configUrlSpellings = [
  ...new Set([
    configUrl,
    pathToFileURL(configLocation).href,
    pathToFileURL(realConfigLocation()).href,
  ]),
];
for (const spelling of configUrlSpellings) {
  graphNodes.set(spelling, configLocation);
}
recordDependency(
  "file",
  configLocation,
  createHash("sha256").update(fs.readFileSync(configLocation)).digest("hex"),
  configUrlSpellings,
);
recordPackageManifests(configLocation, configUrlSpellings);

declare const process: {
  env: Record<string, string | undefined>;
  platform: string;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (typeof resolved.url !== "string" || !resolved.url.startsWith("file:")) {
      return resolved;
    }
    const url = new URL(resolved.url).href;
    const parent = context.parentURL && new URL(context.parentURL).href;
    const location = fileURLToPath(url);
    // The entry is recognized by what was asked for, not only by what came
    // back. A module URL is assigned by whoever loaded it: a compiling loader
    // can serve the config from its emitted output, and a platform can hand
    // back a different spelling of the same file. Either way the URL bears no
    // resemblance to the one this process was given, so the config's own
    // imports would be rejected here — their parent is a URL no node was
    // recorded under — and the graph would collapse to the records made before
    // the first import. The request itself is unambiguous, so it decides.
    const entry =
      specifier === configUrl ||
      url === new URL(configUrl).href ||
      samePhysicalPath(location, configLocation);
    if (!entry && (parent === undefined || !graphNodes.has(parent))) {
      return resolved;
    }
    graphNodes.set(url, location);
    if (parent !== undefined) {
      graphEdges.push({
        child: url,
        packageBoundary:
          pathHasNodeModules(location) && !isLocalModuleSpecifier(specifier),
        parent,
      });
      recordResolutionTopology(
        specifier,
        parent,
        url,
        location,
        context.conditions,
      );
    }
    try {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        [url],
      );
    } catch {
      recordDependency("file", location, "", [url]);
    }
    return resolved;
  },
});

// Wrapped rather than written as a top-level await: the loader tsconfig's
// "module" follows the config's own package, and TS1378 rejects top-level await
// under a CommonJS module option however this .mts file emits. The body's own
// catch is the only failure path — it ends the process — so there is nothing
// left for a trailing handler to settle.
(async () => {
  try {
    const importedConfig = await import(configUrl);
    const value = await resolveConfig(importedConfig, true);
    if (!isObject(value) || Array.isArray(value)) {
      throw new Error("config file must export an ITtscLintConfig object");
    }
    fs.writeFileSync(outputPath, JSON.stringify({
      dependencies: finalizeDependencies(),
      value: toSerializableConfig(value),
    }), "utf8");
  } catch (error) {
    process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
    // The stack above is for the reader. This is for the caller: the parent
    // reads the result file either way, so a failure reason travels as data
    // rather than as text scraped back out of a captured stream. A write that
    // itself fails leaves the process status to speak.
    try {
      fs.writeFileSync(outputPath, JSON.stringify({ __ttscLoaderError: error instanceof Error ? error.message : String(error) }), "utf8");
    } catch {}
    process.exit(1);
  } finally {
    hooks.deregister();
  }
})();

async function resolveConfig(value: unknown, allowNamedConfig: boolean): Promise<unknown> {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (typeof current === "function") {
      current = await (current as () => unknown | Promise<unknown>)();
      allowNamedConfig = false;
      continue;
    }
    if (isObject(current) && !Array.isArray(current)) {
      if (hasOwn(current, "default")) {
        const defaultValue = current.default;
        if (isModuleNamespace(current) || !hasConfigKey(current)) {
          current = defaultValue;
          allowNamedConfig = false;
          continue;
        }
        const normalizedDefault = await resolveConfig(defaultValue, false);
        if (isObject(normalizedDefault) && !Array.isArray(normalizedDefault)) {
          current = mergeConfigObjects(normalizedDefault, current);
          allowNamedConfig = false;
          continue;
        }
      }
      if (allowNamedConfig && hasOwn(current, "config")) {
        current = current.config;
        allowNamedConfig = false;
        continue;
      }
    }
    break;
  }
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function missingPathError(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function dependencyMetadataSignature(
  location: string,
): string | undefined {
  const requested = path.resolve(location);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try { target = fs.statSync(current, { bigint: true }); }
        catch { return undefined; }
      }
      return [path.relative(current, requested), link.dev, link.ino, link.mode, link.size, link.mtimeNs, link.ctimeNs, target.dev, target.ino, target.mode, target.size, target.mtimeNs, target.ctimeNs].join(":");
    } catch (error) {
      if (!missingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function currentDependencyDigest(
  kind: "directory" | "entry" | "file" | "optional-file",
  location: string,
): string {
  try {
    if (kind === "directory") return directoryDigest(location);
    if (kind === "entry") return entryDigest(location);
    if (kind === "optional-file") return optionalFileDigest(location);
    return createHash("sha256").update(fs.readFileSync(location)).digest("hex");
  } catch {
    return "";
  }
}

function recordDependency(
  kind: "directory" | "entry" | "file" | "optional-file",
  location: string,
  digest: string,
  owners: readonly string[],
): void {
  const key = kind + "\0" + location;
  const previous = dependencies.get(key);
  const mergedOwners = previous?.owners ?? new Set<string>();
  for (const owner of owners) mergedOwners.add(owner);
  const beforeSignature = dependencyMetadataSignature(location);
  const observedDigest = currentDependencyDigest(kind, location);
  const realpath = dependencyRealpath(location);
  const afterSignature = dependencyMetadataSignature(location);
  const identityStable =
    previous?.identityStable !== false &&
    beforeSignature !== undefined &&
    afterSignature !== undefined &&
    beforeSignature === afterSignature &&
    digest === observedDigest &&
    (previous === undefined || previous.realpath === realpath) &&
    (previous === undefined || previous.signature === afterSignature);
  dependencies.set(key, {
    digest:
      !identityStable ||
      (previous !== undefined && previous.digest !== digest)
        ? ""
        : digest,
    identityStable,
    kind,
    owners: mergedOwners,
    path: location,
    realpath,
    signature: afterSignature,
  });
}

function dependencyRealpath(location: string): string | null {
  try {
    return realPath(location);
  } catch {
    return null;
  }
}

function isLocalModuleSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(specifier);
}

function pathHasNodeModules(location: string): boolean {
  return location.replaceAll("\\", "/").split("/").includes("node_modules");
}

function recordResolutionTopology(
  specifier: string,
  parentUrl: string,
  childUrl: string,
  childLocation: string,
  conditions: readonly string[],
): void {
  const owners = [parentUrl, childUrl];
  const parentLocation = graphNodes.get(parentUrl);
  if (parentLocation !== undefined && isLocalModuleSpecifier(specifier)) {
    recordDirectoryDependency(path.dirname(parentLocation), owners);
  }
  recordDirectoryDependency(path.dirname(childLocation), owners);
  recordPackageManifests(childLocation, owners);
  if (parentLocation !== undefined && !isLocalModuleSpecifier(specifier)) {
    recordNodeModulesSearchDirectories(
      parentLocation,
      specifier,
      childLocation,
      owners,
      conditions,
    );
  }
}

function recordDirectoryDependency(
  location: string,
  owners: readonly string[],
): void {
  try {
    recordDependency("directory", location, directoryDigest(location), owners);
  } catch {
    recordDependency("directory", location, "", owners);
  }
}

// Observe one path's own existence and link topology instead of enumerating the
// directory that contains it. A resolution trace passes through ancestors it
// does not own -- /var on macOS is a symlink whose parent is the filesystem
// root -- and digesting that parent both reaches outside the project boundary
// and reads the whole directory to learn one entry's state.
// A path candidate is observed through the directory that would own a
// competing resolution, so a sibling winning extension resolution still
// invalidates. That reasoning is what the parent digest is for and it stays.
//
// It does not reach the filesystem root. The root owns no candidate this trace
// could pick, and a resolution path routinely passes through an ancestor
// directly beneath it -- /var on macOS is a symlink whose parent is the root --
// so digesting the parent there enumerates the entire filesystem root on every
// config load, outside the project boundary. Record that one ancestor instead.
function recordAncestorDependency(
  parent: string,
  entry: string,
  root: string,
  owners: readonly string[],
): void {
  if (parent === root) recordEntryDependency(entry, owners);
  else recordDirectoryDependency(parent, owners);
}

function recordEntryDependency(
  location: string,
  owners: readonly string[],
): void {
  recordDependency("entry", location, entryDigest(location), owners);
}

function entryDigest(location: string): string {
  let entry: ReturnType<typeof fs.lstatSync>;
  try {
    entry = fs.lstatSync(location);
  } catch {
    return createHash("sha256").update("missing\0").digest("hex");
  }
  if (entry.isSymbolicLink()) {
    let target: Buffer;
    try {
      target = fs.readlinkSync(location, { encoding: "buffer" });
    } catch {
      target = Buffer.from("<unreadable>");
    }
    return createHash("sha256")
      .update(Buffer.concat([Buffer.from("symlink\0"), target]))
      .digest("hex");
  }
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : "other";
  return createHash("sha256").update(kind + "\0").digest("hex");
}

function directoryDigest(location: string): string {
  const entries: Buffer[] = [];
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = Buffer.from(
            fs.readlinkSync(path.join(location, entry.name)),
            "utf8",
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(Buffer.from(entry.name), entry, target));
    }
  } else {
    for (const entry of fs.readdirSync(location, {
      encoding: "buffer",
      withFileTypes: true,
    })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = fs.readlinkSync(
            Buffer.concat([
              Buffer.from(location),
              Buffer.from(path.sep),
              entry.name,
            ]),
            { encoding: "buffer" },
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(entry.name, entry, target));
    }
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function directoryDigestRecord(
  name: Buffer,
  entry: {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
  target: Buffer,
): Buffer {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

function optionalFileDigest(location: string): string {
  try {
    if (fs.statSync(location).isFile()) {
      return createHash("sha256")
        .update(Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]))
        .digest("hex");
    }
  } catch {
  }
  return createHash("sha256").update("missing\0").digest("hex");
}

function recordOptionalFileDependency(
  location: string,
  owners: readonly string[],
): boolean {
  try {
    if (fs.statSync(location).isFile()) {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        owners,
      );
      return true;
    }
  } catch {
  }
  recordDependency("optional-file", location, optionalFileDigest(location), owners);
  return false;
}

function recordPackageManifests(
  location: string,
  owners: readonly string[],
): void {
  let current = path.dirname(location);
  while (true) {
    const manifest = path.join(current, "package.json");
    if (recordOptionalFileDependency(manifest, owners)) return;
    const parent = path.dirname(current);
    if (parent === current || path.basename(current) === "node_modules") return;
    current = parent;
  }
}

function recordNodeModulesSearchDirectories(
  parentLocation: string,
  specifier: string,
  childLocation: string,
  owners: readonly string[],
  conditions: readonly string[],
): void {
  const packageName = modulePackageName(specifier);
  const scope =
    specifier.startsWith("@") && specifier.includes("/")
      ? specifier.slice(0, specifier.indexOf("/"))
      : undefined;
  let current = path.dirname(parentLocation);
  while (true) {
    recordDirectoryDependency(current, owners);
    const modules = path.join(current, "node_modules");
    try {
      if (fs.statSync(modules).isDirectory()) {
        recordDirectoryDependency(modules, owners);
        if (scope !== undefined) {
          const scoped = path.join(modules, scope);
          try {
            if (fs.statSync(scoped).isDirectory()) {
              recordDirectoryDependency(scoped, owners);
            }
          } catch {
          }
        }
        if (packageName !== undefined) {
          const selected = recordPackageCandidateTopology(
            modules,
            packageName,
            specifier,
            childLocation,
            owners,
            conditions,
          );
          if (
            selected ||
            resolvedPackageContains(modules, packageName, childLocation)
          ) {
            return;
          }
        }
      }
    } catch {
    }
    if (
      packageName === undefined &&
      samePhysicalPath(current, resolutionRoot)
    ) {
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function recordPackageCandidateTopology(
  modules: string,
  packageName: string,
  specifier: string,
  childLocation: string,
  owners: readonly string[],
  conditions: readonly string[],
): boolean {
  const packageRoot = path.join(modules, packageName);
  try {
    if (!fs.statSync(packageRoot).isDirectory()) return false;
  } catch {
    return false;
  }
  const subpath = specifier
    .slice(packageName.length)
    .replace(/^[/\\]+/, "");
  const rootTopology = recordPackageRootTopology(
    packageRoot,
    owners,
    subpath === "",
    subpath === "" ? "." : "./" + subpath.replaceAll("\\", "/"),
    childLocation,
    conditions,
  );
  if (subpath !== "" && !rootTopology.hasExports) {
    return (
      recordPackageSubpathTopology(
        packageRoot,
        subpath,
        childLocation,
        owners,
      ) || rootTopology.selected
    );
  }
  return rootTopology.selected;
}

function recordPackageRootTopology(
  packageRoot: string,
  owners: readonly string[],
  useMain: boolean,
  packageSubpath: string,
  childLocation: string,
  conditions: readonly string[],
): { hasExports: boolean; selected: boolean } {
  const normalizedRoot = path.resolve(packageRoot);
  const manifest = path.join(normalizedRoot, "package.json");
  const legacySelected = (): boolean =>
    useMain &&
    packagePathCandidateMatchesChild(normalizedRoot, childLocation, true);
  if (!recordOptionalFileDependency(manifest, owners)) {
    const selected = legacySelected();
    if (!selected) {
      recordPackageIndexCandidates(normalizedRoot, useMain, owners);
    }
    return { hasExports: false, selected };
  }
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const metadata = value as Record<string, unknown>;
      const hasExports =
        metadata.exports !== undefined && metadata.exports !== null;
      if (hasExports) {
        const target = selectPackageExportsTarget(
          metadata.exports,
          packageSubpath,
          new Set(conditions),
        );
        const candidate =
          typeof target === "string"
            ? packageExportsTarget(normalizedRoot, target)
            : undefined;
        const selected =
          candidate !== undefined &&
          packagePathCandidateMatchesChild(
            candidate,
            childLocation,
            false,
          );
        if (selected) {
          recordPackagePathCandidate(candidate, owners);
        } else if (candidate !== undefined) {
          // A nearer package the search skipped starts winning the moment its
          // own active target appears, and neither the parent node_modules
          // listing nor the manifest changes when only that file is created.
          recordOptionalFileDependency(candidate, owners);
        }
        return { hasExports: true, selected };
      }
      let selected = legacySelected();
      if (useMain && typeof metadata.main === "string") {
        const main = path.resolve(normalizedRoot, metadata.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
      if (!selected) {
        recordPackageIndexCandidates(normalizedRoot, useMain, owners);
      }
      return { hasExports: false, selected };
    }
  } catch {
  }
  const rootSelected = legacySelected();
  if (!rootSelected) {
    recordPackageIndexCandidates(normalizedRoot, useMain, owners);
  }
  return { hasExports: false, selected: rootSelected };
}

// recordPackageIndexCandidates pins the LOAD_INDEX fallbacks of a package root
// this resolution walked past without selecting. An empty package directory, or
// one whose manifest declares no usable entry, becomes resolvable as soon as one
// of these files exists, and that creation changes neither the parent directory
// listing nor the manifest digest already recorded for the candidate.
function recordPackageIndexCandidates(
  packageRoot: string,
  useMain: boolean,
  owners: readonly string[],
): void {
  if (!useMain) return;
  for (const name of ["index.js", "index.json", "index.node"]) {
    recordOptionalFileDependency(path.join(packageRoot, name), owners);
  }
}

function selectPackageExportsTarget(
  exportsValue: unknown,
  packageSubpath: string,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  let mappings: unknown = exportsValue;
  if (
    typeof mappings === "string" ||
    Array.isArray(mappings) ||
    (isObject(mappings) &&
      Object.keys(mappings).every((key) => !key.startsWith(".")))
  ) {
    if (packageSubpath !== ".") return undefined;
    return selectPackageTarget(mappings, "", false, conditions);
  }
  if (!isObject(mappings)) return undefined;
  if (
    Object.prototype.hasOwnProperty.call(mappings, packageSubpath) &&
    !packageSubpath.includes("*") &&
    !packageSubpath.endsWith("/")
  ) {
    return selectPackageTarget(
      mappings[packageSubpath],
      "",
      false,
      conditions,
    );
  }
  let bestMatch = "";
  let bestSubpath = "";
  for (const key of Object.keys(mappings)) {
    const wildcard = key.indexOf("*");
    if (
      wildcard === -1 ||
      key.lastIndexOf("*") !== wildcard ||
      !packageSubpath.startsWith(key.slice(0, wildcard))
    ) {
      continue;
    }
    const trailer = key.slice(wildcard + 1);
    if (
      packageSubpath.length < key.length ||
      !packageSubpath.endsWith(trailer) ||
      packagePatternKeyCompare(bestMatch, key) !== 1
    ) {
      continue;
    }
    bestMatch = key;
    bestSubpath = packageSubpath.slice(
      wildcard,
      packageSubpath.length - trailer.length,
    );
  }
  return bestMatch === ""
    ? undefined
    : selectPackageTarget(
        mappings[bestMatch],
        bestSubpath,
        true,
        conditions,
      );
}

function selectPackageTarget(
  target: unknown,
  subpath: string,
  pattern: boolean,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  if (typeof target === "string") {
    const selected = pattern ? target.replaceAll("*", subpath) : target;
    return validPackageExportsTarget(selected) ? selected : undefined;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const selected = selectPackageTarget(
        item,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined && selected !== null) return selected;
    }
    return null;
  }
  if (isObject(target)) {
    for (const [condition, value] of Object.entries(target)) {
      if (condition !== "default" && !conditions.has(condition)) continue;
      const selected = selectPackageTarget(
        value,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined) return selected;
    }
    return undefined;
  }
  return target === null ? null : undefined;
}

function packagePatternKeyCompare(left: string, right: string): number {
  const leftWildcard = left.indexOf("*");
  const rightWildcard = right.indexOf("*");
  const leftBase =
    leftWildcard === -1 ? left.length : leftWildcard + 1;
  const rightBase =
    rightWildcard === -1 ? right.length : rightWildcard + 1;
  if (leftBase > rightBase) return -1;
  if (rightBase > leftBase) return 1;
  if (leftWildcard === -1) return 1;
  if (rightWildcard === -1) return -1;
  if (left.length > right.length) return -1;
  if (right.length > left.length) return 1;
  return 0;
}

function packageExportsTarget(
  packageRoot: string,
  target: string,
): string | undefined {
  if (!validPackageExportsTarget(target)) return undefined;
  try {
    // Node resolves an exports target as a URL against the package manifest,
    // so percent escapes, query strings, and fragments all take part in the
    // path it finally loads. Joining the raw target by hand diverges from that
    // whenever the target is anything but a plain relative path, and a target
    // Node resolves while this model rejects loses the selected file's
    // fingerprint, leaving a retargeted symlink cached as fresh.
    const packageUrl = pathToFileURL(path.join(packageRoot, "package.json"));
    const resolved = new URL(target, packageUrl);
    const packagePath = new URL(".", packageUrl).pathname;
    if (!resolved.pathname.startsWith(packagePath)) return undefined;
    return fileURLToPath(resolved);
  } catch {
    return undefined;
  }
}

function validPackageExportsTarget(target: string): boolean {
  if (!target.startsWith("./") || /%%2f|%%5c/i.test(target)) return false;
  const components = target
    .slice(2)
    .replaceAll("\\", "/")
    .split("/");
  if (
    components.some(
      (component) => {
        try {
          const decoded = decodeURIComponent(component);
          return (
            decoded === "." ||
            decoded === ".." ||
            decoded.includes("/") ||
            decoded.includes("\\") ||
            decoded.toLowerCase() === "node_modules"
          );
        } catch {
          return true;
        }
      },
    )
  ) {
    return false;
  }
  return true;
}

function packagePathCandidateMatchesChild(
  candidate: string,
  childLocation: string,
  legacy: boolean,
): boolean {
  let child: string;
  try {
    child = fs.realpathSync.native(childLocation);
  } catch {
    child = path.resolve(childLocation);
  }
  const candidates = legacy
    ? [
        candidate,
        candidate + ".js",
        candidate + ".json",
        candidate + ".node",
        path.join(candidate, "index.js"),
        path.join(candidate, "index.json"),
        path.join(candidate, "index.node"),
      ]
    : [candidate];
  return candidates.some((location) => {
    try {
      return sameResolutionPath(fs.realpathSync.native(location), child);
    } catch {
      return false;
    }
  });
}

function recordPackageSubpathTopology(
  packageRoot: string,
  subpath: string,
  childLocation: string,
  owners: readonly string[],
): boolean {
  const candidate = boundedPackageTarget(packageRoot, subpath);
  if (candidate === undefined) return false;
  recordPackagePathCandidate(candidate, owners);
  let selected = packagePathCandidateMatchesChild(
    candidate,
    childLocation,
    true,
  );
  try {
    if (!fs.statSync(candidate).isDirectory()) return selected;
  } catch {
    return selected;
  }
  const manifest = path.join(candidate, "package.json");
  if (!recordOptionalFileDependency(manifest, owners)) return selected;
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const metadata = value as Record<string, unknown>;
      if (typeof metadata.main === "string") {
        const main = path.resolve(candidate, metadata.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
    }
  } catch {
  }
  return selected;
}

function boundedPackageTarget(
  packageRoot: string,
  target: string,
): string | undefined {
  const candidate = path.resolve(packageRoot, target);
  const relative = path.relative(packageRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return candidate;
}

function recordPackagePathCandidate(
  candidate: string,
  owners: readonly string[],
  visited: Set<string> = new Set(),
  depth = 0,
): void {
  const normalized = path.resolve(candidate);
  // The depth bound owns termination. A platform-wide case fold would merge
  // paths that differ only by case, which a per-directory case-sensitive
  // Windows tree keeps distinct, and would truncate a valid symlink chain.
  if (depth >= 64 || visited.has(normalized)) return;
  visited.add(normalized);
  const parsed = path.parse(normalized);
  const components = normalized
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const next = path.join(current, component);
    let entry: ReturnType<typeof fs.lstatSync>;
    try {
      entry = fs.lstatSync(next);
    } catch {
      recordAncestorDependency(current, next, parsed.root, owners);
      return;
    }
    if (entry.isSymbolicLink()) {
      recordAncestorDependency(current, next, parsed.root, owners);
      try {
        const target = fs.readlinkSync(next);
        const remainder = components.slice(index + 1);
        recordPackagePathCandidate(
          path.join(path.resolve(current, target), ...remainder),
          owners,
          visited,
          depth + 1,
        );
      } catch {
      }
    }
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDirectory = fs.statSync(next).isDirectory();
      } catch {
        return;
      }
    }
    if (index === components.length - 1) {
      if (isDirectory) recordDirectoryDependency(next, owners);
      else recordAncestorDependency(current, next, parsed.root, owners);
      return;
    }
    if (!isDirectory) {
      recordAncestorDependency(current, next, parsed.root, owners);
      return;
    }
    current = next;
  }
  // Reached only when the candidate resolved to the filesystem root itself,
  // which names no package. Record its existence, not its listing.
  if (current === parsed.root) recordEntryDependency(current, owners);
  else recordDirectoryDependency(current, owners);
}

function modulePackageName(specifier: string): string | undefined {
  if (specifier.startsWith("@")) {
    const components = specifier.split("/");
    return components.length >= 2
      ? components[0] + "/" + components[1]
      : undefined;
  }
  const [name] = specifier.split("/");
  return name && !name.startsWith("#") ? name : undefined;
}

function resolvedPackageContains(
  modules: string,
  packageName: string,
  childLocation: string,
): boolean {
  try {
    const packageRoot = fs.realpathSync(path.join(modules, packageName));
    const child = fs.realpathSync(childLocation);
    const relative = path.relative(packageRoot, child);
    if (relative === "") return sameResolutionPath(packageRoot, child);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    ) return false;
    let ancestor = child;
    for (let remaining = relative.split(path.sep).length; remaining !== 0; --remaining)
      ancestor = path.dirname(ancestor);
    return sameResolutionPath(packageRoot, ancestor);
  } catch {
    return false;
  }
}

function sameResolutionPath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  if (resolvedLeft === resolvedRight) return true;
  if (path.relative(resolvedLeft, resolvedRight) !== "") return false;
  try {
    const leftIdentity = fs.statSync(resolvedLeft, { bigint: true });
    const rightIdentity = fs.statSync(resolvedRight, { bigint: true });
    return leftIdentity.ino !== 0n &&
      leftIdentity.dev === rightIdentity.dev &&
      leftIdentity.ino === rightIdentity.ino;
  } catch {
    return false;
  }
}

function samePhysicalPath(left: string, right: string): boolean {
  try {
    return sameResolutionPath(realPath(left), realPath(right));
  } catch {
    return sameResolutionPath(left, right);
  }
}

/**
 * The config's real path, or its declared one when the volume will not say.
 *
 * A config can disappear between the host reading it and this loader starting,
 * and a throw here would replace a precise report from the import below with a
 * crash in bookkeeping. Seeding lexically instead only risks the demotion this
 * value exists to prevent, on a file that is already gone.
 */
function realConfigLocation(): string {
  try {
    return realPath(configLocation);
  } catch {
    return configLocation;
  }
}

function realPath(location: string): string {
  return fs.realpathSync.native
    ? fs.realpathSync.native(location)
    : fs.realpathSync(location);
}

function finalizeDependencies(): Array<{
  digest: string;
  identityStable: boolean;
  kind: "directory" | "entry" | "file" | "optional-file";
  path: string;
  realpath: string | null;
  scope: "cache" | "watch";
}> {
  for (const dependency of [...dependencies.values()]) {
    recordDependency(
      dependency.kind,
      dependency.path,
      currentDependencyDigest(dependency.kind, dependency.path),
      [...dependency.owners],
    );
  }
  const watched = graphWatchReachability();
  // Opt-in diagnostics for a graph that comes back empty. The only channel this
  // loader may use is stderr, because the result travels through a private file
  // that user output must not corrupt; it stays silent unless a caller asks.
  if (process.env.TTSC_LINT_DEBUG_CONFIG_GRAPH) {
    process.stderr.write(
      "@ttsc/lint: config graph " +
        JSON.stringify({
          configUrl,
          seeds: configUrlSpellings,
          nodes: [...graphNodes.keys()],
          edges: graphEdges.map((edge) => edge.parent + " -> " + edge.child),
          watched: [...watched],
        }) +
        "\n",
    );
  }
  return [...dependencies.values()].map((dependency) => ({
    digest: dependency.digest,
    identityStable: dependency.identityStable,
    kind: dependency.kind,
    path: dependency.path,
    realpath: dependency.realpath,
    scope: [...dependency.owners].some((owner) => watched.has(owner))
      ? "watch"
      : "cache",
  }));
}

function graphWatchReachability(): Set<string> {
  const adjacency = new Map<string, typeof graphEdges>();
  for (const edge of graphEdges) {
    const outgoing = adjacency.get(edge.parent) ?? [];
    outgoing.push(edge);
    adjacency.set(edge.parent, outgoing);
  }
  const queue: Array<{ url: string; watched: boolean }> =
    configUrlSpellings.map((url) => ({ url, watched: true }));
  const visited = new Set<string>();
  const watched = new Set<string>();
  while (queue.length !== 0) {
    const state = queue.shift()!;
    const key = state.url + "\0" + (state.watched ? "1" : "0");
    if (visited.has(key)) continue;
    visited.add(key);
    if (state.watched) watched.add(state.url);
    for (const edge of adjacency.get(state.url) ?? []) {
      const childLocation = graphNodes.get(edge.child);
      const childWatched = edge.packageBoundary
        ? false
        : childLocation !== undefined && !pathHasNodeModules(childLocation)
          ? true
          : state.watched;
      queue.push({ url: edge.child, watched: childWatched });
    }
  }
  return watched;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isModuleNamespace(value: Record<string, unknown>): boolean {
  return Object.prototype.toString.call(value) === "[object Module]";
}

function hasConfigKey(value: Record<string, unknown>): boolean {
  for (const key of CONFIG_KEYS) {
    if (hasOwn(value, key)) {
      return true;
    }
  }
  return false;
}

function mergeConfigObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out = toSerializableConfig(base);
  for (const key of CONFIG_KEYS) {
    if (hasOwn(override, key)) {
      out[key] = override[key];
    }
  }
  return out;
}

// toSerializableConfig copies every ITtscLintConfig key onto a plain object so
// it survives the JSON round trip to the Go sidecar. Every key is copied
// verbatim — files, ignores, extends, plugins, rules, AND format — so a config
// whose only key is "format" is not silently dropped.
function toSerializableConfig(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) {
    if (hasOwn(value, key)) {
      out[key] = value[key];
    }
  }
  return out;
}
`,
    importLiteral,
    outputLiteral,
    resolutionRootLiteral,
    serializableConfigKeysLiteral(),
  )
}

// typeScriptConfigLoaderTsconfig generates the JSON content of the ephemeral
// tsconfig that compiles the loader script. Settings mirror the JS-factory
// loader's lenient baseline so identical user configs evaluate the same way
// from both the JS and Go sides.
func typeScriptConfigLoaderTsconfig(loader, location, outDir string) string {
  // Mirror the JS-factory loader's lenient settings (see the matching
  // tsconfig synthesis in `packages/lint/src/index.ts::readTtsxConfigPlugins`).
  // Both sides evaluate the SAME user-authored lint config; without
  // matching strictness, a config that loads fine through the JS
  // factory could be rejected by the Go sidecar (or vice versa) on
  // identical input. The loader is extracting data, not validating
  // user code, so `strict: false` + `allowJs: true` + `noImplicitAny:
  // false` is the right baseline.
  content := map[string]any{
    "compilerOptions": map[string]any{
      "allowImportingTsExtensions": true,
      "allowJs":                    true,
      "checkJs":                    false,
      // The config is a Node module, so Node's rule decides its format: the
      // nearest package.json "type" above it. Hardcoding one answer ran every
      // ambiguous `.ts` config as ESM and broke __dirname in an ordinary
      // CommonJS package (#1068). moduleResolution stays "bundler", which tsgo
      // accepts for both kinds, so extensionless relative imports keep
      // resolving either way.
      "module":                          configModuleOption(location),
      "moduleResolution":                "bundler",
      "jsx":                             "preserve",
      "noImplicitAny":                   false,
      "outDir":                          filepath.ToSlash(filepath.Join(outDir, "out")),
      "rewriteRelativeImportExtensions": true,
      "rootDir":                         loaderRootDir(outDir),
      "skipLibCheck":                    true,
      "strict":                          false,
      "target":                          "ES2022",
      // TypeScript 7 includes no ambient type package unless "types" asks for
      // it, and this Program extends nothing, so without the wildcard a config
      // could not name a single Node global (#1068). The loader directory links
      // the config's nearest node_modules, so the default typeRoots walk finds
      // exactly what the project installed.
      "types": []string{"*"},
    },
    "files": []string{
      filepath.ToSlash(loader),
      filepath.ToSlash(location),
    },
  }
  body, err := json.MarshalIndent(content, "", "  ")
  if err != nil {
    panic(err)
  }
  return string(body)
}

// ttsc:config-loader-shared begin
//
// One policy in three Go copies: everything between these markers is
// duplicated verbatim in packages/lint/linthost/config.go,
// packages/banner/driver/banner.go and packages/strip/driver/config.go. #1169
// decided against extracting it — the only home the three modules could share
// is the public `packages/ttsc/driver` seam, and packages/lint's go.mod
// deliberately requires no in-tree ttsc module — so a change to one copy must
// be made to all three.
//
// The code between the markers must stay identical. Comments may differ, the
// `@ttsc/<pkg>:` error prefix may differ, and @ttsc/strip spells each name with
// a `strip` prefix. Anything package-specific belongs outside the markers.

// configModuleOption returns the loader tsconfig's "module" for a config file:
// the module kind Node itself would give that file.
//
// An explicit .cts/.cjs or .mts/.mjs extension already decides the emit format
// on its own, so those keep the ES-module setting and let the extension win —
// the same precedence tsgo applies. Everything ambiguous walks up for the
// nearest package.json "type", exactly as Node does when it loads the file.
func configModuleOption(location string) string {
  switch strings.ToLower(filepath.Ext(location)) {
  case ".ts", ".tsx", ".js":
    if nearestPackageType(location) == "commonjs" {
      return "CommonJS"
    }
  }
  return "ESNext"
}

// nearestPackageType mirrors Node's package-scope lookup for the nearest
// package.json above location: the walk stops at the FIRST manifest it finds,
// and a manifest declaring no "type" means CommonJS rather than a reason to
// keep climbing. Reaching the filesystem root without any manifest also means
// CommonJS. The location is made absolute first, so a relative config path
// cannot end the walk at "." after a single step.
func nearestPackageType(location string) string {
  absolute, err := filepath.Abs(location)
  if err != nil {
    absolute = location
  }
  dir := filepath.Dir(absolute)
  for {
    raw, err := os.ReadFile(filepath.Join(dir, "package.json"))
    if err == nil {
      var manifest struct {
        Type string `json:"type"`
      }
      // A manifest that does not parse still bounds the package scope; Node
      // refuses to look past it, and CommonJS is the format it defaults to.
      if json.Unmarshal(raw, &manifest) == nil && manifest.Type == "module" {
        return "module"
      }
      return "commonjs"
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return "commonjs"
    }
    dir = parent
  }
}

// loaderRootDir returns the widest rootDir that still contains the loader
// tsconfig's inputs: the volume root of the loader temp dir (`C:/` on
// Windows, `/` elsewhere). A literal "/" is not an ancestor of drive-letter
// paths, so tsgo rejects every input with TS6059 (#299). The temp dir is
// created on the same volume as the config file (see loaderTempBase), so its
// volume root spans both `files` entries.
func loaderRootDir(outDir string) string {
  vol := filepath.VolumeName(outDir)
  if vol == "" {
    return "/"
  }
  return filepath.ToSlash(vol + `\`)
}

// loaderTempBase picks the parent directory for the ephemeral config-loader
// tree. The system temp dir is the default, but when it sits on a different
// volume than the config file (Windows: TEMP on `C:`, project on `D:`) the
// loader cannot work from there — no single tsconfig rootDir spans two
// volumes and filepath.Rel cannot produce a relative import across drives
// (#305) — so the tree is created under the config's nearest
// node_modules/.cache instead, falling back to the config's own directory
// when no node_modules exists (or its .cache cannot be created): any location
// on the config's volume beats the system temp dir, which is guaranteed to
// fail. Returns "" (the os.MkdirTemp default) when the volumes already match.
func loaderTempBase(location, systemTemp string) string {
  // A relative location has no volume; "" must not be read as "a volume
  // other than the system temp's" — it keeps the historical default (and
  // the Rel-failure contract for relative config paths).
  vol := filepath.VolumeName(location)
  if vol == "" || strings.EqualFold(filepath.VolumeName(systemTemp), vol) {
    return ""
  }
  nodeModules := findNearestNodeModules(filepath.Dir(location))
  if nodeModules == "" {
    return filepath.Dir(location)
  }
  // Resolve a linked node_modules (junction/symlink — common in managed
  // setups) before descending into it: the ESM runtime realpaths the loader
  // module at import time, and a relative config specifier computed from the
  // link-form path would resolve against the wrong directory. NTFS junctions
  // defeat filepath.EvalSymlinks, so the link component is chased by hand
  // first. Realpathing may also land on another volume, which defeats the
  // whole point — fall back to the config's directory then.
  base := filepath.Join(resolveDirLink(nodeModules), ".cache")
  if err := os.MkdirAll(base, 0o755); err != nil {
    return filepath.Dir(location)
  }
  real, err := filepath.EvalSymlinks(base)
  if err != nil || !strings.EqualFold(filepath.VolumeName(real), filepath.VolumeName(location)) {
    return filepath.Dir(location)
  }
  return real
}

func realpathIfPossible(location string) string {
  real, err := filepath.EvalSymlinks(location)
  if err != nil {
    return location
  }
  return real
}

// resolveDirLink chases a directory that is itself a symlink or NTFS junction
// to its target (bounded against link cycles). os.Readlink is the probe:
// it resolves junctions, which report neither ModeSymlink nor an
// EvalSymlinks-traversable path.
func resolveDirLink(dir string) string {
  for i := 0; i < 8; i++ {
    target, err := os.Readlink(dir)
    if err != nil {
      return dir
    }
    if !filepath.IsAbs(target) {
      target = filepath.Join(filepath.Dir(dir), target)
    }
    dir = target
  }
  return dir
}

// Both tools the TypeScript config evaluator needs — the `ttsx` launcher it
// spawns and the native compiler it hands that launcher — are resolved from the
// project being linted, with an explicit environment variable winning and a
// last resort that invents no path.
//
// No automated check holds the three Go copies identical: a change lands in
// all three by hand, and each package's own config-loader tests exercise it.
// The JS original — `resolveConfigTsgo` / `resolveTtsxLauncher` in
// packages/lint/src/index.ts — is a fourth copy in another language; the two
// evaluators must keep one policy, because it was a divergence between them
// that made a TypeScript lint config unevaluable outside a `ttsx`-launched
// host.
//
// The environment alone is the wrong place to ask. `ttsx` exports
// TTSC_TSGO_BINARY and TTSC_TTSX_BINARY to its own descendants, so a host
// launched under `ttsx` inherited both and a host launched any other way
// inherited neither. The shipped `ttscserver` binary invoked with its
// documented `--tsgo <path>` flag keeps that path in a local and exports
// nothing, and an embedder of the driver package exports nothing either. For
// those the evaluator spawned a bare `ttsx` that only a global install puts on
// PATH, and, past that, a compiler-less child that aborted with
// `ttsc: typescript is required` before a line of the config was read.
//
// configToolAnchors lists the file paths those resolutions walk upward from,
// in order: the config file being evaluated, then the resolution root's
// manifest. The config comes first because it is the file whose own
// installation decides which toolchain the config's imports were written
// against; the resolution root answers for a config that lives outside the
// project tree (an `extends` target, or a `configFile` pointed at a shared
// package).
//
// The JS evaluator carries a third anchor, the loaded descriptor's own
// directory. It has no counterpart here: this host is a compiled binary rather
// than a module some `node_modules` copy of `@ttsc/lint` was loaded from, so
// there is no third installation to ask.
func configToolAnchors(configPath, resolutionRoot string) []string {
  anchors := make([]string, 0, 2)
  if strings.TrimSpace(configPath) != "" {
    anchors = append(anchors, configPath)
  }
  if strings.TrimSpace(resolutionRoot) != "" {
    anchors = append(anchors, filepath.Join(resolutionRoot, "package.json"))
  }
  return anchors
}

// resolveConfigTsgo returns the native TypeScript compiler the evaluator hands
// its ttsx child through `--binary`, or "" to leave the child resolving for
// itself.
//
// The child runs with `--cwd <ephemeral loader dir>`, so it cannot discover
// `typescript` the way an ordinary invocation does: linkNearestNodeModules is
// the only thing that puts the project's modules within its reach, and it links
// nothing when the config's ancestry carries no node_modules. An explicit
// TTSC_TSGO_BINARY still wins, so an embedder that pins a compiler keeps
// pinning it. "" is the unchanged last resort: a project that cannot answer
// here could not answer inside the child either, and the child's own diagnostic
// is the one that names the missing package.
func resolveConfigTsgo(anchors []string) string {
  if explicit := strings.TrimSpace(os.Getenv("TTSC_TSGO_BINARY")); explicit != "" {
    return explicit
  }
  for _, anchor := range anchors {
    if binary := tsgoBinaryFrom(anchor); binary != "" {
      return binary
    }
  }
  return ""
}

// tsgoBinaryFrom returns the platform compiler executable of the `typescript`
// install `anchor` can see, or "" when this anchor reaches neither the package
// nor its platform dependency.
//
// Mirrors resolveTsgo.ts so the Go host and the JS launcher name one file: the
// `typescript` manifest, then `@typescript/typescript-<platform>-<arch>`
// resolved from that manifest, then `lib/tsc` inside it.
//
// The install is chased to its real directory before the second hop, because
// Node resolves a module's own dependencies from its real location. pnpm keeps
// the real `typescript` directory in its content-addressed store with the
// platform package beside it and leaves a link in the project's node_modules,
// so a walk that started at the link would climb straight past the platform
// package. NTFS junctions defeat filepath.EvalSymlinks, so the link component
// is chased by hand first, the same order loaderTempBase uses.
func tsgoBinaryFrom(anchor string) string {
  manifest := nodePackageManifestFrom(anchor, "typescript")
  if manifest == "" {
    return ""
  }
  packageDir := realpathIfPossible(resolveDirLink(filepath.Dir(manifest)))
  platform, arch := nodePlatformPair()
  platformManifest := nodePackageManifestFrom(
    filepath.Join(packageDir, "package.json"),
    "@typescript/typescript-"+platform+"-"+arch,
  )
  if platformManifest == "" {
    return ""
  }
  name := "tsc"
  if runtime.GOOS == "windows" {
    name = "tsc.exe"
  }
  binary := filepath.Join(filepath.Dir(platformManifest), "lib", name)
  if stat, err := os.Stat(binary); err != nil || stat.IsDir() {
    return ""
  }
  return binary
}

// resolveTtsxLauncher returns the launcher ttsxCommandContext spawns.
//
// An explicit TTSC_TTSX_BINARY wins. Otherwise the launcher is derived from the
// `ttsc` installation one of the anchors can see, because a bare command name
// only works when a bin link happens to be on PATH — which it is for a global
// install and is not for the ordinary project-local one. The bare `"ttsx"` name
// remains the unchanged last resort for an installation no anchor reaches.
func resolveTtsxLauncher(anchors []string) string {
  if explicit := strings.TrimSpace(os.Getenv("TTSC_TTSX_BINARY")); explicit != "" {
    return explicit
  }
  for _, anchor := range anchors {
    if launcher := ttsxLauncherFrom(anchor); launcher != "" {
      return launcher
    }
  }
  return "ttsx"
}

// ttsxLauncherFrom returns `lib/launcher/ttsx.js` of the `ttsc` install
// `anchor` can see, or "" when this anchor reaches no such install. Only the
// manifest is an exported subpath, so the launcher is derived from where the
// manifest resolved rather than requested as a subpath of its own.
func ttsxLauncherFrom(anchor string) string {
  manifest := nodePackageManifestFrom(anchor, "ttsc")
  if manifest == "" {
    return ""
  }
  launcher := filepath.Join(filepath.Dir(manifest), "lib", "launcher", "ttsx.js")
  if stat, err := os.Stat(launcher); err != nil || stat.IsDir() {
    return ""
  }
  return launcher
}

// nodePackageManifestFrom resolves `<pkg>/package.json` the way Node's
// require.resolve does from the FILE `anchor`: walk upward from the anchor's
// directory and return the first `<dir>/node_modules/<pkg>/package.json` that
// exists. The anchor is treated as a file path, so its own directory is the
// first candidate's parent, and it need not exist — Node derives the search
// paths from the string alone.
//
// A directory already named `node_modules` contributes no candidate of its own,
// matching Module._nodeModulePaths, so nothing ever resolves through
// `node_modules/node_modules`.
//
// A relative anchor is resolved against the process directory before the walk,
// again matching Node. Walking a relative path instead would terminate at "."
// after one step and silently answer nothing for a config named relatively.
func nodePackageManifestFrom(anchor, pkg string) string {
  if strings.TrimSpace(anchor) == "" || pkg == "" {
    return ""
  }
  if absolute, err := filepath.Abs(anchor); err == nil {
    anchor = absolute
  }
  dir := filepath.Dir(filepath.Clean(anchor))
  for {
    if filepath.Base(dir) != "node_modules" {
      candidate := filepath.Join(dir, "node_modules", filepath.FromSlash(pkg), "package.json")
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        return candidate
      }
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return ""
    }
    dir = parent
  }
}

// nodePlatformPair is nodePlatformPairFor applied to this build's own target.
func nodePlatformPair() (string, string) {
  return nodePlatformPairFor(runtime.GOOS, runtime.GOARCH)
}

// nodePlatformPairFor maps a Go build target onto the `process.platform` and
// `process.arch` pair npm spells a platform package with, so the package name
// this host resolves is the same one the JS launcher resolves.
//
// Only the members whose two vocabularies disagree are mapped. Every other
// value is identical on both sides and passes through, which keeps a target
// neither side publishes yet resolvable rather than silently wrong, and keeps
// this from becoming a list that has to grow with every new port.
func nodePlatformPairFor(goos, goarch string) (string, string) {
  platform := goos
  switch platform {
  case "windows":
    platform = "win32"
  case "solaris":
    platform = "sunos"
  }
  arch := goarch
  switch arch {
  case "amd64":
    arch = "x64"
  case "386":
    arch = "ia32"
  case "ppc64le":
    arch = "ppc64"
  }
  return platform, arch
}

// ttsxCommand returns a ttsx exec.Cmd bound to a background context. Use
// ttsxCommandContext when the caller owns a cancellable context.
func ttsxCommand(anchors []string, args ...string) *exec.Cmd {
  return ttsxCommandContext(context.Background(), anchors, args...)
}

// ttsxCommandContext is the cancellable variant, used by the config loaders so
// their subprocess is torn down with the call that started it. It carries no
// deadline: evaluating a user config is the user's own code running, and how
// long that is allowed to take is not this binary's decision.
//
// `anchors` are the file paths the launcher is resolved from; see
// resolveTtsxLauncher.
func ttsxCommandContext(ctx context.Context, anchors []string, args ...string) *exec.Cmd {
  ttsx := resolveTtsxLauncher(anchors)
  if shouldRunTtsxThroughNode(ttsx) {
    node := os.Getenv("TTSC_NODE_BINARY")
    if node == "" {
      node = "node"
    }
    return exec.CommandContext(ctx, node, append([]string{ttsx}, args...)...)
  }
  return exec.CommandContext(ctx, ttsx, args...)
}

// shouldRunTtsxThroughNode reports whether the resolved ttsx binary is a
// script (JS or TS extension) rather than a compiled native executable.
// Scripts must be executed via `node <binary> <args>` instead of directly.
func shouldRunTtsxThroughNode(binary string) bool {
  switch strings.ToLower(filepath.Ext(binary)) {
  case ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts":
    return true
  default:
    return false
  }
}

// nodeConfigLoaderEnv builds the environment for a Node.js config-loader
// subprocess. It prepends the nearest node_modules directory to NODE_PATH so
// that imports in .js/.cjs/.mjs config files resolve correctly even when the
// subprocess's cwd differs from the config file's location.
func nodeConfigLoaderEnv(location string) []string {
  env := os.Environ()
  parts := make([]string, 0, 2)
  if nodeModules := findNearestNodeModules(filepath.Dir(location)); nodeModules != "" {
    parts = append(parts, nodeModules)
  }
  if existing := os.Getenv("NODE_PATH"); existing != "" {
    parts = append(parts, existing)
  }
  if len(parts) == 0 {
    return env
  }
  return setEnv(env, "NODE_PATH", strings.Join(parts, string(os.PathListSeparator)))
}

// linkNearestNodeModules creates a node_modules symlink (or Windows junction)
// inside `tempDir` that points at the nearest node_modules directory found
// upward from `sourceDir`. This lets the TypeScript config loader resolve
// imports from the user's project without copying the entire module tree.
// If no node_modules directory exists, the function is a no-op.
func linkNearestNodeModules(tempDir, sourceDir string) error {
  nodeModules := findNearestNodeModules(sourceDir)
  if nodeModules == "" {
    return nil
  }
  link := filepath.Join(tempDir, "node_modules")
  err := os.Symlink(nodeModules, link)
  if err == nil {
    return nil
  }
  // Windows: a true symbolic link needs SeCreateSymbolicLinkPrivilege
  // (admin or Developer Mode). The JS side uses fs.symlink with the
  // `"junction"` type to dodge that restriction; here we shell out to
  // `mklink /J` to create an equivalent directory junction. Junctions
  // only work for absolute directory targets, which matches the input.
  if runtime.GOOS == "windows" {
    jerr := createWindowsJunction(link, nodeModules)
    if jerr == nil {
      return nil
    }
    err = fmt.Errorf("%w (junction fallback: %v)", err, jerr)
  }
  return fmt.Errorf("@ttsc/lint: link config node_modules %s: %w", nodeModules, err)
}

// createWindowsJunction creates a directory junction at `link` pointing at
// `target`. Junctions do not require elevated privileges (unlike symlinks on
// Windows), making them the right fallback when os.Symlink fails.
func createWindowsJunction(link, target string) error {
  return windowsjunction.Create(link, target)
}

// findNearestNodeModules walks upward from `start` and returns the first
// node_modules directory found, or the empty string if the filesystem root is
// reached without a match.
func findNearestNodeModules(start string) string {
  dir := filepath.Clean(start)
  for {
    candidate := filepath.Join(dir, "node_modules")
    if stat, err := os.Stat(candidate); err == nil && stat.IsDir() {
      return candidate
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return ""
    }
    dir = parent
  }
}

// setEnv updates an existing key=value entry in `env` (in-place) or appends
// a new one. It is intentionally a pure-slice helper — no os.Setenv side
// effects — so callers can pass it directly to exec.Cmd.Env.
func setEnv(env []string, key, value string) []string {
  prefix := key + "="
  for i, entry := range env {
    if strings.HasPrefix(entry, prefix) {
      env[i] = prefix + value
      return env
    }
  }
  return append(env, prefix+value)
}

// ttsc:config-loader-shared end

// parseExternalRuleEntry delegates to parseRuleEntry. It is kept under this
// name because test files in the same package call it directly.
func parseExternalRuleEntry(v any) (Severity, json.RawMessage, error) {
  return parseRuleEntry(v)
}

// parseSeverity converts a raw config value to a Severity. Accepts the string
// literals "off", "warn"/"warning", "error" and the numeric equivalents 0, 1,
// 2 (the ESLint convention). Any other value is a hard error — there is no
// silent fallback so typos are surfaced immediately.
func parseSeverity(v any) (Severity, error) {
  switch x := v.(type) {
  case string:
    switch x {
    case "off":
      return SeverityOff, nil
    case "warning", "warn":
      return SeverityWarn, nil
    case "error":
      return SeverityError, nil
    }
    return SeverityOff, fmt.Errorf("unknown severity %q (want off | warn | warning | error)", x)
  case float64:
    switch x {
    case 0:
      return SeverityOff, nil
    case 1:
      return SeverityWarn, nil
    case 2:
      return SeverityError, nil
    }
    return SeverityOff, fmt.Errorf("unknown severity %v (want 0 | 1 | 2)", x)
  }
  return SeverityOff, fmt.Errorf("severity must be one of: off | warn | warning | error | 0 | 1 | 2, got %T", v)
}

// sortedRuleNames returns the sorted slice of rule names from `config` for
// which `include` returns true. Sorting ensures deterministic dispatch-table
// ordering so test output and diagnostic ordering are stable across runs.
func sortedRuleNames(config RuleConfig, include func(Severity) bool) []string {
  names := make([]string, 0, len(config))
  for name, sev := range config {
    if include(sev) {
      names = append(names, name)
    }
  }
  sort.Strings(names)
  return names
}

// matchAnyPattern reports whether `fileName` matches at least one of the
// provided glob patterns. If baseDir is non-empty, both paths are made
// absolute before computing a relative path so that glob patterns rooted at
// the config file's directory match correctly regardless of the process cwd.
// Files outside the base directory never match (the relative path would start
// with "..").
func matchAnyPattern(baseDir string, patterns []string, fileName string) bool {
  rel := filepath.ToSlash(fileName)
  base := ""
  if baseDir != "" {
    base = baseDir
    if abs, err := filepath.Abs(base); err == nil {
      base = abs
    }
    base = realProjectPath(base)
    file := fileName
    if abs, err := filepath.Abs(file); err == nil {
      file = abs
    }
    file = realProjectPath(file)
    if candidate, err := filepath.Rel(base, file); err == nil {
      if candidate == ".." || strings.HasPrefix(candidate, ".."+string(filepath.Separator)) {
        return false
      }
      rel = filepath.ToSlash(candidate)
    } else {
      base = ""
    }
  }
  rel = strings.TrimPrefix(rel, "./")
  if matchAnyGlob(patterns, rel) {
    return true
  }
  if base == "" {
    return false
  }
  // Most glob misses cannot become matches by changing only case. Rule
  // overrides test every file, so avoid a directory walk for those misses.
  // Character classes, escapes, and Unicode use the full on-disk decision:
  // lowercasing a class range can change which punctuation it admits.
  if !mayMatchStoredCase(patterns, rel) {
    return false
  }
  stored := storedRelativeSpelling(base, rel)
  return stored != rel && matchAnyGlob(patterns, stored)
}

func matchAnyGlob(patterns []string, rel string) bool {
  for _, pattern := range patterns {
    if matchGlob(normalizeGlobPattern(pattern), rel) {
      return true
    }
  }
  return false
}

// mayMatchStoredCase is only a negative filter. A simple ASCII glob that
// cannot match rel even without case has no stored-case match to discover.
// Anything whose case folding or glob grammar needs more than ASCII is read
// from the tree instead of risking a false negative.
func mayMatchStoredCase(patterns []string, rel string) bool {
  if !isASCII(rel) {
    return true
  }
  folded := strings.ToLower(rel)
  for _, pattern := range patterns {
    if !isASCII(pattern) || strings.ContainsAny(pattern, "[]\\") {
      return true
    }
    if matchGlob(strings.ToLower(normalizeGlobPattern(pattern)), folded) {
      return true
    }
  }
  return false
}

func isASCII(value string) bool {
  for index := 0; index < len(value); index++ {
    if value[index] >= 0x80 {
      return false
    }
  }
  return true
}

// storedRelativeSpelling returns `rel`, a slash-separated path below `base`,
// spelled the way each directory stores its names. A Program can name a file
// the way an import spelled it, and on a volume that ignores case (macOS's
// default) `SRC/DIRECTORY/index.ts` reaches `src/directory/index.ts` while
// `filepath.EvalSymlinks` keeps the import's spelling, so a glob written
// against the tree missed it (samchon/ttsc#1589). Each component its parent
// does not list exactly is replaced by the one entry equal to it ignoring
// case; a path that does not exist, or a component with no single such entry,
// keeps the given spelling.
func storedRelativeSpelling(base, rel string) string {
  if _, err := os.Stat(filepath.Join(base, filepath.FromSlash(rel))); err != nil {
    return rel
  }
  current := base
  components := strings.Split(rel, "/")
  for index, component := range components {
    if component == "" || component == "." {
      continue
    }
    components[index] = storedEntryName(current, component)
    current = filepath.Join(current, components[index])
  }
  return strings.Join(components, "/")
}

// storedEntryName is the name `directory` stores for `name`: `name` itself when
// the directory lists it, else its single entry equal to it ignoring case.
func storedEntryName(directory, name string) string {
  entries, err := os.ReadDir(directory)
  if err != nil {
    return name
  }
  match := ""
  for _, entry := range entries {
    if entry.Name() == name {
      return name
    }
    if strings.EqualFold(entry.Name(), name) {
      if match != "" {
        return name
      }
      match = entry.Name()
    }
  }
  if match == "" {
    return name
  }
  return match
}

// normalizeGlobPattern normalizes a user-supplied glob pattern to forward
// slashes and strips a leading "./". Patterns that contain no slash are treated
// as basename-only globs by prepending "**/" so that `*.ts` matches any
// TypeScript file regardless of directory depth, matching ESLint's behavior.
func normalizeGlobPattern(pattern string) string {
  pattern = filepath.ToSlash(pattern)
  pattern = strings.TrimPrefix(pattern, "./")
  if !strings.Contains(pattern, "/") {
    return "**/" + pattern
  }
  return pattern
}

// Severity returns the configured level for a rule, defaulting to
// `SeverityOff`. Rules opt in explicitly — silent on missing entries.
// Lookup accepts either canonical or eslint-prefixed stored keys after map
// identity validation through ResolveProjectRules.
//
// @evidence contracts/common.md#principled-implementation Exact, canonical and unique normalized-alias lookup preserve explicit off values and default only absent names to off after identity validation.
// @evidence contracts/common.md#clear-and-simple-design One scalar lookup owns absence behavior without constructing a normalized map for each rule query.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing declarations remain disabled by documented policy rather than a fixture-specific activation fallback.
// @evidence contracts/common.md#meaningful-documentation Native prose explains opt-in absence and the direction of alias lookup, separated from the acknowledgment tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Severity looks up a rule severity by name and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Exact and canonical keys use an expected constant number of map probes, with hashing and normalization proportional to query-name bytes. Only a miss scans n stored names, paying their normalization/comparison byte costs; no normalized map or cached snapshot is built.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Severity keeps no cache and shares no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Severity acquires no handle or task and retains nothing.
func (c RuleConfig) Severity(name string) Severity {
  if c == nil {
    return SeverityOff
  }
  if sev, ok := c[name]; ok {
    return sev
  }
  canonical := normalizeBuiltinRuleName(name)
  if sev, ok := c[canonical]; ok {
    return sev
  }
  for storedName, sev := range c {
    if normalizeBuiltinRuleName(storedName) == canonical {
      return sev
    }
  }
  return SeverityOff
}

// loaderFailureReason reads the failure envelope a config loader writes to its
// private result file when it stops on an error it can name.
//
// The loader's stack goes to this process's stderr as it runs, which is where a
// reader wants it. But the reason — "config file must export an ITtscLintConfig
// object" — is a fact about the user's config, and a caller deserves it in the
// error rather than having to go find it in the log. Only a well-formed
// envelope is honoured; anything else leaves the process status to speak.
//
// The key is `__ttscLoaderError` — the same spelling every other ttsc loader
// writes, and namespaced so it cannot collide with a payload field. This file
// spends "error" on rule severity, which is exactly the confusion a shared,
// prefixed key avoids.
// observe receives this same read's bytes and error before envelope decoding;
// it cannot substitute bytes or alter the returned failure reason.
func loaderFailureReason(outputPath string, observe func([]byte, error)) string {
  raw, err := os.ReadFile(outputPath)
  observe(raw, err)
  if err != nil {
    return ""
  }
  var envelope struct {
    Error string `json:"__ttscLoaderError"`
  }
  if json.Unmarshal(raw, &envelope) != nil {
    return ""
  }
  return strings.TrimSpace(envelope.Error)
}
