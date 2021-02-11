import { computed, ComputedRef, InjectionKey, ref, Ref } from "@vue/composition-api";
import { InMemoryCache } from "apollo-cache-inmemory";
import ApolloClient from "apollo-client";
import { createHttpLink } from "apollo-link-http";
import gql from "graphql-tag";

export type LbTokenType = "Basic"

export interface LbToken {
  token_type: LbTokenType;
  access_token: string;
  exp: number;
  fromTime: number;
  username: string;
}

export interface AuthService {
  loading: ComputedRef<boolean>;
  authorization: ComputedRef<string | null>;
  login(credentials: { username: string; password: string }, remember: boolean): Promise<void>;
  logout(message?: string): Promise<void>;
  errorMessage: ComputedRef<string>;
  resetError(): Promise<void>;
  token: ComputedRef<LbToken>;
}

export const AuthServiceKey: InjectionKey<AuthService> = Symbol("AuthService");

// TODO AuthServiceOptions
export function useAuthService (STORAGE_TOKEN_KEY: string, rememberExp: number, graphqlURL?: string): AuthService {
  const storedRawToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const storedToken: LbToken = storedRawToken
    ? JSON.parse(storedRawToken)
    : null;

  const authToken: Ref<LbToken> = ref(storedToken || {} as LbToken);
  const _loading = ref(false);

  const _errorMessage = ref("");
  const resetError = async () => {
    _errorMessage.value = "";
  };
  /*
  https://stackoverflow.com/questions/3562929/how-can-i-get-an-event-to-fire-every-time-localstorage-is-updated-in-safari-5
  After investigating further (and with the help from a friend) I discovered that the storage_handler method is called
  not when the value of a localstorage value changes on the page in my current window or tab, but when it changes in another tab.
  For example, if I have the two tabs open, and have controls in the pages in each tab to change localstorage settings,
  then when I hit the control in the first tab, the storage_handler method is called in the other tab.
  */
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_TOKEN_KEY) {
      authToken.value = event.newValue
        ? JSON.parse(event.newValue)
        : {};
    }
  });

  const tokenType = computed((): LbTokenType => {
    return authToken.value.token_type;
  });

  const authorization = computed(() => {
    // NB non è reactive ...new Date().getTime()
    // vale solo la prima volta
    return authToken.value.access_token &&
            (authToken.value.exp + authToken.value.fromTime) > new Date().getTime() // not expired
      ? tokenType.value + " " + authToken.value.access_token
      : null;
  });

  const logout = async (message = "") => {
    _errorMessage.value = message;
    authToken.value = {} as LbToken;
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  };

  const checkToken = async (authorization: string): Promise<boolean> => {
    if (!graphqlURL) {
      // se non c'è un URL per il test, non fa niente..
      return true;
    };

    try {
      _loading.value = true;
      await new ApolloClient({
        cache: new InMemoryCache(),
        link: createHttpLink({
          uri: graphqlURL,
          headers: { authorization: authorization }
        })
      }).query({
        query: gql` { __schema { __typename } }`
      });
      return true;
    } catch (error) {
      if (error.networkError &&
        "statusCode" in error.networkError &&
        error.networkError.statusCode === 401) {
        logout("Username e/o password errata.");
      } else {
        logout(error.message);
      }
      return false;
    } finally {
      _loading.value = false;
    }
  };

  const login = async (credentials: { username: string; password: string }, remember: boolean) => {
    const encoded = btoa(credentials.username + ":" + credentials.password);
    // test per verificare che il token generato lato client sia valido
    const validToken = await checkToken("Basic " + encoded);
    if (validToken) {
      const token = {
        token_type: "Basic",
        access_token: encoded,
        exp: remember ? rememberExp : 1000,
        fromTime: new Date().getTime(),
        username: credentials.username
      } as LbToken;
      authToken.value = token;
      localStorage.setItem(STORAGE_TOKEN_KEY, JSON.stringify(token));
    }
  };

  if (authorization.value) {
    checkToken(authorization.value);
  }

  return {
    authorization,
    login,
    logout,
    errorMessage: computed(() => _errorMessage.value),
    resetError,
    loading: computed(() => _loading.value),
    token: computed(() => storedToken)
  };
};
