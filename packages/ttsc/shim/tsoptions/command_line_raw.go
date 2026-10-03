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
// Returns nil for a nil command line or an absent, nil or differently typed
// raw value. A present ordered map is wrapped even when it contains no options.
// The wrapper retains the original ordered map; callers must not mutate it
// while configuration merging reads the command line.
//
// @evidence contracts/common.md#principled-implementation The compilerOptions wrapper preserves the parsed ordered raw values, including explicit null, because config merging distinguishes an absent option from a supplied zero-like value.
// @evidence contracts/common.md#clear-and-simple-design Nil and raw-shape checks precede one ordered-map wrapper, keeping representation adaptation separate from the config parser that owns merging.
// @evidence contracts/common.md#prohibited-implementation-shortcuts compilerOptions is the compiler's merge-envelope key, not a consumer exception; the adapter preserves upstream parsing rather than patching fields or inventing reset values.
// @evidence contracts/common.md#meaningful-documentation Native prose explains explicit-null reset semantics, nil results and shared-map ownership, keeping the example and ownership note in distinct paragraphs.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned one-entry wrapper retains the original ordered map and its reachable raw option values for its consumers; it adds no deep copy, handle or historical cache. Callers own reference release and must avoid concurrent mutation during merging; this adapter imposes no bound on the supplied raw graph.
// @evidence contracts/performance.md#efficient-algorithms Nil and type checks precede one insertion into a fresh ordered map, taking constant wrapper work and space independent of raw option count; the raw values are referenced without traversal or copying, while downstream config merging owns its separate option scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This representation adapter owns no shared producer, request cache or validity coordinator; upstream parsing produces the supplied raw map and callers determine when that same command line remains valid for merging.
// @evidenceExclude contracts/portability.md#os-neutral-implementation CommandLineRawOptions computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
