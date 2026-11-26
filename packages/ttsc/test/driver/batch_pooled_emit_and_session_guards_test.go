package driver_test

import (
	"path/filepath"
	"strings"
	"testing"

	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimtspath "github.com/microsoft/typescript-go/shim/tspath"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverPooledNoEmitIncrementalWritesBuildInfoThroughEmitAllRaw verifies
// that a pooled one-shot no-emit incremental Program still emits its
// .tsbuildinfo through EmitAllRaw without writing JavaScript or declaration
// outputs.
//
//  1. Build a multi-file project with noEmit:true, incremental:true and an
//     explicit tsBuildInfoFile.
//  2. Load under TTSC_BATCH=1 and assert the live checker pool size exceeds 1.
//  3. Run EmitAllRaw with a recording writer and assert no error, the
//     .tsbuildinfo file is written and no .js or .d.ts file is written.
//
// @evidence contracts/testing.md#behavioral-verification Loads a real multi-file noEmit+incremental project under TTSC_BATCH=1, verifies live multi-checker pooling and invokes EmitAllRaw with a recording WriteFile callback.
// @evidence contracts/testing.md#independent-expectations TypeScript's noEmit+incremental rule requires emitting only the configured .tsbuildinfo file and zero .js/.d.ts artifacts; the batch pooling contract requires >1 live checker.
// @evidence contracts/testing.md#distinguishing-cases Covers the pooled noEmit+incremental build-info lane that must remain working; forced declaration emit refusal and resident session refusal are owned by sibling tests.
// @evidence contracts/testing.md#execution-ownership Discoverable Go unit in package driver_test using in-process LoadProgram and EmitAllRaw over a temporary project; no native binary or consumer install runs.
func TestDriverPooledNoEmitIncrementalWritesBuildInfoThroughEmitAllRaw(t *testing.T) {
	root := t.TempDir()
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true,
    "incremental": true,
    "tsBuildInfoFile": "out/check.tsbuildinfo",
    "types": []
  },
  "files": [
    "src/a.ts",
    "src/b.ts",
    "src/c.ts",
    "src/d.ts",
    "src/e.ts",
    "src/f.ts",
    "src/g.ts",
    "src/h.ts"
  ]
}
`)
	for _, name := range []string{"a", "b", "c", "d", "e", "f", "g", "h"} {
		writeProjectFile(t, root, "src/"+name+".ts", "export const item_"+name+": number = 1;\n")
	}

	t.Setenv(shimcompiler.BatchEnv, "1")
	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil || len(diags) != 0 || prog == nil {
		t.Fatalf("LoadProgram: prog=%v diags=%#v err=%v", prog, diags, err)
	}
	defer prog.Close()

	if count := liveCheckerPoolSize(prog.TSProgram); count <= 1 {
		t.Fatalf("expected pooled Program (>1 checker), got %d", count)
	}

	written := map[string]string{}
	_, emitDiags, err := prog.EmitAllRaw(func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
		written[filepath.ToSlash(string(fileName))] = text
		return nil
	})
	if err != nil {
		t.Fatalf("EmitAllRaw on pooled noEmit+incremental Program failed: %v", err)
	}
	if len(emitDiags) != 0 {
		t.Fatalf("EmitAllRaw diagnostics: %#v", emitDiags)
	}

	var sawBuildInfo bool
	for path, content := range written {
		if strings.HasSuffix(path, "/out/check.tsbuildinfo") {
			if strings.TrimSpace(content) == "" {
				t.Fatalf("written tsbuildinfo at %s was empty", path)
			}
			sawBuildInfo = true
			continue
		}
		t.Fatalf("unexpected non-buildinfo emit artifact %q on noEmit pooled Program", path)
	}
	if !sawBuildInfo {
		t.Fatalf("expected out/check.tsbuildinfo to be written, got %v", sortedKeys(written))
	}
}

// TestDriverPooledProgramRefusesDeclarationShapeDigest verifies that
// DeclarationShapeDigest refuses a pooled Program with an error explaining the
// multi-checker emit invariant, while a pinned Program computes the digest.
//
//  1. Load a multi-file project pinned (without TTSC_BATCH) and assert
//     DeclarationShapeDigest succeeds with a non-empty digest.
//  2. Load the same project pooled under TTSC_BATCH=1 with ForceNoEmit, assert
//     live pool size > 1, and assert DeclarationShapeDigest returns an empty
//     digest and the pooled-Program error.
//
// @evidence contracts/testing.md#behavioral-verification Calls DeclarationShapeDigest on both a pinned Program and a live pooled Program loaded from the same temporary project.
// @evidence contracts/testing.md#independent-expectations A pinned Program must produce a non-empty SHA-256 hex digest; a pooled Program must fail with the contract error stating that files were checked on several checkers and emit reads each file's own checker.
// @evidence contracts/testing.md#distinguishing-cases Compares pinned success against pooled refusal on the same source file; build-info emit under noEmit and resident Session refusal are owned by sibling tests.
// @evidence contracts/testing.md#execution-ownership Discoverable Go unit in package driver_test using in-process LoadProgram and DeclarationShapeDigest; no native binary or consumer install runs.
func TestDriverPooledProgramRefusesDeclarationShapeDigest(t *testing.T) {
	root := writeNoEmitMultiFileProject(t)
	filePath := filepath.Join(root, "src", "a.ts")

	t.Setenv(shimcompiler.BatchEnv, "")
	pinned, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
		ForceNoEmit: true,
	})
	if err != nil || len(diags) != 0 || pinned == nil {
		t.Fatalf("pinned LoadProgram: prog=%v diags=%#v err=%v", pinned, diags, err)
	}
	defer pinned.Close()

	pinnedDigest, err := pinned.DeclarationShapeDigest(pinned.SourceFile(filePath))
	if err != nil {
		t.Fatalf("pinned DeclarationShapeDigest failed: %v", err)
	}
	if pinnedDigest == "" {
		t.Fatal("pinned DeclarationShapeDigest returned empty digest")
	}

	t.Setenv(shimcompiler.BatchEnv, "1")
	pooled, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
		ForceNoEmit: true,
	})
	if err != nil || len(diags) != 0 || pooled == nil {
		t.Fatalf("pooled LoadProgram: prog=%v diags=%#v err=%v", pooled, diags, err)
	}
	defer pooled.Close()

	if count := liveCheckerPoolSize(pooled.TSProgram); count <= 1 {
		t.Fatalf("expected pooled Program (>1 checker), got %d", count)
	}

	digest, err := pooled.DeclarationShapeDigest(pooled.SourceFile(filePath))
	if err == nil {
		t.Fatalf("expected DeclarationShapeDigest to fail on pooled Program, got digest %q", digest)
	}
	if digest != "" {
		t.Fatalf("expected empty digest on refusal, got %q", digest)
	}
	wantSubstr := "a pooled Program checked files on several checkers, and emit reads each file's own checker"
	if !strings.Contains(err.Error(), wantSubstr) {
		t.Fatalf("DeclarationShapeDigest error = %q, want substring %q", err.Error(), wantSubstr)
	}
}

// TestDriverNewSessionFromProgramRefusesPooledProgram verifies that
// NewSessionFromProgram enforces single-checker residency by refusing a pooled
// Program with an error naming why, and accepting a pinned Program.
//
//  1. Load a pooled Program over an OverlayFS under TTSC_BATCH=1 with
//     ForceNoEmit, assert live pool size > 1, and assert NewSessionFromProgram
//     returns nil and the resident-session single-checker error.
//  2. Load a pinned Program over an OverlayFS without TTSC_BATCH and assert
//     NewSessionFromProgram returns a non-nil Session wrapping that Program.
//
// @evidence contracts/testing.md#behavioral-verification Calls NewSessionFromProgram with both a real pooled Program and a real pinned Program loaded over OverlayFS.
// @evidence contracts/testing.md#independent-expectations The resident-session contract requires rejecting any pooled Program with an error explaining that a resident session's diagnostics must come from the checker its reads use, while admitting a pinned Program.
// @evidence contracts/testing.md#distinguishing-cases Covers pooled refusal and pinned acceptance at the NewSessionFromProgram boundary without relying on the launcher clearing TTSC_BATCH; NewSession itself is covered by the sibling checker-count test.
// @evidence contracts/testing.md#execution-ownership Discoverable Go unit in package driver_test using in-process LoadProgram, OverlayFS and NewSessionFromProgram; no native binary or consumer install runs.
func TestDriverNewSessionFromProgramRefusesPooledProgram(t *testing.T) {
	root := writeNoEmitMultiFileProject(t)

	t.Setenv(shimcompiler.BatchEnv, "1")
	pooledOverlay := driver.NewOverlayFS(driver.DefaultFS())
	pooled, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
		ForceNoEmit: true,
		FS:          pooledOverlay,
	})
	if err != nil || len(diags) != 0 || pooled == nil {
		t.Fatalf("pooled LoadProgram: prog=%v diags=%#v err=%v", pooled, diags, err)
	}
	defer pooled.Close()

	if count := liveCheckerPoolSize(pooled.TSProgram); count <= 1 {
		t.Fatalf("expected pooled Program (>1 checker), got %d", count)
	}

	sess, err := driver.NewSessionFromProgram(root, pooledOverlay, pooled)
	if err == nil || sess != nil {
		t.Fatalf("NewSessionFromProgram(pooled) = (%v, %v), want (nil, error)", sess, err)
	}
	wantSubstr := "a resident session's diagnostics must come from the checker its reads use"
	if !strings.Contains(err.Error(), wantSubstr) {
		t.Fatalf("NewSessionFromProgram error = %q, want substring %q", err.Error(), wantSubstr)
	}

	t.Setenv(shimcompiler.BatchEnv, "")
	pinnedOverlay := driver.NewOverlayFS(driver.DefaultFS())
	pinned, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
		ForceNoEmit: true,
		FS:          pinnedOverlay,
	})
	if err != nil || len(diags) != 0 || pinned == nil {
		t.Fatalf("pinned LoadProgram: prog=%v diags=%#v err=%v", pinned, diags, err)
	}

	okSess, err := driver.NewSessionFromProgram(root, pinnedOverlay, pinned)
	if err != nil || okSess == nil {
		_ = pinned.Close()
		t.Fatalf("NewSessionFromProgram(pinned) = (%v, %v), want non-nil Session and nil error", okSess, err)
	}
	defer okSess.Close()
	if okSess.Program() != pinned {
		t.Fatalf("NewSessionFromProgram(pinned).Program() = %p, want %p", okSess.Program(), pinned)
	}
}
