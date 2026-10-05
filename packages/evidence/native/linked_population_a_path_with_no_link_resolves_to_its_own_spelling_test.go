package evidence

import (
  "path/filepath"
  "runtime"
  "testing"
)

/**
 * Verifies a path with no link in it resolves to the spelling it arrived as.
 *
 * The resolution walks components, and a volume is the one prefix that is not
 * one: a drive root and a UNC share carry their own separator, and a share root
 * has nothing after it at all. Recomposing such a base from the pieces the walk
 * starts with returns a path one character from the one it was given, which
 * names the same directory and compares as though it did not — so every
 * consumer that asks whether resolution moved the base would answer yes forever
 * on a base with no link in it, and pay the second spelling on every file.
 *
 * The names below are deliberately fictional. A shape this case can judge only
 * by its spelling has to be one no machine running it has made real, because a
 * link anywhere on such a path would change the answer correctly.
 *
 *  1. Take each volume and root shape this platform can spell.
 *  2. Resolve it with no link anywhere on the path.
 *  3. Assert the answer is the cleaned input, byte for byte.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveLinkedPath settles hypothetical native path shapes and preserves their cleaned spelling.
 * @evidence contracts/testing.md#independent-expectations Authored nonexistent path shapes contain no fixture links; filepath.Clean independently defines lexical normalization, not resolver traversal.
 * @evidence contracts/testing.md#distinguishing-cases Windows drive, UNC and extended prefixes contrast with POSIX root and descendants; native platform semantics choose the appropriate shape set.
 * @evidence contracts/testing.md#execution-ownership TestAPathWithNoLinkResolvesToItsOwnSpelling calls resolveLinkedPath with hypothetical native path strings and actual Lstat probes in one Go process. It creates no fixture or symbolic link; Linux selects POSIX shapes, while Windows drive and UNC probes use the real native filesystem policy. No consumer, compiler or product host is started.
 */
func TestAPathWithNoLinkResolvesToItsOwnSpelling(t *testing.T) {
  shapes := []string{}
  if runtime.GOOS == "windows" {
    shapes = append(
      shapes,
      `C:\`,
      `C:\ttsc-evidence-sales`,
      `C:\ttsc-evidence-sales\schema`,
      `\\ttsc-evidence-server\share`,
      `\\ttsc-evidence-server\share\sales`,
      `//ttsc-evidence-server/share`,
      `\\?\C:\ttsc-evidence-sales`,
    )
  } else {
    shapes = append(
      shapes,
      "/",
      "/ttsc-evidence-sales",
      "/ttsc-evidence-sales/schema",
    )
  }
  for _, shape := range shapes {
    resolved, ok := resolveLinkedPath(shape)
    if !ok {
      t.Fatalf("resolving '%s' must settle when no link is on it", shape)
    }
    if want := filepath.Clean(shape); resolved != want {
      t.Fatalf("resolving '%s' gave '%s'; want '%s'", shape, resolved, want)
    }
  }
}
