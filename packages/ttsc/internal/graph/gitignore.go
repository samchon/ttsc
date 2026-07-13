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
  cmd := exec.Command("git", "-C", cwd, "check-ignore", "--stdin")
  cmd.Stdin = strings.NewReader(strings.Join(paths, "\n") + "\n")
  // check-ignore exits 0 with the ignored paths on stdout, 1 (an error to
  // Output) with no output when none match, and 128 when git cannot run. Only
  // stdout matters: parse it whenever it is non-empty, ignore the exit code.
  out, _ := cmd.Output()
  ignored := make(map[string]bool)
  for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
    if line != "" {
      ignored[line] = true
    }
  }
  if len(ignored) == 0 {
    return nil
  }
  return ignored
}
