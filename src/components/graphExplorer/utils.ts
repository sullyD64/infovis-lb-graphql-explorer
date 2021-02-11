import * as d3 from "d3";
import { settings } from "./network";
import { useQueryPath } from "./queryPath";
import { $SVG, ExplorerNode, ObjectNode } from "./types";

export function stringify (obj: unknown) {
  return JSON.stringify(obj, null, 2);
};

export function safeMapGet<V> (mapObj: Map<string, V>, key: string): V {
  const result = mapObj.get(key);
  if (!result) { throw new Error(`${key} not found in map with keys: ${[...mapObj.keys()]}`); }
  return result;
}

export function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function now (): string {
  const d = new Date();
  return `${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}`;
};

export function alphaSort (f1: { name: string}, f2: { name: string}) {
  return f1.name < f2.name ? -1 : 1;
}

export function capitalize (str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateNodes (numNodes = 100, radius?: number): ExplorerNode[] {
  return [...Array(numNodes)].map((_, i) => {
    return {
      id: `node-${i}`,
      x: settings.centerX,
      y: settings.centerY,
      kind: "object",
      label: i.toString(),
      r: radius || Math.max(3, d3.randomNormal(8, 5)()),
      isQuerying: true
    };
  });
};

// export function generateLinks (nodes: ExplorerNode[]): ExplorerLink[] {
//   return [...nodes]
//     .map((node) => {
//       return {
//         source: node.id,
//         target: nodes[d3.randomInt(nodes.length)()].id,
//         kind: "instance"
//       };
//     })
//     .filter(d => d.source !== d.target);
// };

export function drawGrid (svg: $SVG) {
  // add the X gridlines
  svg.append("g")
    .classed("viz-grid", true)
    .call(d3.axisTop(settings.scaleX)
      .ticks(10)
      .tickSize(-settings.chart.height)
      .tickFormat(null)
    );
  // add the Y gridlines
  svg.append("g")
    .classed("viz-grid", true)
    .call(d3.axisLeft(settings.scaleY)
      .ticks(10)
      .tickSize(-settings.chart.width)
      .tickFormat(null)
    );
};

export const dummyNode: ObjectNode = {
  id: "dummy",
  kind: "object",
  objectData: [],
  path: useQueryPath("dummy"),
  x: 0,
  y: 0,
  r: 0,
  label: "dummy",
  isQuerying: false,
  objectID: "dummy",
  parentID: "dummy"
};
