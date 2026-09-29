/**
 * Main-process file predicate used only by project discovery.
 *
 * @evidence contracts/common.md#principled-implementation The file predicate and identity express the two facts discovery needs; its member documentation distinguishes the broader compiler predicate used by the extending baseline.
 * @evidence contracts/common.md#clear-and-simple-design This minimal base avoids reading content or constructing graph state for a discovery-only question.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Availability is observed and identity is carried explicitly, without accepting an expected candidate solely from its name.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain predicate provenance and identity mismatch, with separated members and tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The native file predicate and filesystem identity remain independent facts; platform-specific case policy is not guessed by this type.
 */
export interface TtscWatchInputFileBaseline {
  /**
   * Whether the path counts as a file under the predicate that captured it:
   * discovery's regular-file check for a file baseline, or the compiler's stat
   * kind, which counts anything but a directory, for a broad one.
   */
  fileExists: boolean;

  /**
   * Filesystem identity key of the path; evidence recorded for another identity
   * never matches.
   */
  identity: string;
}
