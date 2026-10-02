import type { IPlaygroundDependencyProgressPhase } from "./IPlaygroundDependencyProgressPhase";

/**
 * One dependency-install progress event. Package identity may be absent for
 * aggregate completion; completed and total count package work, not bytes.
 *
 * @evidence contracts/common.md#principled-implementation Phase and optional package identity express both per-package transitions and aggregate completion without inventing an identity for the latter.
 * @evidence contracts/common.md#clear-and-simple-design One event record carries display progress without exposing the installer's queue internals.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Progress reflects actual phase transitions and package counts, not fabricated measurement outcomes.
 * @evidence contracts/common.md#meaningful-documentation Native prose states optional identity and count units; paragraph and tag separation follow the documentation skill.
 */
export interface IPlaygroundDependencyProgress {
  phase: IPlaygroundDependencyProgressPhase;
  packageName?: string;
  version?: string;
  completed: number;
  total: number;
  message: string;
}
