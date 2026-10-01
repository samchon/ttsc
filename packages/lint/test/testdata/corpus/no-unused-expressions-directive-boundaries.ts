// expect: no-unused-expressions error
("use strict");
// expect: no-unused-expressions error
"use client";

const ready: boolean = true;

// expect: no-unused-expressions error
"misplaced after statement";

function scoped(): void {
  "use scoped";
  void ready;
  // expect: no-unused-expressions error
  "use late";
}

class Widget {
  static {
    // expect: no-unused-expressions error
    "use static";
  }
}

namespace Space {
  "use namespace";
  export const marker: number = 1;
  // expect: no-unused-expressions error
  "after namespace statement";
}

scoped();
void Widget;
void Space.marker;
