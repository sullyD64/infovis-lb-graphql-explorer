/* eslint-disable @typescript-eslint/no-explicit-any */
import { D3DragEvent, Selection, SimulationNodeDatum } from "d3";
import { QueryPath } from "./queryPath";

import gql from "graphql-tag";

export type SVGInHTML = HTMLElement & SVGElement
export type $SVG = Selection<SVGInHTML, undefined, HTMLElement, undefined>

export type ExplorerDatum = {}

export interface ExplorerNode extends SimulationNodeDatum, ExplorerDatum {
  x: number;
  y: number;
  id: string;
  r: number;
  kind: "class" | "object";
  label: string;
  isQuerying: boolean;
}

export interface ExplorerLink extends ExplorerDatum {
  source: string | ExplorerNode;
  target: string | ExplorerNode;
  kind: "instance" | "relation";
}

export type ExplorerDragEvent = D3DragEvent<SVGGElement, SimulationNodeDatum, SimulationNodeDatum>

export type ExplorerDragHandler = (this: SVGGElement, event: ExplorerDragEvent, d: SimulationNodeDatum) => void

export type ExplorerSelection<T extends ExplorerDatum> = Selection<any, T, any, any>

export interface ExplorerGraph {
  $nodes: ExplorerSelection<ExplorerNode>;
  $links: ExplorerSelection<ExplorerLink>;
}

export interface ClassNode extends ExplorerNode {
  isQueryable: boolean;
}

export interface ObjectNode extends ExplorerNode {
  objectData: SchemaFieldInstance[];
  path: QueryPath;
  objectID: string;
  parentID: string;
}

export interface QueryableClass {
  className: string;
  isQuerying: boolean;
  isRoot: boolean;
  selected: boolean;
}

export interface GqlSchemaField {
  name: string;
  type: {
    name: string;
    kind: string;
  };
}

export interface SchemaField {
  name: string;
  typeName: string;
  isObjectType: boolean;
  isToMany?: boolean;
  picked: boolean;
};

export interface SchemaFieldInstance extends SchemaField {
  value: string;
}

export interface NodeData {
  parent: string | null; // id del nodo padre
  fields: SchemaFieldInstance[];
}

export interface QueryManagerResult {
  path: QueryPath;
  datum?: NodeData;
  data?: Map<string, NodeData>;
}

export enum BASE_FIELDS {
  _id = "_id",
  _clientId = "_clientId"
}

export type SERVICE_TYPE = "get" | "getPage";

export const PAGE_SUFFIX = "Page";

export const ID_ROOT = "ROOT";

export const OBJ_VALUE = "__object__";

export const QUERY_CLASSES = gql`
query {
  result: __type(name: "Query") {
    fields {
      name
    }
  }
}`;

export const QUERY_FIELDS = (typeName: string) => gql`
query {
  result: __type(name: "${typeName}") {
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}`;

export class NodeDataKey {
  parentID: string;
  datumID: string;

  constructor (parentID: string, datumID: string) {
    this.parentID = parentID;
    this.datumID = datumID;
  }

  static parse (str: string) {
    const tokens = str.split(":");
    if (tokens.length !== 2) {
      throw new Error(`invalid key: ${str}`);
    }
    return new NodeDataKey(tokens[0], tokens[1]);
  }

  toString () {
    return `${this.parentID}:${this.datumID}`;
  }
}
