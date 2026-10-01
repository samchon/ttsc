/**
 * Verifies jsx-a11y/media-has-caption: `<audio>`/`<video>` need captions.
 *
 * Pins the self-closing branch: without a `<track kind="captions">` child,
 * deaf and hard-of-hearing users have no access to the audio content.
 *
 * 1. Render a self-closing `<video />` with no caption track child.
 * 2. Lint flags the missing caption track.
 */
// expect: jsx-a11y/media-has-caption error
export const X = () => <video src="/clip.mp4" />;
