import type { ITtscCompilerTransformation } from "ttsc";

import { selectListedFiles } from "../envelope/selectListedFiles";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";

/** Exclude disposed transform scratch from live host-input tracking. */
export function selectPersistentHostInputs(props: {
  filesystem: TtscTransformFilesystemOperations;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") return [];
  const inputs = selectListedFiles(props.projectRoot, props.result.hostInputs);
  if (
    props.scratchDirectory === undefined &&
    props.temporaryTsconfig === undefined
  )
    return inputs;
  const identities = createHostPathIdentityContext(props.filesystem);
  const temporary =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  return inputs.filter((input) => {
    if (isTransformScratchInput(input, props.scratchDirectory)) return false;
    return pathIdentityKey(input, identities) !== temporary;
  });
}
