// Package compileraliases discovers npm aliases by their declared package target.
package compileraliases

import (
  "encoding/json"
  "os"
  "path/filepath"
  "sort"
  "strings"
)

// Names returns declared npm aliases targeting typescript, followed by the
// ordinary typescript name. The nearest ancestor manifest declaring TypeScript
// or its aliases owns discovery; installed dependency trees are not scanned.
// Callers still resolve each name and verify its installed package identity.
//
// @evidence contracts/common.md#principled-implementation npm aliases declare a real target independently of their exposed name. Ancestor manifest dependency maps supply those arbitrary names, while installed identity and native version remain with the caller.
// @evidence contracts/common.md#clear-and-simple-design This package owns declaration discovery once for all Go config evaluators; each evaluator retains its existing Node-style manifest and platform resolution.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Only npm's target syntax and the real typescript identity are constants. No alias name, consumer or fixture controls selection.
// @evidence contracts/common.md#meaningful-documentation The comment defines filename anchors, ancestor traversal, output ordering and the caller's verification obligation; read or parse errors propagate except absent manifests.
// @evidence contracts/portability.md#os-neutral-implementation filepath.Abs, Dir and Join follow native paths; os.ReadFile closes its handles and no shell or filesystem case assumption is used.
// @evidence contracts/performance.md#efficient-algorithms The walk parses ancestor manifest bytes and visits D dependency declarations once; A unique aliases require O(A) retained names and O(A log A) sorting. No installed package population is traversed.
//
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable project declarations have no invalidation owner here, so every call reads current bytes.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads retain no handle; the returned name slice transfers to the caller.
func Names(anchor string) ([]string, error) {
  absolute, err := filepath.Abs(anchor)
  if err != nil {
    return nil, err
  }
  aliases := make(map[string]struct{})
  for directory := filepath.Dir(absolute); ; directory = filepath.Dir(directory) {
    body, err := os.ReadFile(filepath.Join(directory, "package.json"))
    if err != nil && !os.IsNotExist(err) {
      return nil, err
    }
    if err == nil {
      var project map[string]any
      if err := json.Unmarshal(body, &project); err != nil {
        return nil, err
      }
      declaresTypeScript := false
      for _, field := range []string{"dependencies", "devDependencies", "optionalDependencies"} {
        dependencies, _ := project[field].(map[string]any)
        if _, exists := dependencies["typescript"]; exists {
          declaresTypeScript = true
        }
        for name, value := range dependencies {
          specifier, ok := value.(string)
          if name != "typescript" && ok && (specifier == "npm:typescript" || strings.HasPrefix(specifier, "npm:typescript@")) {
            aliases[name] = struct{}{}
          }
        }
      }
      if declaresTypeScript || len(aliases) != 0 {
        break
      }
    }
    if filepath.Dir(directory) == directory {
      break
    }
  }
  names := make([]string, 0, len(aliases)+1)
  for name := range aliases {
    names = append(names, name)
  }
  sort.Strings(names)
  return append(names, "typescript"), nil
}
