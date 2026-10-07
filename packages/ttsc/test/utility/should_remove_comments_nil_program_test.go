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
//
// @evidence contracts/testing.md#behavioral-verification utilityShouldRemoveComments(nil) returns false without panicking.
// @evidence contracts/testing.md#independent-expectations False for a nil program is the defensive contract stated for this predicate.
// @evidence contracts/testing.md#distinguishing-cases The nil input is the boundary; programs with real options are covered through the build tests.
// @evidence contracts/testing.md#execution-ownership TestUtilityShouldRemoveCommentsNilProgram is a Go unit test in the test/utility process: it calls the predicate directly with a nil program and starts no project or process.
func TestUtilityShouldRemoveCommentsNilProgram(t *testing.T) {
  if utilityShouldRemoveComments(nil) {
    t.Fatal("nil program should not remove comments")
  }
}
