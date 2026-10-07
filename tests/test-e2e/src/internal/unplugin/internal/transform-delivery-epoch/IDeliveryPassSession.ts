/**
 * One driven delivery-pass session over a fixture project.
 *
 * Every scenario in this module drives the same shape a bundler with a real
 * `buildStart` drives: `beginTtscTransformBuild` once per pass, then every
 * module delivered inside it. The fixture's Go producer appends one byte per
 * whole-project compile, so `compiles()` counts native host invocations rather
 * than a proxy for them.
 */
export interface IDeliveryPassSession {
  /** How many whole-project compiles the fixture plugin has run so far. */
  compiles: () => number;
  /** Deliver one module through the public transform API. */
  deliver: (file: string) => Promise<unknown>;
  /** Absolute module paths of the fixture, sorted. */
  modules: string[];
  /** Open the next delivery pass, as a host's `buildStart` does. */
  pass: () => void;
  /** Absolute path of the project root. */
  root: string;
  /** Discard every generation, as a host's real teardown does. */
  close: () => void;
}
