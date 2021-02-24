import { inject, InjectionKey } from "@vue/composition-api";

export function safeInject<T> (key: InjectionKey<T>): T {
  const store = inject(key);
  if (!store) {
    throw new Error(`Store with key: ${key} not found!`);
  }
  return store;
};

export function safeProcessEnv (key: string): string {
  if (!process.env[key]) {
    throw new Error("missing required env var: " + key);
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return process.env[key]!;
}
