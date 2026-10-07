package driver

import (
  "path/filepath"
  "reflect"
  "testing"
)

// TestTransformDependenciesKeysAReportedPathLikeTheEnvelope reports a source
// dependency through an absolute slash spelling and completeness through an
// absolute native spelling. The cwd-relative dependency is emitted under the
// two expected project-relative keys. A blank source report contributes nothing
// to these asserted entries. No compiler output or consumer join is exercised.
//
// @evidence contracts/testing.md#behavioral-verification PluginContext reporting normalizes the supplied source and dependency spellings before aggregation returns the literal src/main.ts completeness and src/consulted.d.ts dependency entries.
// @evidence contracts/testing.md#independent-expectations The expected keys are literal project-relative slash paths built from a real temporary directory.
// @evidence contracts/testing.md#distinguishing-cases Absolute slash/native source spellings meet the same expected key; a different dependency uses a cwd-relative spelling. The blank source report leaves these expected entries unchanged. The test does not compare absolute and relative spellings of the same file.
// @evidence contracts/testing.md#execution-ownership This driver Go unit supplies callbacks backed by its own declaration ledger to PluginContext and calls aggregation. A real temporary root establishes native absolute paths; no files, compiler Program, consumer, or child process are created.
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
