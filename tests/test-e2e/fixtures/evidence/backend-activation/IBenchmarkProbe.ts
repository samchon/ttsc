/** One unacknowledged contract for the staged backend graph. */
export interface IBenchmarkProbe {
  /** Primary key mirrored from the probe model. */
  id: string;

  /** Human-readable label mirrored from the probe model. */
  label: string;
}
