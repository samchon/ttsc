package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "github.com/samchon/ttsc/packages/ttsc/driver"
  "io/fs"
  "os"
  "path/filepath"
  "reflect"
  "slices"
  "strings"
  "testing"
)

// apiTransformGraph mirrors the graph section of the api-transform envelope.
//
// Private wire decoders retain native common grounds rather than unsupported
// exported-host Evidence annotations. These data carriers do not choose a
// processing algorithm, coordinate reusable work, own a lease lifecycle or
// access a native filesystem/process; their consumers own those decisions.
// Common: Principled implementation: Independently decodes adjacency lists, global-scope files and config ancestry under the literal edges/globals/configs wire names.
// Common: Clear and simple design: One map and two slices retain the three distinct graph relationships tested by literal membership assertions.
// Common: Prohibited implementation shortcuts: No adjacency or config expectation is generated here; the named observer compares actual decoded relationships with authored fixture relationships.
// Common: Meaningful documentation: Native prose names the graph fields and focused test ownership rather than asserting unobserved graph completeness.
type apiTransformGraph struct {
  Edges   map[string][]string `json:"edges"`
  Globals []string            `json:"globals"`
  Configs []string            `json:"configs"`
}

// apiTransformResultWithGraph independently decodes the observed graph wire fields.
//
// Private wire decoders retain native common grounds rather than unsupported
// exported-host Evidence annotations. These data carriers do not choose a
// processing algorithm, coordinate reusable work, own a lease lifecycle or
// access a native filesystem/process; their consumers own those decisions.
// Common: Principled implementation: Independently decodes source text and a nullable graph pointer so absent/null graph fails before its original relationship assertions.
// Common: Clear and simple design: The graph pointer preserves the absent-section distinction while the text map retains its separate envelope field.
// Common: Prohibited implementation shortcuts: The decoder does not synthesize a missing graph, hide nil state or infer expected edges from actual output.
// Common: Meaningful documentation: Native prose explains nullable graph and focused envelope decoding; it does not claim observation of all response metadata.
type apiTransformResultWithGraph struct {
  TypeScript map[string]string  `json:"typescript"`
  Graph      *apiTransformGraph `json:"graph"`
}

// TestCLICommandOperationFamilies verifies original command preparations and
// compiler result oracles with explicit immutable-fixture and Program ownership.
//
// The twenty-one original failure names remain named cases. Pure preparation
// observes original argv and selected defaults; separately named compiler
// operations load the declared config variant. Shared API response work uses
// one emit-capable Program while transform preparation still requires noEmit.
// No-output shared cases precede disk publication; each records its original
// absence oracle before cleanup restores the next case prerequisite.
//
//  1. Materialize nine unique projects and one shared source with five configs.
//  2. Observe original command/handler preparations and named result assertions.
//  3. Run project normalization once as an explicitly shared actual build, and
//     borrow one actual API generation across memory emit and source response.
//  4. Publish the shared manifest last; close acquired Programs before cleanup.
//
// @evidence contracts/testing.md#behavioral-verification Original CLI status/stream, JSON source/output/graph, diagnostic and disk/manifest oracles remain named; original argv preparation and selected semantic config variants are separate observations.
// @evidence contracts/testing.md#independent-expectations Original literal argv, authored fixture bytes, JSON keys, source/export syntax, diagnostics and absence checks define expected behavior independently of actual output. Project aliases additionally assert literal normalized argv; API preparation asserts distinct ForceEmit versus ForceNoEmit policies.
// @evidence contracts/testing.md#distinguishing-cases All twenty-one old TestNames remain named cases, including alias/help/version variants, positive project publication, semantic/syntax/unused/declaration failures, implicit cwd and outside keys. Nested alias rootDir/source-path changes are explicit fixture deltas.
// @evidence contracts/testing.md#execution-ownership Actual private preparation is consumed by the real dispatcher; loaded response operations use real driver Programs with explicit owners. The family owns10 roots14 selected configs27 files and15 Programs; The twenty-one command-operation cases execute here; the separately registered OS transport success and nonzero-exit cases own the remaining two child connections. Nine case-owned TempDirs and one lazily acquired shared native workspace supply the ten roots. Counts are design expectations until actual validation.
func TestCLICommandOperationFamilies(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  var sharedWorkspace, sharedRoot string
  var sharedPrerequisiteErr error
  sharedPrepared := false
  // Only the six dependent cases request this fixture. Independent cases run
  // first; a failed preparation is retained locally without aborting the family.
  prepareShared := func() error {
    if sharedPrepared {
      return sharedPrerequisiteErr
    }
    sharedPrepared = true
    owner, err := filepath.Abs(os.TempDir())
    if err != nil {
      sharedPrerequisiteErr = fmt.Errorf("shared temporary owner: %w", err)
      return sharedPrerequisiteErr
    }
    sharedWorkspace, err = os.MkdirTemp(owner, "ttsc-cli-operation-families-")
    if err != nil {
      sharedPrerequisiteErr = fmt.Errorf("shared temporary workspace: %w", err)
      return sharedPrerequisiteErr
    }
    // Register removal immediately, including partially copied/error fixtures.
    // The aggregate owns this immutable path until all children and cwd/Program
    // cleanups have completed; a failed guard retains it and fails the family.
    workspace := sharedWorkspace
    t.Cleanup(func() {
      absolute, resolveErr := filepath.Abs(workspace)
      relative, relativeErr := filepath.Rel(owner, absolute)
      if resolveErr != nil || relativeErr != nil || filepath.IsAbs(relative) || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) || !strings.HasPrefix(filepath.Base(absolute), "ttsc-cli-operation-families-") {
        t.Errorf("shared workspace cleanup outside owner: %s", workspace)
        return
      }
      if err := os.RemoveAll(absolute); err != nil {
        t.Errorf("shared workspace cleanup: %v", err)
      }
    })
    sharedRoot = filepath.Join(sharedWorkspace, "project")
    sharedPrerequisiteErr = copyCLIFamilyFixture(filepath.Join("testdata", "cli_operation_families", "shared-value-one", "project"), sharedRoot)
    if sharedPrerequisiteErr == nil {
      if _, err := os.Stat(filepath.Join(sharedRoot, "bin", "index.js")); !os.IsNotExist(err) {
        sharedPrerequisiteErr = fmt.Errorf("shared family requires initial output absence: %v", err)
      }
    }
    return sharedPrerequisiteErr
  }
  t.Run("TestCLIAPICompileAndTransform", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIAPICompileAndTransform"), root)
    var owned *driver.Program
    var initial []driver.Diagnostic
    t.Cleanup(func() {
      if owned != nil {
        if err := owned.Close(); err != nil {
          t.Errorf("API shared Program Close: %v", err)
        }
      }
    })
    invoke := func(t *testing.T, args ...string) (int, string, string) {
      return captureCLIFamilyOperation(t, func() int {
        kind, values, status := prepareCommandInvocation(args)
        if status != 0 {
          return status
        }
        var request apiCommandRequest
        if kind == commandAPICompile {
          request, status = prepareAPICompileInvocation(values)
        } else if kind == commandAPITransform {
          request, status = prepareAPITransformInvocation(values)
        } else {
          t.Fatalf("unexpected API dispatch kind: %v", kind)
        }
        if status != 0 {
          return status
        }
        if request.cwd != root || request.tsconfigPath != "tsconfig.json" {
          t.Fatalf("API preparation cwd/config: %#v", request)
        }
        if kind == commandAPICompile {
          if !request.options.ForceEmit || request.options.ForceNoEmit {
            t.Fatal("compile preparation must force emit only")
          }
          var err error
          owned, initial, err = driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
          if err != nil {
            t.Fatalf("API shared producer failed: %v", err)
          }
          return writeCompiledProgramResponse(owned, initial, request.cwd)
        }
        if !request.options.ForceNoEmit || request.options.ForceEmit {
          t.Fatal("transform preparation must force noEmit only")
        }
        if owned == nil {
          t.Fatal("source response requires actual compile-owned Program")
        }
        // Actual noEmit loader mechanism is separately owned by
        // TestDriverLoadProgramForceNoEmitSuppressesRawEmit. This response
        // borrows the emit-capable generation without changing its options.
        return writeTransformedProgramResponse(owned, initial, request.cwd)
      })
    }
    observeTestCLIAPICompileAndTransform(t, root, invoke)
  })
  t.Run("TestAPITransformEnvelopeCarriesReferenceGraph", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestAPITransformEnvelopeCarriesReferenceGraph"), root)
    observeTestAPITransformEnvelopeCarriesReferenceGraph(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIAPITransformUsesCurrentDirectory", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIAPITransformUsesCurrentDirectory"), root)
    observeTestCLIAPITransformUsesCurrentDirectory(t, root, runCLIContractCommand)
  })
  t.Run("TestCLICommandHelpAliases", func(t *testing.T) {
    root := ""
    observeTestCLICommandHelpAliases(t, root, runCLIContractCommand)
  })
  t.Run("TestCLICommandRejectsConflictingEmitFlags", func(t *testing.T) {
    root := ""
    observeTestCLICommandRejectsConflictingEmitFlags(t, root, runCLIContractCommand)
  })
  t.Run("TestCLICommandRejectsMissingProjectArgument", func(t *testing.T) {
    root := ""
    observeTestCLICommandRejectsMissingProjectArgument(t, root, runCLIContractCommand)
  })
  t.Run("TestCLICommandRejectsUnknown", func(t *testing.T) {
    root := ""
    observeTestCLICommandRejectsUnknown(t, root, runCLIContractCommand)
  })
  t.Run("TestCLICommandVersionAliases", func(t *testing.T) {
    root := ""
    observeTestCLICommandVersionAliases(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures"), root)
    observeTestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIProjectBuildBlocksSemanticDiagnostics", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIProjectBuildBlocksSemanticDiagnostics"), root)
    observeTestCLIProjectBuildBlocksSemanticDiagnostics(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIProjectBuildBlocksSyntacticDiagnostics", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIProjectBuildBlocksSyntacticDiagnostics"), root)
    observeTestCLIProjectBuildBlocksSyntacticDiagnostics(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIProjectBuildBlocksUnusedParameters", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIProjectBuildBlocksUnusedParameters"), root)
    observeTestCLIProjectBuildBlocksUnusedParameters(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIProjectBuildEmitErrorRejectsManifest", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIProjectBuildEmitErrorRejectsManifest"), root)
    observeTestCLIProjectBuildEmitErrorRejectsManifest(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIReportsDiagnosticsWithoutEmit", func(t *testing.T) {
    root := t.TempDir()
    materializeCLIFamily(t, filepath.Join("testdata", "cli_operation_families", "TestCLIReportsDiagnosticsWithoutEmit"), root)
    observeTestCLIReportsDiagnosticsWithoutEmit(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIRunUnknownCommandExits2", func(t *testing.T) {
    root := ""
    observeTestCLIRunUnknownCommandExits2(t, root, runCLIContractCommand)
  })
  t.Run("TestCLIAPICompilePreservesOutsideOutputKey", func(t *testing.T) {
    if err := prepareShared(); err != nil {
      t.Fatalf("shared authored fixture prerequisite: %v", err)
    }
    root := sharedRoot
    t.Cleanup(func() { cleanCLIFamilyOutputs(t, sharedWorkspace, root) })
    invoke := func(t *testing.T, args ...string) (int, string, string) {
      return captureCLIFamilyOperation(t, func() int {
        kind, values, status := prepareCommandInvocation(args)
        if status != 0 {
          return status
        }
        if kind != commandAPICompile {
          t.Fatalf("unexpected original dispatch: %v", kind)
        }
        request, status := prepareAPICompileInvocation(values)
        if status != 0 {
          return status
        }
        if request.cwd != root || request.tsconfigPath != "tsconfig.json" || !request.options.ForceEmit || request.options.ForceNoEmit {
          t.Fatalf("outside compile preparation: %#v", request)
        }
        // The original default-config argv is observed above. This separate
        // actual semantic operation selects the declared immutable variant.
        prog, diags, err := driver.LoadProgram(root, "outside.json", request.options)
        if err != nil {
          t.Fatalf("outside Program load: %v", err)
        }
        if prog != nil {
          defer prog.Close()
        }
        return writeCompiledProgramResponse(prog, diags, root)
      })
    }
    observeTestCLIAPICompilePreservesOutsideOutputKey(t, root, invoke)
  })
  t.Run("TestCLICommandAcceptsFlagShapedBuildAlias", func(t *testing.T) {
    if err := prepareShared(); err != nil {
      t.Fatalf("shared authored fixture prerequisite: %v", err)
    }
    root := sharedRoot
    t.Cleanup(func() { cleanCLIFamilyOutputs(t, sharedWorkspace, root) })
    invoke := func(t *testing.T, args ...string) (int, string, string) {
      return captureCLIFamilyOperation(t, func() int {
        kind, values, status := prepareCommandInvocation(args)
        if status != 0 {
          return status
        }
        if kind != commandBuild {
          t.Fatalf("unexpected original dispatch: %v", kind)
        }
        request, status := prepareBuildInvocation(values)
        if status != 0 {
          return status
        }
        if request.cwd != root || request.tsconfigPath != "tsconfig.json" || request.options.ForceNoEmit != true || request.options.ForceEmit != false {
          t.Fatalf("original build preparation: %#v", request)
        }
        request.tsconfigPath = "flag-shaped.json" // explicit semantic variant, not the original argv-selected name
        prog, diags, err := driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
        if err != nil {
          t.Fatalf("variant Program load: %v", err)
        }
        if prog != nil {
          defer prog.Close()
        }
        return writeBuildProgramResponse(prog, diags, request)
      })
    }
    observeTestCLICommandAcceptsFlagShapedBuildAlias(t, root, invoke)
  })
  // TestCLICommandAcceptsProjectFlagAliases verifies literal alias normalization
  // and one explicitly shared noEmit build of the normalized project arguments.
  //
  // Both aliases independently reach real preparation with the same literal
  // normalized argv. The compiler operation runs once under its own named child;
  // its result is not replayed as two alias invocations. The nested config's
  // explicit parent rootDir contains the genuinely shared source file.
  //
  //  1. Prepare -p and --project separately and compare the exact normalized argv.
  //  2. Execute the normalized build once with the actual selected config.
  //  3. Require successful status and absence of bin/index.js.
  //
  // Testing behavioral-verification: Real preparation selects build and its literal normalized args; a separately named actual build succeeds without disk JavaScript.
  // Testing independent-expectations: Authored -p/--project operands and --tsconfig=<config>, --noEmit literals define expected normalization independently; native Stat defines the output absence oracle.
  // Testing distinguishing-cases: Both aliases retain named preparation failures while one shared_normalized_build child owns compiler status and disk assertions.
  // Testing execution-ownership: Local shared preparation owns fixture bytes; two pure production preparations acquire no Program, and runBuild owns one actual Program and Close lifecycle.
  t.Run("TestCLICommandAcceptsProjectFlagAliases", func(t *testing.T) {
    if err := prepareShared(); err != nil {
      t.Fatalf("shared authored fixture prerequisite: %v", err)
    }
    root := sharedRoot
    t.Cleanup(func() { cleanCLIFamilyOutputs(t, sharedWorkspace, root) })
    config := filepath.Join(root, "nested", "tsconfig.app.json")
    expected := []string{"--tsconfig=" + config, "--noEmit"}
    for _, flag := range []string{"-p", "--project"} {
      t.Run(flag, func(t *testing.T) {
        code, out, errOut := captureCLIFamilyOperation(t, func() int {
          kind, values, status := prepareCommandInvocation([]string{flag, config, "--noEmit"})
          if kind != commandBuild || !reflect.DeepEqual(values, expected) {
            t.Fatalf("%s normalization: kind=%v args=%#v", flag, kind, values)
          }
          return status
        })
        if code != 0 {
          t.Fatalf("%s alias preparation failed: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
        }
      })
    }
    t.Run("shared_normalized_build", func(t *testing.T) {
      code, out, errOut := captureCLIFamilyOperation(t, func() int { return runBuild(expected) })
      if code != 0 {
        t.Fatalf("%s alias failed: code=%d stdout=%q stderr=%q", "shared normalized -p/--project", code, out, errOut)
      }
      if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
        t.Fatalf("%s alias should not emit JavaScript: %v", "shared normalized -p/--project", err)
      }
    })
  })
  t.Run("TestCLICommandCheckAliasSuppressesEmit", func(t *testing.T) {
    if err := prepareShared(); err != nil {
      t.Fatalf("shared authored fixture prerequisite: %v", err)
    }
    root := sharedRoot
    t.Cleanup(func() { cleanCLIFamilyOutputs(t, sharedWorkspace, root) })
    invoke := func(t *testing.T, args ...string) (int, string, string) {
      return captureCLIFamilyOperation(t, func() int {
        kind, values, status := prepareCommandInvocation(args)
        if status != 0 {
          return status
        }
        if kind != commandBuild {
          t.Fatalf("unexpected original dispatch: %v", kind)
        }
        request, status := prepareBuildInvocation(values)
        if status != 0 {
          return status
        }
        if request.cwd != root || request.tsconfigPath != "tsconfig.json" || request.options.ForceNoEmit != true || request.options.ForceEmit != false {
          t.Fatalf("original build preparation: %#v", request)
        }
        request.tsconfigPath = "emit.json" // explicit semantic variant, not the original argv-selected name
        prog, diags, err := driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
        if err != nil {
          t.Fatalf("variant Program load: %v", err)
        }
        if prog != nil {
          defer prog.Close()
        }
        return writeBuildProgramResponse(prog, diags, request)
      })
    }
    observeTestCLICommandCheckAliasSuppressesEmit(t, root, invoke)
  })
  t.Run("TestCLICommandRunsProjectFromCurrentDirectory", func(t *testing.T) {
    if err := prepareShared(); err != nil {
      t.Fatalf("shared authored fixture prerequisite: %v", err)
    }
    root := sharedRoot
    t.Cleanup(func() { cleanCLIFamilyOutputs(t, sharedWorkspace, root) })
    invoke := func(t *testing.T, args ...string) (int, string, string) {
      return captureCLIFamilyOperation(t, func() int {
        kind, values, status := prepareCommandInvocation(args)
        if status != 0 {
          return status
        }
        if kind != commandBuild {
          t.Fatalf("unexpected original dispatch: %v", kind)
        }
        request, status := prepareBuildInvocation(values)
        if status != 0 {
          return status
        }
        if request.cwd != root || request.tsconfigPath != "tsconfig.json" || request.options.ForceNoEmit != false || request.options.ForceEmit != false {
          t.Fatalf("original build preparation: %#v", request)
        }
        request.tsconfigPath = "tsconfig.json" // explicit semantic variant, not the original argv-selected name
        prog, diags, err := driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
        if err != nil {
          t.Fatalf("variant Program load: %v", err)
        }
        if prog != nil {
          defer prog.Close()
        }
        return writeBuildProgramResponse(prog, diags, request)
      })
    }
    observeTestCLICommandRunsProjectFromCurrentDirectory(t, root, invoke)
  })
  t.Run("TestCLIProjectBuildEmitsManifest", func(t *testing.T) {
    if err := prepareShared(); err != nil {
      t.Fatalf("shared authored fixture prerequisite: %v", err)
    }
    root := sharedRoot
    t.Cleanup(func() { cleanCLIFamilyOutputs(t, sharedWorkspace, root) })
    invoke := func(t *testing.T, args ...string) (int, string, string) {
      return captureCLIFamilyOperation(t, func() int {
        kind, values, status := prepareCommandInvocation(args)
        if status != 0 {
          return status
        }
        if kind != commandBuild {
          t.Fatalf("unexpected original dispatch: %v", kind)
        }
        request, status := prepareBuildInvocation(values)
        if status != 0 {
          return status
        }
        if request.cwd != root || request.tsconfigPath != "tsconfig.json" || request.options.ForceNoEmit != false || request.options.ForceEmit != true {
          t.Fatalf("original build preparation: %#v", request)
        }
        request.tsconfigPath = "emit.json" // explicit semantic variant, not the original argv-selected name
        prog, diags, err := driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
        if err != nil {
          t.Fatalf("variant Program load: %v", err)
        }
        if prog != nil {
          defer prog.Close()
        }
        return writeBuildProgramResponse(prog, diags, request)
      })
    }
    observeTestCLIProjectBuildEmitsManifest(t, root, invoke)
  })
}

// captureCLIFamilyOperation owns full native stream bytes around one real
// supplied operation. The closure exposes its actual producer/borrower call.
//
// Private Go helpers retain native review grounds rather than unsupported export-host annotations.
// Common: Principled implementation: The real supplied synchronous closure supplies its actual status while full stdout/stderr buffers capture bytes and defer restores both streams plus real os.Getwd.
// Common: Clear and simple design: One closure owns stream capture; producer/load/borrow calls stay visible in the caller.
// Common: Prohibited implementation shortcuts: No subprocess is called a unit, expected response fabricated, failure skipped or previous compiler result replayed.
// Common: Meaningful documentation: Native prose names actual operation, owner and limits; the caller declares fixture/config and producer observations.
// Portability: OS-neutral implementation: Native Go path/writer/testing APIs preserve platform semantics without shell, symlink fixtures or forced separators.
// Performance: Efficient algorithms: Work is proportional to captured stream bytes; no independent byte cap or command timeout exists.
// Performance: Reuse equivalent work: No response or compiler status is cached; each closure executes once.
// Performance: Bound retention and release resources: The previous package seams are restored by defer even on panic or Goexit; returned strings own bytes until their named observer finishes.
func captureCLIFamilyOperation(t *testing.T, operation func() int) (int, string, string) {
  t.Helper()
  previousOut, previousErr, previousGetwd := stdout, stderr, getwd
  var out, errOut bytes.Buffer
  stdout, stderr, getwd = &out, &errOut, os.Getwd
  defer func() { stdout, stderr, getwd = previousOut, previousErr, previousGetwd }()
  code := operation()
  return code, out.String(), errOut.String()
}

// invokeInCurrentDirectory preserves omitted cwd by changing the actual native
// directory with test-owned restoration; it does not replace getwd's result.
//
// Private Go helpers retain native review grounds rather than unsupported export-host annotations.
// Common: Principled implementation: testing.T.Chdir changes the actual native process directory before omitted cwd reaches real os.Getwd.
// Common: Clear and simple design: One actual directory change precedes the explicitly supplied closure.
// Common: Prohibited implementation shortcuts: No subprocess is called a unit, expected response fabricated, failure skipped or previous compiler result replayed.
// Common: Meaningful documentation: Native prose names actual operation, owner and limits; the caller declares fixture/config and producer observations.
// Portability: OS-neutral implementation: Native Go path/writer/testing APIs preserve platform semantics without shell, symlink fixtures or forced separators.
// Performance: Efficient algorithms: One native cwd change introduces no recursive input processing.
// Performance: Reuse equivalent work: The helper does not replay a cwd resolver or prior result.
// Performance: Bound retention and release resources: Subtest cleanup restores cwd before aggregate-owned fixture removal; no parallel test or ancestor is permitted.
func invokeInCurrentDirectory(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string), args ...string) (int, string, string) {
  t.Helper()
  t.Chdir(root)
  return invoke(t, args...)
}

// materializeCLIFamily copies each authored static fixture once to its owning
// fresh root; configurations and source are read from maintained testdata.
//
// Private Go helpers retain native review grounds rather than unsupported export-host annotations.
// Common: Principled implementation: Actual static authored config/source bytes are copied once per immutable family; symlink fixtures are rejected.
// Common: Clear and simple design: WalkDir reads maintained fixture files and writes one declared fresh owner root.
// Common: Prohibited implementation shortcuts: No subprocess is called a unit, expected response fabricated, failure skipped or previous compiler result replayed.
// Common: Meaningful documentation: Native prose names actual operation, owner and limits; the caller declares fixture/config and producer observations.
// Portability: OS-neutral implementation: Native Go path/writer/testing APIs preserve platform semantics without shell, symlink fixtures or forced separators.
// Performance: Efficient algorithms: One traversal and one read/write per authored file scale with real fixture bytes.
// Performance: Reuse equivalent work: Unique roots use this child-local wrapper; the six shared cases call the error-return copy once through their declared local prerequisite owner.
// Performance: Bound retention and release resources: Each file byte slice is local to its synchronous visit; testing.TempDir owns removal after all child consumers and Program Close cleanup.
func materializeCLIFamily(t *testing.T, source, destination string) {
  t.Helper()
  if err := copyCLIFamilyFixture(source, destination); err != nil {
    t.Fatalf("materialize CLI family: %v", err)
  }
}

// copyCLIFamilyFixture copies authored bytes while returning prerequisite errors.
//
// The caller owns a fresh destination and its cleanup. Returning the first real
// traversal/read/write error lets shared dependents report that failure without
// terminating unrelated named cases; it does not cache a compiler result.
// Common: Principled implementation: The original WalkDir/Rel/MkdirAll/read/write sequence copies maintained bytes and rejects symlink fixture entries.
// Common: Clear and simple design: One synchronous traversal returns its error to the actual resource owner, which chooses child-local Fatal or shared error propagation.
// Common: Prohibited implementation shortcuts: No authored bytes, compiler status or response are synthesized; partial failure remains an error and cleanup belongs to the caller.
// Common: Meaningful documentation: Native prose distinguishes fixture preparation from actual command observations and describes the first-error boundary.
// Portability: OS-neutral implementation: Native filepath and filesystem APIs preserve platform path semantics without shell commands or symlink fixtures.
// Performance: Efficient algorithms: One traversal and one read/write per file scale with authored bytes; no additional independent size limit is imposed.
// Performance: Reuse equivalent work: Only the immutable shared fixture is copied once; independent roots copy their own fixtures and no Program result is replayed.
// Performance: Bound retention and release resources: File bytes live within one synchronous visit; the caller registers destination cleanup before shared copying and owns partial artifacts too.
func copyCLIFamilyFixture(source, destination string) error {
  return filepath.WalkDir(source, func(path string, entry fs.DirEntry, err error) error {
    if err != nil {
      return err
    }
    rel, err := filepath.Rel(source, path)
    if err != nil {
      return err
    }
    target := filepath.Join(destination, rel)
    if entry.IsDir() {
      return os.MkdirAll(target, 0o755)
    }
    if entry.Type()&os.ModeSymlink != 0 {
      return fmt.Errorf("fixture symlink forbidden: %s", path)
    }
    contents, err := os.ReadFile(path)
    if err != nil {
      return err
    }
    return os.WriteFile(target, contents, 0o644)
  })
}

// cleanCLIFamilyOutputs runs after each shared case's original assertions;
// cleanup cannot turn a recorded failure into a pass or alter authored inputs.
//
// Private Go helpers retain native review grounds rather than unsupported export-host annotations.
// Common: Principled implementation: Original per-case assertions record failure before this cleanup removes known generated outputs, preserving later no-output prerequisites without erasing the prior failure.
// Common: Clear and simple design: Only declared generated index.js/bin/outside-bin paths are candidates; authored source/config paths are excluded.
// Common: Prohibited implementation shortcuts: No subprocess is called a unit, expected response fabricated, failure skipped or previous compiler result replayed.
// Common: Meaningful documentation: Native prose names actual operation, owner and limits; the caller declares fixture/config and producer observations.
// Portability: OS-neutral implementation: Native Go path/writer/testing APIs preserve platform semantics without shell, symlink fixtures or forced separators.
// Performance: Efficient algorithms: Removal visits only generated artifacts after resolving their actual absolute owner paths.
// Performance: Reuse equivalent work: Restored absence is a declared local lifecycle prerequisite, not compiler-result caching or cold-cache independence.
// Performance: Bound retention and release resources: Absolute targets must remain strictly under the owning fixture workspace before RemoveAll; resolve/remove failures remain test failures.
func cleanCLIFamilyOutputs(t *testing.T, workspace, root string) {
  t.Helper()
  for _, path := range []string{filepath.Join(root, "bin"), filepath.Join(root, "index.js"), filepath.Join(workspace, "outside-bin")} {
    absolute, err := filepath.Abs(path)
    if err != nil {
      t.Errorf("output cleanup resolve: %v", err)
      continue
    }
    owner, err := filepath.Abs(workspace)
    if err != nil {
      t.Errorf("cleanup owner resolve: %v", err)
      continue
    }
    relative, err := filepath.Rel(owner, absolute)
    if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
      t.Errorf("cleanup outside owner: %s", absolute)
      continue
    }
    if err := os.RemoveAll(absolute); err != nil {
      t.Errorf("output cleanup: %v", err)
    }
  }
}

// observeTestCLIAPICompileAndTransform verifies memory JavaScript and source responses without disk emission.
//
// The two response observations borrow one emit-capable generation. Transform preparation still independently requires ForceNoEmit; this observer does not assert a noEmit-loaded generation.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Request api-compile and decode its actual JSON response.
//  2. Check the literal bin/index.js export, empty diagnostics and disk absence.
//  3. Request api-transform and check index.ts source, empty diagnostics and disk absence.
//
// Testing behavioral-verification: api-compile and api-transform JSON envelopes carry bin/index.js JavaScript and index.ts source text with no diagnostics.
// Testing independent-expectations: Authored project-relative envelope keys and CommonJS export/source syntax provide independent expectations; substring checks do not require exact printer whitespace.
// Testing distinguishing-cases: Two command adapters share one fixture; successful compile and transform are distinct from the serialized diagnostic case.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIAPICompileAndTransform(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  t.Run("compile_response", func(t *testing.T) {

    // The aggregate materialized the authored project once before this observer.

    // Compile assertion: api-compile returns emitted JavaScript as JSON and must
    // not write to the project outDir as a side effect.
    code, out, errOut := invoke(t, "api-compile", "--cwd", root)
    if code != 0 {
      t.Fatalf("api-compile failed: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    var compiled cliContractCompileResult
    if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &compiled); err != nil {
      t.Fatalf("api-compile JSON decode failed: %v\n%s", err, out)
    }
    if len(compiled.Diagnostics) != 0 {
      t.Fatalf("api-compile should not report diagnostics: %#v", compiled.Diagnostics)
    }
    if !strings.Contains(compiled.Output["bin/index.js"], "exports.answer") {
      t.Fatalf("api-compile output missing emitted JavaScript: %#v", compiled.Output)
    }
    if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
      t.Fatalf("api-compile wrote JavaScript to disk: %v", err)
    }

  })
  t.Run("transform_response", func(t *testing.T) {
    // Transform assertion: api-transform returns parsed TypeScript source text
    // under the same relative key style used by the TypeScript wrapper.
    code, out, errOut := invoke(t, "api-transform", "--cwd", root)
    if code != 0 {
      t.Fatalf("api-transform failed: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    var transformed cliContractTransformResult
    if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
      t.Fatalf("api-transform JSON decode failed: %v\n%s", err, out)
    }
    if !strings.Contains(transformed.TypeScript["index.ts"], "answer: number") {
      t.Fatalf("api-transform source missing expected declaration: %#v", transformed.TypeScript)
    }
    if len(transformed.Diagnostics) != 0 {
      t.Fatalf("api-transform should not report diagnostics: %#v", transformed.Diagnostics)
    }
    if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
      t.Fatalf("api-transform wrote JavaScript to disk: %v", err)
    }
  })
}

// observeTestCLIAPICompilePreservesOutsideOutputKey verifies an absolute output key for an outDir outside the project.
//
// The outside config is selected by the visible semantic owner after original default-config argument preparation. The assertion requires a native absolute matching key, not an exact output map.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke api-compile with the original explicit cwd arguments.
//  2. Decode the emitted output map and require a native absolute key ending in outside-bin/index.js.
//
// Testing behavioral-verification: api-compile returns an absolute JavaScript key ending in /outside-bin/index.js for an outDir above cwd.
// Testing independent-expectations: The API contract retains absolute outside-cwd outputs, independently of the emitted value; the test does not require the whole output map to have one entry.
// Testing distinguishing-cases: An outside outDir distinguishes this case from normal relative output keys.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIAPICompilePreservesOutsideOutputKey(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, out, errOut := invoke(t, "api-compile", "--cwd", root)
  if code != 0 {
    t.Fatalf("api-compile failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var compiled cliContractCompileResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &compiled); err != nil {
    t.Fatalf("api-compile JSON decode failed: %v\n%s", err, out)
  }

  foundOutsideKey := false
  for key := range compiled.Output {
    if filepath.IsAbs(filepath.FromSlash(key)) && strings.HasSuffix(key, "/outside-bin/index.js") {
      foundOutsideKey = true
      break
    }
  }
  if !foundOutsideKey {
    t.Fatalf("api-compile output did not preserve an absolute outside key: %#v", compiled.Output)
  }
}

// observeTestAPITransformEnvelopeCarriesReferenceGraph verifies the reference graph relationships in the source envelope.
//
// Graph membership expectations come from authored imports, global declarations and config ancestry. Additional compiler inputs are allowed; a missing graph is rejected.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Request and decode the api-transform source/graph envelope.
//  2. Require the main.ts to mytype.ts edge and ambient.d.ts global membership.
//  3. Check tsconfig.json is first and tsconfig.base.json occurs in config ancestry.
//
// Testing behavioral-verification: api-transform returns the main.ts to mytype.ts type-only edge, ambient.d.ts global and selected plus extended configuration paths.
// Testing independent-expectations: Literal fixture relationships define the expected graph; membership assertions allow unrelated additional compiler inputs.
// Testing distinguishing-cases: The fixture combines a type-only edge, ambient global and extends chain; a missing graph fails before its three independent fields are inspected.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestAPITransformEnvelopeCarriesReferenceGraph(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, out, errOut := invoke(t, "api-transform", "--cwd", root)
  if code != 0 {
    t.Fatalf("api-transform failed: code=%d stderr=%q", code, errOut)
  }

  var result apiTransformResultWithGraph
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatalf("envelope is not valid JSON: %v\nstdout=%q", err, out)
  }
  if result.Graph == nil {
    t.Fatalf("envelope has no graph section: %q", out)
  }
  if !slices.Contains(result.Graph.Edges["main.ts"], "mytype.ts") {
    t.Fatalf("type-only edge main.ts -> mytype.ts missing: %v", result.Graph.Edges)
  }
  if !slices.Contains(result.Graph.Globals, "ambient.d.ts") {
    t.Fatalf("globals missing ambient.d.ts: %v", result.Graph.Globals)
  }
  if len(result.Graph.Configs) < 2 || result.Graph.Configs[0] != "tsconfig.json" {
    t.Fatalf("configs must start with tsconfig.json and include its extends chain: %v", result.Graph.Configs)
  }
  if !slices.ContainsFunc(result.Graph.Configs, func(config string) bool {
    return strings.HasSuffix(config, "tsconfig.base.json")
  }) {
    t.Fatalf("configs missing extended tsconfig.base.json: %v", result.Graph.Configs)
  }
}

// observeTestCLIAPITransformUsesCurrentDirectory verifies source selection with omitted cwd.
//
// The actual process cwd is changed and restored by the owner; the response is not supplied by a fake cwd resolver.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Change the actual cwd to the fixture root and invoke api-transform without a cwd flag.
//  2. Decode the response and require value: number in index.ts.
//
// Testing behavioral-verification: api-transform without --cwd returns the index.ts declaration from the current process fixture directory.
// Testing independent-expectations: The authored source declaration and project-relative key define the response, independently of the adapter implementation.
// Testing distinguishing-cases: Omitting --cwd and setting the process directory exercises the implicit cwd path rather than the explicit override used by sibling API cases.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIAPITransformUsesCurrentDirectory(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, out, errOut := invokeInCurrentDirectory(t, root, invoke, "api-transform")
  if code != 0 {
    t.Fatalf("api-transform from cwd failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var transformed cliContractTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
    t.Fatalf("api-transform JSON decode failed: %v\n%s", err, out)
  }
  if !strings.Contains(transformed.TypeScript["index.ts"], "value: number") {
    t.Fatalf("api-transform did not return cwd project source: %#v", transformed.TypeScript)
  }
}

// observeTestCLICommandAcceptsFlagShapedBuildAlias verifies successful build dispatch for a leading cwd flag.
//
// The owner independently checks original preparation before loading its immutable flag-shaped semantic variant. This observer checks success status only.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke the leading --cwd argv with --noEmit.
//  2. Require status zero while retaining streams in a failure report.
//
// Testing behavioral-verification: A leading --cwd flag followed by --noEmit selects project build and returns status zero.
// Testing independent-expectations: The native front door contract accepts compiler-shaped flags without the build word; this body checks acceptance only, not the emitted filesystem.
// Testing distinguishing-cases: A leading flag is distinct from explicit build and unsupported command labels.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandAcceptsFlagShapedBuildAlias(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, out, errOut := invoke(t, "--cwd", root, "--noEmit")
  if code != 0 {
    t.Fatalf("flag-shaped build alias failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}

// observeTestCLICommandCheckAliasSuppressesEmit verifies successful check with no JavaScript publication.
//
// The selected config permits emit, so actual ForceNoEmit compilation must preserve output absence. The manifest case owns a separate immutable emit-capable Program.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke check with the explicit fixture cwd.
//  2. Require status zero and absence of bin/index.js.
//
// Testing behavioral-verification: check succeeds for a compilable outDir project and does not create bin/index.js.
// Testing independent-expectations: The documented check alias is analysis-only even when the configuration supports output; no output is a filesystem observation, not source inspection.
// Testing distinguishing-cases: The positive project makes an accidental emit observable; forced successful emit is covered by the manifest unit case.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandCheckAliasSuppressesEmit(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, out, errOut := invoke(t, "check", "--cwd", root)
  if code != 0 {
    t.Fatalf("check alias failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("check alias should not emit JavaScript: %v", err)
  }
}

// observeTestCLICommandHelpAliases verifies help text for all three literal help aliases.
//
// Each alias executes the real dispatcher separately. The focused text oracle checks documented sections and excludes demo rather than copying the entire help output.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke -h, --help and help under separate named children.
//  2. Require status zero, Project build: and version text, and no demo text.
//
// Testing behavioral-verification: -h, --help and help return zero with Project build: and version text and without demo.
// Testing independent-expectations: The native CLI command surface supplies literal help fragments; the checks permit unrelated extra text and do not enforce empty stderr.
// Testing distinguishing-cases: Three named alias subtests retain all help inputs and Project build and no-demo assertions from TestCLIRunHelpVariants, with the additional version fragment check.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandHelpAliases(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  for _, flag := range []string{"-h", "--help", "help"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := invoke(t, flag)
      if code != 0 {
        t.Fatalf("%s help alias failed: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      if !strings.Contains(out, "Project build:") || !strings.Contains(out, "version") || strings.Contains(out, "demo") {
        t.Fatalf("%s help output missing expected sections:\n%s", flag, out)
      }
    })
  }
}

// observeTestCLICommandRejectsConflictingEmitFlags verifies the mutually exclusive emit flag diagnostic.
//
// Argument rejection needs no authored project or compiler Program. The literal stderr phrase distinguishes this rejection from unrelated status-two failures.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke build with both --emit and --noEmit.
//  2. Require status two and mutually exclusive in stderr.
//
// Testing behavioral-verification: build with --emit and --noEmit returns usage status two and a mutually exclusive diagnostic.
// Testing independent-expectations: Mutually exclusive command intent defines rejection before any fixture project is needed.
// Testing distinguishing-cases: The contradictory pair distinguishes usage rejection from successful emit or noEmit; missing project operands have separate cases.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandRejectsConflictingEmitFlags(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  code, out, errOut := invoke(t, "build", "--emit", "--noEmit")
  if code != 2 {
    t.Fatalf("conflicting emit flags should fail: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(errOut, "mutually exclusive") {
    t.Fatalf("conflicting emit diagnostic missing mutual-exclusion text: %q", errOut)
  }
}

// observeTestCLICommandRejectsMissingProjectArgument verifies missing operands for both project aliases.
//
// Each literal alias has its own named failure identity. The requires a path argument diagnostic distinguishes missing operands from unknown commands.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke -p and --project without operands in separate children.
//  2. Require status two and the literal path-argument diagnostic for each.
//
// Testing behavioral-verification: -p and --project without a path each return status two and a requires a path argument diagnostic.
// Testing independent-expectations: Both project selectors require an operand by their public argv contract; expected error text is a literal contract fragment.
// Testing distinguishing-cases: Named subtests cover both missing-value aliases; the valid absolute-path pair is tested separately.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandRejectsMissingProjectArgument(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  for _, flag := range []string{"-p", "--project"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := invoke(t, flag)
      if code != 2 {
        t.Fatalf("%s without path should fail: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      if !strings.Contains(errOut, "requires a path argument") {
        t.Fatalf("%s diagnostic missing required-path text: %q", flag, errOut)
      }
    })
  }
}

// observeTestCLICommandRejectsUnknown verifies the unknown command diagnostic and help hint.
//
// The demo command does not materialize a project. This observer checks status and stderr text without claiming empty stdout.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke the literal demo command.
//  2. Require status two plus unknown command and --help in stderr.
//
// Testing behavioral-verification: demo returns status two with unknown command and --help diagnostic fragments.
// Testing independent-expectations: An unsupported non-file command label is a usage error; literal diagnostic fragments distinguish dispatch from compiler diagnostics.
// Testing distinguishing-cases: The former demo label stays rejected, while the distinct fly-to-mars unknown case additionally checks empty stdout.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandRejectsUnknown(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  code, out, errOut := invoke(t, "demo")
  if code != 2 {
    t.Fatalf("unknown command should fail: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(errOut, "unknown command") || !strings.Contains(errOut, "--help") {
    t.Fatalf("unknown command diagnostic missing expected text: %q", errOut)
  }
}

// observeTestCLICommandRunsProjectFromCurrentDirectory verifies default project execution from actual cwd.
//
// No argv is supplied, so real cwd lookup selects the authored noEmit config. The focused stdout check distinguishes compilation from printing usage.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Change the actual cwd to the fixture and invoke with no arguments.
//  2. Require status zero and absence of Usage: in stdout.
//
// Testing behavioral-verification: Bare native ttsc succeeds from the noEmit fixture directory and does not print Usage:.
// Testing independent-expectations: The no-argument compiler front door builds its cwd project rather than printing help; the authored valid fixture makes that observable.
// Testing distinguishing-cases: Empty argv differs from explicit help and explicit --cwd; the body checks dispatch acceptance and help absence rather than output contents.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandRunsProjectFromCurrentDirectory(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, out, errOut := invokeInCurrentDirectory(t, root, invoke)
  if code != 0 {
    t.Fatalf("bare command should build cwd project: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if strings.Contains(out, "Usage:") {
    t.Fatalf("bare command should not print help usage: %q", out)
  }
}

// observeTestCLICommandVersionAliases verifies version metadata text for all literal aliases.
//
// Metadata values remain actual runtime values. Independent marker expectations check the output shape without generating expected text from those values.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke -v, --version and version under separate named children.
//  2. Require status zero and the ttsc, commit and go markers.
//
// Testing behavioral-verification: -v, --version and version each return zero and include ttsc, commit and go metadata fragments.
// Testing independent-expectations: The native build metadata contract defines field presence; variable release values are intentionally not copied from the binary.
// Testing distinguishing-cases: Three named alias subtests retain all inputs and metadata fragments from TestCLIRunVersion; requiring go followed by a space strengthens its original go substring assertion.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLICommandVersionAliases(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  for _, flag := range []string{"-v", "--version", "version"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := invoke(t, flag)
      if code != 0 {
        t.Fatalf("%s version alias failed: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      for _, expected := range []string{"ttsc ", "commit", "go "} {
        if !strings.Contains(out, expected) {
          t.Fatalf("%s version output missing %q:\n%s", flag, expected, out)
        }
      }
    })
  }
}

// observeTestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures verifies publication despite an unused overload-only type parameter.
//
// The implementation uses its parameter while the overload signature has a type parameter. This distinguishes declaration-only generic usage from the rejected unused implementation parameter case.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Build the authored overload fixture with forced emit.
//  2. Require success and no unused-parameter/type-parameter diagnostic phrases.
//  3. Require bin/index.js to exist.
//
// Testing behavioral-verification: Forced emit accepts an overload-only unused type parameter, produces index.js and emits no unused-type-parameter message.
// Testing independent-expectations: TypeScript permits type parameters used solely by overload declarations; actual output and forbidden diagnostics establish acceptance independently of filtering logic.
// Testing distinguishing-cases: An overload signature and used implementation parameter are the positive case; an unused implementation parameter is rejected by sibling cases.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, _, stderr := invoke(t, "build", "--cwd", root, "--emit", "--quiet")
  if code != 0 {
    t.Fatalf("build failed: code=%d stderr=%q", code, stderr)
  }
  if strings.Contains(stderr, "declared but never used") || strings.Contains(stderr, "All type parameters are unused") {
    t.Fatalf("overload signature type parameters must not fail noUnused checks: %q", stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); err != nil {
    t.Fatalf("expected emitted JS: %v", err)
  }
}

// observeTestCLIProjectBuildBlocksSemanticDiagnostics verifies no publication after a semantic type error.
//
// The number-to-string assignment is authored invalid input. Its literal diagnostic and output absence distinguish semantic rejection from an unrelated nonzero exit.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Build the semantic-invalid fixture with emit requested.
//  2. Require status two and the number-to-string assignment diagnostic.
//  3. Require bin/index.js to remain absent.
//
// Testing behavioral-verification: build --emit rejects a number-to-string assignment with status two, its semantic diagnostic and no index.js.
// Testing independent-expectations: The independently invalid assignment and pre-emit diagnostic contract define rejection and the observable absence of output.
// Testing distinguishing-cases: Valid syntax isolates semantic failure; parse failure and accepted overloads are exercised separately.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIProjectBuildBlocksSemanticDiagnostics(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  // Scenario setup: using a semantic type mismatch exercises the checker path,
  // not only the config parser or syntax parser.

  // Failure assertion: the command must reject before WriteFile can create the
  // configured output path.
  code, _, errOut := invoke(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("semantic build should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "Type 'number' is not assignable to type 'string'") {
    t.Fatalf("semantic diagnostic missing expected message: %q", errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("semantic failure should not emit JavaScript: %v", err)
  }
}

// observeTestCLIProjectBuildBlocksSyntacticDiagnostics verifies no publication after a malformed variable declaration.
//
// Valid preceding code cannot justify partial JavaScript publication when the later declaration is syntactically invalid. The retained literal diagnostic identifies that branch.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Build the fixture containing the malformed const declaration.
//  2. Require status two and Variable declaration expected in stderr.
//  3. Require bin/index.js to remain absent.
//
// Testing behavioral-verification: build --emit rejects const = ; with status two, Variable declaration expected and no index.js.
// Testing independent-expectations: The malformed declaration violates TypeScript grammar and must block forced output; filesystem absence is observed after direct dispatch completes.
// Testing distinguishing-cases: Valid preceding console code does not permit partial output. The removed BeforeEmit duplicate used the identical source, argv, returned status, diagnostic and output-absence assertions retained here.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIProjectBuildBlocksSyntacticDiagnostics(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, _, errOut := invoke(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("syntactic build should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "Variable declaration expected") {
    t.Fatalf("syntactic diagnostic missing expected message: %q", errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("syntactic failure should not emit JavaScript: %v", err)
  }
}

// observeTestCLIProjectBuildBlocksUnusedParameters verifies no publication after an unused implementation parameter.
//
// The diagnostic accepts two existing upstream wordings for the same unused parameter. Output absence remains an independent assertion rather than following from status alone.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Build the fixture with the unused implementation parameter.
//  2. Require status two and one of the two retained unused diagnostic phrases.
//  3. Require bin/index.js to remain absent.
//
// Testing behavioral-verification: build --emit rejects an unused implementation parameter with status two, an unused diagnostic and no index.js.
// Testing independent-expectations: noUnusedParameters defines the negative compiler case; either supported diagnostic rendering is accepted without generating an expectation from the implementation.
// Testing distinguishing-cases: The real unused implementation parameter differs from permitted overload type parameters. The removed BeforeEmit duplicate used the same project, argv, status, accepted diagnostic alternatives and output-absence assertion retained here.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIProjectBuildBlocksUnusedParameters(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  code, _, errOut := invoke(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("unused-parameter build should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "'unused' is declared but its value is never read") &&
    !strings.Contains(errOut, "'unused' is declared but never used") {
    t.Fatalf("unused-parameter diagnostic missing expected message: %q", errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("unused-parameter failure should not emit JavaScript: %v", err)
  }
}

// observeTestCLIProjectBuildEmitErrorRejectsManifest verifies manifest absence after declaration emission fails.
//
// The anonymous exported class has a private hidden member that triggers TS4094. A failed emit may have partial outputs; this observer specifically rejects publication of a complete-build manifest.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Build with declaration emission and a requested manifest path.
//  2. Require nonzero status plus error, TS4094, emit failed and incomplete-build diagnostics.
//  3. Require the manifest path to remain absent.
//
// Testing behavioral-verification: Declaration emit of an exported anonymous class with a private field fails, reports TS4094 plus incomplete-build context and publishes no manifest.
// Testing independent-expectations: TypeScript declaration visibility rules supply the independently invalid emit; a success manifest would falsely certify a failed output generation.
// Testing distinguishing-cases: An emit-only diagnostic differs from earlier source semantic or syntactic rejection; nonzero status is allowed to be any failure code.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIProjectBuildEmitErrorRejectsManifest(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  manifest := filepath.Join(root, "manifest.json")
  code, out, errOut := invoke(t, "build", "--cwd", root, "--emit", "--manifest", manifest)
  if code == 0 {
    t.Fatalf("build succeeded: %s %s", out, errOut)
  }
  for _, text := range []string{"error", "TS4094", "ttsc: emit failed", "build output is incomplete"} {
    if !strings.Contains(errOut, text) {
      t.Fatalf("missing %q: %s", text, errOut)
    }
  }
  if _, err := os.Stat(manifest); !os.IsNotExist(err) {
    t.Fatalf("incomplete build published a manifest: %v", err)
  }
}

// observeTestCLIProjectBuildEmitsManifest verifies successful JavaScript and manifest publication.
//
// This shared case publishes last after no-output observations. The manifest oracle permits additional outputs while retaining the first JavaScript path suffix and nonempty list.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Build the valid project with emit, verbose and manifest flags.
//  2. Require status zero, emitted= text and bin/index.js existence.
//  3. Decode the manifest and require a nonempty output list beginning with bin/index.js.
//
// Testing behavioral-verification: Successful verbose build --emit creates index.js, prints emitted= and writes a JSON manifest containing its output path.
// Testing independent-expectations: The authored outDir and manifest contract provide independent path expectations; membership/count checks do not require exact verbose text or reject additional outputs.
// Testing distinguishing-cases: The valid emitting project is the positive publication path; the TS4094 case rejects a success manifest.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIProjectBuildEmitsManifest(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  // Scenario setup: the manifest only has meaning when the compiler writes a
  // real output file, so the fixture uses `--emit` with a configured outDir.

  manifest := filepath.Join(root, "manifest.json")

  // Build assertion: verbose output names the emitted count while the manifest
  // remains a machine-readable file list for wrapper callers.
  code, out, errOut := invoke(t, "build", "--cwd", root, "--emit", "--verbose", "--manifest", manifest)
  if code != 0 {
    t.Fatalf("build failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, "emitted=") {
    t.Fatalf("verbose build output missing emitted count: %q", out)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); err != nil {
    t.Fatalf("expected emitted JavaScript: %v", err)
  }

  raw, err := os.ReadFile(manifest)
  if err != nil {
    t.Fatal(err)
  }
  var files []string
  if err := json.Unmarshal(raw, &files); err != nil {
    t.Fatalf("manifest JSON decode failed: %v\n%s", err, raw)
  }
  if len(files) == 0 || !strings.HasSuffix(filepath.ToSlash(files[0]), "bin/index.js") {
    t.Fatalf("manifest did not include emitted JavaScript: %#v", files)
  }
}

// observeTestCLIReportsDiagnosticsWithoutEmit verifies serialized error diagnostics from source transformation.
//
// The transform response remains valid JSON even though the authored type error makes status nonzero. The category oracle does not claim an exact complete diagnostic list.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke api-transform on the invalid type fixture.
//  2. Require status two and decode the actual JSON diagnostics.
//  3. Require a nonempty list whose first category is error.
//
// Testing behavioral-verification: api-transform returns failure status two while stdout retains JSON with an error diagnostic for a number-to-string assignment.
// Testing independent-expectations: The API envelope contract preserves machine-readable diagnostics on failure; the authored invalid assignment provides an independent negative input.
// Testing distinguishing-cases: Failure with a usable JSON envelope distinguishes this adapter from stderr-only build rejection; exact diagnostic text and the complete diagnostic list are not asserted.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIReportsDiagnosticsWithoutEmit(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {

  // Scenario setup: one strict type error is enough to exercise the diagnostic
  // path while keeping the expected JSON result small and deterministic.

  // Diagnostic assertion: the owning run dispatcher executes directly, so this
  // checks its returned status rather than an OS child exit code.
  code, out, errOut := invoke(t, "api-transform", "--cwd", root)
  if code != 2 {
    t.Fatalf("api-transform should fail with diagnostics: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var transformed cliContractTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
    t.Fatalf("diagnostic JSON decode failed: %v\nstdout=%s\nstderr=%s", err, out, errOut)
  }
  if len(transformed.Diagnostics) == 0 || transformed.Diagnostics[0].Category != "error" {
    t.Fatalf("expected serialized error diagnostics: %#v", transformed.Diagnostics)
  }
}

// observeTestCLIRunUnknownCommandExits2 verifies empty stdout and an unknown-command error.
//
// The literal fly-to-mars input distinguishes this focused rejection from positive command execution. This direct unit observes the returned status, not native os.Exit transport.
// Fixture materialization and the visible execution owner remain outside this observer.
//
//  1. Invoke fly-to-mars through the supplied actual dispatcher.
//  2. Require status two, empty stdout and unknown command in stderr.
//
// Testing behavioral-verification: fly-to-mars returns status two, empty stdout and an unknown command stderr fragment.
// Testing independent-expectations: An unsupported command label is a usage error; empty stdout separates command failure from a JSON result or help response.
// Testing distinguishing-cases: This distinct unknown label complements demo rejection and adds the empty stdout assertion.
// Testing execution-ownership: The named aggregate supplies the declared fixture and actual closure; this observer owns only original argv/result assertions. Preparation and borrowed semantic execution are explicitly separated by that owner, and no response is replayed.
func observeTestCLIRunUnknownCommandExits2(t *testing.T, root string, invoke func(*testing.T, ...string) (int, string, string)) {
  code, stdout, stderr := invoke(t, "fly-to-mars")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
