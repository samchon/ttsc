import type { ITtscCompilerTransformation } from "ttsc";

import { selectListedFiles } from "./selectListedFiles";

/** Return exact host-wide descriptor/config inputs for every output file. */
export function selectHostInputs(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  return props.result.type === "exception"
    ? []
    : selectListedFiles(props.projectRoot, props.result.hostInputs);
}
