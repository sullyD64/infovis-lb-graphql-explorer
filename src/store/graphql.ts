import { AuthService } from "@/store/auth";
import { InjectionKey } from "@vue/composition-api";
import { InMemoryCache, NormalizedCacheObject } from "apollo-cache-inmemory";
import { ApolloClient } from "apollo-client";
import { ApolloLink } from "apollo-link";
import { setContext } from "apollo-link-context";
import { ErrorResponse, onError } from "apollo-link-error";
import { createHttpLink } from "apollo-link-http";
import { GraphQLError } from "graphql";
import { GqlIssue, GqlIssueType } from "./model";

export type LbGraphqlService = ApolloClient<NormalizedCacheObject>

export const LbGraphqlServiceKey: InjectionKey<LbGraphqlService> = Symbol("LbGraphqlService");

export function useLbGraphqlService (gqlApplicationUrl: string, authService: AuthService): LbGraphqlService {
  const errorLink: ApolloLink = onError((response: ErrorResponse) => {
    if (response.networkError) {
      console.error("[Network error]: " + JSON.stringify(response.networkError));
      if ("statusCode" in response.networkError) {
        const statusCode = response.networkError.statusCode;
        if (statusCode === 401) {
          authService.logout("Le credenziali di accesso non sono valide");
        }
      }
    }
    if (response.graphQLErrors) {
      response.graphQLErrors.forEach((error: GraphQLError) => {
        if (error.extensions) {
          console.error(`[GraphQL error extensions]: ${JSON.stringify(error.extensions)}`);
          const issue = error.extensions as GqlIssue;
          if (issue.issueType === GqlIssueType.ApplicationGrant) {
            authService.logout("Il profilo dell'utente non permette l'accesso");
          }
        } else {
          console.error(`[GraphQL error]: ${JSON.stringify(error)}`);
        }
        // console.error(stringify(response.graphQLErrors));
      });
    }
  });

  // HTTP connection to the API
  const httpLink: ApolloLink = createHttpLink({
    // You should use an absolute URL here
    uri: gqlApplicationUrl
  });

  const authLink: ApolloLink = setContext((operation, { headers }) => {
    // return the headers to the context so httpLink can read them
    return {
      headers: {
        ...headers,
        authorization: authService.authorization.value
      }
    };
  });

  return new ApolloClient({
    link: errorLink.concat(authLink).concat(httpLink),
    cache: new InMemoryCache({
      addTypename: false
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "no-cache"
      },
      query: {
        fetchPolicy: "no-cache"
      },
      mutate: {
        fetchPolicy: "no-cache"
      }
    }
  });
}
