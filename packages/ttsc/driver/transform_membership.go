package driver

import (
  "sort"
  "strings"
)

// TransformMembership reports the native settings needed to discover possible
// roots. Output directories are absolute compiler paths; nil clears an inherited
// output option. Explicit excludes and files/include specifications remain in
// the authored configuration. This metadata does not certify a completed walk.
//
// @evidence contracts/common.md#principled-implementation Supported extension groups and parsed output paths retain effective native settings independently of JSON-only reconstruction.
// @evidence contracts/common.md#clear-and-simple-design Three fields express the root-admission dimensions that invocation options can change; config specification ownership stays separate.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No source population or completed walk is inferred from this settings report.
// @evidence contracts/common.md#meaningful-documentation Native prose and fields distinguish possible suffixes, absolute output paths and null clearing.
// @evidence contracts/portability.md#os-neutral-implementation Native compiler paths retain their spelling; consumers compare them under observed project anchors and compiler case policy.
// @evidenceExclude contracts/performance.md#efficient-algorithms This declaration chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This metadata owns no cache or reuse verdict.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller-owned report acquires no handle or historical state.
type TransformMembership struct {
  // InputExtensions preserve possible-root suffix spellings from upstream APIs.
  InputExtensions []string `json:"inputExtensions"`
  // OutDir is the parsed absolute output directory, or nil when unset.
  OutDir *string `json:"outDir"`
  // DeclarationDir is the parsed absolute declaration directory, or nil when unset.
  DeclarationDir *string `json:"declarationDir"`
}

// transformMembership projects upstream-supported suffixes and parsed paths.
// Declaration suffixes already covered by their underlying source suffix are
// redundant for possible-root admission and are omitted. Work follows extension
// text plus sorting; the returned report owns its slices and path pointers.
func transformMembership(prog *Program, groups [][]string) *TransformMembership {
  extensions := map[string]struct{}{}
  for _, group := range groups {
    for _, extension := range group {
      extensions[extension] = struct{}{}
    }
  }
  for extension := range extensions {
    if strings.HasPrefix(extension, ".d.") {
      if _, covered := extensions[extension[2:]]; covered {
        delete(extensions, extension)
      }
    }
  }
  out := &TransformMembership{InputExtensions: make([]string, 0, len(extensions))}
  for extension := range extensions {
    out.InputExtensions = append(out.InputExtensions, extension)
  }
  sort.Strings(out.InputExtensions)
  options := prog.ParsedConfig.CompilerOptions()
  if value := string(options.OutDir); value != "" {
    out.OutDir = &value
  }
  if value := string(options.DeclarationDir); value != "" {
    out.DeclarationDir = &value
  }
  return out
}
