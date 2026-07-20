package driver

import (
  "path/filepath"
  "sort"
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// bundledScheme prefixes the virtual paths of the TypeScript-Go standard
// library files embedded in the binary. They are not filesystem inputs — they
// change only with the compiler itself — so the reference graph excludes them.
const bundledScheme = "bundled:///"

// TransformGraph is the host-owned reference-graph section of a transform
// envelope (`graph` in the stdout JSON). It carries the language-semantic
// input set of a transform under `tsc --incremental` semantics, so cache
// layers (bundler filesystem caches, watch graphs) can register every file
// whose content can influence a transformed module's output:
//
//   - Edges maps each file to its direct resolved references — imports,
//     re-exports, `/// <reference>` targets, type reference directives, and
//     ambient-module declaration files, type-only edges included. Direct
//     edges are the minimal sufficient statistic; consumers that need a flat
//     per-file list compute the reachability closure themselves.
//   - Globals lists the files that contribute to the global scope (ambient
//     declaration files, script files, global augmentations, `typeRoots`
//     entries). A change to any of them can affect every file.
//   - Configs lists the project tsconfig followed by its `extends` ancestry.
//   - Candidates maps each importing file to the resolution probes that precede
//     its selected module target. They are a separate class from resolved
//     edges: a probe's file appearing or changing can change an unchanged
//     import's meaning.
//
// Keys and values use the same convention as the envelope's `typescript`
// map: project-relative slash paths, falling back to slash-normalized
// absolute paths outside the project root (see TransformOutputKey).
type TransformGraph struct {
  Edges      map[string][]string `json:"edges"`
  Globals    []string            `json:"globals"`
  Configs    []string            `json:"configs"`
  Candidates map[string][]string `json:"candidates,omitempty"`
}

// NewTransformGraph computes the reference graph of a loaded program, keyed
// relative to cwd exactly like the transform envelope's `typescript` map.
// Hosts stamp the result into their stdout envelope's `graph` field;
// `cmd/ttsc api-transform` and the linked-plugin utility host both do.
// Returns nil only for a nil or unloaded program.
func NewTransformGraph(prog *Program, cwd string) *TransformGraph {
  if prog == nil || prog.TSProgram == nil {
    return nil
  }
  graph := &TransformGraph{
    Edges:      map[string][]string{},
    Globals:    []string{},
    Configs:    []string{},
    Candidates: SupersedingModuleCandidates(prog, cwd),
  }
  for _, file := range prog.TSProgram.SourceFiles() {
    fileName := file.FileName()
    if strings.HasPrefix(fileName, bundledScheme) {
      continue
    }
    key := TransformOutputKey(cwd, fileName)
    if shimcompiler.FileAffectsGlobalScope(file) {
      graph.Globals = append(graph.Globals, key)
    }
    targets := referenceTargets(prog, cwd, file)
    if len(targets) != 0 {
      graph.Edges[key] = targets
    }
  }
  sort.Strings(graph.Globals)
  graph.Configs = configChain(prog, cwd)
  return graph
}

// referenceTargets resolves one file's direct reference set to sorted envelope
// keys, dropping bundled library files and the file itself.
func referenceTargets(prog *Program, cwd string, file *ast.SourceFile) []string {
  paths := shimcompiler.GetReferencedFilePaths(prog.TSProgram, file)
  targets := make([]string, 0, len(paths))
  for _, path := range paths {
    fileName := path
    // Referenced paths are case-canonicalized tspath.Path values; recover the
    // real spelling from the program so consumers can compare them against
    // filesystem paths byte-for-byte.
    if resolved := prog.TSProgram.GetSourceFileByPath(shimtspath.Path(path)); resolved != nil {
      fileName = resolved.FileName()
    }
    if fileName == file.FileName() || strings.HasPrefix(fileName, bundledScheme) {
      continue
    }
    targets = append(targets, TransformOutputKey(cwd, fileName))
  }
  sort.Strings(targets)
  return targets
}

// configChain returns the project tsconfig followed by its `extends` ancestry
// as envelope keys. An inferred (config-less) program yields an empty list.
func configChain(prog *Program, cwd string) []string {
  configs := []string{}
  parsed := prog.ParsedConfig
  if parsed == nil || parsed.ConfigFile == nil {
    return configs
  }
  if source := parsed.ConfigFile.SourceFile; source != nil {
    configs = append(configs, TransformOutputKey(cwd, source.FileName()))
  }
  for _, extended := range parsed.ExtendedSourceFiles() {
    configs = append(configs, TransformOutputKey(cwd, extended))
  }
  return configs
}

// TransformOutputKey converts an absolute fileName to the key used by the
// transform and compile envelopes: a slash-separated path relative to cwd,
// falling back to the slash-normalized absolute path when the file lives
// outside the project root. Every envelope section (`typescript`, `graph`,
// `dependencies` producers) must share this one implementation so a consumer
// can join sections by key.
func TransformOutputKey(cwd, fileName string) string {
  rel, err := filepath.Rel(cwd, fileName)
  if err != nil || isOutsideRelativePath(rel) {
    return filepath.ToSlash(fileName)
  }
  return filepath.ToSlash(rel)
}

// isOutsideRelativePath reports whether rel escapes the project root (starts
// with ".." or is exactly "..").
func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
