# Native Platform Boundaries

A declaration with no native filesystem, path identity, or process boundary excludes this chapter.

## OS-neutral implementation

Use abstractions that keep the contract on every supported OS, and isolate necessary native differences behind an explicit boundary. An OS name says nothing about case policy or capabilities.

State how the declaration learns actual platform capabilities, how a path separates filesystem identity from URL spelling, how process arguments are represented, and any remaining platform assumption.
