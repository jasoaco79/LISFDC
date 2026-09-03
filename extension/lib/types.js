/**
 * @typedef {"profile"|"search"|"company"|"salesNav"|"unknown"} LisfdcLinkedInKind
 * @typedef {"lightning"|"classic"|"unknown"} LisfdcSalesforceKind
 *
 * @typedef {object} LisfdcLinkedInExtract
 * @property {LisfdcLinkedInKind} kind
 * @property {string} url
 * @property {string} title
 * @property {string} extractedAt
 *
 * @typedef {object} LisfdcSalesforceExtract
 * @property {LisfdcSalesforceKind} kind
 * @property {string} url
 * @property {string} title
 * @property {string} extractedAt
 * @property {string|null} object
 * @property {string|null} id
 * @property {string|null} name
 * @property {{label:string,value:string}[]} headerFields
 */
