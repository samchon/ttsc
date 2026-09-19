// gen_shims:hand-maintained

package tsoptions

import (
  "github.com/microsoft/typescript-go/internal/collections"
  "github.com/microsoft/typescript-go/internal/tsoptions"
)

// CommandLineRawOptions returns the options a parsed command line spelled out,
// wrapped in a "compilerOptions" key: the `optionsRaw` shape
// GetParsedCommandLineOfConfigFile merges over the config it parses.
//
// TypeScript-Go's own command line passes exactly this beside the parsed
// CompilerOptions. The struct alone cannot carry an option the command line
// resets: `--declarationDir null` leaves the field at its zero value, which the
// merge reads as "not given", so the config's own value survives. The raw map
// records the explicit null, and the merge honors it.
//
// Returns nil when the command line recorded no raw options.
func CommandLineRawOptions(commandLine *tsoptions.ParsedCommandLine) *collections.OrderedMap[string, any] {
  if commandLine == nil {
    return nil
  }
  raw, ok := commandLine.Raw.(*collections.OrderedMap[string, any])
  if !ok || raw == nil {
    return nil
  }
  wrapped := &collections.OrderedMap[string, any]{}
  wrapped.Set("compilerOptions", raw)
  return wrapped
}
