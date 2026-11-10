package linthost

import (
  "crypto/sha256"
  "encoding/binary"
  "encoding/hex"
  "fmt"
  "path/filepath"
  "strconv"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

// compilerArguments is one parsed invocation and the response-file observations
// actually used by it. Only a complete identity can authorize resident reuse.
// Input names also let project-inputs expose response files before publication.
type compilerArguments struct {
  commandLine *tsoptions.ParsedCommandLine
  diagnostics []*shimast.Diagnostic
  directory   shimtspath.RootedDirectoryPath
  inputs      []string
  identity    string
  reusable    bool
}

// argumentObservationFS preserves every requested spelling for publication,
// even when the compiler's case policy merges ledger keys. Parsing is serial;
// the shared ledger still withdraws reuse for conflicting observations.
type argumentObservationFS struct {
  *inputObservationFS
  inputs []string
  seen   map[string]struct{}
}

func (fs *argumentObservationFS) record(path string) {
  if _, exists := fs.seen[path]; !exists {
    fs.seen[path] = struct{}{}
    fs.inputs = append(fs.inputs, path)
  }
}

func (fs *argumentObservationFS) ReadFile(path shimtspath.RootedFilePath) (string, bool) {
  fs.record(string(path))
  return fs.inputObservationFS.ReadFile(path)
}

// prepareCompilerArguments preserves nil inheritance, explicit empty suppression
// and the argument cwd without changing project identity. Parsing stays owned by
// upstream. The ledger records returned response text and physical identity;
// length-prefixed raw bytes avoid ambiguous concatenation or UTF-8 replacement.
// Maps, parser data and input names belong to this call's result, with no handle
// or historical cache. Cost follows argument, path and response-file bytes.
func prepareCompilerArguments(cwd string, fs vfs.FS, args []string, argumentCwd string) (*compilerArguments, error) {
  if !filepath.IsAbs(cwd) {
    absolute, err := filepath.Abs(cwd)
    if err != nil {
      return nil, err
    }
    cwd = absolute
  }
  if args == nil {
    inherited, err := decodeTsgoArgs("")
    if err != nil {
      return nil, err
    }
    args = inherited
    if argumentCwd == "" {
      argumentCwd = decodeTsgoArgsCwd("", args)
    }
  }
  directory := cwd
  if argumentCwd != "" {
    directory = argumentCwd
    if !filepath.IsAbs(directory) {
      directory = filepath.Join(cwd, directory)
    }
  }
  rooted, ok := rootedDirectory(directory)
  if !ok {
    return nil, fmt.Errorf("loadProgram: tsgo args cwd is not absolute: %s", directory)
  }
  observer := &argumentObservationFS{inputObservationFS: newInputObservationFS(fs), seen: map[string]struct{}{}}
  if len(args) != 0 {
    observer.record(string(rooted))
    observer.DirectoryExists(rooted)
  }
  commandLine, diagnostics := parseTsgoArgs(args, observer, rooted)
  inputs := observer.inputs
  hash := sha256.New()
  write := func(value string) {
    var length [8]byte
    binary.LittleEndian.PutUint64(length[:], uint64(len(value)))
    hash.Write(length[:])
    hash.Write([]byte(value))
  }
  write(string(rooted))
  write(strconv.Itoa(len(args)))
  for _, argument := range args {
    write(argument)
  }
  write(strconv.Itoa(len(inputs)))
  reusable := true
  for _, input := range inputs {
    digest, physical, failure := observer.proof(input)
    reusable = reusable && failure == ""
    write(input)
    write(string(failure))
    if digest == nil {
      write("missing")
    } else {
      write("hash:" + *digest)
    }
    if physical == nil {
      write("missing")
    } else {
      write("path:" + *physical)
    }
  }
  return &compilerArguments{
    commandLine: commandLine, diagnostics: diagnostics, directory: rooted,
    inputs: inputs, identity: hex.EncodeToString(hash.Sum(nil)), reusable: reusable,
  }, nil
}
