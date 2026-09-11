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
type PluginEmitError struct {
  Diagnostics  []Diagnostic
  Phase        string
  Declarations bool
  cwd          string
}

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
