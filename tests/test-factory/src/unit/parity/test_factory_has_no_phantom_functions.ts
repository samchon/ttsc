import ttscFactory from "../../../../../packages/factory/src/index";
import fs from "node:fs";
import path from "node:path";
import ts from "ts-legacy";
import { factorySurface } from "./test_factory_completeness";

const { ttscFactoryNames, runtimeFactoryNames } = factorySurface;

/**
 * Verifies the reverse guard: every `create*` that `@ttsc/factory` exposes must be a
 * real `ts.factory` member.
 *
 * This fails loudly if a factory function is invented (a typo, or a name that
 * never existed in the legacy compiler), so the surface can only ever be a
 * subset of the genuine runtime `ts.factory`.
 *
 * 1. Every authored create export is callable and belongs to the independent legacy runtime factory.
 * 2. Live ts.factory member names supply an external runtime API oracle, rather than a committed manifest or second authored file.
 *
 * @evidence contracts/testing.md#behavioral-verification Every authored create export is callable and belongs to the independent legacy runtime factory.
 * @evidence contracts/testing.md#independent-expectations Live ts.factory member names supply an external runtime API oracle, rather than a committed manifest or second authored file.
 * @evidence contracts/testing.md#distinguishing-cases Reverse inclusion catches invented create names; forward missing-public-member coverage belongs to factory_completeness.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_factory_has_no_phantom_functions. Calls shared runtimeFactoryNames and ttscFactoryNames, which enumerate the loaded reference and authored exports in process.
 */
export const test_factory_has_no_phantom_functions = (): void => {
  const real: ReadonlySet<string> = runtimeFactoryNames();
  const phantom: string[] = [...ttscFactoryNames()]
    .filter((name) => !real.has(name))
    .sort();
  if (phantom.length !== 0)
    throw new Error(
      `@ttsc/factory exposes ${phantom.length} create* function(s) absent from ` +
        `the real ts.factory:\n${phantom.map((n) => `  - ${n}`).join("\n")}`,
    );
};
