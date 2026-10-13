# Test Contracts

Answer for every unit and E2E test from its actual assertions and execution path, including cases registered through a shared harness. A passing run is not an answer.

## Behavioral verification

Run the behavior and assert its observable result. Checks of repository arrangement, such as a file existing, a manifest or document containing a string, a workflow having a step, source matching a pattern, or two files agreeing, are not tests; delete them.

State the operation exercised, the defect the assertions catch, and the valid behavior they allow.

## Independent expectations

Derive expected values from the supported contract, a specification, or an independent reference, never from the implementation under test or a snapshot of its output.

State that basis, how the assertion would catch a wrong implementation, and any oracle limitation.

## Distinguishing cases

Cover the decisions the test owns with positive, negative, and boundary cases: input that must change and meaning that must stay, an adjacent input where a predicate must not act, and empty, singleton, limit, malformed, and failure cases where relevant. Never weaken assertions or drop cases to save time.

State this test's contribution and the cases another test owns.

## Execution ownership

A unit test reaches portable semantics without installing a consumer, building a native artifact, or starting a real host; an E2E test exercises a necessary real connection. Keep them in separate populations, runners, and Evidence selections. Moving or relabeling a file does not change its layer.

State the layer, the discoverable entry, and who owns dynamically registered cases.
