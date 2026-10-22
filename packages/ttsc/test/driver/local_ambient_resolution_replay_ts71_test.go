//go:build ttsc_typescript_7_1

package driver_test

import (
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/microsoft/typescript-go/shim/bundled"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLocalAmbientResolutionReplay Verifies local ambient cache sentinels do
// not become filesystem queries while real resolutions retain their proofs.
//
// A same-named disk package distinguishes an unnecessary lookup from the
// compiler's source-owned ambient declaration, even with valid types.
//
// 1. Load local ambient self-imports with and without a disk collision.
// 2. Assert source-local task exclusion, stable graph proofs and real task replay.
// 3. Mutate ordinary, missing and automatic packages, then the ambient source.
// 4. Check an ambient-only Program and the replay API's empty-group refusal.
//
// @evidence contracts/testing.md#behavioral-verification Loads and typechecks real Programs, extracts and replays tasks, and constructs transform graphs. Local sentinel tasks must be absent, every real task must replay unchanged, each package mutation must invalidate its retained tasks, and ambient edits must change a source content proof retained by the import edge.
// @evidence contracts/testing.md#independent-expectations The compiler's local AmbientModuleNames branch skips filesystem resolution only in the declaring source. Authored disk targets, unresolved imports and external augmentations require real tasks; SHA-256 of authored ambient bytes independently establishes the graph content proof. This unit observes the proof supplied to hosts rather than running a bundler's admission policy.
// @evidence contracts/testing.md#distinguishing-cases Covers colliding and absent local packages, a same-name import in another source, an external augmentation, unchanged and changed ordinary/unresolved/automatic resolutions, ambient content edits, nil Program and an empty filesystem-task population. Existing resolution tests own modes, reference redirects, lexical casing and links.
// @evidence contracts/testing.md#execution-ownership The 7.1-tagged Go driver unit registers its cases here and calls public SDK/shim seams in process with private t.TempDir files and uncached filesystem reads. Programs close at subtest cleanup; no package installation, native artifact build or external host is needed.
func TestLocalAmbientResolutionReplay(t *testing.T) {
  ambient := `declare module "local-ambient" { export interface Value { label: string } export type Self = import("local-ambient").Value; }
declare module "local-only" { export type Self = import("local-only").Value; export interface Value { tag: true } }`
  load := func(t *testing.T, root string) *driver.Program {
    t.Helper()
    prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
      ForceNoEmit: true,
      TsgoArgs:    []string{},
      FS:          bundled.WrapFS(osvfs.FS()),
    })
    if err != nil || prog == nil || driver.CountErrors(diagnostics) != 0 {
      t.Fatalf("load project: %v, %v", err, diagnostics)
    }
    t.Cleanup(func() { prog.Close() })
    if diagnostics := prog.Diagnostics(); driver.CountErrors(diagnostics) != 0 {
      t.Fatalf("typecheck project: %v", diagnostics)
    }
    return prog
  }
  t.Run("source ownership and mutation controls", func(t *testing.T) {
    root := t.TempDir()
    files := map[string]string{
      "tsconfig.json": `{"compilerOptions":{"target":"es2022","module":"nodenext","moduleResolution":"nodenext","strict":true,"skipLibCheck":true,"types":["ambient-controls"]},"files":["index.ts","ambient.d.ts","augmentation.ts"]}`,
      "ambient.d.ts":  ambient,
      "index.ts": `import type { Self } from "local-ambient"; import type { Model } from "ordinary";
// @ts-ignore -- deliberate unresolved-resolution control
import type { Missing } from "absent";
export const value: Self = { label: "ok" }; export const model: Model = { id: 1 };`,
      "augmentation.ts":                                   `import "ordinary"; declare module "ordinary" { interface Model { optional?: boolean } }`,
      "node_modules/local-ambient/package.json":           `{"name":"local-ambient","version":"1.0.0","types":"index.d.ts"}`,
      "node_modules/local-ambient/index.d.ts":             `export interface Value { label: string } export type Self = Value;`,
      "node_modules/ordinary/package.json":                `{"name":"ordinary","version":"1.0.0","types":"a.d.ts"}`,
      "node_modules/ordinary/a.d.ts":                      `export interface Model { id: number }`,
      "node_modules/ordinary/b.d.ts":                      `export interface Model { id: number }`,
      "node_modules/@types/ambient-controls/package.json": `{"name":"@types/ambient-controls","version":"1.0.0","types":"a.d.ts"}`,
      "node_modules/@types/ambient-controls/a.d.ts":       `interface AmbientControl { tag: true }`,
      "node_modules/@types/ambient-controls/b.d.ts":       `interface AmbientControl { tag: true }`,
    }
    for name, text := range files {
      writeProjectFile(t, root, name, text)
    }
    prog := load(t, root)
    graph := driver.NewTransformGraph(prog, root)
    if len(graph.InputProofFailures) != 0 {
      t.Errorf("unchanged graph proof failures: %v", graph.InputProofFailures)
    }
    groups := map[string][]shimcompiler.ProgramResolutionTask{}
    for _, task := range shimcompiler.ProgramResolutionTasks(prog.TSProgram) {
      source := driver.TransformOutputKey(root, string(task.SourceFile))
      if source == "ambient.d.ts" && (task.Name == "local-ambient" || task.Name == "local-only") {
        t.Errorf("local ambient sentinel became a filesystem task: %+v", task)
        continue
      }
      if !shimcompiler.ReplayProgramResolutions([]shimcompiler.ProgramResolutionTask{task}, prog.FS) {
        t.Errorf("unchanged task failed replay: %+v", task)
      }
      switch {
      case task.Kind == shimcompiler.ProgramResolutionKindModule && task.Name == "local-ambient" && source == "index.ts" && strings.HasSuffix(string(task.ResolvedFile), "/node_modules/local-ambient/index.d.ts"):
        groups["other source"] = append(groups["other source"], task)
      case task.Kind == shimcompiler.ProgramResolutionKindModule && task.Name == "ordinary" && source == "index.ts":
        groups["ordinary"] = append(groups["ordinary"], task)
      case task.Kind == shimcompiler.ProgramResolutionKindModule && task.Name == "ordinary" && source == "augmentation.ts":
        groups["augmentation"] = append(groups["augmentation"], task)
      case task.Kind == shimcompiler.ProgramResolutionKindModule && task.Name == "absent" && source == "index.ts" && task.ResolvedFile == "":
        groups["unresolved"] = append(groups["unresolved"], task)
      case task.Kind == shimcompiler.ProgramResolutionKindTypeReference && task.Name == "ambient-controls" && task.Universal && task.ResolvedFile != "":
        groups["automatic"] = append(groups["automatic"], task)
      }
    }
    for _, name := range []string{"other source", "ordinary", "augmentation", "unresolved", "automatic"} {
      if len(groups[name]) == 0 {
        t.Fatalf("missing real filesystem task for %s", name)
      }
    }
    for _, name := range []string{"ordinary", "augmentation", "unresolved", "automatic"} {
      t.Run(name+" mutation", func(t *testing.T) {
        manifest := "node_modules/ordinary/package.json"
        if name == "automatic" {
          manifest = "node_modules/@types/ambient-controls/package.json"
        }
        if name == "unresolved" {
          manifest = "node_modules/absent/package.json"
          declaration := "node_modules/absent/index.d.ts"
          writeProjectFile(t, root, manifest, `{"name":"absent","version":"1.0.0","types":"index.d.ts"}`)
          writeProjectFile(t, root, declaration, `export interface Missing { now: true }`)
          t.Cleanup(func() {
            for _, file := range []string{manifest, declaration} {
              if err := os.Remove(filepath.Join(root, filepath.FromSlash(file))); err != nil {
                t.Error(err)
              }
            }
          })
        } else {
          writeProjectFile(t, root, manifest, strings.Replace(files[manifest], "a.d.ts", "b.d.ts", 1))
          t.Cleanup(func() { writeProjectFile(t, root, manifest, files[manifest]) })
        }
        if shimcompiler.ReplayProgramResolutions(groups[name], prog.FS) {
          t.Error("changed filesystem resolution was accepted")
        }
      })
    }
    if !slices.Contains(graph.Edges["index.ts"], "ambient.d.ts") {
      t.Fatalf("local ambient source missing from import edges: %v", graph.Edges["index.ts"])
    }
    before := graph.InputHashes["ambient.d.ts"]
    if before == nil || *before != fmt.Sprintf("%x", sha256.Sum256([]byte(ambient))) {
      t.Fatalf("ambient content proof does not describe compiler input: %v", before)
    }
    changed := strings.Replace(ambient, "label: string", "label: string; changed?: boolean", 1)
    writeProjectFile(t, root, "ambient.d.ts", changed)
    fresh := driver.NewTransformGraph(load(t, root), root)
    after := fresh.InputHashes["ambient.d.ts"]
    if len(fresh.InputProofFailures) != 0 || !slices.Contains(fresh.Edges["index.ts"], "ambient.d.ts") || after == nil || *after != fmt.Sprintf("%x", sha256.Sum256([]byte(changed))) || *after == *before {
      t.Fatalf("ambient edit lost source content invalidation: hash=%v failures=%v edges=%v", after, fresh.InputProofFailures, fresh.Edges["index.ts"])
    }
  })
  t.Run("no filesystem resolution tasks", func(t *testing.T) {
    root := t.TempDir()
    writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"types":[],"strict":true},"files":["ambient.d.ts"]}`)
    writeProjectFile(t, root, "ambient.d.ts", ambient)
    prog := load(t, root)
    tasks := shimcompiler.ProgramResolutionTasks(prog.TSProgram)
    if len(tasks) != 0 || len(shimcompiler.ProgramResolutionTasks(nil)) != 0 {
      t.Errorf("unexpected filesystem tasks: %v", tasks)
    }
    if shimcompiler.ReplayProgramResolutions(tasks, prog.FS) {
      t.Error("empty-group replay must retain its false result")
    }
    if observation := driver.ObserveProgramResolutions(prog, root); len(observation.Failures) != 0 || len(observation.Candidates) != 0 {
      t.Errorf("empty task population produced phantom observations: %+v", observation)
    }
    if graph := driver.NewTransformGraph(prog, root); len(graph.InputProofFailures) != 0 {
      t.Errorf("empty task population produced graph failures: %v", graph.InputProofFailures)
    }
  })
}
