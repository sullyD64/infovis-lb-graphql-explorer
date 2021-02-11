/* eslint-disable @typescript-eslint/no-explicit-any */
import { LbGraphqlService } from "@/store/graphql";
import { computed, reactive, ref, Ref } from "@vue/composition-api";
import { DocumentNode, print } from "graphql";
import gql from "graphql-tag";
import { clonePath, QueryPath, useQueryPath } from "./queryPath";
import { BASE_FIELDS, GqlSchemaField, ID_ROOT, NodeData, NodeDataKey, OBJ_VALUE, PAGE_SUFFIX, QueryableClass, QueryManagerResult, QUERY_CLASSES, QUERY_FIELDS, SchemaField, SchemaFieldInstance, SERVICE_TYPE } from "./types";
import { alphaSort, safeMapGet } from "./utils";

export function useQueryManager (gqlService: LbGraphqlService) {
  /**
   * Chiavi della mappa
   *  Employee:Employee [...]
   *  Employee.team:Team [...]
   *  Employee.assignments:Project_assignment [...]
   *  Employee.assignments.project:Project [...]
   */
  const fieldsMap: Map<string, SchemaField[]> = reactive(new Map());
  const fieldsMapTracker: Ref<number> = ref(0);

  const schemaClasses: Ref<QueryableClass[]> = ref([]);

  const schemaClassesMap = computed(() => {
    return new Map(schemaClasses.value.map(qc => [qc.className, qc]));
  });

  const currentClass = computed(() => {
    return schemaClasses.value.find(qc => qc.isQuerying);
  });

  const currentService: Ref<SERVICE_TYPE | null> = ref(null);
  const currentServiceFieldName = computed(() => {
    return currentClass.value
      ? `${currentClass.value.className}___${currentService.value}`
      : null;
  });

  const currentQueryHeader: Ref<string> = ref("");

  /**
   * Restituisce la query GraphQL costruita a partire da una classe
   * I campi vengono letti da fieldsMap navigando ricorsivamente i riferimenti.
   * Per passare da una entry all'altra della mappa "sposto" un queryPath ogni volta che incontro
   *  un campo che ha un oggetto. Il nome del campo viene aggiunto al queryPath.
   * Se un campo è a molti, viene wrappato in un campo { items }
   */
  const currentQuery = computed((): DocumentNode | undefined => {
    if (!currentClass.value || !currentQueryHeader.value.length) { return; }
    if (fieldsMapTracker.value === 0) { return; }

    let currentFieldsStr: string[] = [];

    // clona la mappa pulendo tutti i campi non selezionati
    const pickedFieldMap: Map<string, SchemaField[]> = new Map();
    for (const [key, fields] of fieldsMap.entries()) {
      pickedFieldMap.set(key, fields.filter(field => field.picked));
    }

    const getFieldsRecursive = (fields: SchemaField[], path: QueryPath): string[] => {
      const fieldsStr: string[] = [];
      fields
        .sort(alphaSort)
        .forEach(field => {
          fieldsStr.push(field.name);
          if (field.isObjectType) {
            path.forward(field); // mi sposto sul tipo annidato
            if (pickedFieldMap.has(path.str.value)) {
              const subFields = safeMapGet<SchemaField[]>(pickedFieldMap, path.str.value);
              const subFieldsStr = getFieldsRecursive(subFields, path);
              fieldsStr.push("{");
              if (field.isToMany) {
                fieldsStr.push("items {");
                fieldsStr.push(...subFieldsStr);
                fieldsStr.push("}");
              } else {
                fieldsStr.push(...subFieldsStr);
              }
              fieldsStr.push("}");
            } else {
              // console.log("____ subfields not found");
            }
            path.back(); // ritorno sul tipo corrente
          }
        });
      return fieldsStr;
    };

    // usa un queryPath come cursore per spostarsi tra i campi
    const queryPath = useQueryPath(currentClass.value.className);
    if (!pickedFieldMap.has(queryPath.str.value)) {
      return;
    }
    const rootFields = safeMapGet(pickedFieldMap, queryPath.str.value);
    currentFieldsStr = getFieldsRecursive(rootFields, queryPath);
    if (currentService.value === "getPage") {
      currentFieldsStr = ["items {", ...currentFieldsStr, "}"];
    }
    if (!currentFieldsStr.length) { return; }
    // console.log(currentFieldsStr);
    return gql`
    query {
      ${currentQueryHeader.value} {
        ${currentFieldsStr.join("\n")}
      }
    }
    `;
  });

  const currentQueryPretty = computed(() => {
    return currentQuery.value ? print(currentQuery.value) : null;
  });

  const reset = () => {
    schemaClasses.value = schemaClasses.value.map(qc => ({
      ...qc,
      selected: false,
      isQuerying: false,
      isRoot: false
    }));
  };

  const getIndexOfPath = (queryPath: QueryPath): number => {
    return [...fieldsMap.keys()].indexOf(queryPath.str.value);
  };

  /**
   * Deseleziona i campi di tutti i tipi, ad eccezione del campo ID
   */
  const resetFields = () => {
    fieldsMap.forEach(fields => {
      fields.forEach(field => {
        field.picked = field.name === BASE_FIELDS._id;
      });
    });
  };

  const setCurrentRootClass = (className: string) => {
    schemaClasses.value = schemaClasses.value.map(qc => {
      return {
        ...qc,
        isQuerying: qc.className === className,
        isRoot: qc.className === className
      };
    });
  };

  /**
   * Chiede allo schema le classi per cui è possibile invocare un servizio di lettura.
   */
  const loadQueryableClasses = async () => {
    const dataResult = await gqlService.query({ query: QUERY_CLASSES });
    const fields = dataResult.data.result.fields;
    schemaClasses.value = fields
      .map((field: { name: string }) => field.name)
      .filter((name: string) => name.endsWith("___get"))
      .map((name: string) => name.replace("___get", ""))
      // Il prossimo filtro si applica allo scenario del modello Tutorial.
      // In Livebase le classi Part possono essere abilitate come voci di menu su un Application Schema
      // per visualizzare una tabella read-only di tutti i part.
      // In questi casi, GraphQL crea i servizi di lettura anche per queste classi.
      // Nella visualizzazione, ciò potrebbe confondere riguardo il concetto di "classe main".
      // Questo vale per la classe "Project_assignment" nella vista "Administration", su cui è basata la visualizzazione.
      // Pertanto filtriamo questa classe dalla lista di classi queryable.
      .filter((name: string) => name !== "Project_assignment")
      .map((name: string) => {
        return {
          className: name,
          selected: false,
          isQuerying: false,
          isRoot: false
        };
      });
  };

  /**
   * Chiede allo schema i campi selezionabili per il tipo dell'oggetto affiorante.
   */
  const fetchQueryableFields = async (path: QueryPath) => {
    // await sleep(500);
    const dataResult = await gqlService.query({ query: QUERY_FIELDS(path.currentTypeName.value) });
    const fields = (dataResult.data.result.fields as GqlSchemaField[])
      .filter(field => field.name !== BASE_FIELDS._clientId) // nascondo il campo _clientId

      // nascondo tutti i campi associables
      .filter(field => !field.name.endsWith("___associables"))

      .map(field => {
        const isObjectType = field.type.kind === "OBJECT" && field.type.name !== "FileInfo";
        const isToMany = isObjectType
          ? field.type.name.endsWith(PAGE_SUFFIX)
          : undefined;
        return {
          name: field.name,
          typeName: field.type.name,
          // il campo ID è *sempre* selezionato per ogni nuovo oggetto
          picked: field.name === BASE_FIELDS._id,
          isObjectType,
          isToMany
        } as SchemaField;
      });
    fieldsMap.set(path.str.value, fields);
    fieldsMapTracker.value += 1;
  };

  /**
   * Data una lista di campi, ritorna un campo a partire dal suo nome
   */
  const getField = (fields: (SchemaField | SchemaFieldInstance)[], fieldName: string): (SchemaField |SchemaFieldInstance) => {
    const fieldsMap = new Map(fields.map(field => [field.name, field]));
    return safeMapGet<SchemaField>(fieldsMap, fieldName);
  };

  /**
   * Aggiorna lo stato di un campo. Se il campo è un oggetto, inoltre:
   *
   * Se passa da non selezionato a selezionato:
   *    - aggiorna il path corrente
   *    - richiede i campi per quell'oggetto a quel path (e pre-seleziona il campo _id)
   *
   * Se passa da selezionato a non selezionato:
   *    - aggiorna il path corrente
   *    - pulisce lo schema per quel path
   */
  const toggleQueryableField = async (path: QueryPath, fieldName: string, picked: boolean) => {
    const fields = safeMapGet<SchemaField[]>(fieldsMap, path.str.value);
    const field = getField(fields, fieldName);
    field.picked = picked;

    if (field.isObjectType) {
      path.forward(field); // mi sposto sul tipo annidato
      if (picked) {
        if (!fieldsMap.has(path.str.value)) {
          await fetchQueryableFields(path);
        }
      } else {
        fieldsMap.delete(path.str.value);
        path.back(); // ritorno sul tipo del nodo corrente
      }
      // se ho selezionato il campo, rimango sul tipo di quel campo
      // se l'ho deselezionato, sono ritornato sul tipo corrente
    }
    fieldsMapTracker.value += 1;
    // console.log("toggled field", fieldName, field, "new path", path.str.value, fieldsMap);
  };

  /**
   * Dato un array di valori di un certo nodo, "popola" ciascun campo puntato dal path.
   * Ritorna anche i campi per cui non è presente un valore, ovvero i campi che non sono stati richiesti.
   */
  const resolveFields = (path: QueryPath, datum: Record<string, never>): SchemaFieldInstance[] => {
    const fields = safeMapGet<SchemaField[]>(fieldsMap, path.str.value);
    try {
      return fields.map(field => {
        return {
          ...field,
          value: !field.isObjectType
            ? datum
              ? datum[field.name]
              : ""
            : OBJ_VALUE
        };
      });
    } catch (error) {
      throw new Error(`datum is null at path ${path.str.value}`);
    }
  };

  /**
   * Data una mappa indicizzata da una chiave complessa ID-padre:ID-oggetto,
   * Ritorna le entry che matchano parzialmente in base alla chiave ID-padre
   */
  const getPartialMatches = (dataMap: Map<string, NodeData>, parentID: string) => {
    const entries = [...dataMap.entries()];
    return entries.filter((entry) => NodeDataKey.parse(entry[0]).parentID === parentID);
  };

  /**
   * Naviga l'albero ritornato dalla query.
   * L'obiettivo è selezionare l'oggetto / gli oggetti contenuti nel campo più esterno del path corrente.
   * L'output dell'algoritmo è quindi o un singolo oggetto, o una lista di oggetti.
   * Questi oggetti sono nella forma NodeData: { parent: id, fields:  SchemaField[] }
   * I campi di ciascun oggetto sono popolati con il valore ritornato dalla query.
   *
   */
  const navigate = (queryPath: QueryPath, rawQueryData: Record<string, never> | Record<string, never>[]): NodeData[] => {
    const data: NodeData[] = [];

    const toArray = (itemOrItems: Record<string, never> | Record<string, never>[]): Record<string, never>[] => {
      return (itemOrItems instanceof Array) ? itemOrItems : [itemOrItems];
    };

    const rawData = toArray(rawQueryData);

    const navigateRecursive = (index: number, rawDatum: Record<string, never>) => {
      const field = queryPath.hops.value[index];
      const rawSubData = field.isToMany
        ? toArray((rawDatum[field?.name] as Record<string, never>).items)
        : toArray(rawDatum[field.name]);

      if (queryPath.leafField.value && queryPath.leafField.value.name === field.name) {
        // sono arrivato in fondo al path
        rawSubData.forEach(rawSubDatum => {
          data.push({
            parent: rawDatum._id as string,
            fields: resolveFields(queryPath, rawSubDatum)
          });
        });
      } else {
        rawSubData.forEach(rawSubDatum => {
          navigateRecursive(index + 1, rawSubDatum);
        });
      }
    };

    if (queryPath.isRoot.value) {
      // caso semplice: risolvo i campi subito
      rawData.forEach(rawDatum => {
        data.push({
          parent: null,
          fields: resolveFields(queryPath, rawDatum)
        });
      });
    } else {
      // caso complesso: vado in ricorsione sul path
      rawData.forEach(rawDatum => {
        navigateRecursive(0, rawDatum);
      });
    }
    return data;
  };

  /**
   * Esegue la query corrente e ritorna i campi alla profondità puntata dal path corrente.
   * I campi sono valorizzati con i dati ritornati dalla query.
   */
  const runQuery = async (queryPath: QueryPath): Promise<QueryManagerResult> => {
    if (!currentQuery.value || !currentService.value || !currentServiceFieldName.value) { throw new Error("called runQuery without a query or a service"); }

    // console.log("running query on path", queryPath.str.value);
    const dataResult = await gqlService.query({ query: currentQuery.value });

    let rawData = dataResult.data[currentServiceFieldName.value];
    if (currentService.value === "getPage") {
      rawData = rawData.items;
    }
    // console.log(stringify(data));

    const resolvedData = navigate(clonePath(queryPath), rawData);
    let resolvedDatum: NodeData | undefined;
    let resolvedDataMap: Map<string, NodeData> | undefined;
    if (resolvedData.length === 1) {
      resolvedDatum = resolvedData[0];
    } else {
      // converte la lista di campi in una mappa indicizzata dalla coppia ID-padre:ID-oggetto
      // questa doppia chiave è necessaria perché due oggetti di livello N possono puntare allo stesso oggetto di livello N+1.
      // la mappa non deve trattare queste informazioni come duplicati.
      resolvedDataMap = new Map();
      resolvedData.forEach(nodeDatum => {
        const _idField = (getField(nodeDatum.fields, BASE_FIELDS._id) as SchemaFieldInstance);
        const key = new NodeDataKey(nodeDatum.parent || ID_ROOT, _idField.value);
        (resolvedDataMap as Map<string, NodeData>).set(key.toString(), nodeDatum);
      });
    }
    const result: QueryManagerResult = {
      path: queryPath,
      datum: resolvedDatum || undefined,
      data: resolvedDataMap || undefined
    };
    console.log("gql-result", result);
    return result;
  };

  const initQuery = async (service: SERVICE_TYPE, className: string, id?: string, next?: string): Promise<QueryPath> => {
    setCurrentRootClass(className);

    resetFields();
    const queryPath = useQueryPath(className);

    if (!fieldsMap.has(queryPath.str.value)) {
      await fetchQueryableFields(queryPath);
    }

    currentService.value = service;
    if (service === "get") {
      currentQueryHeader.value = `${currentServiceFieldName.value}(_id: ${id})`;
      // pre-seleziona il campo ID
      await toggleQueryableField(queryPath, BASE_FIELDS._id, true);
    } else if (service === "getPage") {
      // currentQueryHeader.value = `${currentServiceFieldName.value}(options: {next: 2})`; // TODO è un test
      currentQueryHeader.value = `${currentServiceFieldName.value}(options: ${next ? `{ next: ${next} }` : "{}"})`;
    } else {
      throw new Error(`Unsupported service: ${service}`);
    }
    return queryPath;
  };

  const test = async (queryPath: QueryPath) => {
    if (!currentClass.value) { return; }

    // Inizio da Employee. i nodi espansi per primi hanno questo path
    console.debug("START", queryPath.str.value); // Employee:Employee

    // Simulo la selezione di alcuni campi su un nodo Employee
    await toggleQueryableField(queryPath, "age", true);
    await toggleQueryableField(queryPath, "full_name", true);

    await runQuery(queryPath);

    // Simulo la selezione di un campo con un oggetto.
    console.debug("BEFORE SELECT NESTED", queryPath.str.value); // Employee:Employee
    await toggleQueryableField(queryPath, "team", true);
    // Il path viene spostato sul tipo dell'oggetto corrente
    console.debug("AFTER SELECT NESTED", queryPath.str.value); // Employee.team:Team
    await toggleQueryableField(queryPath, "name", true);

    await runQuery(queryPath);

    // Simulo la deselezione di un campo su employee
    // Per "tornare" su Employee da Team, rimuovo il campo affiorante dal path
    queryPath.back();
    console.debug("MOVED TO", queryPath.str.value); // Employee:Employee
    await toggleQueryableField(queryPath, "team", false);

    // Seleziono un altro campo con un oggetto su Employee
    await toggleQueryableField(queryPath, "assignments", true);
    // Di nuovo, il path viene spostato sul tipo dell'oggetto corrente
    console.debug("MOVED TO", queryPath.str.value); // Employee.assignments:Project_assignment

    // Seleziono dei campi su assignments
    await toggleQueryableField(queryPath, "start_date", true);

    await runQuery(queryPath);

    await toggleQueryableField(queryPath, "project_", true);
    // Il path ora è spostato sul tipo dell'oggetto del campo project_
    console.debug("MOVED TO", queryPath.str.value); // Employee.assignments.project_:Project
    await toggleQueryableField(queryPath, "name", true);

    await runQuery(queryPath);

    // Simulo la selezione di un campo di nuovo sul nodo Employee
    // In questo caso devo "tornare indietro" di due nodi
    queryPath.back();
    console.debug("MOVED TO", queryPath.str.value); // Employee.assignments:Project_assignment
    queryPath.back();
    console.debug("MOVED TO", queryPath.str.value); // Employee:Employee
    await toggleQueryableField(queryPath, "address", true);
    console.debug("MOVED TO", queryPath.str.value); // Employee.address:Address

    // Simulo la selezione di un campo sul nodo Address
    await toggleQueryableField(queryPath, "city", true);

    await runQuery(queryPath);

    // Simulo la selezione di un campo sul nodo Project_assignment
    // Per prima cosa mi devo spostare indietro di un salto, e "in avanti" sul campo di tipo Project_assignment
    // Poi seleziono il campo assignments su Employee
    // Poi mi "sposto sul nodo di quel tipo"
    // Questo processo deve essere replicato quando la query espande dei nodi annidati e ritorna il path come risultato. Tale path deve tenere conto del livello aggiuntivo di profindità
    queryPath.back();
    console.debug("MOVED TO", queryPath.str.value); // Employee.address:Address
    const nextNodeField = getField(safeMapGet(fieldsMap, queryPath.str.value), "assignments");
    queryPath.forward(nextNodeField);
    console.debug("MOVED TO", queryPath.str.value); // Employee.assignments:Project_assignment
    await toggleQueryableField(queryPath, "end_date", true);

    // A questo punto posso controllare lo stato della query corrente
    // console.debug("CURRENT QUERY", currentQueryPretty.value);

    // risultato atteso
    /*
    query {
      Employee___get(_id: 11000) {
        _id
        address {
          _id
          city
        }
        age
        assignments {
          items {
            _id
            end_date
            project_ {
              _id
            }
            start_date
          }
        }
        full_name
      }
    }
    */
  };

  return {
    currentService,
    currentQuery,
    currentQueryPretty,
    schemaClasses,
    schemaClassesMap,
    fieldsMap,
    loadQueryableClasses,
    fetchQueryableFields,
    getField,
    getPartialMatches,
    getIndexOfPath,
    reset,
    toggleQueryableField,
    initQuery,
    runQuery,
    test
  };
}

export type QueryManager = ReturnType<typeof useQueryManager>;
