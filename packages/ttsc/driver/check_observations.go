package driver

import (
  "encoding/json"
  "fmt"
  "path/filepath"
)

// WriteCheckObservationsJSON publishes the linked-hook input observations of a
// completed check invocation to its caller-owned absolute private path. The
// caller must keep the Program open until this snapshot is written. Command
// status and diagnostics remain independent of these observation facts.
//
// A nil Program publishes empty hook observation collections and an explicit
// incomplete marker. WriteCheckRecoveryObservationsJSON additionally accepts
// actual failed-load CLI/config predicates without completed Program authority.
// For a loaded Program,
// only an explicit hook limitation adds that marker. Its absence does not prove
// the population complete or repair missing or conflicting individual proofs.
// The caller owns a fresh result path, its parent directory and eventual artifact
// removal. Publication occurs only after a temporary write and close succeed.
//
// @evidence contracts/common.md#principled-implementation The same loaded Program supplies recorded input names and consistent supplied content and physical-path reports; missing generation authority is explicitly incomplete, while diagnostics and individual conflicts retain their independent meanings.
// @evidence contracts/common.md#clear-and-simple-design One typed wire object keeps hook observations separate from human diagnostic streams and never reloads a second compiler generation to reconstruct them.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No later filesystem read or fabricated proof repairs a missing generation, unknown input or explicit observation limitation.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state absolute private-path ownership, Program lifetime, independent command status and the nil/absent-marker distinctions following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native filepath admission and the shared same-directory publisher preserve host paths without shell parsing or separator substitution; observed physical names pass through unchanged.
// @evidence contracts/performance.md#efficient-algorithms Each accessor snapshots and combines scope reports; input names and JSON map keys sort by text. Encoding and native publication include report population, path and value byte costs and temporary collection copies rather than only the final payload.
// @evidence contracts/performance.md#reuse-equivalent-work The same check generation's recorded observations supply the result without reparsing sources or reexecuting configuration hooks.
// @evidence contracts/performance.md#bound-retention-and-release-resources Scope snapshots and encoding buffers are call-local without a payload cap. The shared publisher closes its temporary descriptor before rename and attempts removal on failure, returning cleanup errors; the caller owns the Program, fresh destination, parent directory and final artifact removal.
func WriteCheckObservationsJSON(fileName string, program *Program) error {
  return WriteCheckRecoveryObservationsJSON(fileName, program, nil)
}

// WriteCheckRecoveryObservationsJSON publishes check observations with an
// optional failed-load recovery graph. A loaded Program always supplies its own
// graph instead; nil Program remains explicitly incomplete. The recovery graph
// comes from that invocation's OnFailureInputs sink, not a later filesystem read.
//
// @evidence contracts/common.md#principled-implementation Loaded Program observations retain their generation; only a nil Program admits supplied failed-load predicates, with explicit incomplete hook authority.
// @evidence contracts/common.md#clear-and-simple-design One publisher serves the original two-argument API and native callers retaining failed-load recovery inputs.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fake Program, reconstructed resolver or later read supplies recovery metadata; status remains separate.
// @evidence contracts/common.md#meaningful-documentation Native prose states recovery provenance, Program precedence and incomplete authority.
// @evidence contracts/portability.md#os-neutral-implementation Native absolute path validation and the existing same-directory private publisher retain observation spellings unchanged.
// @evidence contracts/performance.md#efficient-algorithms Program accessors snapshot current ledgers and graph; JSON encoding and publication visit retained predicate/path bytes and allocate the serialized payload without a population cap.
// @evidence contracts/performance.md#reuse-equivalent-work The invocation's existing observations supply metadata without another compiler load or filesystem proof read.
// @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns Program/recovery lifetimes and the final artifact; call-local snapshots and encoding buffers add no historical registry, and the shared publisher closes temporary handles.
func WriteCheckRecoveryObservationsJSON(fileName string, program *Program, recovery *TransformGraph) error {
  if !filepath.IsAbs(fileName) {
    return fmt.Errorf("driver: check observations path must be absolute: %q", fileName)
  }
  inputs := []string{}
  hashes := map[string]*string{}
  realpaths := map[string]*string{}
  var complete *bool
  var graph *TransformGraph
  if program == nil {
    graph = recovery
  }
  if program == nil || program.PluginObservationsIncomplete() {
    unavailable := false
    complete = &unavailable
  }
  if program != nil {
    if program.TSProgram != nil {
      graph = NewTransformGraph(program, string(program.TSProgram.GetCurrentDirectory()))
    }
    if recorded := program.PluginHostInputs(); recorded != nil {
      inputs = recorded
    }
    if recorded := program.PluginHostInputHashes(); recorded != nil {
      hashes = recorded
    }
    if recorded := program.PluginHostInputRealpaths(); recorded != nil {
      realpaths = recorded
    }
  }
  data, err := json.Marshal(struct {
    Graph                *TransformGraph    `json:"graph,omitempty"`
    HostInputs           []string           `json:"hostInputs"`
    HostInputHashes      map[string]*string `json:"hostInputHashes"`
    HostInputRealpaths   map[string]*string `json:"hostInputRealpaths"`
    ObservationsComplete *bool              `json:"observationsComplete,omitempty"`
  }{graph, inputs, hashes, realpaths, complete})
  if err != nil {
    return err
  }
  return writePrivateResult(fileName, data)
}
