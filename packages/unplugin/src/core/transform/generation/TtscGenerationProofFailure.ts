/** One reason a whole-project transform cannot become a reusable generation. */
export interface TtscGenerationProofFailure {
  domain: "external" | "graph" | "host" | "project";
  /** Machine-readable failure class printed verbatim in terminal diagnostics. */
  kind: string;
  /** Optional producer detail, such as the native compiler observation failure. */
  detail?: string;
  /** Absolute lexical spelling of the input or directory that failed proof. */
  path?: string;
}
