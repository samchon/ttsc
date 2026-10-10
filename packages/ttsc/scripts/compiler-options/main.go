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
}

// Read exported declarations from the same pinned module as ParseCommandLine.
func main() {
  options := []option{}
  for _, declaration := range tsoptions.OptionsDeclarations {
    entry := option{Name: declaration.Name, Alias: declaration.ShortName, Kind: string(declaration.Kind), ConfigOnly: declaration.IsTSConfigOnly}
    if declaration.Kind == "list" {
      entry.Element = string(declaration.Elements().Kind)
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
