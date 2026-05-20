package ttsc_test

import "testing"

// TestUtilityShouldRemoveCommentsNilProgram verifies the comment-removal
// predicate handles a nil program without panicking.
//
// The utility host calls this helper while wrapping emit and transform output.
// Nil and partially initialized programs can occur on defensive error paths,
// so the helper must return false rather than panic when Program is nil.
//
// 1. Pass a nil Program pointer to the predicate.
// 2. Assert the predicate returns false (comments are not removable).
func TestUtilityShouldRemoveCommentsNilProgram(t *testing.T) {
  if utilityShouldRemoveComments(nil) {
    t.Fatal("nil program should not remove comments")
  }
}
