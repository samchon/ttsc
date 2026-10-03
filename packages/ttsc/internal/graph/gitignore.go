package graph

import (
  "os/exec"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// GitIgnoredFiles returns the graph's source files that git ignores: generated
// output an author does not navigate, such as a Prisma client or other codegen
// emitted as real .ts into the source tree. Graph declaration classification
// treats declaration files separately; driver.SourceFiles itself still exposes
// loaded declaration files. Dump projection marks reported matches as Ignored
// rather than dropping the nodes here; consumer presentation owns de-surfacing.
//
// Empty when cwd is unset, the tree is not a git work tree, or git is
// unavailable. The default check-ignore invocation omits tracked files; empty
// stdout also hides a failed query because this optional result has no error lane.
//
// @evidence contracts/common.md#principled-implementation Git check-ignore supplies membership for unique reported paths using NUL input/output and default tracked-file omission. This optional result preserves nonempty stdout without authenticating query success or acquisition stability.
// @evidence contracts/common.md#clear-and-simple-design One subprocess batches the graph's unique physical files and returns a membership set for both navigation and dump consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The function uses configured Git semantics rather than a generated-code name heuristic; unavailable Git supplies no invented ignored paths.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state de-surfacing behavior and optional Git availability, with documentation-skill prose/tag separation.
// @evidence contracts/portability.md#os-neutral-implementation Executable and arguments are passed separately through os/exec; the documented Git -z protocol handles filenames independently of OS quoting or separators.
// @evidence contracts/performance.md#efficient-algorithms One graph-node scan deduplicates string keys and one command evaluates the batch. Path hashing, joined input, native Git index/ignore work, complete stdout capture and parsing contribute; enabled private tracing also adds its own bounded observations.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This acquisition does not own ignore-rule invalidation or cross-generation caching; a caller must refresh it when Git inputs change.
// @evidence contracts/performance.md#bound-retention-and-release-resources Cmd.Output owns child wait, copy goroutines and pipe closure when it returns. No context deadline, WaitDelay or stdout/population cap is set here, so a hung child or inherited output can prolong completion. Temporary input/maps are call-local; returned membership substrings can retain the complete decoded stdout backing string. No historical cache is owned, and tracing has a separate sink lifetime.
func GitIgnoredFiles(cwd string, g *Graph) map[string]bool {
  if cwd == "" || g == nil {
    return nil
  }
  seen := make(map[string]bool)
  var paths []string
  for _, node := range g.Nodes {
    f := node.File
    if f == "" || strings.HasPrefix(f, "bundled:///") || seen[f] {
      continue
    }
    seen[f] = true
    paths = append(paths, f)
  }
  if len(paths) == 0 {
    return nil
  }
  cmd := exec.Command("git", "-C", cwd, "check-ignore", "--stdin", "-z")
  cmd.Stdin = strings.NewReader(strings.Join(paths, "\x00") + "\x00")
  // check-ignore exits 0 with the ignored paths on stdout, 1 (an error to
  // Output) with no output when none match, and 128 when git cannot run. Only
  // stdout matters: parse it whenever it is non-empty, ignore the exit code.
  observation := e2etrace.BeginCommand(cmd, "Output")
  out, outputErr := cmd.Output()
  observation.Result(outputErr)
  ignored := make(map[string]bool)
  for _, path := range strings.Split(string(out), "\x00") {
    if path != "" {
      ignored[path] = true
    }
  }
  if len(ignored) == 0 {
    return nil
  }
  return ignored
}
