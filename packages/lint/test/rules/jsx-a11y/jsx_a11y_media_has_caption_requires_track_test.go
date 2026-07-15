package linthost

import "testing"

// TestJsxA11yMediaHasCaptionRequiresTrack verifies media elements need captions.
//
// Empty normal and self-closing media elements cannot provide caption tracks.
// The rule must visit both JSX node kinds for video elements.
//
// 1. Parse normal and self-closing videos with no track child.
// 2. Enable only `jsx-a11y/media-has-caption`.
// 3. Assert each captionless video reports a diagnostic.
func TestJsxA11yMediaHasCaptionRequiresTrack(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/media-has-caption", `const Component = () => <video src="/movie.mp4"></video>;`, "caption")
  assertJsxA11yRuleFinds(t, "jsx-a11y/media-has-caption", `const Component = () => <video src="/movie.mp4" />;`, "caption")
}
