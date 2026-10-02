package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies the resolver follows exactly the number of links it claims to.
 *
 * The two graph cases either side of the boundary bracket it without pinning
 * it: raising the bound by one leaves both of them green, because the refusal
 * they assert is built well past either value. The bound is a single number
 * that decides whether a working root is refused, so it is measured directly
 * and at the two values that touch it.
 *
 *  1. Build one chain and take three lengths of it.
 *  2. Resolve each from its own head.
 *  3. Assert the last followed hop settles and the one after it does not.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveLinkedDirectory settles thirty-one and thirty-two links but refuses thirty-three, and every settled answer is a directory.
 * @evidence contracts/testing.md#independent-expectations The independently authored true,true,false table pins the literal thirty-two-link limit; os.Lstat checks the settled endpoint.
 * @evidence contracts/testing.md#distinguishing-cases The immediately adjacent lengths distinguish an off-by-one limit that the farther-overrun graph cases would miss.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestTheResolverFollowsExactlyItsBoundOfLinks(t *testing.T) {
	workspace := t.TempDir()
	target := filepath.Join(workspace, "target")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	heads := []string{}
	previous := target
	for hop := range 33 {
		link := filepath.Join(workspace, "hop"+decimal(hop))
		if err := linkDirectory(t, previous, link); err != nil {
			t.Fatalf("this platform refused to create a link: %v", err)
		}
		heads = append(heads, link)
		previous = link
	}
	// `hop[index]` is index+1 links above the directory, and the resolver's own
	// `os.Stat` walks the whole chain at once — so a platform that stops before
	// this one does answers the deepest case before the bound can.
	if _, err := os.Stat(heads[32]); err != nil {
		t.Fatalf("this platform does not follow 33 links either (%v)", err)
	}
	for _, expected := range []struct {
		links   int
		settles bool
	}{
		{links: 31, settles: true},
		{links: 32, settles: true},
		{links: 33, settles: false},
	} {
		resolved, settled := resolveLinkedDirectory(heads[expected.links-1])
		if settled != expected.settles {
			t.Fatalf(
				"a chain of %d links settled=%v, want %v; resolved to '%s'",
				expected.links,
				settled,
				expected.settles,
				resolved,
			)
		}
		if !settled {
			continue
		}
		landed, err := os.Lstat(resolved)
		if err != nil || !landed.IsDir() {
			t.Fatalf("a chain of %d links settled on '%s', which is not a directory", expected.links, resolved)
		}
	}
}
