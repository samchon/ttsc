# Task: trace an exported API end to end

You are onboarding to this TypeScript project. Pick one commonly used exported API (a public function, a class method, or an entry point) and trace its real call path from the public entry point all the way down to where the underlying work actually happens: the database call, the I/O, the core algorithm, whichever applies for the API you chose.

## What the answer must contain

- The full chain of hops, in execution order, with no gap between consecutive hops. Write each hop as a concrete declaration: `kind Name  file:line` (for example `method save  src/repository/Repository.ts:412`).
- For every hop, the relationship that reaches the next one: the call site that invokes it, the place one type implements or overrides another, or the point where dispatch is dynamic (a callback, an interface resolved to its implementation, a method override). Cite the `file:line` where that call or definition lives, so each edge can be checked.
- The boundary where the path crosses each major layer (public API, coordination layer, engine, driver, and so on), named explicitly as you cross it.

## Rules

- Every named symbol and every edge must point to a real location in this codebase. Do not approximate, do not guess, and do not report a hop you have not confirmed in the source.
- Do not stop at the public surface or at a mid-level facade. Keep following the path until it reaches the actual work.
- No filler prose and no architecture essay. The deliverable is the verified chain itself, complete and precise.
