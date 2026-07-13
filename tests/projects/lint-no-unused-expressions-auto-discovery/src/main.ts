"use client";
"use arbitrary directive";

declare function work(): Promise<void>;
declare function generic<T>(): T;
declare const tag: (strings: TemplateStringsArray) => string;
const box: { value?: number } = {};
let counter = 0;

work();
new Error("productive construction");
counter = 1;
counter++;
delete box.value;
void work();
work() as Promise<void>;
work()!;
generic<Promise<void>>();

async function later(): Promise<void> {
  await work();
}

function* sequence(): Generator<Promise<void>, void, unknown> {
  yield work();
}

void later;
void sequence;

// expect: no-unused-expressions error
tag`value`;

function misplacedDirective(): void {
  "use function directive";
  console.log("before");
  // expect: no-unused-expressions error
  ("use strict");
}

misplacedDirective();
