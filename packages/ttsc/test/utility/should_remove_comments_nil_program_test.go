package ttsc_test

import "testing"

/**
 * Verifies utility comment-removal predicate handles nil program state.
 *
 * The utility host calls this helper while wrapping emit and transform output.
 * Nil and partially initialized programs occur only on defensive paths, but the
 * helper must still return false rather than panic.
 *
 * 1. Pass a nil Program to the predicate.
 * 2. Assert comments are not considered removable.
 */
func TestUtilityShouldRemoveCommentsNilProgram(t *testing.T) {
	if utilityShouldRemoveComments(nil) {
		t.Fatal("nil program should not remove comments")
	}
}
