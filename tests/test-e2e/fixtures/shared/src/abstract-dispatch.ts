export function transform(): void {}
export function persistAbstract(): void {}
export abstract class AbstractPipeline {
  public abstract execute(): void;
  public start(): void { this.execute(); }
}
export class TransformAbstractPipeline extends AbstractPipeline {
  public execute(): void { transform(); }
}
export class PersistAbstractPipeline extends AbstractPipeline {
  public execute(): void { persistAbstract(); }
}
export class AbstractRunner {
  public constructor(private readonly pipeline: AbstractPipeline) {}
  public run(): void { this.pipeline.start(); }
}
