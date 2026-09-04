/**
 * @typedef {"profile"|"search"|"company"|"salesNav"|"unknown"} LisfdcLinkedInKind
 * @typedef {"lightning"|"classic"|"unknown"} LisfdcSalesforceKind
 *
 * @typedef {object} LisfdcLinkedInProfile
 * @property {string} [name]
 * @property {string} [headline]
 * @property {string} [location]
 * @property {string} [currentRole]
 * @property {string} [company]
 * @property {string} [about]
 *
 * @typedef {object} LisfdcLinkedInSearchResult
 * @property {string} name
 * @property {string} [headline]
 * @property {string} [url]
 *
 * @typedef {object} LisfdcLinkedInSearch
 * @property {string} [query]
 * @property {number} [resultCountEstimate]
 * @property {LisfdcLinkedInSearchResult[]} [topResults]
 *
 * @typedef {object} LisfdcLinkedInCompany
 * @property {string} [name]
 * @property {string} [about]
 * @property {string} [industry]
 * @property {string} [location]
 *
 * @typedef {object} LisfdcLinkedInExtract
 * @property {LisfdcLinkedInKind} kind
 * @property {string} url
 * @property {string} title
 * @property {string} extractedAt
 * @property {LisfdcLinkedInProfile} [profile]
 * @property {LisfdcLinkedInSearch} [search]
 * @property {LisfdcLinkedInCompany} [company]
 *
 * @typedef {object} LisfdcHeaderField
 * @property {string} label
 * @property {string} value
 *
 * @typedef {object} LisfdcSalesforceExtract
 * @property {LisfdcSalesforceKind} kind
 * @property {string} url
 * @property {string} title
 * @property {string} extractedAt
 * @property {string|null} object
 * @property {string|null} id
 * @property {string|null} name
 * @property {LisfdcHeaderField[]} headerFields
 */
