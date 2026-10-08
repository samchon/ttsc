import { assertWithTtscChainsAnExistingTransformer } from "../../internal/metro-config";

/**
 * Verifies a transformer the config already declared is chained, not replaced.
 *
 * See {@link assertWithTtscChainsAnExistingTransformer}: `withTtsc` overwrote
 * `babelTransformerPath` without reading it, so a project using
 * `react-native-svg-transformer` lost it silently (samchon/ttsc#1321).
 *
 * 1. Create absolute, relative, package and duplicate-self transformer fixtures.
 * 2. Configure each spelling, explicit override and double wrapping.
 * 3. Assert every published upstream adoption and refusal from the worker payload.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc publishes an absolute, project-relative or bare-package babelTransformerPath as the worker upstream (resolved from the project), passes an unresolvable spelling through as written, lets an explicit upstreamTransformer win, publishes none for a bare config, a doubly wrapped config, a duplicate @ttsc/metro copy and an @ttsc/metro specifier, and still chains a foreign module named transformer.js.
 * @evidence contracts/testing.md#independent-expectations Each fixture module path and package name is authored in the test, so the expected published upstream (the exact path, the literal spelling, or undefined) follows from the explicit-override and self-delegation rules rather than from the resolver's output. Expected module spellings use independent Node realpath observations over authored files, retaining lexical inputs through aliased temporary parents.
 * @evidence contracts/testing.md#distinguishing-cases Adoption spellings (absolute, relative, bare), the unresolved spelling, explicit precedence, no declared transformer, double wrapping, a second installed copy, the package specifier and a foreign lookalike transformer.js are separate asserted cases in this body.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls withTtsc in-process against temp project roots with fake node_modules packages and reads the result back from TTSC_METRO_OPTIONS (restored afterwards); no native compile, consumer install or Metro host is started.
 */
export const test_withttsc_chains_an_existing_transformer = async () => {
  await assertWithTtscChainsAnExistingTransformer();
};
