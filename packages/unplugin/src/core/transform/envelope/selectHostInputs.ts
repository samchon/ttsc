import type { ITtscCompilerTransformation } from "ttsc";

import { selectListedFiles } from "./selectListedFiles";

/**
 * Return host-wide descriptor/config inputs affecting every output file.
 *
 * Relative entries resolve against the project root. Exceptions, absent lists
 * and malformed entries supply no inputs; duplicate spellings remain for the
 * final watch-input merger to deduplicate.
 *
 * @evidence contracts/common.md#principled-implementation Host inputs are universal producer declarations, so every successful or diagnostic-bearing envelope contributes the same normalized list to its outputs while an exception supplies none.
 * @evidence contracts/common.md#clear-and-simple-design This result discriminator delegates list normalization to selectListedFiles instead of duplicating path and malformed-member policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Inputs come from the envelope's hostInputs declaration, without inferring consumer config files or synthesizing dependencies after a failed compile.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains universal scope, relative paths, empty outcomes and downstream deduplication rather than merely restating the return type; separate tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native project-relative path interpretation stays in selectListedFiles; this adapter adds no platform-specific descriptor names or path-string normalization.
 */
export function selectHostInputs(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  return props.result.type === "exception"
    ? []
    : selectListedFiles(props.projectRoot, props.result.hostInputs);
}
