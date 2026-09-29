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
// @evidence contracts/common.md#principled-implementation The same loaded Program supplies recorded input names, content and physical proofs; missing generation authority is explicitly incomplete, while diagnostics and individual conflicts retain their independent meanings.
// @evidence contracts/common.md#clear-and-simple-design One typed wire object keeps hook observations separate from human diagnostic streams and never reloads a second compiler generation to reconstruct them.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No later filesystem read or fabricated proof repairs a missing generation, unknown input or explicit observation limitation.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state absolute private-path ownership, Program lifetime, independent command status and the nil/absent-marker distinctions following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native filepath admission and the shared same-directory publisher preserve host paths without shell parsing or separator substitution; observed physical names pass through unchanged.
// @evidence contracts/performance.md#efficient-algorithms Existing hook ledgers project their observation population once each, followed by one JSON serialization and one artifact write.
// @evidence contracts/performance.md#reuse-equivalent-work The same check generation's recorded observations supply the result without reparsing sources or reexecuting configuration hooks.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The Program and final artifact lifecycle remain caller-owned, local snapshot bytes are transient, and the delegated publisher closes its descriptor and removes its temporary allocation.
func WriteCheckObservationsJSON(fileName string, program *Program) error {
  if !filepath.IsAbs(fileName) {
    return fmt.Errorf("driver: check observations path must be absolute: %q", fileName)
  }
  inputs := []string{}
  hashes := map[string]*string{}
  realpaths := map[string]*string{}
  var complete *bool
  if program == nil || program.PluginObservationsIncomplete() {
    unavailable := false
    complete = &unavailable
  }
  if program != nil {
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
    HostInputs           []string           `json:"hostInputs"`
    HostInputHashes      map[string]*string `json:"hostInputHashes"`
    HostInputRealpaths   map[string]*string `json:"hostInputRealpaths"`
    ObservationsComplete *bool              `json:"observationsComplete,omitempty"`
  }{inputs, hashes, realpaths, complete})
  if err != nil {
    return err
  }
  return writePrivateResult(fileName, data)
}
