// Emit the pinned native compiler's option grammar and Unicode name folds.
package main

import (
  "encoding/json"
  "os"
  "unicode"

  "github.com/microsoft/typescript-go/shim/stringutil"
  "github.com/microsoft/typescript-go/shim/tsoptions"
)

type option struct {
  Name       string `json:"name"`
  Alias      string `json:"alias,omitempty"`
  Kind       string `json:"kind"`
  Element    string `json:"element,omitempty"`
  ConfigOnly bool   `json:"configOnly"`
  // A command-line value that names a path, which the compiler resolves
  // against the working directory; for a list, its elements.
  FilePath bool `json:"filePath"`
  // An option the compiler accepts only on the command line, never in a
  // tsconfig.
  CommandLineOnly bool `json:"commandLineOnly"`
}

// Read exported declarations from the same pinned module as ParseCommandLine.
func main() {
  options := []option{}
  declarations := append(append([]*tsoptions.CommandLineOption{}, tsoptions.OptionsDeclarations...), watchOptionDeclarations()...)
  for _, declaration := range declarations {
    entry := option{Name: declaration.Name, Alias: declaration.ShortName, Kind: string(declaration.Kind), ConfigOnly: declaration.IsTSConfigOnly, FilePath: declaration.IsFilePath, CommandLineOnly: declaration.IsCommandLineOnly}
    if declaration.Kind == "list" {
      entry.Element = string(declaration.Elements().Kind)
      entry.FilePath = declaration.Elements().IsFilePath
    }
    options = append(options, entry)
  }
  // Native option names use ASCII. Enumerate the native Unicode simple-case
  // mappings whose output can reach that domain, rather than spelling aliases.
  folds := map[string]string{}
  enumWhitespace := []string{}
  for input := rune(0); input <= unicode.MaxRune; input++ {
    output := unicode.ToLower(input)
    if input >= 128 && output >= 'a' && output <= 'z' {
      folds[string(input)] = string(output)
    }
    if stringutil.IsWhiteSpaceLike(input) {
      enumWhitespace = append(enumWhitespace, string(input))
    }
  }
  result := struct {
    Options        []option          `json:"options"`
    AsciiFolds     map[string]string `json:"asciiFolds"`
    EnumWhitespace []string          `json:"enumWhitespace"`
  }{options, folds, enumWhitespace}
  if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
    panic(err)
  }
}
