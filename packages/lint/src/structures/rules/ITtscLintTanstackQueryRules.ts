import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * TanStack Query rules from `@tanstack/eslint-plugin-query`.
 *
 * Guards the ergonomic and correctness contracts of TanStack Query
 * (`useQuery`, `useMutation`, query-options factories) inside React
 * TypeScript sources.
 *
 * @reference https://github.com/TanStack/query/tree/main/packages/eslint-plugin-query
 */
export interface ITtscLintTanstackQueryRules {
  /**
   * Require TanStack Query `queryKey` arrays to include every
   * variable read by the `queryFn` body, mirroring React Hooks
   * dependency tracking.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/exhaustive-deps
   */
  "tanstack-query/exhaustive-deps"?: TtscLintRuleSetting;

  /**
   * Require `queryFn`, `getPreviousPageParam`, and `getNextPageParam`
   * inside `useInfiniteQuery` to appear in the order TanStack Query
   * documents.
   *
   * Type inference flows through these callbacks in sequence, so a
   * reordered options object widens the page-param type to
   * `unknown`.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/infinite-query-property-order
   */
  "tanstack-query/infinite-query-property-order"?: TtscLintRuleSetting;

  /**
   * Require `useMutation` callbacks to declare `onMutate` before
   * `onError` and `onSettled`.
   *
   * The options object's type inference threads the `onMutate`
   * return value into the later callbacks' `context` parameter,
   * which collapses to `unknown` when the order is wrong.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/mutation-property-order
   */
  "tanstack-query/mutation-property-order"?: TtscLintRuleSetting;

  /**
   * Reject `...rest` destructuring on TanStack Query hook results.
   *
   * The result object is a tracked proxy that only re-renders for
   * the fields you read; rest-destructuring touches every field,
   * subscribes the component to all of them, and disables that
   * optimization.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/no-rest-destructuring
   */
  "tanstack-query/no-rest-destructuring"?: TtscLintRuleSetting;

  /**
   * Reject passing entire TanStack Query hook results into React
   * dependency arrays.
   *
   * The returned object is a fresh reference on every render, so
   * `useEffect` / `useMemo` / `useCallback` would re-run
   * unconditionally; depend on the specific fields you read instead.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/no-unstable-deps
   */
  "tanstack-query/no-unstable-deps"?: TtscLintRuleSetting;

  /**
   * Reject `queryFn` callbacks that resolve to `void`.
   *
   * The return value is what TanStack Query caches and exposes as
   * `data`; a void implementation always populates the cache with
   * `undefined` and almost always indicates a forgotten `return`.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/no-void-query-fn
   */
  "tanstack-query/no-void-query-fn"?: TtscLintRuleSetting;

  /**
   * Prefer wrapping query options in the `queryOptions()` helper
   * over inline `{ queryKey, queryFn }` literals.
   *
   * The helper co-locates key and fetcher, lets
   * `queryClient.getQueryData` and `setQueryData` share the same
   * typed key, and prevents the same key being paired with two
   * different `queryFn`s.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/prefer-query-options
   */
  "tanstack-query/prefer-query-options"?: TtscLintRuleSetting;

  /**
   * Reject creating a `QueryClient` inside a React component or
   * hook body — the client must be stable across renders.
   *
   * @reference https://tanstack.com/query/latest/docs/eslint/stable-query-client
   */
  "tanstack-query/stable-query-client"?: TtscLintRuleSetting;
}
