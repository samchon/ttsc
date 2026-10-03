package driver

import (
  "encoding/json"
  "errors"
  "fmt"
  "path/filepath"
  "slices"
  "strings"
  "sync"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// NewEmitProvenanceRecorder wraps a writer and returns a build-owned snapshot
// function for successfully written JavaScript outputs. The compiler's actual
// eligible source list and output resolver determine candidates; neither sibling
// filenames nor source maps establish ownership.
//
// Snapshot keys are absolute native output paths. Values are sorted, distinct
// physical source paths recorded by this compiler generation's input observer.
// An empty value means an output was written but its eligible owners or some
// owner's physical proof were unavailable or inconsistent. Multiple values
// preserve ambiguity. An empty object means no JavaScript write succeeded.
//
// Call the snapshot after emission finishes. It remains attached to its captured
// generation's ledger and never resolves an alias against post-build disk state.
// The ledger does not claim an atomic filesystem or file
// descriptor snapshot; conflicting observed predicates invalidate ownership.
// A nil writer uses DefaultWriteFile. Callback execution is serialized.
//
// @evidence contracts/common.md#principled-implementation Native eligible sources and resolved script destinations intersect only successful unskipped writes; all candidate generation-time physical proofs are required, with unknown and multiple owners represented explicitly.
// @evidence contracts/common.md#clear-and-simple-design One compiler-owned candidate index, one serialized writer and one snapshot separate eligibility, successful publication and physical provenance without a same-stem fallback.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The recorder delegates supported emit-path helpers and actual writers; later realpath, fixture filenames or extension precedence cannot fabricate a unique source owner.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain snapshot timing, native keys, physical proof, ambiguity, unknown values and the non-atomic ledger limitation following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Compiler path normalization and its coordinate case policy index candidate collisions; recorded native physical paths prove source identity separately from that policy, preserving lexical output names without an OS-derived identity guess.
// @evidence contracts/performance.md#efficient-algorithms Eligible S sources build one output index; W successful callbacks use indexed candidate membership. The final snapshot visits actual written rows and their candidates once, deduplicating physical names before per-row sorting.
// @evidence contracts/performance.md#reuse-equivalent-work One generation's native eligibility and output paths serve every writer callback; the snapshot reuses captured input observations without re-reading source bytes or recomputing an independent compiler Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned closures retain the captured generation input ledger plus O(S+W) candidate/write references until their owner releases them; no descriptor is acquired beyond the delegated writer and snapshots return independent maps and slices.
func (p *Program) NewEmitProvenanceRecorder(writeFile shimcompiler.WriteFile) (shimcompiler.WriteFile, func() map[string][]string, error) {
  if p == nil || p.TSProgram == nil {
    return nil, nil, errors.New("driver: nil program")
  }
  if err := p.ApplyLinkedPlugins(); err != nil {
    return nil, nil, err
  }
  program := p.TSProgram
  observer := p.inputObserver
  cwd := program.GetCurrentDirectory()
  caseSensitive := program.UseCaseSensitiveFileNames()
  nativePath := func(name string) string {
    return filepath.FromSlash(shimtspath.GetNormalizedAbsolutePath(name, cwd))
  }
  coordinateKey := func(name string) string {
    return shimtspath.GetCanonicalFileName(
      shimtspath.NormalizePath(nativePath(name)),
      caseSensitive,
    )
  }
  candidates := map[string][]string{}
  host := &pluginEmitHost{program: program}
  for _, source := range shimcompiler.GetSourceFilesToEmit(host, nil, false) {
    output := shimcompiler.GetOutputPathsFor(source, program.Options(), host, false).JsFilePath()
    switch strings.ToLower(filepath.Ext(output)) {
    case ".js", ".jsx", ".mjs", ".cjs":
      key := coordinateKey(output)
      candidates[key] = append(candidates[key], nativePath(source.FileName()))
    }
  }
  if writeFile == nil {
    writeFile = func(name, text string, _ *shimcompiler.WriteFileData) error {
      return DefaultWriteFile(name, text)
    }
  }
  written := map[string]string{}
  var mu sync.Mutex
  record := func(name, text string, data *shimcompiler.WriteFileData) error {
    mu.Lock()
    defer mu.Unlock()
    if err := writeFile(name, text, data); err != nil {
      return err
    }
    if data == nil || !data.SkippedDtsWrite {
      switch strings.ToLower(filepath.Ext(name)) {
      case ".js", ".jsx", ".mjs", ".cjs":
        written[nativePath(name)] = coordinateKey(name)
      }
    }
    return nil
  }
  snapshot := func() map[string][]string {
    mu.Lock()
    defer mu.Unlock()
    result := map[string][]string{}
    for output, key := range written {
      physical := map[string]struct{}{}
      known := observer != nil && len(candidates[key]) != 0
      if known {
        for _, source := range candidates[key] {
          proof, failure := observer.predicateProof(source)
          if failure != "" || proof.ReadFile == nil || !proof.ReadFile.OK ||
            proof.Realpath == nil || !proof.Realpath.OK || !filepath.IsAbs(proof.Realpath.Path) {
            known = false
            break
          }
          physical[filepath.Clean(proof.Realpath.Path)] = struct{}{}
        }
      }
      owners := []string{}
      if known {
        for source := range physical {
          owners = append(owners, source)
        }
        slices.Sort(owners)
      }
      result[output] = owners
    }
    return result
  }
  return record, snapshot, nil
}

// WriteEmitProvenanceJSON writes one private build-result object to an absolute
// native path as an output-to-source map, preserving the command's existing
// stdout stream. The caller owns a fresh result path and its parent directory.
// Publication follows a successful temporary write and close. The file preserves
// the supplied snapshot independently of command status or diagnostics; this
// encoder does not authenticate the snapshot's recorded-write origin. Consumers
// must validate it before admission. A nil map is rejected rather than written
// as null.
//
// @evidence contracts/common.md#principled-implementation A caller-owned absolute result path receives every supplied emittedSources row, preserving empty and unknown-row values without authenticating their origin; encoding or publication failure returns an error.
// @evidence contracts/common.md#clear-and-simple-design One encoder and one native write keep machine metadata independent of compiler diagnostic streams.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The writer never substitutes stdout scraping or a successful empty result for a failed metadata publication.
// @evidence contracts/common.md#meaningful-documentation Native prose states absolute-path admission, private parent ownership, stream separation and ownership proof's distinction from command success following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation filepath validates native absolute grammar and the shared same-directory publisher performs native write, close and rename without shell commands or separator substitution.
// @evidence contracts/performance.md#efficient-algorithms JSON serialization sorts map keys by text and encodes every supplied row and owner string before one native publication; costs include key comparisons, payload bytes and temporary key/encoding buffers, without per-row files or source-tree enumeration.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Artifact publication borrows a completed snapshot and coordinates no reusable compiler or identity work.
// @evidence contracts/performance.md#bound-retention-and-release-resources Encoding bytes are call-local without a payload cap. The shared publisher closes its temporary descriptor before rename and attempts removal on failure, returning cleanup errors; the caller owns the borrowed snapshot, fresh destination, parent directory and final artifact removal.
func WriteEmitProvenanceJSON(fileName string, emittedSources map[string][]string) error {
  if !filepath.IsAbs(fileName) {
    return fmt.Errorf("driver: emit provenance path must be absolute: %q", fileName)
  }
  if emittedSources == nil {
    return errors.New("driver: missing emit provenance snapshot")
  }
  data, err := json.Marshal(emittedSources)
  if err != nil {
    return err
  }
  return writePrivateResult(fileName, data)
}
