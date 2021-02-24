<template>
  <v-app>
    <v-app-bar
      app
      color="primary"
      dark
    >
      <v-toolbar-title>LB-GraphQL-Explorer</v-toolbar-title>
    </v-app-bar>
    <v-main>
      <GraphExplorer />
    </v-main>
    <v-footer
      color="primary lighten-1"
      padless
    >
      <v-row
        no-gutters
        align="center"
        justify="center"
      >
        <v-col
          cols="12"
          class="primary lighten-2 py-4 text-center white--text"
        >
          <strong>Made by sullyD64</strong>
          — {{ new Date().getFullYear() }}
          <v-icon>mdi-heart</v-icon>
        </v-col>
      </v-row>
    </v-footer>
  </v-app>
</template>
>

<script lang="ts">
import { defineComponent, provide } from "@vue/composition-api";
import GraphExplorer from "@/components/GraphExplorer.vue";
import { AuthServiceKey, useAuthService } from "./store/auth";
import { LbGraphqlServiceKey, useLbGraphqlService } from "./store/graphql";
import { safeProcessEnv } from "./store/utils";

export default defineComponent({
  name: "App",

  components: {
    GraphExplorer
  },

  setup () {
    const oneMonth = 1000 * 60 * 60 * 24 * 30;
    const authService = useAuthService("lb-token-demo", oneMonth);
    const gqlClient = useLbGraphqlService(safeProcessEnv("VUE_APP_GQL_URL"), authService);

    authService.login({ username: safeProcessEnv("VUE_APP_USERNAME"), password: safeProcessEnv("VUE_APP_PASSWORD") }, true);

    provide(AuthServiceKey, authService);
    provide(LbGraphqlServiceKey, gqlClient);
  }

});
</script>
