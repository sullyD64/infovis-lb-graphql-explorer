import { Maybe } from "graphql/jsutils/Maybe";

export type GqlID = string;
export type GqlReal = string;
export type GqlSerial = string;
export type GqlDate = string;
export type GqlTime = string;
export type GqlDatetime = string;
export type GqlYear = number;

export type GqlIssue = {
  _clientId?: Maybe<GqlID>;
  applicationName: string;
  attributeNames?: Maybe<Array<string>>;
  entityID?: Maybe<GqlID>;
  entityName?: Maybe<string>;
  issueLevel: GqlIssueLevel;
  issueReferenceType?: Maybe<GqlIssueReferenceType>;
  issueType: GqlIssueType;
  profileName: string;
  roleNames?: Maybe<Array<string>>;
  sourceRequestReference: string;
  traceId: string;
  userMessage: string;
};

export enum GqlIssueLevel {
  Error = "ERROR",
  Warning = "WARNING"
}

export enum GqlIssueReferenceType {
  Entity = "ENTITY",
  EntityAttribute = "ENTITY_ATTRIBUTE",
  EntityRole = "ENTITY_ROLE"
}

export enum GqlIssueType {
  ApplicationGrant = "APPLICATION_GRANT",
  AttributeCodiceFiscalePersonaFisica = "ATTRIBUTE_CODICE_FISCALE_PERSONA_FISICA",
  AttributeCodiceFiscalePersonaGiuridica = "ATTRIBUTE_CODICE_FISCALE_PERSONA_GIURIDICA",
  AttributeEmail = "ATTRIBUTE_EMAIL",
  AttributeFileSize = "ATTRIBUTE_FILE_SIZE",
  AttributeFileType = "ATTRIBUTE_FILE_TYPE",
  AttributeGrantEdit = "ATTRIBUTE_GRANT_EDIT",
  AttributeGrantRead = "ATTRIBUTE_GRANT_READ",
  AttributePartitaIva = "ATTRIBUTE_PARTITA_IVA",
  AttributePhone = "ATTRIBUTE_PHONE",
  AttributeRange = "ATTRIBUTE_RANGE",
  AttributeRealDecimalDigits = "ATTRIBUTE_REAL_DECIMAL_DIGITS",
  AttributeRequired = "ATTRIBUTE_REQUIRED",
  AttributeStringLength = "ATTRIBUTE_STRING_LENGTH",
  AttributeStringPattern = "ATTRIBUTE_STRING_PATTERN",
  DataType = "DATA_TYPE",
  EntityAccessForbidden = "ENTITY_ACCESS_FORBIDDEN",
  EntityAttributeAccessForbidden = "ENTITY_ATTRIBUTE_ACCESS_FORBIDDEN",
  EntityAttributeNotFound = "ENTITY_ATTRIBUTE_NOT_FOUND",
  EntityCreateVeto = "ENTITY_CREATE_VETO",
  EntityDeleteVeto = "ENTITY_DELETE_VETO",
  EntityDomain = "ENTITY_DOMAIN",
  EntityEditVeto = "ENTITY_EDIT_VETO",
  EntityGrantCreate = "ENTITY_GRANT_CREATE",
  EntityGrantDelete = "ENTITY_GRANT_DELETE",
  EntityGrantEdit = "ENTITY_GRANT_EDIT",
  EntityGrantRead = "ENTITY_GRANT_READ",
  EntityLockEdit = "ENTITY_LOCK_EDIT",
  EntityLockPersist = "ENTITY_LOCK_PERSIST",
  EntityNotFound = "ENTITY_NOT_FOUND",
  EntityRoleAccessForbidden = "ENTITY_ROLE_ACCESS_FORBIDDEN",
  EntityRoleNotFound = "ENTITY_ROLE_NOT_FOUND",
  EntityUnique = "ENTITY_UNIQUE",
  MalformedRequest = "MALFORMED_REQUEST",
  RoleCardinality = "ROLE_CARDINALITY",
  RoleGrantCreate = "ROLE_GRANT_CREATE",
  RoleGrantDelete = "ROLE_GRANT_DELETE",
  RoleGrantEdit = "ROLE_GRANT_EDIT",
  RoleGrantRead = "ROLE_GRANT_READ",
  ServerError = "SERVER_ERROR",
  ServiceHandlerError = "SERVICE_HANDLER_ERROR"
}
