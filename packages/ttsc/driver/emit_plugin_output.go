package driver

import (
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
)

// PluginEmitError reports compiler errors from a native plugin emit. The same
// diagnostics remain in the returned slice for structured consumers. Hosts
// that only check the Go error still reject an incomplete build and display
// the compiler's code, severity and available source context.
//
// @evidence contracts/common.md#principled-implementation Structured diagnostics and the Go error describe the same incomplete native emit, so an error-only host cannot overlook compiler failures.
// @evidence contracts/common.md#clear-and-simple-design One error value groups diagnostics with the failed phase and declaration-output consequence.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler findings are retained rather than replaced with a success flag or a fixture-specific message.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the structured and error-only consumer boundary following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This error value stores diagnostic context; renderer and emit owners perform native operations.
// @evidenceExclude contracts/performance.md#efficient-algorithms Rendering owns traversal; the type stores the error payload.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The error payload coordinates no repeated work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller-owned error retains its diagnostics without acquiring a resource or resident cache.
type PluginEmitError struct {
  // Diagnostics contains the same findings returned by the failed emit.
  Diagnostics []Diagnostic

  // Phase names the native operation that failed.
  Phase string

  // Declarations reports whether declaration output may be incomplete.
  Declarations bool
  cwd          string
}

// Error renders the failed phase and compiler diagnostics for error-only hosts.
//
// @evidence contracts/common.md#principled-implementation Error-only consumers receive compiler severity and source context alongside the incomplete-output consequence.
// @evidence contracts/common.md#clear-and-simple-design A string builder adds phase context then delegates diagnostic formatting to one shared renderer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The real diagnostic slice is rendered without hiding findings behind a generic success or failure marker.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the error-only host use following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Shared diagnostic rendering owns filename presentation; this method owns no native operation.
// @evidence contracts/performance.md#efficient-algorithms One builder accumulates the message and diagnostic output without repeatedly concatenating a growing string.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each requested error string is rendered independently with no shared-work coordination.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The temporary builder is returned as a string and no resident buffer is retained.
func (e *PluginEmitError) Error() string {
  var out strings.Builder
  fmt.Fprintf(&out, "driver: native plugin %s failed; build output is incomplete", e.Phase)
  if e.Declarations {
    out.WriteString("; declaration output is incomplete or skipped")
  }
  out.WriteByte('\n')
  WritePrettyDiagnostics(&out, e.Diagnostics, e.cwd)
  return strings.TrimSpace(out.String())
}

func (p *Program) pluginEmitDiagnostics(phase string, raw []*shimast.Diagnostic) ([]Diagnostic, error) {
  diagnostics := p.convertProgramDiagnostics(raw)
  if CountErrors(diagnostics) == 0 {
    return diagnostics, nil
  }
  return diagnostics, &PluginEmitError{
    Diagnostics:  diagnostics,
    Phase:        phase,
    Declarations: p.TSProgram.Options().GetEmitDeclarations(),
    cwd:          p.TSProgram.GetCurrentDirectory(),
  }
}

type pluginEmitOutput struct {
  writeFile shimcompiler.WriteFile
  buffered  bool
  pending   []pluginEmitFile
}

type pluginEmitFile struct {
  name string
  text string
  data *shimcompiler.WriteFileData
}

func newPluginEmitOutput(writeFile shimcompiler.WriteFile, buffered bool) *pluginEmitOutput {
  if writeFile == nil {
    writeFile = func(name, text string, _ *shimcompiler.WriteFileData) error {
      return DefaultWriteFile(name, text)
    }
  }
  return &pluginEmitOutput{writeFile: writeFile, buffered: buffered}
}

// The caller serializes declaration writes; JavaScript and flush are serial.
func (o *pluginEmitOutput) write(name, text string, data *shimcompiler.WriteFileData) error {
  if !o.buffered {
    return o.writeFile(name, text, data)
  }
  o.pending = append(o.pending, pluginEmitFile{name, text, data})
  return nil
}

func (o *pluginEmitOutput) flush() error {
  for _, file := range o.pending {
    if err := o.writeFile(file.name, file.text, file.data); err != nil {
      return fmt.Errorf("driver: native plugin output write failed for %s; build output is incomplete: %w", file.name, err)
    }
  }
  return nil
}
