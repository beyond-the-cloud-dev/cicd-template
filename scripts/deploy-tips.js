// Known Salesforce deployment error patterns with hints on how to fix them.
// Each entry: { id, label, match: RegExp | RegExp[], hint, docs? }.
// `match` is tested against the component failure `problem` text.
// Keep hints short, actionable and generic enough for every BTC repo.

"use strict";

const TIPS = [
  {
    id: "member-not-visible",
    label: "Member not visible",
    match: /(Variable|Method|Constructor|Field) is not visible/i,
    hint:
      "The referenced member is private or protected. Add `@TestVisible`, make it public/global, or move the test into the same class. Inside a namespaced org (`btcdev.X`) cross-class access follows the same rules.",
  },
  {
    id: "member-does-not-exist",
    label: "Member does not exist",
    match: /(Variable|Method|Field|Property) does not exist|Method does not exist or incorrect signature|Invalid constructor syntax|Constructor not defined/i,
    hint:
      "The class, method or variable is missing or has a different signature. Check for typos, wrong types, or a class that is not part of the deploy (outside `packageDirectories` in `sfdx-project.json`).",
  },
  {
    id: "invalid-type",
    label: "Invalid type",
    match: /Invalid type: /i,
    hint:
      "The referenced class is not in the deploy. Make sure it lives in a `packageDirectories` path in `sfdx-project.json`, or vendor the dependency (e.g. soql-lib under `dependencies/`).",
  },
  {
    id: "dependent-class-invalid",
    label: "Dependent class invalid",
    match: /Dependent class is invalid and needs recompilation/i,
    hint: "Side effect of another compile error in this deploy. Fix the first real error and this one disappears.",
  },
  {
    id: "apex-syntax",
    label: "Apex syntax error",
    match: /Unexpected token|Missing ['"]?[;)}\]]|expecting ['"]?[;)}\]]|mismatched input|Unexpected character/i,
    hint: "Apex does not compile. Open the file at the reported line; `npm run prettier:verify` usually points at the same spot.",
  },
  {
    id: "type-mismatch",
    label: "Type mismatch",
    match: /Illegal assignment from|Incompatible (types|value type|key type)|Return value must be of type|Argument\(s\) must be of type/i,
    hint: "Types do not line up. Cast explicitly or fix the declared type; watch out for `Object` vs `SObject` and `List<Object>` vs `List<SObject>`.",
  },
  {
    id: "no-such-column",
    label: "Field not in org",
    match: /No such column '.*' on (entity|sobject|object)|Invalid field: .* in related list|Invalid field .* for SObject|Field .* is not available for/i,
    hint:
      "The field does not exist in the scratch org. Either add it to the source, or enable the feature/setting that creates it in the file passed as `scratch-def-file` (default `config/project-scratch-def.json`).",
  },
  {
    id: "entity-not-accessible",
    label: "Object not in org",
    match: /Entity is not org-accessible|sObject type '.*' is not supported|Invalid sObject type|no CustomObject named .* found/i,
    hint: "The SObject is not available in the scratch org. Add the required feature (e.g. `PersonAccounts`, `Communities`, `ContactsToMultipleAccounts`) to `features` in the scratch org definition.",
  },
  {
    id: "missing-reference",
    label: "Missing metadata reference",
    match: /In field: .* - no .* named .* found|Cannot find folder|Cannot find a user that matches|Unknown user permission/i,
    hint: "The deploy references metadata that is not part of it and not in the org (profile, layout, folder, permission, user). Add the missing component to the source or drop the reference.",
  },
  {
    id: "duplicate",
    label: "Duplicate",
    match: /Duplicate label|duplicate value found|Duplicate (field|method|variable|class|name)/i,
    hint: "Two components resolve to the same name or label. Check for a leftover copy after a rename, or the same class in two package directories.",
  },
  {
    id: "lwc-compile",
    label: "LWC compile error",
    match: /LWC1\d{3}|Invalid HTML syntax|does not exist in the component|is not a valid identifier/i,
    hint: "Lightning Web Component does not compile. `npm run lint` and `npm test` in the repo reproduce it locally.",
  },
  {
    id: "xml-parse",
    label: "Malformed metadata XML",
    match: /Error parsing file|Element .* invalid at this location|Unable to parse/i,
    hint: "A `*-meta.xml` file is malformed or uses an element the API version does not know. Compare it with a working file of the same type.",
  },
  {
    id: "api-version",
    label: "API version",
    match: /apiVersion can't be|Invalid api version|INVALID_API_VERSION/i,
    hint: "Component `apiVersion` is higher than the org or `sourceApiVersion` in `sfdx-project.json` allows. Align both to the same value.",
  },
  {
    id: "cross-reference",
    label: "Cross reference",
    match: /insufficient access rights on cross-reference id|is referenced elsewhere/i,
    hint: "The component is referenced by something else in the org (layout, flow, permission set). Remove the reference first, or deploy both together.",
  },
  {
    id: "coverage",
    label: "Code coverage",
    match: /Average test coverage across all Apex Classes and Triggers is|test coverage of at least 75%/i,
    hint: "Org-wide Apex coverage is below 75%. Add tests for the uncovered classes; the coverage report artifact lists them.",
  },
  {
    id: "deploy-timeout",
    label: "Deploy timed out",
    match: /The client has timed out|request has timed out|timed out waiting|Timeout/i,
    hint: "The deploy did not finish inside the wait window. Raise the `deploy-wait` input (minutes) in the calling workflow.",
  },
  {
    id: "auth",
    label: "Authentication",
    match: /expired access\/refresh token|INVALID_SESSION_ID|INVALID_LOGIN|No authorization information found|Named org not found/i,
    hint: "The org auth did not work. For Dev Hub refresh the `SFDX_AUTH_URL_DEVHUB` secret; on the Free plan it must be set per repository, org secrets do not reach private repos.",
  },
];

/**
 * Returns the first tip matching the given problem text, or null.
 */
function findTip(problem) {
  if (!problem) return null;
  for (const tip of TIPS) {
    const patterns = Array.isArray(tip.match) ? tip.match : [tip.match];
    if (patterns.some((re) => re.test(problem))) {
      return tip;
    }
  }
  return null;
}

module.exports = { TIPS, findTip };
