import { Contract } from "graph-dependency";
export function Reverseaccepted(): void {}
export function Reverserejected(): void {}
export interface ReversePipeline { execute(input: number): void; }
export class ReverseGood implements ReversePipeline {
  public execute(input: number): void { Reverseaccepted(); }
}
export class ReverseBad implements ReversePipeline {
  public execute(input: string): void { Reverserejected(); }
}
export class ReverseRunner {
  public constructor(private readonly pipeline: ReversePipeline) {}
  public run(): void { this.pipeline.execute(1); }
}
export function main(runner: ReverseRunner): void { runner.run(); }
export abstract class ReverseTask { public abstract perform(): void; }
export class RealTask extends ReverseTask { public perform(): void { startTask(this); } }
export function startTask(task: ReverseTask): void { task.perform(); }
export class Alone { public solo(): void {} }
export function callSolo(alone: Alone): void { alone.solo(); }
export class Settlement implements Contract { public settle(): void {} }
export interface ReverseWidget { draw(): void; }
export class ReverseWidget0 implements ReverseWidget { draw(): void {} }
export class ReverseWidget1 implements ReverseWidget { draw(): void {} }
export class ReverseWidget2 implements ReverseWidget { draw(): void {} }
export class ReverseWidget3 implements ReverseWidget { draw(): void {} }
export class ReverseWidget4 implements ReverseWidget { draw(): void {} }
export class ReverseWidget5 implements ReverseWidget { draw(): void {} }
export class ReverseWidget6 implements ReverseWidget { draw(): void {} }
export class ReverseWidget7 implements ReverseWidget { draw(): void {} }
export class ReverseWidget8 implements ReverseWidget { draw(): void {} }
export class ReverseWidget9 implements ReverseWidget { draw(): void {} }
export class ReverseWidget10 implements ReverseWidget { draw(): void {} }
export class ReverseWidget11 implements ReverseWidget { draw(): void {} }
export function paint(widget: ReverseWidget): void { widget.draw(); }
