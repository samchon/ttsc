# Common Implementation Principles

Answer each chapter with grounds a reviewer can check against the declaration. Keep simple decisions brief, and invent no alternatives or history.

## Principled Implementation

Use a method the problem's semantics justify: a language idiom, documented API behavior, or a recognized algorithm, not precedent or popularity. State the method or representation, the premises it relies on (what a transformation must leave unchanged, a numeric method's precision and degeneracies), why they hold for the inputs it actually receives, and any unresolved limitation.

## Clear and Simple Design

Use the simplest structure that serves current requirements, with no layer, option, or abstraction for presumed future needs, and keep each decision with the responsibility that owns it. State how the organization exposes that responsibility and why any non-obvious layer or separation is needed.

## Prohibited Implementation Shortcuts

Do not special-case consumers, fixtures, expected answers, or measurements; replace foreign methods, globals, or internals; add production behavior only to pass a test; or keep a disproven assumption under wrappers, retries, or exceptions. Contract-defined constants and paths for a real supported difference are allowed. Name any such special case or compensation present and its basis, or state the violation honestly.

## Meaningful documentation

Document each public declaration and member with its purpose and the non-obvious facts needed to use it, such as ownership, units, failure effects, or optional-state meaning, not a restatement of its name and type. Separate prose from tags with a blank comment line and documented properties with a blank line. State which facts the documentation gives.
