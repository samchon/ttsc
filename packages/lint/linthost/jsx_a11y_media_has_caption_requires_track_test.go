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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify normal and self-closing videos lack a track child; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations An authored track child with kind="captions" satisfies this static track-marker policy. The clean input supplies no track src or caption text, so it does not establish a working text alternative. The literal expected findings distinguish the required marker without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Both paired-empty and self-closing video report; a track kind="captions" child with the same media source is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yMediaHasCaptionRequiresTrack owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yMediaHasCaptionRequiresTrack(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/media-has-caption", `const Component = () => <video src="/movie.mp4"></video>;`, "caption")
  assertJsxA11yRuleFinds(t, "jsx-a11y/media-has-caption", `const Component = () => <video src="/movie.mp4" />;`, "caption")
  assertJsxA11yRuleSkips(t, "jsx-a11y/media-has-caption", "declare const props: object; const Component = () => <video src=\"/movie.mp4\"><track kind=\"captions\" /></video>;")
}
