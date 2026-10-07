package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// TestTheResolverFollowsExactlyItsBoundOfLinks verifies the resolver policy follows exactly thirty-two links.
//
// Native link limits can hide the rule boundary.
// An explicit synthetic metadata model makes every target Stat succeed, while the same actual native chain independently checks native-gate behavior.
// The model never enters a graph or certifies native observations.
//
//  1. Author a 33-link chain with real link and terminal-directory metadata.
//  2. Resolve 31, 32 and 33 links through the explicit policy model.
//  3. Resolve the same heads natively and compare with independently observed native Stat capability.
//
// @evidence contracts/testing.md#behavioral-verification resolveLinkedDirectory settles the modeled 31/32-link cases on their authored terminal directory and refuses 33; native traversal either retains an entry rejected by Stat or reaches the same policy result.
// @evidence contracts/testing.md#independent-expectations The literal true/true/false table and authored target pin the thirty-two-link policy independently of kernel capacity. Native Stat and Lstat supply separate actual gate and directory-kind observations.
// @evidence contracts/testing.md#distinguishing-cases Immediately adjacent lengths detect an off-by-one bound on every host, even when native Stat cannot follow 33 links. Native refusal must preserve the unresolved head rather than falsely reach the target.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestTheResolverFollowsExactlyItsBoundOfLinks(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  target := filepath.Join(workspace, "target")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  heads := []string{}
  links := map[string]string{}
  previous := target
  for hop := range 33 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    heads = append(heads, link)
    links[filepath.ToSlash(link)] = filepath.ToSlash(previous)
    previous = link
  }
  directoryInfo, err := os.Lstat(target)
  if err != nil {
    t.Fatal(err)
  }
  linkInfo, err := os.Lstat(heads[0])
  if err != nil {
    t.Fatal(err)
  }
  modeled := evidenceInputReader{host: linkPolicyFixture{
    links: links, target: filepath.ToSlash(target), directory: directoryInfo, link: linkInfo,
  }}
  for _, expected := range []struct {
    links int
    settles bool
  }{{31, true}, {32, true}, {33, false}} {
    head := heads[expected.links-1]
    resolved, settled := resolveLinkedDirectory(head, modeled)
    if settled != expected.settles {
      t.Fatalf("modeled chain of %d links settled=%v, want %v; resolved=%q", expected.links, settled, expected.settles, resolved)
    }
    if settled && resolved != filepath.ToSlash(target) {
      t.Fatalf("modeled chain of %d links settled on %q, want authored target %q", expected.links, resolved, target)
    }
    nativeResolved, nativeSettled := resolveLinkedDirectory(head)
    if _, err := os.Stat(head); err != nil {
      if !nativeSettled || nativeResolved != head {
        t.Fatalf("native Stat refusal must retain the unresolved entry: resolved=%q settled=%v error=%v", nativeResolved, nativeSettled, err)
      }
    } else {
      if nativeSettled != expected.settles {
        t.Fatalf("native chain of %d links settled=%v, want %v", expected.links, nativeSettled, expected.settles)
      }
      if nativeSettled {
        landed, err := os.Lstat(nativeResolved)
        if err != nil || !landed.IsDir() {
          t.Fatalf("native chain of %d links settled on non-directory %q: %v", expected.links, nativeResolved, err)
        }
      }
    }
  }
}
