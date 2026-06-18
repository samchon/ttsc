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
