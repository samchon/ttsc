# Overall Review

Apply the Review skill's review loop until dry to the complete application and every cross-layer relationship.

## Scope

The complete overall scope is the union of the Backend Review and Frontend Review scopes. Read `backend.md` and `frontend.md` in full before this document, then repeat both propagation trees as one indivisible round.

Overall review does not reuse or compose the earlier backend and frontend rounds. It rereads the current requirements, database, API, backend, frontend, tests, live states, and journeys after all earlier corrections.

## Forward Propagation

Treat every requirement as a root and follow every applicable path through the complete application.

1. Propagate the requirement into the database.
2. Propagate the requirement into API operations and DTOs.
3. Propagate the API into its operation contract and backend tests.
4. Propagate the API into frontend state, screens, interactions, and browser tests.
5. Propagate each screen and interaction into a complete live user journey.
6. Verify that the final visible result agrees with every required database effect, authorization boundary, refusal, rollback, lifecycle transition, and cleanup.

Every branch is independent. A correct API does not prove its database, implementation, frontend, or tests; a passing journey does not prove unvisited refusals or persistent effects.

## Backward Propagation

Treat every current artifact and behavior as a root and trace it backward.

1. Trace every database element to the requirement and API behavior that need it.
2. Trace every API operation and DTO property to its requirement, database source, backend owner, frontend consumer, and tests.
3. Trace every promised effect and refusal to its requirement, API contract, database invariant, and proof.
4. Trace every frontend route, screen, component, state, and action to its requirement, API contract, live journey, and browser test.
5. Trace every backend and browser test to the exact behavior it claims to prove.

Record orphaned artifacts, invented behavior, unused operations, unproved effects, duplicated owners, and consistent cross-layer mistakes as findings.

## Adjacent-Layer Closure

Compare every adjacent boundary in both directions.

1. Requirements and database:
   - verify full concept, field, relation, lifecycle, ownership, ordering, concurrency, and deletion coverage;
   - verify that every persisted element is required or technically necessary.
2. Database and API:
   - verify DTO types, units, optionality, null meanings, validation, ownership, and derivation;
   - verify complete create, read, change, delete, list, aggregate, authorization, and refusal behavior.
3. API and backend:
   - verify every controller contract against authorization, provider branches, transactions, side effects, errors, and returned values;
   - verify every implementation path remains inside the public contract.
4. API and frontend:
   - verify request construction, response interpretation, errors, cache behavior, navigation, and deletion cleanup;
   - verify every required operation is usable and every used operation is required;
   - verify the complete chain for every accessor: a hook calls it, a screen renders that hook, and a journey walks that screen.
5. Backend and tests:
   - verify success, refusal, boundaries, persistence, rollback, cascade, ordering, isolation, and concurrency;
   - verify that every accessor has its proving tests, that each names the operation it actually exercises, and that its prerequisites are not mistaken for the subject;
   - verify that assertions fail when the named behavior disappears.
6. Frontend and browser tests:
   - verify every required live state, action, refusal, recovery, responsive behavior, and user-visible consequence;
   - verify that journeys exercise the current live application rather than a simulated substitute;
   - verify that a journey's assertions fail when the behavior it names disappears.

## End-To-End Closure

For every user journey, trace the complete path from requirement through request, authorization, backend behavior, database effect, response, cache update, screen state, and browser assertion. Then trace the same path backward from the observed result to its requirement.

Record each failed edge separately in the current Overall finding list, even when one correction can fix several edges. Continue through every remaining root and relationship before applying any correction.
