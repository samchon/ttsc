// Positive: named specifiers are out of order; the first offending name
// (`a`, sorted after `b`) is flagged.
// expect: sort-imports error
import { b, a } from "first";
void a;
void b;

// Positive: alias targets are the sort key. `a as z` reads as `z`, so
// the following `b` is out of order relative to it.
// expect: sort-imports error
import { a as z, b } from "second";
void z;
void b;

// Negative: alphabetical named specifiers across multiple lines are fine.
import { alpha, beta, gamma } from "third";
void alpha;
void beta;
void gamma;

// Negative: single-specifier and default-only imports have nothing to sort.
import single from "fourth";
import only from "fifth";
void single;
void only;
