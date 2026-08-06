# Screens

A screen is a route page under `src/components/<domain>/<name>-page.tsx`. Every screen needs a requirement and the domain hooks that supply its data. Screens do not call accessors directly; `architecture.md` owns that boundary.

## Requirement Ownership

Every requirement section is delivered by a screen or recorded as an omission. The set is not yours to choose: it is every H2 and H3 under `docs/analysis`, which is the same population the backend answers to. From the workspace root:

```bash
rg --no-filename -o '^#{2,3} .+' docs/analysis | sort
```

| Rule | Detail |
| --- | --- |
| one owning screen | the screen a reader reaches to satisfy this requirement, named in `screen-plan.md` |
| every section named | each enumerated section appears in `screen-plan.md`, or in `omissions.md` with what covers it instead |
| an omission is a decision | it names the owner or observable alternative and the condition that would make it false |

"No screen needed" is a conclusion, not a reason. A section a browser genuinely does not deliver, a persistence rule or an authorization boundary the backend enforces alone, belongs in `omissions.md` with that owner named.

`pnpm plan` from `packages/frontend` decides it. It reads the corpus, reads both records, prints the covered count, and lists every section named by neither. It reads and never writes.

## Plan And Declare

Before implementation, write `packages/frontend/wiki/screen-plan.md` with each screen, its requirement, actor, operations, and user journey. Run `pnpm plan` while writing it rather than at the end; the enumeration is exact from the first line, so a plan that grows against it never needs reconciling later.

Declare the whole page surface before realizing it:

```tsx
/**
 * Seller sale list with filter, pagination, and ownership actions.
 *
 * Implementation pending: connect useSales, complete every state, and add
 * gallery fixtures and browser coverage.
 */
export function CatalogPage(props: { sellerId: string }) {
  props;
  return <Skeleton className="h-64 w-full" />;
}
```

Mount every stub in the route table. Implement one screen at a time, remove its marker only after its hooks, states, fixtures, and interactions are complete.

## Screen Structure

```tsx
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const query = useCatalog(params.toString());

  if (query.isPending) return <CatalogPageFallback />;
  if (query.error)
    return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (query.data.data.length === 0)
    return <EmptyState message="No sale matches this filter." />;

  return (
    <SaleList
      sales={query.data.data}
      onPage={(page) => setParams(nextPage(params, page))}
    />
  );
}
```

Each screen owns loading, initial empty, filtered empty, expected refusal, unexpected error, retry, success, and post-mutation freshness. Children receive data and callbacks; they do not fetch.

Walk every requirement journey end to end as its actor. A set of individually working pages can still form an impossible sequence.

## Forms

The DTO is the validation schema:

```ts
const result = typia.validate<IShoppingMember.IJoin>(input);
if (result.success === false)
  setDiagnoses(toDiagnoses(result.errors));
```

Use shared diagnosers for cross-field rules both backend and frontend enforce. Do not create a parallel form schema or repeat DTO format checks.

Map `typia` paths and server `IDiagnosis.accessor` values to the same field messages. Empty accessors belong to the form as a whole.

| Outcome | Required behavior |
| --- | --- |
| submitting | disable duplicate submit and keep fields readable |
| client invalid | focus the first invalid field; do not call the server |
| server refusal | keep all input and render actionable diagnoses |
| success | invalidate every affected query, then navigate or close |

Send only DTO-declared fields. Omit absent optionals instead of fabricating empty values.

## Lists

Filter, sort, and page live in the URL so the view survives reload, sharing, and back navigation. Build the request from the DTO:

```ts
const body = {
  page: Number(params.get("page") ?? 1),
  limit: 20,
  search: {
    title: params.get("title") ?? undefined,
  },
  sort: ["-sale.opened_at"],
} satisfies IShoppingSale.IRequest;
```

Reset page to one when filter or sort changes. Render `IPage.pagination`, not guesses from `data.length`. Keep the previous page visible while the next loads.

Distinguish “nothing exists” from “this filter matched nothing” only when the contract provides a reliable signal. Never fetch one detail per row; a missing summary value is a contract finding.

## Values

Render contract meaning, not raw transport:

- show money with its currency and documented scale;
- do not recompute server-owned totals;
- render instants in the reader's zone;
- render UTC-normalized calendar dates without timezone shifting;
- map every enum literal through an exhaustive human label;
- render each nullable value according to its documented absence meaning; and
- centralize pure formatters in `src/lib/utils.ts`.

Never display raw ISO strings, enum identifiers, or a generic dash for semantically different null states.

## Authorization And Failures

Hide or disable actions the current actor cannot use, but still handle server refusal because authority may change after render. Interface visibility is usability, not enforcement.

Keep the current route and form input when a session expires or an operation is refused. Render API `403` and `404` in the requesting screen rather than converting them into router redirects.

## Responsive And Accessible

Verify real lists, forms, detail views, dialogs, and pagination at mobile, tablet, and desktop widths. Every control needs a semantic element, visible focus, associated label, sufficient target size, keyboard operation, and understandable status text.

If a screen needs an operation or value the SDK does not expose, repair the contract. Do not invent a frontend-only transport or local DTO.
