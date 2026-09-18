import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { inputMetadataEvidence } from "./inputMetadataEvidence";

/** Metadata identity whose stability lets a generation reuse a content hash. */
export function inputMetadataSignature(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  return inputMetadataEvidence(file, filesystem)?.signature;
}
