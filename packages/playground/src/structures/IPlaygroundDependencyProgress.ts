import type { IPlaygroundDependencyProgressPhase } from "./IPlaygroundDependencyProgressPhase";

/** A single progress event emitted while installing playground dependencies. */
export interface IPlaygroundDependencyProgress {
  phase: IPlaygroundDependencyProgressPhase;
  packageName?: string;
  version?: string;
  completed: number;
  total: number;
  message: string;
}
