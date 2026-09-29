package graph

import (
  "os/exec"
  "strings"
)

// GitIgnoredFiles returns the graph's source files that git ignores: generated
// output an author does not navigate, such as a Prisma client or other codegen
// emitted as real .ts into the source tree (the .d.ts emit is already dropped by
// driver.SourceFiles, but a generated .ts becomes a node and, being large and
// highly connected, otherwise dominates ranking and floods responses). Callers
// de-surface them: the MCP matcher keeps them reachable as edge targets and by
// exact name; the full-graph dump drops them from the viewer payload entirely.
//
// Empty when cwd is unset, the tree is not a git work tree, or git is
// unavailable, so a non-git project is unaffected.
//
// @evidence contracts/common.md#principled-implementation Git's own ignore engine evaluates each unique source path; NUL-separated input/output preserves native filenames without quoting or newline ambiguity.
// @evidence contracts/common.md#clear-and-simple-design One subprocess batches the graph's unique physical files and returns a membership set for both navigation and dump consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The function uses configured Git semantics rather than a generated-code name heuristic; unavailable Git supplies no invented ignored paths.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state de-surfacing behavior and optional Git availability, with documentation-skill prose/tag separation.
// @evidence contracts/portability.md#os-neutral-implementation Executable and arguments are passed separately through os/exec; the documented Git -z protocol handles filenames independently of OS quoting or separators.
// @evidence contracts/performance.md#efficient-algorithms One graph-node scan deduplicates files and one process evaluates the batch; temporary input/output space scales with unique path bytes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This acquisition does not own ignore-rule invalidation or cross-generation caching; a caller must refresh it when Git inputs change.
// @evidence contracts/performance.md#bound-retention-and-release-resources Cmd.Output waits for its child and closes process pipes; only the caller-owned result set survives completion, including nonzero Git exit outcomes.
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
  out, _ := cmd.Output()
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
