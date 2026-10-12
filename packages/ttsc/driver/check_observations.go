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
// A nil Program publishes empty observation collections and an explicit incomplete
// marker, because no generation supplied input authority. For a loaded Program,
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
  if !filepath.IsAbs(fileName) {
    return fmt.Errorf("driver: check observations path must be absolute: %q", fileName)
  }
  inputs := []string{}
  hashes := map[string]*string{}
  realpaths := map[string]*string{}
  var complete *bool
  var graph *TransformGraph
  if program == nil || program.PluginObservationsIncomplete() {
    unavailable := false
    complete = &unavailable
  }
  if program != nil {
    if program.TSProgram != nil {
      graph = NewTransformGraph(program, program.TSProgram.GetCurrentDirectory().AsString())
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
