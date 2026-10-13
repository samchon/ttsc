# Performance

Judge the owning operation together with its helpers; moving work to another layer does not remove its cost.

## Efficient algorithms

For a function that chooses an algorithm, data structure, or processing strategy: use the most efficient correct one for the supported workload, without needless traversal or allocation. State the input dimensions that drive time and space, the dominant cost, and why any full scan or rebuild is needed, without claiming unmeasured speedups.

## Reuse equivalent work

For an operation that coordinates work across requests, phases, or consumers: reuse completed or in-flight results whenever the contract permits. State what is shared, which inputs, dependencies, and effects decide equivalence, and how identity and invalidation keep it valid. A matching key or a quiet watcher alone does not prove equivalence, and effectful work is not shared just because its results match.

## Bound retention and release resources

For an operation that owns retained state, handles, or running tasks: hold them only as long as the owner needs, and release them on completion, failure, cancellation, and transfer. State the owner, the acquisition and release points, and what grows the retained population and its bound, keeping handles, bytes, and tasks distinct. State an absent bound honestly.
