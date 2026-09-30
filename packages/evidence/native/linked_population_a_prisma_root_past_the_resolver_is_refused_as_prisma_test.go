package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies the Prisma walker refuses an unresolved chain with its own noun.
 *
 * The refusal is one sentence for every kind, and the kind appears in it, so a
 * wrong noun or a dropped arm reads as another kind's failure. Markdown and
 * TypeScript each have a case; without this one the Prisma arm could be handed
 * either and stay green.
 *
 *  1. Build a chain longer than the resolver follows.
 *  2. Root a Prisma population at its head and collect the addresses.
 *  3. Assert the refusal names the Prisma root and the base is recorded failed.
 *
 * @evidence contracts/testing.md#behavioral-verification configuredPrismaAddressesWithHealth refuses the overlong Prisma root, selects zero addresses and records exactly one failed root.
 * @evidence contracts/testing.md#independent-expectations Original literal Prisma noun and declared-root spelling with zero addresses and one failure distinguish refusal from an empty healthy schema set.
 * @evidence contracts/testing.md#distinguishing-cases A real schema exists behind a host-readable chain but the bounded walker cannot reach it; no Prisma parser is started.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestAPrismaRootPastTheResolverIsRefusedAsPrisma(t *testing.T) {
	workspace := t.TempDir()
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
		if err := linkDirectory(previous, link); err != nil {
			t.Fatalf("this platform refused to create a link: %v", err)
		}
		previous = link
	}
	head := filepath.Join(workspace, "schema")
	if err := linkDirectory(previous, head); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	if _, err := os.Stat(head); err != nil {
		t.Fatalf(
			"this platform did not follow the chain to a directory either (%v), so the stat gate answers first",
			err,
		)
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
	assertProblemContains(
		t,
		problems,
		"found no directory at the end of the prisma root '../schema'",
	)
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
