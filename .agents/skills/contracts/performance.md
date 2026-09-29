# Performance

Answer only the chapters whose decisions the declaration owns. Review the owning operation together with its helpers; moving work into another layer does not remove its cost. No chapter requires a benchmark run, measurement report or certification that behavioral test cases pass.

## Efficient algorithms

Apply to functions that choose an algorithm, data structure or processing strategy for repeated or expensive work.

Choose the most efficient correct algorithm and data structure suited to the supported workload. Avoid unnecessary full scans, repeated calculations and allocations.

Identify the input size that drives the dominant cost and explain why the processing strategy is efficient for it. When a full scan is necessary, explain the requirement that prevents indexing, batching or incremental processing.

## Reuse equivalent work

Apply to operations that choose whether and how completed or in-flight work is shared across consumers.

Reuse equivalent work whenever the supported contract permits it. Use caching, memoization or sharing of in-flight computation to eliminate redundant work. Separate calls or helpers must not each repeat the same valid computation.

Identify the shared computation, its validity scope and the basis for treating inputs and dependencies as equivalent. Explain why the identity and invalidation mechanism fit the actual producer and consumers. A matching key or a quiet watcher alone does not establish that basis.

Avoid redundant lookup, validation and maintenance work. Explain how the design shares that work without weakening the validity boundary; rebuilding a complete snapshot for every consumer can defeat reuse. Tests verify actual invalidation and concurrent behavior.

## Bound retention and release resources

Apply to operations that own retained state, native handles or their acquisition and release. A data container does not independently own its consumers' lifecycle.

Keep resources for the lifetime that the supported operation needs and release obsolete state and handles. Avoid retaining historical entries or opening per-input resources when a shared resource serves the same requirement.

Identify the owner, lifetime and release policy, and explain why resource growth fits the supported workload. Distinguish native handle counts from total memory and work; bounding one does not bound the others.

State an absent bound or unresolved retention assumption honestly. The acknowledgment explains ownership and growth, not passing cleanup or concurrency cases.
