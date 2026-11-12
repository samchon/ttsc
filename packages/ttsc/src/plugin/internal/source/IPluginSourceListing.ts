/**
 * A plugin source directory's population as one walk listed it
 * (`collectPluginSourceFiles`): every directory it read, with that directory's
 * metadata taken just before its entries were read, and every file it
 * selected.
 *
 * A filesystem moves a directory's modification and change stamps when an entry
 * is created, removed or renamed in it, and not when a file's content changes
 * or something changes deeper down. While every listed directory still has its
 * recorded stamps, each still holds the entries the walk read, so the
 * population is the recorded one and only its files' own metadata remains to be
 * compared (`pluginSourceFilesSignature`). Enumerating a directory costs a
 * native listing; comparing its stamps costs one metadata request, which is
 * what makes a warm proof of a large source tree cheap (samchon/ttsc#1852).
 *
 * The premise is checked per device rather than assumed: an observer offers a
 * directory's stamps as evidence only on a device it has seen move a
 * directory's stamps when it created an entry, and only when they precede its
 * clock reference, so no later change can share their tick.
 *
 * @evidence contracts/common.md#principled-implementation Each directory's stamps are observed before its entries are read, so any later entry change moves them; files keep their own metadata comparison, and a device that has not shown the premise lists every time.
 * @evidence contracts/common.md#clear-and-simple-design Two relative populations carry exactly what a replay compares, independent of where the directory lives.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The listing never stands for content: file metadata is still compared, and the content digest stays with its owner.
 * @evidence contracts/common.md#meaningful-documentation Native prose states which changes move a directory's stamps, why that bounds the population and how the premise is established.
 * @evidence contracts/portability.md#os-neutral-implementation Paths are native relative spellings and signatures are opaque native metadata strings; the premise is observed per native device.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type runs no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type grants no reuse; its replay does.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type holds no resource.
 */
export interface IPluginSourceListing {
  /**
   * Each listed directory relative to the source directory (`""` for itself),
   * with its metadata signature, in listing order.
   */
  directories: [string, string][];

  /** Each selected file relative to the source directory, in selection order. */
  files: string[];
}
