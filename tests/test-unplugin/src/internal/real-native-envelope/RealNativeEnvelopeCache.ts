interface IRealNativeEnvelopeGraph {
  candidates?: Record<string, string[]>;
  configs: string[];
  edges: Record<string, string[]>;
  globals: string[];
  inputHashes?: Record<string, string | null>;
  inputProofFailures?: Record<string, string>;
  inputObservations?: Record<
    string,
    {
      accessibleEntries?: { directories: string[]; files: string[] };
      directoryExists?: boolean;
      fileExists?: boolean;
      readFile?: { hash?: string; ok: boolean };
      realpath?: { ok: boolean; path?: string };
      stat?: "directory" | "file" | "missing";
    }
  >;
  inputRealpaths?: Record<string, string | null>;
  resolutionInputs?: string[];
}

interface IRealNativeEnvelopeTransformation {
  graph?: IRealNativeEnvelopeGraph;
  type: string;
  typescript?: Record<string, string>;
}

export type RealNativeEnvelopeCache = Map<
  string,
  Promise<{
    projectSnapshotComplete?: boolean;
    result: IRealNativeEnvelopeTransformation;
  }>
>;
