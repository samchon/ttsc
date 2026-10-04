import { externalWork } from "trace-dependency";

export function shared(): void {}
export function identity(): void { shared(); }
export function disconnected(): void {}

export function leaf(): void {}
export function leafStart(): void { leaf(); }

export function chainTail(): void {}
export function chainMiddle(): void { chainTail(); }
export function chainStart(): void { chainMiddle(); }

export function reverseRoot(): void { reverseMiddle(); }
export function reverseMiddle(): void { reverseLeaf(); }
export function reverseLeaf(): void {}

export type TypeOnly = { value: number };
export function typeBoundary(_value: TypeOnly): void {}
export function typeStart(): void { typeBoundary({ value: 1 }); }

export function externalBoundary(): void { externalWork(); }
export function externalStart(): void { externalBoundary(); }

export function cycleA(): void { cycleB(); }
export function cycleB(): void { cycleA(); }

export function crossStart(): void { crossLeft(); crossRight(); }
export function crossLeft(): void { crossRight(); }
export function crossRight(): void {}

export function exactNode(): void {}
export function exactNodeStart(): void { exactNode(); }
export function overflowNodeA(): void {}
export function overflowNodeB(): void {}
export function overflowNodeStart(): void { overflowNodeA(); overflowNodeB(); }

export function exactHopStart(): void { exactHopA(); exactHopB(); }
export function exactHopA(): void { exactHopB(); exactHopStart(); }
export function exactHopB(): void {}

export function overflowHopStart(): void { overflowHopA(); overflowHopB(); }
export function overflowHopA(): void { overflowHopB(); overflowHopStart(); }
export function overflowHopB(): void { overflowHopA(); }

export namespace First { export function duplicate(): void {} }
export namespace Second { export function duplicate(): void {} }

