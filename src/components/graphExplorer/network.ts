/* eslint-disable @typescript-eslint/no-explicit-any */
import vuetify from "@/plugins/vuetify";
import * as d3 from "d3";

import * as d3ScaleChromatic from "d3-scale-chromatic";

import { ForceLink, Selection, Simulation, SimulationLinkDatum } from "d3";
import { QueryManager } from "./queryManager";
import { clonePath, QueryPath } from "./queryPath";
import { BASE_FIELDS, ClassNode, ExplorerDragHandler, ExplorerLink, ExplorerNode, ExplorerSelection, ID_ROOT, NodeDataKey, ObjectNode, OBJ_VALUE, PAGE_SUFFIX, QueryManagerResult, SchemaFieldInstance, SERVICE_TYPE, SVGInHTML } from "./types";
import { alphaSort, capitalize, drawGrid, dummyNode, safeMapGet } from "./utils";

const breakpoint = vuetify.framework.breakpoint;

const CLASS_RADIUS = 130;
const OBJ_RADIUS = 50;

const chart = {
  // windowWidth: breakpoint.width,
  // windowHeight: Math.min(window.innerHeight * 0.9, breakpoint.height),
  windowWidth: 1000,
  windowHeight: 800,

  width: 1100,
  height: 600,
  margin: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }
};

const color = d3.scaleOrdinal(d3ScaleChromatic.schemeAccent);

const scaleX = d3.scaleLinear()
  .domain([0, 1])
  .range([chart.margin.left, chart.width - chart.margin.right]);

const scaleY = d3.scaleLinear()
  .domain([0, 1])
  .range([chart.margin.top, chart.height - chart.margin.bottom]);

const centerX = breakpoint.mdAndDown ? scaleX(0.5) : scaleX(0.5);
const centerY = breakpoint.mdAndDown ? scaleY(0.5) : scaleY(0.5);

export const settings = {
  chart,
  scaleX,
  scaleY,
  centerX,
  centerY
};

export class ExplorerNetwork {
  $rootSVG: Selection<SVGInHTML, undefined, HTMLElement, undefined>;
  $network: Selection<SVGGElement, undefined, HTMLElement, undefined>;
  $nodes: ExplorerSelection<ExplorerNode>;
  $links: ExplorerSelection<ExplorerLink>;
  $vObjectDetails: Selection<HTMLDivElement, undefined, HTMLElement, undefined>;
  $vObjectDetailsFields: ExplorerSelection<SchemaFieldInstance>;

  queryManager: QueryManager;

  data: {
    nodes: ExplorerNode[];
    links: ExplorerLink[];
  };

  forceSim: Simulation<ExplorerNode, ExplorerLink>;

  constructor (svg: Selection<SVGInHTML, undefined, HTMLElement, undefined>,
    nodes: ExplorerNode[] = [], links: ExplorerLink[] = [],
    queryManager: QueryManager) {
    /* init data */
    this.data = { nodes, links };

    /* init query manager */
    this.queryManager = queryManager;

    /* init selections */
    this.$rootSVG = svg;
    this.$rootSVG
      .select(".viz-graph")
      .remove();

    this.$rootSVG
      .selectAll("g")
      .remove();

    this.$rootSVG
      .selectAll("defs")
      .remove();

    // drawGrid(svg);

    const zoomWindow = this.$rootSVG
      .append<SVGGElement>("g")
      .attr("width", chart.width)
      .attr("height", chart.height)
      .attr("class", "zoom-window");

    const defs = this.$rootSVG
      .append("defs");
    const arrow = defs
      .append("marker")
      .attr("id", "arrowhead-instance");
    arrow.clone()
      .attr("id", "arrowhead-relation");
    arrow.clone()
      .attr("id", "arrowhead-relation-highlight");
    defs.selectAll("marker")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 50)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerUnits", "userSpaceOnUse")
      .attr("markerWidth", 15)
      .attr("markerHeight", 15)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5");

    // arrow
    //   .attr("viewbox", "0 0 477.175 477.175")
    //   .select("path")
    //   .attr("d", "M360.731,229.075l-225.1-225.1c-5.3-5.3-13.8-5.3-19.1,0s-5.3,13.8,0,19.1l215.5,215.5l-215.5,215.5 c-5.3,5.3-5.3,13.8,0,19.1c2.6,2.6,6.1,4,9.5,4c3.4,0,6.9-1.3,9.5-4l225.1-225.1C365.931,242.875,365.931,234.275,360.731,229.075z");

    this.$network = zoomWindow
      .append("g")
      .attr("class", "viz-graph");

    // centro di massa
    // this.$network
    //   .append("circle")
    //   .attr("r", 2)
    //   .attr("cx", centerX)
    //   .attr("cy", centerY)
    //   .attr("fill", "red");

    this.$links = this.$network
      .append("g")
      .attr("class", "viz-links")
      .selectAll(".viz-link");

    this.$nodes = this.$network
      .append("g")
      .attr("class", "viz-nodes")
      .selectAll(".viz-node");

    this.forceSim = this.initForceSimulation();

    this.$vObjectDetails = d3.select(".object-details");
    this.$vObjectDetails.classed("show", false);
    this.$vObjectDetails
      .select(".object-details__close")
      .on("click", () => {
        this.$vObjectDetails.classed("show", false);
      });
    const objectDetailsFields = this.$vObjectDetails
      .select<HTMLDivElement>(".object-details__fields");
    this.$vObjectDetailsFields = objectDetailsFields
      .selectAll<HTMLDivElement, SchemaFieldInstance>("div.queryable-field");

    this.$rootSVG
      .call(d3.zoom<SVGInHTML, undefined>()
        .extent([[0, 0], [chart.width, chart.height]])
        .scaleExtent([0.2, 2])
        .on("zoom", function (event) {
          zoomWindow.attr("transform", event.transform);
        })
      )
      .on("dblclick.zoom", null);

    this.drawNetwork();
  }

  initForceSimulation () {
    const STR_XY = 0.1;
    const LINK_DISTANCE = 200;
    const STR_CHARGE = -5000;
    const STR_RADIAL = 0.01;
    const STR_COLLIDE = 1.3;
    const BC_RADIUS = 600;

    // function distance2D ([x1, y1]: [number, number], [x2, y2]: [number, number]) {
    //   return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    // };

    // function repositionInsideBoundingCircle (node: ExplorerNode, radius: number) {
    //   // if node is outside of the bounding circle,
    //   // move node just inside circle along same polar axis
    //   if (distance2D([node.x, node.y], [centerX, centerY]) > radius) {
    //     const theta = Math.atan((node.y - centerY) / (node.x - centerX));
    //     node.x = centerX + radius * Math.cos(theta) * (node.x < centerX ? -1 : 1);
    //     node.y = centerY + radius * Math.sin(theta) * (node.x < centerX ? -1 : 1);
    //   }
    // };

    const simulation = d3.forceSimulation<ExplorerNode, ExplorerLink>()
      .force("link", d3.forceLink<ExplorerNode, ExplorerLink>()
        .id(d => d.id)
        // .distance(LINK_DISTANCE)
      )
      .force("x", d3.forceX(centerX).strength(STR_XY))
      .force("y", d3.forceY(centerY).strength(STR_XY))
      // .force("center", d3.forceCenter(centerX, centerY))
      .force("charge", d3.forceManyBody().strength(STR_CHARGE))
      .force("collide", d3.forceCollide<ExplorerNode>().strength(STR_COLLIDE).radius(d => d.r * 1.2))
      // .force("radial", d3.forceRadial(500, centerX, centerY).strength(STR_RADIAL))
      // .force("bounding-circle", () => { nodes.forEach(node => repositionInsideBoundingCircle(node, BC_RADIUS)); })
      .on("tick", () => this.ticked());

    return simulation;
  }

  ticked () {
    if (!this.$network) { return false; }
    // this.data.nodes.forEach((d: ExplorerNode) => {
    // impedisce ai nodi di fuggire dalla cornice
    // d.x = Math.max(d.r * 1.2, Math.min(scaleX(1) - d.r, d.x));
    // d.y = Math.max(d.r * 1.2, Math.min(scaleY(1) - d.r, d.y));
    // });
    // const fixna = (x: number) => isFinite(x) ? x : 0;
    this.$nodes
      .attr("transform", d => `translate(${d.x}, ${d.y})`);
    // .attr("transform", d => `translate(${fixna(d.x)}, ${fixna(d.y)})`);
    //   .selectAll<SVGCircleElement, ExplorerNode>("circle")

    this.$rootSVG
      .selectAll<SVGLineElement, SimulationLinkDatum<ExplorerNode>>(".viz-link")
      .attr("x1", d => (d.source as ExplorerNode).x)
      .attr("y1", d => (d.source as ExplorerNode).y)
      .attr("x2", d => (d.target as ExplorerNode).x)
      .attr("y2", d => (d.target as ExplorerNode).y);
  };

  drag (simulation: Simulation<ExplorerNode, ExplorerLink>) {
    const dragstarted: ExplorerDragHandler = (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    };
    const dragged: ExplorerDragHandler = (event, d) => {
      d.fx = event.x;
      d.fy = event.y;

      // if (this.$vObjectDetails.classed("show") &&
      //  this.$vObjectDetails.attr("data-following") === (d as ExplorerNode).id
      // ) {
      //   this.$vObjectDetails
      //     .style("transform", `translate(${event.sourceEvent.pageX + 15}px, ${event.sourceEvent.pageY + 15}px)`);
      // }
    };
    const dragended: ExplorerDragHandler = (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      // commenta le righe seguenti per rendere i nodi "sticky"
      if ((d as ExplorerNode).kind === "object") {
        d.fx = null;
        d.fy = null;
      }
    };

    return d3.drag<SVGGElement, ExplorerNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  // color () {
  //   const scale = d3.scaleOrdinal(d3.schemeCategory10);
  //   return (d: ObjectNode) => scale(d.path.str.value);
  // }

  highlightNodes (node: ObjectNode) {
    const highlightRecursive = (node: ObjectNode) => {
      d3.select(`.viz-node#${node.id}`)
        .classed("highlight", true);

      this.data.nodes
        .filter(this.isObjectNode)
        .filter(d => (d as ObjectNode).parentID === node.objectID)
        .forEach(d => {
          d3.select(`.viz-link[data-source="${node.id}"][data-target="${d.id}"]`)
            .classed("highlight", true)
            .attr("marker-end", "url(#arrowhead-relation-highlight)");
          highlightRecursive(d as ObjectNode);
        });
    };
    highlightRecursive(node);
  }

  resetNodesHighlight () {
    this.$nodes.classed("highlight", false);
    this.$links
      .classed("highlight", false)
      .attr("marker-end", d => `url(#arrowhead-${d.kind})`);
  }

  drawNetwork () {
    // console.log("DRAWNETWORK", this.data.nodes, this.data.links);

    this.$links = this.$links
      .data(this.data.links)
      .join("line")
      .attr("class", d => `viz-link ${d.kind}`)
      .attr("data-source", d => (d.source as ObjectNode).id)
      .attr("data-target", d => (d.target as ObjectNode).id)
      .classed("active", d => (d.source as ObjectNode).isQuerying)
      .attr("marker-end", d => `url(#arrowhead-${d.kind})`);

    this.$nodes = this.$nodes
      .data(this.data.nodes, d => d.id)
      .join(
        (enter) => {
          const group = enter
            .append("g")
            .attr("class", "viz-node")
            .attr("id", d => d.id)
            .call(this.drag(this.forceSim));

          const classNode = group
            .filter(this.isClassNode)
            .attr("class", "viz-node viz-node__classnode");

          classNode
            .append<SVGRectElement>("rect")
            .attr("x", d => -d.r)
            .attr("y", d => -d.r / 2)
            .attr("width", d => d.r * 2)
            .attr("height", d => d.r);
          classNode
            .append<SVGTextElement>("text")
            .attr("class", "label")
            .attr("y", -20)
            .text(d => capitalize(d.label));

          const classNodeMain = classNode
            .filter(d => (d as ClassNode).isQueryable)
            .append<SVGForeignObjectElement>("foreignObject")
            .attr("class", "foreign-object")
            .attr("width", d => d.r)
            .attr("height", 60);

          classNodeMain
            .attr("x", d => -d.r + 10)
            .append<HTMLDivElement>("xhtml:div")
            .attr("class", "viz-btn")
            .attr("id", "getBtn")
            .text("Get one")
            .on("click", (_, d) => this.handleNewQuery("get", d as ClassNode));

          classNodeMain.clone()
            .attr("x", -10)
            .append<HTMLDivElement>("xhtml:div")
            .attr("class", "viz-btn")
            .attr("id", "getPageBtn")
            .text("Get many")
            .on("click", (_, d) => this.handleNewQuery("getPage", d as ClassNode));

          const classNodePart = classNode
            .filter(d => !(d as ClassNode).isQueryable)
            .append<SVGTextElement>("text")
            .attr("class", "label-ispart")
            .text("part class");

          const objectNode = group
            .filter(this.isObjectNode)
            .attr("class", "viz-node viz-node__objnode")
            .classed("active", true)
            .on("click", (e, d) => this.handleShowQueryableFields(e, d as ObjectNode))
            .on("mouseover", (event, d) => {
              d3.select(event.currentTarget)
                .select("circle")
                .transition()
                .duration(200)
                .attr("r", d.r * 1.2);
              this.highlightNodes(d as ObjectNode);
            })
            .on("mouseout", (event, d) => {
              d3.select(event.currentTarget)
                .select("circle")
                .transition()
                .duration(200)
                .attr("r", d.r);
              this.resetNodesHighlight();
            });
          objectNode
            .append<SVGCircleElement>("circle")
            .style("fill", d => color((d as ObjectNode).path.str.value))
            .attr("r", d => d.r);
          objectNode
            .append<SVGTextElement>("text")
            .attr("class", "label")
            .text(d => d.label);

          objectNode
            .append("text")
            .attr("y", 30)
            .text(d => (d as ObjectNode).path.currentTypeName.value.toLowerCase())
            .style("opacity", "0.3");

          return group;
        }
      );

    // draw collision circles
    // this.$nodes
    //   .append("circle")
    //   .attr("r", d => d.r)
    //   .attr("fill", "transparent")
    //   .attr("stroke", "red")
    //   .attr("stroke-width", 3);

    this.forceSim.nodes(this.data.nodes);
    (this.forceSim.force("link") as ForceLink<ExplorerNode, ExplorerLink>).links(this.data.links);
    this.forceSim.alpha(1).restart();
  }

  drawFields (node?: ObjectNode) {
    // il nodo è opzionale per gestire il reset dei campi
    // se si passa dalla query a molti a quella a uno e viceversa
    const boundNode = node || dummyNode;
    this.$vObjectDetailsFields = this.$vObjectDetailsFields
      .data(boundNode.objectData, d => d.name)
      .join(
        (enter) => {
          const group = enter
            .append("div")
            .attr("id", d => `${boundNode?.path.str.value}.${d.name}`)
            .attr("class", "queryable-field")
            .classed("disabled", d => d.name === BASE_FIELDS._id || !boundNode.isQuerying)
            .on("click", (e, d) => this.handleSelectField(e, d, boundNode));
          group
            .append("div")
            .attr("class", "queryable-field__name")
            .classed("picked", d => d.picked)
            .classed("role", d => d.isObjectType)
            .html(d => `${d.name}: <span class="queryable-field__name--type">${d.typeName}</span>`);
          group
            .append("div")
            .attr("class", "queryable-field__value")
            .text(d => d.value !== OBJ_VALUE ? d.value : null);

          return group;
        },
        (update) => {
          const group = update;
          group
            .attr("id", d => `${boundNode?.path.str.value}.${d.name}`)
            .classed("disabled", d => d.name === BASE_FIELDS._id || !boundNode.isQuerying)
            .on("click", (e, d) => this.handleSelectField(e, d, boundNode));
          group.select(".queryable-field__name")
            .classed("picked", d => d.picked)
            .classed("role", d => d.isObjectType)
            .html(d => `${d.name}: <span class="queryable-field__name--type">${d.typeName}</span>`);
          group.select(".queryable-field__value")
            .text(d => {
              // console.log(d.name, d.picked, d.value);
              return d.value !== OBJ_VALUE ? d.value : null;
            });
          return update;
        },
        (exit) => exit.remove()
      );
  }

  addClassNode (className: string, isQuerying = false) {
    const queryableClass = this.queryManager.schemaClasses.value.find(qc => qc.className === className);
    if (queryableClass) {
      const index = this.queryManager.schemaClasses.value.indexOf(queryableClass);
      this.queryManager.schemaClasses.value[index].isQuerying = isQuerying;
    }

    const classNode: ClassNode = {
      x: centerX,
      y: centerY,
      r: CLASS_RADIUS,
      id: this.toClassNodeID(className),
      kind: "class",
      label: className,
      isQuerying: isQuerying,
      isQueryable: Boolean(queryableClass)
    };
    this.data.nodes.push(classNode);

    const schemaClass = this.queryManager.schemaClassesMap.value.get(className);
    if (schemaClass) { schemaClass.selected = true; }

    this.drawNetwork();
  }

  appendObjectNode (path: QueryPath, objectData: SchemaFieldInstance[], parentID?: string) {
    const objectID = (this.queryManager.getField(objectData, BASE_FIELDS._id) as SchemaFieldInstance).value;
    const objectNodeID = this.toObjectNodeID(path.currentTypeName.value, objectID);
    if (this.hasNode(objectNodeID)) {
      // se il nodo esiste già, lo aggiorna col risultato della query
      const node = this.getNode<ObjectNode>(path.currentTypeName.value, objectID);
      node.isQuerying = true;
      node.objectData = objectData.sort(alphaSort);
      this.$network.select(`#${objectNodeID}`)
        .classed("active", true);
      return;
    } else {
      // crea un nuovo nodo
      const objectNode: ObjectNode = {
        x: centerX,
        y: centerY,
        r: OBJ_RADIUS,
        id: objectNodeID,
        kind: "object",
        isQuerying: true,
        objectData: objectData.sort(alphaSort),
        path: path,
        label: objectID,
        objectID: objectID,
        parentID: parentID || ID_ROOT
      };
      this.data.nodes.push(objectNode);

      // se la classe non è presente, la mostra
      const classNodeID = this.toClassNodeID(path.currentTypeName.value);
      if (!this.hasClassNode(path.currentTypeName.value)) {
        this.addClassNode(path.currentTypeName.value, true);
      }

      // connette la classe al nodo
      this.data.links.push({
        source: classNodeID,
        target: objectNodeID,
        kind: "instance"
      });
    }

    // se è specificato un parente, connette il parente al nodo
    if (parentID) {
      const parentPath = clonePath(path);
      parentPath.back();
      const parentNodeID = this.toObjectNodeID(parentPath.currentTypeName.value, parentID);
      this.data.links.push({
        source: parentNodeID,
        target: objectNodeID,
        kind: "relation"
      });
    }

    this.drawNetwork();
  }

  appendObjectSubNodes (currentParentNode: ObjectNode, targetPath: QueryPath, queryResult: QueryManagerResult) {
    // append
    if (queryResult.datum) {
      // caso semplice: aggiunta nodo singolo a nodo singolo
      this.appendObjectNode(targetPath, queryResult.datum.fields, currentParentNode.objectID);
    } else if (queryResult.data) {
      // caso complesso: aggiunta nodo/i a nodo/i
      this.data.nodes
        .filter(this.isObjectNode)
        .filter(node => (node as ObjectNode).path.str.value === currentParentNode.path.str.value)
        .forEach(parentNode => {
          const parentObjNode = parentNode as ObjectNode;
          if (queryResult.data && queryResult.data.size) {
            const newNodesDataEntries = this.queryManager.getPartialMatches(queryResult.data, parentObjNode.objectID);
            if (newNodesDataEntries.length) {
              newNodesDataEntries
                .reverse() // lavora i nuovi nodi in senso contrario, così da ridurre la possibilità di incroci
                .forEach(async (newNodeDataEntry) => {
                  const newNodeDatum = newNodeDataEntry[1];
                  this.appendObjectNode(targetPath, newNodeDatum.fields, parentObjNode.objectID);
                });
            }
          }
        });
    }
  }

  cleanOrphanObjectNodes () {
    // rimuove tutti i nodi oggetto che non hanno archi uscenti
    this.data.nodes = this.data.nodes
      .filter(d => {
        return this.isClassNode(d) || this.data.links.some(link =>
          (link.target as ExplorerNode).id === d.id
        );
      });

    // rimuove i link entranti nei nodi appena rimossi
    this.data.links = this.data.links
      .filter(d => {
        return this.hasNode((d.source as ExplorerNode).id);
      });
  }

  cleanOrphanPartClasses () {
    // rimuove tutte le classi part che non sono connesse al grafo
    const partClasses = this.data.nodes
      .filter(this.isClassNode)
      .filter(d => !(d as ClassNode).isQueryable);
    partClasses.forEach(partClass => {
      const partObjects = this.data.nodes
        .filter(this.isObjectNode)
        .filter(d => this.data.links.some(link => link.source === partClass && link.target === d) && this.data.links.some(link => link.source === d));
      partObjects.forEach(partObject => this.removeNode(partObject.id));
      this.removeNode(partClass.id);
    });
  }

  removeNode (id: string): boolean {
    const nodesMap = new Map(this.data.nodes.map(d => [d.id, d]));
    const removed = nodesMap.delete(id);
    if (removed) {
      this.data.nodes = [...nodesMap.values()];
      // rimuove tutti i link di quel nodo
      this.data.links = this.data.links.filter((link) =>
        (link.source as ExplorerNode).id !== id &&
        (link.target as ExplorerNode).id !== id
      );
      this.cleanOrphanObjectNodes();
      // this.cleanOrphanPartClasses();
      this.drawNetwork();
    }
    return removed;
  }

  removeObjectNodesAtPath (path: QueryPath) {
    this.data.nodes
      .filter(this.isObjectNode)
      .filter(d => (d as ObjectNode).path.str.value === path.str.value)
      .forEach(d => this.removeNode(d.id));
  }

  removeClassNode (className: string): boolean {
    const schemaClass = this.queryManager.schemaClassesMap.value.get(className);
    if (schemaClass) { schemaClass.selected = false; }
    return this.removeNode(this.toClassNodeID(className));
  }

  hasClassNode (className: string): boolean {
    return this.hasNode(this.toClassNodeID(className));
  }

  hasNode (id: string): boolean {
    return this.data.nodes.some(d => d.id === id);
  }

  getNode<T extends ExplorerNode> (className: string, id?: string): T {
    const node = this.data.nodes
      .find(d =>
        (!id && d.id === this.toClassNodeID(className)) ||
        (id && d.id === this.toObjectNodeID(className, id))
      );
    if (!node) { throw new Error(`ExplorerNode not found: ${className}, ${id}`); }
    return node as T;
  }

  toObjectNodeID (className: string, id: string): string {
    return `obj-${className.toLowerCase()}-${id}`;
  }

  toClassNodeID (className: string): string {
    return `class-${className.toLowerCase()}`;
  }

  handleShowQueryableFields (event: MouseEvent, node: ObjectNode) {
    this.$nodes
      .filter(this.isObjectNode)
      .classed("selected", d => d.id === node.id);

    this.$vObjectDetails
      .classed("show", true);
    // .attr("data-following", node.id)
    // .style("transform", `translate(${event.pageX + 15}px, ${event.pageY + 15}px)`);
    this.$vObjectDetails
      .select(".object-details__title")
      .text(`${node.id}`);

    this.$vObjectDetails
      .select(".object-details__path")
      .text(node.path.str.value);

    this.drawFields(node);
  }

  async handleSelectField (event: MouseEvent, field: SchemaFieldInstance, currentNode: ObjectNode) {
    field.picked = !field.picked;
    await this.queryManager.toggleQueryableField(currentNode.path, field.name, field.picked);

    try {
      const result = await this.queryManager.runQuery(currentNode.path);

      if (!field.isObjectType) {
      // caso semplice: ho cliccato su un attributo, non devo aggiornare il grafo, ma solo i dati
        if (result.datum) {
          currentNode.objectData = result.datum.fields.sort(alphaSort);
        }
        if (result.data) {
          this.data.nodes
            .filter(this.isObjectNode)
            .filter(node => (node as ObjectNode).path.str.value === currentNode.path.str.value)
            .forEach(node => {
              const objNode = node as ObjectNode;
              // const _idField = objNode.objectData.find(d => d.name === BASE_FIELDS._id);
              if (result.data && result.data.size) {
                const key = new NodeDataKey(objNode.parentID, objNode.objectID);
                objNode.objectData = safeMapGet(result.data, key.toString())
                  .fields
                  .sort(alphaSort);
              }
            });
        }
      } else {
      // caso complesso: ho cliccato su un ruolo, devo aggiornare i dati e il grafo
      // clono il path corrente, che è stato spostato in avanti in caso di [] => [V]
      // è rimasto sul nodo corrente in caso di [V] => []
        const targetPath = clonePath(currentNode.path);
        currentNode.path.back();
        // console.log("currentNode", currentNode.path.str.value);
        // console.log("targetPath", targetPath.str.value);
        // console.log("result", result.path.str.value);

        if (field.picked) {
          this.appendObjectSubNodes(currentNode, targetPath, result);
        } else {
          targetPath.forward(field);
          this.removeObjectNodesAtPath(targetPath);
        }

        this.drawNetwork();
      }
    } catch (error) {
      // se non ho trovato nulla, non devo aggiornare i nodi
      console.log("Not found", currentNode.path.str.value);
      console.log(error);
    }
    this.drawFields(currentNode);
  }

  async handleNewQuery (service: SERVICE_TYPE, classNode: ClassNode) {
    let promptId;
    let next;
    if (service === "get") {
      // promptId = "11000";
      promptId = window.prompt("Please type an ID", promptId);
      if (!promptId) { return; }
    } else if (service === "getPage") {
      const input = d3.select<HTMLInputElement, undefined>(".items-per-page input").node();
      if (input && input.value) {
        next = input.value;
      }
    }

    // imposta la classe corrente come attiva
    classNode.isQuerying = true;

    // mette active al nodo corrente e al bottone premuto
    this.$network
      .select(`#${classNode.id}`)
      .classed("active", true)
      .selectAll(".viz-btn")
      .classed("active", function (this) {
        return d3.select(this).attr("id") === `${service}Btn`;
      });

    // nasconde il dettaglio dei campi
    this.$vObjectDetails
      .classed("show", false);

    // azzera i campi mostrati nel dettaglio dei campi
    this.drawFields();
    this.data.nodes.filter(this.isObjectNode).forEach(node => {
      const objNode = node as ObjectNode;
      objNode.objectData.forEach(field => {
        // azzera tutti i campi eccetto ID
        // field.picked = field.name === BASE_FIELDS._id;
        field.picked = false;
      });
    });

    // toglie isQuerying da tutti i nodi tranne quello corrente
    this.data.nodes
      .filter(d => d.id !== classNode.id)
      .forEach(d => { d.isQuerying = false; });

    // toglie active da tutte le classi tranne quella corrente
    this.$nodes
      .filter(d => this.isClassNode(d) && d.id !== classNode.id)
      .classed("active", false)
      .selectAll(".viz-btn")
      .classed("active", false);

    // toglie active da tutti gli oggetti
    this.$nodes
      .filter(this.isObjectNode)
      .classed("active", false);

    // prepara la query
    const queryPath = await this.queryManager.initQuery(service, classNode.label, promptId, next);
    // await this.queryManager.test(queryPath);

    // esegue la query e aggiorna il grafo
    const result = await this.queryManager.runQuery(queryPath);
    if (result.datum) {
      this.appendObjectNode(result.path, result.datum.fields);
    } else if (result.data) {
      result.data.forEach((item) => {
        this.appendObjectNode(result.path, item.fields);
      });
    }

    // mostra i campi di un nodo
    // const dummyNode = this.getNode<ObjectNode>("Employee", "11000");
    // const dummyEvent = new MouseEvent("click",
    //   { clientX: dummyNode.x, clientY: dummyNode.y });
    // this.handleShowQueryableFields(dummyEvent, dummyNode);
  }

  isClassNode (d: ExplorerNode): boolean {
    return d.kind === "class";
  }

  isObjectNode (d: ExplorerNode): boolean {
    return d.kind === "object";
  }
}
