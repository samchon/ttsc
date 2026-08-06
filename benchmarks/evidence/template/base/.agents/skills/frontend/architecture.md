# Frontend Architecture

The frontend is a static single-page application that calls the backend through the generated SDK. Do not add a server tier, API route layer, repository wrapper, or backend-for-frontend.

## Layout

```text
packages/frontend/
  src/
    App.tsx
    design.ts
    main.tsx
    styles.css
    components/
      app-frame.tsx
      ui/
      providers/app-providers.tsx
      dev/gallery-page.tsx
      <domain>/<name>-page.tsx
    lib/
      client.ts
      config.ts
      utils.ts
      <domain>/
        types.ts
        hooks.ts
        fixtures.ts
  tests/
    journeys/
    ui-review.spec.ts
    readme.spec.ts
  wiki/
    screen-plan.md
    omissions.md
    interactive-review.md
    verification.md
```

Page and domain component filenames are kebab-case; exports are PascalCase. Keep route pages beside their domain subcomponents. `components/ui` holds product-agnostic primitives, `components/providers` holds app-wide providers, and `lib/<domain>` holds hooks, keys, view models, and fixtures.

Import through `@/`. Browser tests stay under package-root `tests/`.

## Hooks Call The SDK

```ts
export function useSales(search: string) {
  return useQuery({
    queryKey: ["shopping", "sales", search] as const,
    queryFn: () =>
      api.functional.shopping.customer.sale.index(apiConnection, {
        body: { search: { title: search } },
      }),
  });
}
```

The hook owns the generated call, query key, invalidation, and transport state. Do not place a handwritten service or transport wrapper between it and the SDK.

Every published accessor is called by some hook, and every hook is used by a screen. An accessor nothing calls is a capability the product does not deliver, and a hook nothing renders is the same omission one layer up; both are invisible in a green build.

One hook usually owns one accessor, and a hook composing two calls for a single screen is ordinary. The obligation is consumption, not layout: a hook may serve a dialog, a background refresh, or a step inside another screen's flow, and whether that capability earns its own page is the separate question `screens.md` answers.

Keep domain keys together and include every parameter:

```ts
const keys = {
  session: ["shopping", "session"] as const,
  catalog: (search: string) => ["shopping", "catalog", search] as const,
  order: (id: string) => ["shopping", "order", id] as const,
};
```

A successful mutation invalidates every view it changed, including actor-owned summaries and counters.

## State Ownership

| State | Owner |
| --- | --- |
| server data | query cache |
| filter, sort, page, open detail | URL |
| form values and dirty state | form |
| menu, tab, hover, dialog | component |

Do not copy query data into component state or synchronize derived values with effects. Derive from the owner during render. Put every request parameter in the query key so out-of-order responses cannot overwrite the current view.

Use optimistic updates only when exact rollback is honest. Never optimistically mint money, orders, or server identity.

## Routes

`App.tsx` owns the route table. Auth-required pages sit below one protected layout:

```tsx
function ProtectedLayout() {
  const session = useSession();
  const location = useLocation();
  if (session.status === "unknown") return <AppSkeleton />;
  if (session.status === "anonymous")
    return <Navigate replace to="/login" state={{ from: location }} />;
  return <Outlet />;
}
```

Route wrappers read and validate parameters, then pass typed props to pages. Pages do not call `useParams`. Keep one catch-all route, distinguish router 404 from API 404 and 403, and preserve the return location across login.

Lazy-load at route boundaries. On forward navigation, move focus to the new heading and scroll to the top; on back navigation, restore scroll.

## Components

Pages fetch through hooks. Children receive view models and callbacks and do not fetch or read the query cache.

Extract a component when a second caller exists or a domain concept deserves a name. Use entity or join-row ids as keys, never array positions. Keep inputs controlled except native file inputs. Add memoization only after a measured need.

Compose app-wide providers in one file. Create `QueryClient` once with a `useState` initializer, set query and mutation retry policies deliberately, and keep one toaster for unexpected errors.

## Errors

Render contract-declared rejections inline or on their fields. Route-level boundaries handle unexpected failures while preserving the application shell. Do not swallow errors or show an expected refusal only as a transient toast.

Queries may retry; mutations default to no automatic retry.

## Resident Compiler

Keep `pnpm dev` running. Vite's `@ttsc/unplugin` checks the package `tsconfig.json`, lint configuration, and contributor rules as the application reloads.
