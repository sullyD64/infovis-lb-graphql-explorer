import { inject, InjectionKey } from "@vue/composition-api";

export function safeInject<T> (key: InjectionKey<T>): T {
  const store = inject(key);
  if (!store) {
    throw new Error(`Store with key: ${key} not found!`);
  }
  return store;
};
