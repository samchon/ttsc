# Repair

Repair preserves established contracts by fixing the responsible cause. Work in this order:

1. Read the implementation, callers, contracts, and tests to understand why the code is structured as it is and which invariants it owns.
2. Before editing, check likely side effects across consumers, failure and recovery, cached or generated state, platforms, and observable file or timing behavior.
3. Fix the cause at its owner, remove obsolete compensations, and verify corrected behavior alongside behavior that must remain. Put non-obvious invariants in nearby comments.
