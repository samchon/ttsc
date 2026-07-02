export namespace ITtscWebsiteGraphViewer {
  export interface RawNode {
    id: string;
    name: string;
    kind: string;
    file: string;
    external?: boolean;
    ignored?: boolean;
    pos?: number;
    end?: number;
  }

  export interface RawEdge {
    from: string;
    to: string;
    kind: string;
  }

  export interface RawDump {
    schemaVersion?: number;
    project?: string;
    provenance?: string;
    nodes: RawNode[];
    edges: RawEdge[];
  }

  export interface Node {
    id: string;
    name: string;
    kind: string;
    file: string;
    external: boolean;
    ignored: boolean;
    degree: number;
  }

  export interface Link {
    source: string;
    target: string;
    kind: string;
  }

  export interface Counts {
    rawNodes: number;
    rawEdges: number;
    nodes: number;
    links: number;
    droppedExternal: number;
    droppedIgnored: number;
    droppedByCap: number;
  }

  export interface Payload {
    schemaVersion: number;
    project: string;
    provenance?: string;
    counts: Counts;
    nodes: Node[];
    links: Link[];
  }

  export interface ReduceOptions {
    maxNodes?: number;
    keepExternal?: boolean;
    keepIgnored?: boolean;
  }
}
