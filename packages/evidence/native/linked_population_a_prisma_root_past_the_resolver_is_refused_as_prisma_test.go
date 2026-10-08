package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// TestAPrismaRootPastTheResolverIsRefusedAsPrisma verifies an unreachable Prisma population retains its own kind and health.
//
// A real schema behind an overlong native chain cannot become a healthy empty inventory, whether the native gate or the rule bound refuses first.
//
//  1. Place a real Prisma schema behind 35 native links.
//  2. Collect configured Prisma addresses and root health.
//  3. Assert the capability-appropriate Prisma refusal, zero addresses and exactly one failed root.
//
// @evidence contracts/testing.md#behavioral-verification configuredPrismaAddressesWithHealth reports the prisma root, selects zero addresses and records exactly one failed root.
// @evidence contracts/testing.md#independent-expectations Authored Prisma/root literals and the zero/one health counts distinguish refusal from emptiness; native Stat independently supplies the branch and underlying error text.
// @evidence contracts/testing.md#distinguishing-cases The endpoint is nonempty, and the assertion retains kind-specific refusal and failed-root health for both native and bounded failures.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestAPrismaRootPastTheResolverIsRefusedAsPrisma(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  root := filepath.Join(workspace, "project")
  real := filepath.Join(workspace, "real")
  for _, directory := range []string{root, real} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  models := filepath.Join(real, "models")
  if err := os.MkdirAll(models, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(models, "user.prisma"),
    []byte("model User {\n  id Int @id\n}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  head := filepath.Join(workspace, "schema")
  if err := linkPopulationDirectory(t, previous, head); err != nil {
    t.Fatalf("this platform refused to create a link: %v", err)
  }
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"prisma",
      "root":"../schema",
      "files":["models/**/*.prisma"],
      "symbol":"model"
    }
  }]}`)
  addresses, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertLinkedPopulationRefusal(t, problems, head, "prisma", "../schema")
  // A schema sits behind the chain, so the directory the links end at is not
  // empty. The count says the refusal is what produced zero rather than an
  // empty population; it cannot tell a refusal from a walk that declined to
  // descend a link, which is why the refusal itself is asserted above.
  if len(addresses) != 0 {
    t.Fatalf("a root the walk never reached selected %d addresses", len(addresses))
  }
  if len(failed) != 1 {
    t.Fatalf("a root the walk never reached is recorded failed, got %d", len(failed))
  }
}
