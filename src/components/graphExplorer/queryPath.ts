import { computed, Ref, ref } from "@vue/composition-api";
import { PAGE_SUFFIX, SchemaField } from "./types";

/**
 * Il queryPath è il "cursore" della query.
 * Ciascun nodo ha un suo queryPath che gli consente di selezionare o espandere campi relativamente al suo tipo.
 */
export function useQueryPath (className: string) {
  const root = ref(className);
  const hops: Ref<SchemaField[]> = ref([]);

  const leafField = computed(() => {
    return hops.value.length
      ? hops.value.slice(-1)[0]
      : null;
  });

  const currentTypeName = computed(() => {
    return leafField.value
      ? leafField.value.typeName.replace(PAGE_SUFFIX, "")
      : root.value;
  });

  const str = computed(() => {
    const hopString = hops.value.length
      ? `.${hops.value.map(h => h.name).join(".")}`
      : "";

    return `${root.value}${hopString}:${currentTypeName.value}`;
  });

  const back = () => {
    hops.value.pop();
  };

  const forward = (field: SchemaField) => {
    hops.value.push(field);
  };

  const isRoot = computed(() => {
    return hops.value.length === 0;
  });

  return {
    root,
    currentTypeName,
    leafField,
    str,
    isRoot,
    hops,
    back,
    forward
  };
}

export const clonePath = (oldPath: QueryPath): QueryPath => {
  const newPath = useQueryPath(oldPath.root.value);
  newPath.hops.value = [...oldPath.hops.value];
  return newPath;
};

export type QueryPath = ReturnType<typeof useQueryPath>
