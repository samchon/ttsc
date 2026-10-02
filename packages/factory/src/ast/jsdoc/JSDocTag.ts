import type { JSDocAugmentsTag } from "./JSDocAugmentsTag";
import type { JSDocAuthorTag } from "./JSDocAuthorTag";
import type { JSDocCallbackTag } from "./JSDocCallbackTag";
import type { JSDocClassTag } from "./JSDocClassTag";
import type { JSDocDeprecatedTag } from "./JSDocDeprecatedTag";
import type { JSDocEnumTag } from "./JSDocEnumTag";
import type { JSDocImplementsTag } from "./JSDocImplementsTag";
import type { JSDocImportTag } from "./JSDocImportTag";
import type { JSDocOverloadTag } from "./JSDocOverloadTag";
import type { JSDocOverrideTag } from "./JSDocOverrideTag";
import type { JSDocParameterTag } from "./JSDocParameterTag";
import type { JSDocPrivateTag } from "./JSDocPrivateTag";
import type { JSDocPropertyTag } from "./JSDocPropertyTag";
import type { JSDocProtectedTag } from "./JSDocProtectedTag";
import type { JSDocPublicTag } from "./JSDocPublicTag";
import type { JSDocReadonlyTag } from "./JSDocReadonlyTag";
import type { JSDocReturnTag } from "./JSDocReturnTag";
import type { JSDocSatisfiesTag } from "./JSDocSatisfiesTag";
import type { JSDocSeeTag } from "./JSDocSeeTag";
import type { JSDocTemplateTag } from "./JSDocTemplateTag";
import type { JSDocThisTag } from "./JSDocThisTag";
import type { JSDocThrowsTag } from "./JSDocThrowsTag";
import type { JSDocTypeTag } from "./JSDocTypeTag";
import type { JSDocTypedefTag } from "./JSDocTypedefTag";
import type { JSDocUnknownTag } from "./JSDocUnknownTag";

/**
 * Any JSDoc tag node.
 *
 * Recognized tags retain their structured payloads. JSDocUnknownTag carries an
 * arbitrary tag name and description without resolving that name's meaning.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union preserves each supported block tag's required payload and includes an explicit unknown-tag form; membership does not establish the tag's semantic validity.
 * @evidence contracts/common.md#clear-and-simple-design Concrete tag types own their individual fields, while this union provides one shared boundary for ordered tag collections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Arbitrary tag names use the public unknown-tag representation rather than consumer-specific additions or patched printer behavior.
 * @evidence contracts/common.md#meaningful-documentation The native prose describes structured and unknown tags and the lack of name resolution, with one explanatory paragraph before tags under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JSDocTag =
  | JSDocAugmentsTag
  | JSDocAuthorTag
  | JSDocCallbackTag
  | JSDocClassTag
  | JSDocDeprecatedTag
  | JSDocEnumTag
  | JSDocImplementsTag
  | JSDocImportTag
  | JSDocOverloadTag
  | JSDocOverrideTag
  | JSDocParameterTag
  | JSDocPrivateTag
  | JSDocPropertyTag
  | JSDocProtectedTag
  | JSDocPublicTag
  | JSDocReadonlyTag
  | JSDocReturnTag
  | JSDocSatisfiesTag
  | JSDocSeeTag
  | JSDocTemplateTag
  | JSDocThisTag
  | JSDocThrowsTag
  | JSDocTypeTag
  | JSDocTypedefTag
  | JSDocUnknownTag;
