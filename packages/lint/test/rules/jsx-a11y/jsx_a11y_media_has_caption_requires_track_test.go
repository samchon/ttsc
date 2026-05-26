package linthost

import "testing"

// TestJsxA11yMediaHasCaptionRequiresTrack verifies media elements need captions.
//
// Audio and video content should expose captions or subtitles. This pins the
// child scan for track elements under normal JSX elements.
//
// 1. Parse a video element with no track child.
// 2. Enable only `jsx-a11y/media-has-caption`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yMediaHasCaptionRequiresTrack(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/media-has-caption", `const Component = () => <video src="/movie.mp4"></video>;`, "caption")
}
