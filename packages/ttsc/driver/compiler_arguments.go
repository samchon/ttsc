package driver

import shimtspath "github.com/microsoft/typescript-go/shim/tspath"

// compilerArgumentObservation freezes the argument phase's response read and
// base-directory identity before config parsing can add other predicates.
// Its copied values cannot be changed through a later graph projection.
type compilerArgumentObservation struct {
  path      shimtspath.RootedPath
  complete  bool
  read      *TransformInputReadObservation
  directory *bool
  realpath  *TransformInputRealpathObservation
}

func captureCompilerArgumentObservations(observer *inputObservationFS, paths []string) []compilerArgumentObservation {
  observations := make([]compilerArgumentObservation, 0, len(paths))
  for _, path := range paths {
    proof, failure := observer.predicateProof(path)
    rooted, ok := shimtspath.TryRootedPathFromAbsolute(shimtspath.NormalizePath(path))
    entry := compilerArgumentObservation{path: rooted, complete: failure == "" && ok}
    if proof.ReadFile != nil {
      value := *proof.ReadFile
      entry.read = &value
    }
    if proof.DirectoryExists != nil {
      value := *proof.DirectoryExists
      entry.directory = &value
    }
    if proof.Realpath != nil {
      value := *proof.Realpath
      entry.realpath = &value
    }
    positive := entry.read != nil && entry.read.OK || entry.directory != nil && *entry.directory
    entry.complete = entry.complete && (entry.read != nil || entry.directory != nil) && (!positive || entry.realpath != nil && entry.realpath.OK)
    observations = append(observations, entry)
  }
  return observations
}

// CompilerArgumentsAreCurrent checks the argument phase's captured response
// reads and directory identity against a fresh native filesystem. A virtual-only
// argument input cannot be certified by this native check. No-argument loads
// need no filesystem replay; incomplete or changed observations refuse reuse.
//
// The hashes describe the argument phase's underlying file reads, before any
// fixed source-preamble layer. They are never replaced by a post-load baseline.
// Upstream owns text decoding and path capabilities on both reads. This is not
// an atomic filesystem snapshot.
//
// @evidence contracts/common.md#principled-implementation Frozen argument-phase read, directory-presence and physical-target observations are compared with the same upstream native filesystem operations. Missing or conflicting original authority cannot become a later successful baseline.
// @evidence contracts/common.md#clear-and-simple-design The driver owns argument observations and their replay; native resident consumers ask this predicate without constructing a transform graph or duplicating a response parser.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Upstream parsing and filesystem text semantics remain unchanged, original hashes are not replaced by current bytes, and unrelated directory membership is not made an input.
// @evidence contracts/common.md#meaningful-documentation Native prose states native versus virtual scope, the no-argument fast path, incomplete refusal and captured-read timing without claiming an atomic volume snapshot.
// @evidence contracts/portability.md#os-neutral-implementation Observed native spellings pass through upstream NormalizePath and rooted-path conversion before replay. DefaultFS preserves upstream case and text-decoding semantics; argument locators and realpath reports remain independent of the selected project root.
// @evidence contracts/performance.md#efficient-algorithms A no-argument load returns without a new FS. Otherwise replay visits recorded argument paths and reads/hashes each response's returned text; work and temporary cache bytes follow argument paths and response bytes, without source-graph traversal or a new Program.
// @evidence contracts/performance.md#reuse-equivalent-work Only equivalent original response reads and base identity authorize continued Program reuse; the owning Program retains copied argument-phase facts rather than later config/resolver observations.
// @evidence contracts/performance.md#bound-retention-and-release-resources Frozen names, hashes and predicate values live with the Program, bounded by that invocation's argument inputs without a byte ceiling. Each replay's FS cache and observer are call-local and acquire no retained handle or background task.
func (p *Program) CompilerArgumentsAreCurrent() bool {
  if p == nil || p.inputObserver == nil {
    return false
  }
  if len(p.compilerArguments) == 0 {
    return true
  }
  current := newInputObservationFS(DefaultFS())
  for _, expected := range p.compilerArguments {
    if !expected.complete {
      return false
    }
    if expected.directory != nil {
      current.DirectoryExists(shimtspath.RootedDirectoryPathFromPath(expected.path))
    }
    if expected.read != nil {
      file, ok := shimtspath.TryRootedFilePathFromAbsolute(string(expected.path))
      if !ok {
        return false
      }
      current.ReadFile(file)
    }
    actual, failure := current.predicateProof(string(expected.path))
    if failure != "" || (expected.read != nil && (actual.ReadFile == nil || !sameReadObservation(expected.read, actual.ReadFile))) ||
      (expected.directory != nil && (actual.DirectoryExists == nil || *expected.directory != *actual.DirectoryExists)) ||
      (expected.realpath != nil && (actual.Realpath == nil || !sameRealpathObservation(expected.realpath, actual.Realpath))) {
      return false
    }
  }
  return true
}
