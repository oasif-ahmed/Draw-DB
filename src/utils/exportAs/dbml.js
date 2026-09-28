import { Cardinality, Constraint } from "../../data/constants";
import { dbToTypes } from "../../data/datatypes";
import i18n from "../../i18n/i18n";
import { escapeQuotes } from "../exportSQL/shared";
import { isFunction, isKeyword, getRelationshipFields } from "../utils";
import {
  dbmlFieldSize,
  dbmlTypeName,
  inlineEnumTypeName,
  isInlineEnumType,
  quoteIdentifier,
} from "../dbml/types";

function parseDefaultDbml(field, database) {
  if (isFunction(field.default)) {
    return `\`${field.default}\``;
  }

  if (isKeyword(field.default) || !dbToTypes[database][field.type]?.hasQuotes) {
    return field.default;
  }

  return `'${escapeQuotes(field.default)}'`;
}

function columnDefault(field, database) {
  if (!field.default) {
    return "";
  }

  if (typeof field.default === "string" && !field.default.trim()) {
    return "";
  }

  return `default: ${parseDefaultDbml(field, database)}`;
}

function columnSettings(field, database) {
  const constraints = [
    field.primary && "pk",
    field.increment && "increment",
    field.notNull && "not null",
    field.unique && "unique",
    columnDefault(field, database),
    columnComment(field),
  ].filter(Boolean);

  if (!constraints.length) {
    return "";
  }

  return ` [ ${constraints.join(", ")} ]`;
}

function cardinality(rel) {
  switch (rel.cardinality) {
    case i18n.t(Cardinality.ONE_TO_ONE):
    case Cardinality.ONE_TO_ONE:
      return "-";
    case i18n.t(Cardinality.ONE_TO_MANY):
    case Cardinality.ONE_TO_MANY:
      return "<";
    case i18n.t(Cardinality.MANY_TO_ONE):
    case Cardinality.MANY_TO_ONE:
      return ">";
    default:
      return null;
  }
}

function processComment(comment) {
  if (comment.includes("\n")) {
    return `'''${comment}'''`;
  }

  return `'${escapeQuotes(comment)}'`;
}

function columnComment(field) {
  if (!field.comment || field.comment.trim() === "") {
    return "";
  }

  return `note: ${processComment(field.comment)}`;
}

function enumBlock(name, values) {
  const body = values.map((value) => `\t${quoteIdentifier(value)}`).join("\n");
  return `enum ${quoteIdentifier(name)} {\n${body}\n}`;
}

function enumNameIndex(enums) {
  return new Map(enums.map((en) => [String(en.name).toUpperCase(), en.name]));
}

function inlineEnumFields(tables) {
  const fields = [];

  for (const table of tables) {
    for (const field of table.fields ?? []) {
      if (isInlineEnumType(field.type) && Array.isArray(field.values)) {
        fields.push(field);
      }
    }
  }

  return fields;
}

// A name can only be declared once in DBML, so fields sharing a name but not
// their values get a numbered suffix to keep every type reference valid.
function resolveInlineEnumNames(tables) {
  const fields = inlineEnumFields(tables);
  const declared = new Map();
  const names = new Map();

  for (const field of fields) {
    const key = JSON.stringify(field.values);
    const preferred = inlineEnumTypeName(field);
    const existing = declared.get(preferred.toUpperCase());

    if (!existing) {
      declared.set(preferred.toUpperCase(), { key, name: preferred });
      names.set(field, preferred);
      continue;
    }

    if (existing.key === key) {
      names.set(field, existing.name);
      continue;
    }

    let i = 2;
    let candidate = `${preferred}_${i}`;
    while (declared.has(candidate.toUpperCase())) {
      const taken = declared.get(candidate.toUpperCase());
      if (taken.key === key) {
        candidate = taken.name;
        break;
      }
      i++;
      candidate = `${preferred}_${i}`;
    }

    declared.set(candidate.toUpperCase(), { key, name: candidate });
    names.set(field, candidate);
  }

  return { fields, names };
}

function inlineEnumBlocks(names, fields) {
  const blocks = [];
  const emitted = new Set();

  for (const field of fields) {
    const name = names.get(field);
    if (emitted.has(name)) continue;
    emitted.add(name);
    blocks.push(enumBlock(name, field.values));
  }

  return blocks;
}

function indexEntry(fields, name, unique) {
  if (!Array.isArray(fields) || !fields.length) return null;

  const settings = [
    name ? `name: '${escapeQuotes(String(name))}'` : "",
    unique ? "unique" : "",
  ].filter(Boolean);
  const columns = fields.map((field) => quoteIdentifier(field)).join(", ");

  return `\t\t(${columns})${settings.length ? ` [ ${settings.join(", ")} ]` : ""}`;
}

function indexesBlock(table) {
  const entries = [
    ...(table.indices ?? []).map((index) =>
      indexEntry(index.fields, index.name, index.unique),
    ),
    ...(table.uniqueConstraints ?? []).map((constraint) =>
      indexEntry(constraint.fields, constraint.name, true),
    ),
  ].filter(Boolean);

  if (!entries.length) return "";

  return `\n\n\tindexes {\n${entries.join("\n")}\n\t}`;
}

function tableBlock(table, database, enumNames, inlineEnumNames) {
  const headerColor = table.color ? ` [headercolor: ${table.color}]` : "";
  const fields = table.fields
    .map(
      (field) =>
        `\t${quoteIdentifier(field.name)} ${quoteIdentifier(
          dbmlTypeName(field, enumNames, inlineEnumNames),
        )}${dbmlFieldSize(field, database)}${columnSettings(field, database)}`,
    )
    .join("\n");
  const comment =
    table.comment && table.comment.trim() !== ""
      ? `\n\n\tNote: ${processComment(table.comment)}`
      : "";

  return `Table ${quoteIdentifier(table.name)}${headerColor} {\n${fields}${indexesBlock(table)}${comment}\n}`;
}

function columnRef(tableName, fieldNames) {
  const columns = fieldNames.map((name) => quoteIdentifier(name));
  const target = columns.length === 1 ? columns[0] : `(${columns.join(", ")})`;
  return `${quoteIdentifier(tableName)}.${target}`;
}

function constraintKeyword(constraint) {
  return String(constraint ?? Constraint.NONE).toLowerCase();
}

function refBlock(rel, tables) {
  const startTable = tables.find((table) => table.id === rel.startTableId);
  const endTable = tables.find((table) => table.id === rel.endTableId);
  if (!startTable || !endTable) return null;

  const symbol = cardinality(rel);
  if (!symbol) return null;

  const pairs = getRelationshipFields(rel);
  const startFields = pairs.map(
    (pair) => startTable.fields.find((f) => f.id === pair.startFieldId)?.name,
  );
  const endFields = pairs.map(
    (pair) => endTable.fields.find((f) => f.id === pair.endFieldId)?.name,
  );
  if (startFields.some((name) => !name) || endFields.some((name) => !name)) {
    return null;
  }

  const name = rel.name ? `${quoteIdentifier(rel.name)} ` : "";
  const settings = `[ delete: ${constraintKeyword(rel.deleteConstraint)}, update: ${constraintKeyword(rel.updateConstraint)} ]`;

  return `Ref ${name}{\n\t${columnRef(startTable.name, startFields)} ${symbol} ${columnRef(endTable.name, endFields)} ${settings}\n}`;
}

export function toDBML(diagram) {
  const database = diagram.database;
  const enums = diagram.enums ?? [];
  const tables = (diagram.tables ?? []).filter(
    (table) => (table.fields ?? []).length > 0,
  );
  const enumNames = enumNameIndex(enums);
  const { fields: inlineFields, names: inlineEnumNames } =
    resolveInlineEnumNames(tables);

  return [
    ...enums.map((en) => enumBlock(en.name, en.values ?? [])),
    ...inlineEnumBlocks(inlineEnumNames, inlineFields),
    ...tables.map((table) =>
      tableBlock(table, database, enumNames, inlineEnumNames),
    ),
    ...(diagram.relationships ?? []).map((rel) => refBlock(rel, tables)),
  ]
    .filter(Boolean)
    .join("\n\n");
}
