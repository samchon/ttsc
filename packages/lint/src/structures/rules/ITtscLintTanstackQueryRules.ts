import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * TanStack Query rules from `@tanstack/eslint-plugin-query`.
 *
 * Static import and syntax policies for query hooks, query-options factories,
 * and client creation. These checks do not execute TanStack Query or prove its
 * runtime behavior or inferred types.
 *
 * @reference https://github.com/TanStack/query/tree/main/packages/eslint-plugin-query
 *
 * @evidence contracts/common.md#principled-implementation Explicit optional tanstack-query identifiers accept the shared severity forms, representing independent source policies without admitting undeclared option objects.
 * @evidence contracts/common.md#clear-and-simple-design The family groups query-key, callback-order and client-lifetime policies while rule execution stays with the native implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported query-policy keys form the public vocabulary; the type adds no cache patch, consumer exemption or measurement-only setting.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain dependency tracking, inference order and stable client identity; separate family prose and spaced members follow documentation guidance.
 */
export interface ITtscLintTanstackQueryRules {
  /**
   * Require direct `queryKey` arrays to include the free lexical names
   * collected from direct `queryFn` function literals. Parameters, local
   * declarations, imports, known stable names, and property-access names are
   * excluded.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/exhaustive-deps
   */
  "tanstack-query/exhaustive-deps"?: TtscLintRuleSetting;

  /**
   * Require `queryFn` before either page-param callback in recognized infinite
   * query calls and `infiniteQueryOptions`. The check does not order
   * `getPreviousPageParam` relative to `getNextPageParam` or inspect inferred
   * page-param types.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/infinite-query-property-order
   */
  "tanstack-query/infinite-query-property-order"?: TtscLintRuleSetting;

  /**
   * Require `useMutation` callbacks to declare `onMutate` before `onError` and
   * `onSettled`.
   *
   * This is a property-order policy; it does not inspect the inferred callback
   * context type.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/mutation-property-order
   */
  "tanstack-query/mutation-property-order"?: TtscLintRuleSetting;

  /**
   * Reject rest destructuring and object spreads of recognized query-hook
   * results, including tracked result variables. Mutation results are outside
   * this check. It does not observe subscriptions or component renders.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/no-rest-destructuring
   */
  "tanstack-query/no-rest-destructuring"?: TtscLintRuleSetting;

  /**
   * Reject passing entire TanStack Query hook results into React dependency
   * arrays.
   *
   * The check tracks recognized result variables in direct dependency arrays of
   * syntactically named `useEffect`, `useMemo`, and `useCallback` calls.
   * Combined `useQueries` results are exempt; render identity is not measured.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/no-unstable-deps
   */
  "tanstack-query/no-unstable-deps"?: TtscLintRuleSetting;

  /**
   * Reject direct `queryFn` function literals whose syntax has no value return,
   * or whose concise body is `undefined` or a `void` expression.
   * Nested-function returns do not supply the callback's return. This is not a
   * checker-based proof of `void`, resolved values, or cache contents.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/no-void-query-fn
   */
  "tanstack-query/no-void-query-fn"?: TtscLintRuleSetting;

  /**
   * Prefer wrapping query options in the `queryOptions()` helper over inline `{
   * queryKey, queryFn }` literals.
   *
   * Recognized query hooks with direct object arguments containing `queryKey`
   * or `queryFn` are reported. The check does not compare keys across calls or
   * enforce one fetcher per key.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/prefer-query-options
   */
  "tanstack-query/prefer-query-options"?: TtscLintRuleSetting;

  /**
   * Reject recognized `new QueryClient` expressions whose nearest function is
   * non-async and has an uppercase-leading or `use`-prefixed name. Async and
   * anonymous callback boundaries are exempt; render lifetime is not measured.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/stable-query-client
   */
  "tanstack-query/stable-query-client"?: TtscLintRuleSetting;
}
