"use strict";
"use client";

declare function work(): Promise<void>;
declare const tag: (strings: TemplateStringsArray) => string;

void work();

// expect: no-unused-expressions error
tag`value`;

// expect: no-unused-expressions error
("not a directive");

function misplacedDirective(): void {
  "use totally custom prologue";
  console.log("before");
  // expect: no-unused-expressions error
  "use strict";
}

function f(a: number, b: number): void {
  // expect: no-unused-expressions error
  (a, b);
}

f(1, 2);
misplacedDirective();
