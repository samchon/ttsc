// Root-file compilation for `ttsx`.
//
// `ttsx` runs files their owning project does not list: an entry beside the
// tsconfig while `include` names only `src`, or a TypeScript file inside an
// installed package. Such a file compiles with every option of that project,
// but the project's file set must not change. The config is therefore parsed
// where it lives, so `${configDir}`, the default `typeRoots`, and every `types`
// lookup keep the meaning they have for the project, and only its file list is
// replaced by the files the launcher names in `driver.RootFilesEnv`.
//
// TypeScript-Go's command line cannot do this: it rejects a project combined
// with a file list, and a file list without the project drops options such as
// `paths` and `rootDirs` that exist only in a config file. This command stands
// in for it in exactly that case. It takes the compiler's own argument list,
// reports diagnostics, lists emitted files, and exits with the compiler's
// statuses, so the launcher reads it as it reads the compiler.
package main

import (
  "context"
  "fmt"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimdiagnosticwriter "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// The exit statuses of TypeScript-Go's command line that this command can end
// with.
const (
  exitStatusSuccess                            = 0
  exitStatusDiagnosticsPresentOutputsGenerated = 1
  exitStatusDiagnosticsPresentOutputsSkipped   = 2
)

// runCompileRoots compiles the project named by `-p` with its root files
// replaced by those in driver.RootFilesEnv, following TypeScript-Go's own
// `EmitFilesAndReportErrors`: every diagnostic of the program, then the emit,
// which honors `noEmit` and `noEmitOnError` itself.
func runCompileRoots(args []string) int {
  roots, err := driver.RootFilesFromEnv()
  if err != nil {
    fmt.Fprintf(stderr, "ttsc platform helper: %v\n", err)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  if len(roots) == 0 {
    fmt.Fprintf(stderr, "ttsc platform helper: compile-roots compiles the root files named in %s, and none were named.\n", driver.RootFilesEnv)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  cwd, err := getwd()
  if err != nil {
    fmt.Fprintf(stderr, "ttsc platform helper: could not get working directory: %v\n", err)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  fs := driver.DefaultFS()
  commandLine := tsoptions.ParseCommandLine(args, driver.DefaultHost(cwd, fs))
  if len(commandLine.Errors) != 0 {
    shimdiagnosticwriter.FormatASTDiagnosticsWithColorAndContext(stdout, commandLine.Errors, cwd)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  if len(commandLine.FileNames()) != 0 {
    fmt.Fprintf(stderr, "ttsc platform helper: compile-roots takes its root files from %s, not the command line.\n", driver.RootFilesEnv)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  project := commandLine.CompilerOptions().Project
  if project == "" {
    fmt.Fprintln(stderr, "ttsc platform helper: compile-roots needs the project whose options the root files compile with (-p).")
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  config := tspath.ResolvePath(cwd, project)
  if fs.DirectoryExists(config) {
    config = tspath.CombinePaths(config, "tsconfig.json")
  }

  prog, diags, err := driver.LoadProgram(cwd, config, driver.LoadProgramOptions{
    RootFiles: roots,
    TsgoArgs:  args,
  })
  if err != nil {
    fmt.Fprintf(stderr, "ttsc platform helper: %v\n", err)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  if len(diags) != 0 {
    driver.WritePrettyDiagnostics(stdout, diags, cwd)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  defer prog.Close()

  ctx := context.Background()
  program := prog.TSProgram
  all := shimcompiler.GetDiagnosticsOfAnyProgram(
    ctx,
    program,
    nil,
    false,
    program.GetBindDiagnostics,
    program.GetSemanticDiagnostics,
  )
  result, _, err := prog.EmitAllRaw(nil)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc platform helper: emit failed: %v\n", err)
    return exitStatusDiagnosticsPresentOutputsSkipped
  }
  all = shimcompiler.SortAndDeduplicateDiagnostics(append(all, result.Diagnostics...))
  shimdiagnosticwriter.FormatASTDiagnosticsWithColorAndContext(stdout, all, cwd)
  if program.Options().ListEmittedFiles.IsTrue() {
    for _, file := range result.EmittedFiles {
      fmt.Fprintln(stdout, "TSFILE: ", tspath.GetNormalizedAbsolutePath(file, cwd))
    }
  }
  switch {
  case len(all) != 0 && result.EmitSkipped:
    return exitStatusDiagnosticsPresentOutputsSkipped
  case len(all) != 0:
    return exitStatusDiagnosticsPresentOutputsGenerated
  default:
    return exitStatusSuccess
  }
}
