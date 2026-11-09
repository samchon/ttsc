package driver

import (
  "encoding/json"
  "fmt"
  "io"
  "sort"
)

// WriteEnvironmentInputsSummary writes the build summary line naming the
// environment variables the Program's linked hooks read through
// PluginContext.Env, as `<prefix>environment inputs=<sorted JSON array>`. It
// writes nothing when no hook read one, so builds of plugins that read no
// environment print the same summary as before. Only names are printed:
// values can be secrets, and the envelope carries them to the consumers that
// compare them. Like the summary lines around it, the write is best-effort.
//
// @evidence contracts/common.md#principled-implementation The names come from the same generation ledger the envelopes publish, sorted so the line is deterministic.
// @evidence contracts/common.md#clear-and-simple-design One writer owns the line's format for every build lane; each lane supplies its own summary prefix.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Values never reach the output stream, and an empty ledger prints nothing rather than an empty list.
// @evidence contracts/common.md#meaningful-documentation Native prose states the line format, the empty case, why values are withheld and the best-effort write following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The writer formats recorded names and performs no native path or process operation.
// @evidence contracts/performance.md#efficient-algorithms One ledger copy, an O(n log n) sort of the distinct names and one JSON encoding.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Formatting a summary coordinates no shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The name list and encoding are call-local; the caller owns the writer.
func WriteEnvironmentInputsSummary(w io.Writer, prefix string, p *Program) {
  inputs := p.PluginEnvironmentInputs()
  if len(inputs) == 0 {
    return
  }
  names := make([]string, 0, len(inputs))
  for name := range inputs {
    names = append(names, name)
  }
  sort.Strings(names)
  encoded, err := json.Marshal(names)
  if err != nil {
    // encoding/json cannot fail on a []string.
    panic(err)
  }
  fmt.Fprintf(w, "%senvironment inputs=%s\n", prefix, encoded)
}
