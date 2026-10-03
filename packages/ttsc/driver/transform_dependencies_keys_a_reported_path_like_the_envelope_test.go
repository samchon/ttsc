package driver

import (
  "path/filepath"
  "reflect"
  "testing"
)

// TestTransformDependenciesKeysAReportedPathLikeTheEnvelope verifies a plugin's
// reported paths reach the envelope under the same key convention as every other
// section.
//
// A plugin reports the spellings its host handed it — absolute program file
// names, which the compiler normalizes to forward slashes on every platform, or
// paths relative to the plugin's cwd. Keying either differently from
// `typescript` would leave a consumer unable to join the sections at all, and on
// Windows the two spellings differ by separator alone, which is exactly the kind
// of mismatch that passes on POSIX CI and fails on a developer's machine.
//
// @evidence contracts/testing.md#behavioral-verification Plugin-reported paths, absolute forward-slash spellings and cwd-relative spellings, reach the aggregated dependencies under the same key convention as the envelope.
// @evidence contracts/testing.md#independent-expectations The expected keys are literal project-relative slash paths built from a real temporary directory.
// @evidence contracts/testing.md#distinguishing-cases Absolute and relative spellings of the same file must collapse to one key, which differs only by separator on Windows.
// @evidence contracts/testing.md#execution-ownership TestTransformDependenciesKeysAReportedPathLikeTheEnvelope is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
func TestTransformDependenciesKeysAReportedPathLikeTheEnvelope(t *testing.T) {
  // A real directory, so the absolute spellings below are absolute under the
  // running platform's own rule rather than under POSIX's alone.
  cwd := t.TempDir()
  declarations := newPluginFileDeclarations()
  ctx := PluginContext{
    Cwd:                  cwd,
    reportFileDependency: declarations.forPlugin(0).addDependency,
    reportFileComplete:   declarations.forPlugin(0).addComplete,
  }

  // The compiler's own spelling of a source file, and a cwd-relative one.
  ctx.ReportFileDependency(
    filepath.ToSlash(filepath.Join(cwd, "src", "main.ts")),
    filepath.Join("src", "consulted.d.ts"),
  )
  ctx.ReportFileDependenciesComplete(filepath.Join(cwd, "src", "main.ts"))
  ctx.ReportFileDependency("   ", "src/ignored.d.ts")

  out := aggregateTransformDependencies([]string{"src/main.ts"}, []int{0}, declarations)

  if !reflect.DeepEqual(out.Complete, []string{"src/main.ts"}) {
    t.Fatalf("expected the reported file to key like the envelope, got %v", out.Complete)
  }
  if !reflect.DeepEqual(out.Dependencies["src/main.ts"], []string{"src/consulted.d.ts"}) {
    t.Fatalf("expected the reported dependency to key like the envelope, got %v", out.Dependencies)
  }
}
