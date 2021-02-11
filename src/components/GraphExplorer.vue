<template>
  <v-container
    class="flex"
    style="height: 100%"
    fluid
  >
    <!-- :fluid="$vuetify.breakpoint.mdAndDown" -->
    <v-row class="mx-4 flex-grow-1 ">
      <v-col
        sm="3"
        lg="2"
        class="flex"
      >
        <v-row>
          <h2>
            GraphQL Explorer
          </h2>
        </v-row>
        <v-divider class="my-4" />
        <v-row>
          <v-btn
            class="mr-4"
            @click="reset"
          >
            Reset
          </v-btn>
          <v-text-field
            class="items-per-page"
            style="width: 150px"
            type="number"
            label="Objects per page"
            outlined
            dense
          />
        </v-row>
        <v-divider class="my-4" />
        <v-row>
          <h3>
            Available main classes
          </h3>
          <v-chip-group
            column
            multiple
          >
            <v-chip
              v-for="(item, index) in schemaClasses"
              :key="index"
              class="ma-1"
              :color="item.isRoot ? 'success' : item.selected ? 'yellow' : ''"
              :disabled="item.isQuerying"
              active
              @click="showClass(item)"
            >
              {{ item.className }}
            </v-chip>
          </v-chip-group>
        </v-row>
        <v-divider class="my-4" />
        <v-row>
          <pre
            v-if="currentQueryPretty"
            style="overflow-x: auto"
            class="current-query"
          >query {{ currentQueryPretty }}</pre>
        </v-row>
      </v-col>
      <v-col>
        <svg
          id="viz"
          width="100%"
          height="75vh"
        />
        <!-- :viewBox="`0 0 ${chart.windowWidth} ${chart.windowHeight}`" -->
        <!-- preserveAspectRatio="xMidYMid meet" -->
      </v-col>
      <v-col
        sm="2"
        lg="2"
      >
        <v-card
          class="object-details show"
        >
          <v-card-title>
            <span class="object-details__title" />
            <v-spacer />
            <!-- <v-btn
              class="object-details__close"
              icon
              small
            >
              <v-icon>
                mdi-close
              </v-icon>
            </v-btn> -->
          </v-card-title>
          <v-card-text>
            <div class="object-details__path m-4" />
            <div class="object-details__fields" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import {
  LbGraphqlService,
  useLbGraphqlService
} from "@/store/graphql";
import { safeInject } from "@/store/utils";
import { AuthServiceKey } from "@/store/auth";
import { computed, ComputedRef, defineComponent, onMounted } from "@vue/composition-api";
import * as d3 from "d3";
import {
  $SVG, drawGrid, ExplorerLink, ExplorerNetwork, ExplorerNode,
  QueryableClass,
  settings, SVGInHTML, useQueryManager

} from "./graphExplorer";

export default defineComponent({
  name: "GraphExplorer",
  setup () {
    const GQL_URL =
      "https://hs41.fhoster.com/angelo.brandimarte/Demo/auth/api/graphql/Administration";
    const authService = safeInject(AuthServiceKey);
    const gqlService: LbGraphqlService = useLbGraphqlService(
      GQL_URL,
      authService
    );

    const queryManager = useQueryManager(gqlService);
    const { currentQueryPretty, schemaClasses, fieldsMap } = queryManager;

    const { chart } = settings;
    const svg: ComputedRef<$SVG> = computed(() => {
      return d3.select<SVGInHTML, undefined>("#viz");
    });

    let nodes: ExplorerNode[] = [];
    let links: ExplorerLink[] = [];

    let graph: ExplorerNetwork;

    const reset = () => {
      links = [];
      nodes = [];
      graph = new ExplorerNetwork(svg.value, nodes, links, queryManager);

      queryManager.reset();
    };

    onMounted(() => {
      queryManager.loadQueryableClasses()
        .then(() => {
          nodes = [];
          links = [];
          graph = new ExplorerNetwork(svg.value, nodes, links, queryManager);

          graph.addClassNode("Employee");
          // graph.addClassNode("Team");

          graph.handleNewQuery("getPage", graph.getNode("Employee"));
        });
    });

    const showClass = (qc: QueryableClass) => {
      if (!graph.hasClassNode(qc.className)) {
        graph.addClassNode(qc.className);
      } else {
        graph.removeClassNode(qc.className);
      }
    };

    const graphData = computed(() => {
      return graph.data;
    });

    return {
      queryManager,
      chart,
      currentQueryPretty,
      schemaClasses,
      showClass,
      reset,
      graphData,
      fieldsMap
    };
  }
});
</script>

<style>
.object-details {
  z-index: 999;
  display: none;
  width: 20rem;
  /* position: fixed;
  top: 0;
  left: 0; */
}
.object-details.show {
  display: block;
}
.object-details .object-details__fields {
  /* max-height: 25rem; */
  max-height: 60vh;
  overflow-y: auto;
}

.object-details .object-details__path {
  color: #000;
  font-style: italic;
}

.queryable-field {
  padding: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  color: #000;
}
.queryable-field.disabled {
  background-color: #f3f3f3;
  color: gray;
  pointer-events: none;
  opacity: 0.7;
}

.queryable-field:not(disabled):hover {
  background-color: #eeeeee;
  cursor: pointer;
}

.queryable-field.disabled .queryable-field__name::after {
  content: " (default)";
  color: gray;
  font-weight: normal;
}

.queryable-field .queryable-field__name {
  flex-basis: 100%;
}

.queryable-field .queryable-field__name .queryable-field__name--type {
  color: rgba(0, 0, 0, 0.6);
  font-weight: normal !important
}

.queryable-field .queryable-field__name.role::before {
  display: inline-block;
  margin-right: 0.5rem;
  vertical-align: text-top;
  mask-image: url('./graphExplorer/role.png');
  -webkit-mask-image: url('./graphExplorer/role.png');
  mask-size: contain;
  content: "";
  width: 1rem;
  height: 1rem;
  background-color: rgba(0, 0, 0, 0.6)
}

.queryable-field .queryable-field__name.picked {
  font-weight: bold;
  color: green
}

.queryable-field .queryable-field__value {
  font-style: italic;
}

#viz {
  background-color: #eeeeee;
}

.viz-grid line {
  stroke: lightgray;
  stroke-opacity: 1;
}

.viz-graph text {
  text-anchor: middle;
  fill: #000;
  cursor: inherit;
  pointer-events: none;
}

.viz-link {
  stroke: #727272;
  stroke-width: 1.5;
}

.viz-link.active {
  stroke: #000
}

.viz-link.instance {
  stroke: #727272;
  stroke-width: 1.5;
  stroke-dasharray: 10;
}

.viz-link.highlight {
  stroke: red;
  stroke-width: 4;
}

#viz #arrowhead-instance {
  fill: #727272;
  opacity: 0.4
}

#viz #arrowhead-relation-highlight {
  fill: red;
}

.viz-node {
  cursor: pointer;
}

.viz-node__objnode text.label {
  font-size: 1rem;
}

.viz-node__objnode > circle {
  fill: #fff;
  stroke: darkgrey;
  stroke-width: 2;
}
.viz-node__objnode > circle:hover {
  fill: #ffcebd;
}
.viz-node__objnode.active > circle {
  stroke: green;
  stroke-width: 3;
}

.viz-node__objnode.selected > circle {
  stroke-width: 5;
  fill: #bffbbf;
}

.viz-node__objnode.highlight > circle {
  stroke: red;
  stroke-width: 3;
}

.viz-node__classnode > rect {
  fill: #fff;
  stroke: darkgrey;
  stroke-width: 2;
}
.viz-node__classnode.active > rect {
  stroke: green;
  stroke-width: 3;
}

.viz-node__classnode text.label {
  font-size: 1.5rem;
}

.viz-node__classnode .viz-btn {
  font-size: 1rem;
  border-radius: 0.5rem;
  border: 1px solid grey;
  background-color: #e0e0e0;
  padding: 1rem;
  position: absolute;
  text-anchor: middle;
  cursor: pointer;
}
.viz-node__classnode #getPageBtn {
  right: 0;
}

.viz-node__classnode.active > rect {
  stroke: green;
}

.viz-node__classnode .viz-btn.active {
  border: 2px solid green;
  color: #00000070;
  background-color: #e0e0e060;
  pointer-events: none;
}
.viz-node__classnode .viz-btn:hover {
  background-color: #e0e0e060;
}
</style>
