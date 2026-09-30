package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies an out-of-project Swagger document is located on disk rather than
 * under the project.
 *
 * The path arithmetic is the whole of what a local Swagger reference does with
 * its root, and it fails in the quietest possible way: joining an absolute path
 * onto the project produces a location that does not exist, which arrives as a
 * missing document instead of as the resolution bug it is.
 *
 *  1. Resolve an ancestor-relative source and an absolute one.
 *  2. Compare each against the location its spelling names.
 *  3. Assert the ascent is applied and the absolute path is left alone.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification swaggerSourcePath resolves the sibling file and preserves absolute spelling.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Independently constructed native contracts/swagger.json path is the expected output.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Ascending and absolute sources retain different resolution behavior.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerSourcePathsResolveOutsideTheProject is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerSourcePathsResolveOutsideTheProject(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "packages", "backend")
  ascending := swaggerSourcePath(root, "../contracts/swagger.json")
  if want := filepath.Join(workspace, "packages", "contracts", "swagger.json"); ascending != want {
    t.Fatalf("ascending source path = %q, want %q", ascending, want)
  }
  absolute := filepath.Join(workspace, "shared", "contracts", "openapi.yaml")
  if got := swaggerSourcePath(root, filepath.ToSlash(absolute)); got != absolute {
    t.Fatalf("absolute source path = %q, want %q", got, absolute)
  }
}
