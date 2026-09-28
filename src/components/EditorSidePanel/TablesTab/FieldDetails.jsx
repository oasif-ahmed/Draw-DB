import { useMemo, useState } from "react";
import {
  Input,
  TextArea,
  Button,
  TagInput,
  InputNumber,
  Checkbox,
  Select,
  Tag,
} from "@douyinfe/semi-ui";
import { Action, ObjectType } from "../../../data/constants";
import { IconDeleteStroked } from "@douyinfe/semi-icons";
import { useDiagram, useEnums, useLayout, useUndoRedo } from "../../../hooks";
import { useTranslation } from "react-i18next";
import { databases } from "../../../data/databases";
import { resolveType } from "../../../utils/customTypes";
import { getFieldEnumValues } from "../../../utils/utils";

export default function FieldDetails({ data, tid }) {
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { tables, database } = useDiagram();
  const { enums } = useEnums();
  const resolved = resolveType(database, data.type);
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { updateField, deleteField } = useDiagram();
  const [editField, setEditField] = useState({});
  const table = useMemo(() => tables.find((t) => t.id === tid), [tables, tid]);
  const isInlineEnum = data.type === "ENUM" || data.type === "SET";
  const namedEnum = useMemo(
    () =>
      enums.find(
        (e) => e.name.toUpperCase() === (data.type || "").toUpperCase(),
      ),
    [enums, data.type],
  );
  const enumValues = useMemo(
    () => getFieldEnumValues(data, enums),
    [data, enums],
  );
  const defaultOptions = useMemo(() => {
    const options = enumValues
      .filter((v) => String(v).trim() !== "")
      .map((v) => ({ label: v, value: v }));
    if (data.default && !options.some((o) => o.value === data.default)) {
      options.push({ label: data.default, value: data.default });
    }
    return options;
  }, [enumValues, data.default]);
  const enumNameError = useMemo(() => {
    const value = (data.enumName || "").trim();
    if (value === "") return null;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      return t("enum_name_invalid");
    }

    const upper = value.toUpperCase();
    const takenByColumn = tables.some((table) =>
      table.fields.some(
        (field) =>
          field.id !== data.id &&
          (field.enumName || "").trim().toUpperCase() === upper,
      ),
    );
    if (takenByColumn || enums.some((e) => e.name.toUpperCase() === upper)) {
      return t("enum_name_in_use");
    }

    return null;
  }, [data.enumName, data.id, tables, enums, t]);

  return (
    <div>
      <div className="font-semibold">{t("default_value")}</div>
      {defaultOptions.length > 0 && data.type !== "SET" ? (
        <Select
          className="my-2 w-full"
          showClear
          placeholder={t("select_a_value")}
          value={data.default}
          disabled={resolved.noDefault || data.increment || layout.readOnly}
          optionList={defaultOptions}
          onChange={(value) => {
            if (layout.readOnly) return;
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid: tid,
                fid: data.id,
                undo: { default: data.default },
                redo: { default: value ?? "" },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, { default: value ?? "" });
          }}
        />
      ) : (
        <Input
          className="my-2"
          placeholder={t("default_value")}
          value={data.default}
          readonly={layout.readOnly}
          disabled={resolved.noDefault || data.increment}
          onChange={(value) => updateField(tid, data.id, { default: value })}
          onFocus={(e) => setEditField({ default: e.target.value })}
          onBlur={(e) => {
            if (e.target.value === editField.default) return;
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid: tid,
                fid: data.id,
                undo: editField,
                redo: { default: e.target.value },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
          }}
        />
      )}
      {isInlineEnum && (
        <>
          <div className="font-semibold mb-1">{t("enum_name")}</div>
          <Input
            className="my-2"
            placeholder={data.name}
            value={data.enumName ?? ""}
            readonly={layout.readOnly}
            validateStatus={enumNameError ? "error" : "default"}
            errorText={enumNameError ?? undefined}
            onChange={(value) => {
              if (layout.readOnly) return;
              updateField(tid, data.id, { enumName: value });
            }}
            onFocus={(e) => setEditField({ enumName: e.target.value })}
            onBlur={(e) => {
              if (e.target.value === editField.enumName) return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid: tid,
                  fid: data.id,
                  undo: { enumName: editField.enumName ?? "" },
                  redo: { enumName: e.target.value },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
            }}
          />
          <div className="text-xs mt-1 mb-2">{t("enum_name_hint")}</div>
          <div className="font-semibold mb-1">
            {data.type} {t("values")}
          </div>
          <TagInput
            separator={[",", ", ", " ,"]}
            value={data.values}
            validateStatus={
              !data.values || data.values.length === 0 ? "error" : "default"
            }
            addOnBlur
            className="my-2"
            placeholder={t("use_for_batch_input")}
            onChange={(v) => {
              if (layout.readOnly) return;
              updateField(tid, data.id, { values: v });
            }}
            onFocus={() => setEditField({ values: data.values })}
            onBlur={() => {
              if (
                JSON.stringify(editField.values) === JSON.stringify(data.values)
              )
                return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid: tid,
                  fid: data.id,
                  undo: editField,
                  redo: { values: data.values },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
            }}
          />
        </>
      )}
      {namedEnum && (
        <>
          <div className="font-semibold mb-1">
            {data.type} {t("values")}
          </div>
          <div className="flex flex-wrap gap-1 my-2">
            {namedEnum.values.length > 0 ? (
              namedEnum.values.map((v, i) => (
                <Tag key={`${v}_${i}`} className="max-w-full">
                  <span className="truncate">{v}</span>
                </Tag>
              ))
            ) : (
              <span className="text-xs opacity-60">
                {t("enum_needs_values")}
              </span>
            )}
          </div>
          <div className="text-xs mt-1 mb-2">{t("enum_values_hint")}</div>
        </>
      )}
      {resolved.isSized && (
        <>
          <div className="font-semibold">{t("size")}</div>
          <InputNumber
            className="my-2 w-full"
            placeholder={t("size")}
            value={data.size}
            readonly={layout.readOnly}
            onChange={(value) => updateField(tid, data.id, { size: value })}
            onFocus={(e) => setEditField({ size: e.target.value })}
            onBlur={(e) => {
              if (e.target.value === editField.size) return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid: tid,
                  fid: data.id,
                  undo: editField,
                  redo: { size: e.target.value },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
            }}
          />
        </>
      )}
      {resolved.hasPrecision && (
        <>
          <div className="font-semibold">{t("precision")}</div>
          <Input
            className="my-2 w-full"
            placeholder={t("set_precision")}
            validateStatus={
              !data.size || /^\d+,\s*\d+$|^$/.test(data.size)
                ? "default"
                : "error"
            }
            readonly={layout.readOnly}
            value={data.size}
            onChange={(value) => updateField(tid, data.id, { size: value })}
            onFocus={(e) => setEditField({ size: e.target.value })}
            onBlur={(e) => {
              if (e.target.value === editField.size) return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid: tid,
                  fid: data.id,
                  undo: editField,
                  redo: { size: e.target.value },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
            }}
          />
        </>
      )}
      {resolved.hasCheck && (
        <>
          <div className="font-semibold">{t("check")}</div>
          <Input
            className="mt-2"
            placeholder={t("check")}
            value={data.check}
            disabled={data.increment}
            readonly={layout.readOnly}
            onChange={(value) => updateField(tid, data.id, { check: value })}
            onFocus={(e) => setEditField({ check: e.target.value })}
            onBlur={(e) => {
              if (e.target.value === editField.check) return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid: tid,
                  fid: data.id,
                  undo: editField,
                  redo: { check: e.target.value },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
            }}
          />
          <div className="text-xs mt-1">{t("this_will_appear_as_is")}</div>
        </>
      )}
      <div className="flex justify-between items-center my-3">
        <div className="font-medium">{t("unique")}</div>
        <Checkbox
          value="unique"
          checked={data.unique}
          disabled={layout.readOnly}
          onChange={(checkedValues) => {
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid: tid,
                fid: data.id,
                undo: {
                  [checkedValues.target.value]: !checkedValues.target.checked,
                },
                redo: {
                  [checkedValues.target.value]: checkedValues.target.checked,
                },
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, {
              [checkedValues.target.value]: checkedValues.target.checked,
            });
          }}
        />
      </div>
      <div className="flex justify-between items-center my-3">
        <div className="font-medium">{t("autoincrement")}</div>
        <Checkbox
          value="increment"
          checked={data.increment}
          disabled={
            !resolved.canIncrement || data.isArray || layout.readOnly
          }
          onChange={(checkedValues) => {
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid: tid,
                fid: data.id,
                undo: {
                  [checkedValues.target.value]: !checkedValues.target.checked,
                },
                redo: {
                  [checkedValues.target.value]: checkedValues.target.checked,
                },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, {
              increment: !data.increment,
              check: data.increment ? data.check : "",
            });
          }}
        />
      </div>
      {databases[database].hasArrays && (
        <div className="flex justify-between items-center my-3">
          <div className="font-medium">{t("declare_array")}</div>
          <Checkbox
            value="isArray"
            checked={data.isArray}
            disabled={layout.readOnly}
            onChange={(checkedValues) => {
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid: tid,
                  fid: data.id,
                  undo: {
                    [checkedValues.target.value]: !checkedValues.target.checked,
                  },
                  redo: {
                    [checkedValues.target.value]: checkedValues.target.checked,
                  },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
              updateField(tid, data.id, {
                isArray: checkedValues.target.checked,
                increment: data.isArray ? data.increment : false,
              });
            }}
          />
        </div>
      )}
      {databases[database].hasUnsignedTypes &&
        resolved.signed && (
          <div className="flex justify-between items-center my-3">
            <div className="font-medium">{t("unsigned")}</div>
            <Checkbox
              value="unsigned"
              checked={data.unsigned}
              disabled={layout.readOnly}
              onChange={(checkedValues) => {
                setUndoStack((prev) => [
                  ...prev,
                  {
                    action: Action.EDIT,
                    element: ObjectType.TABLE,
                    component: "field",
                    tid: tid,
                    fid: data.id,
                    undo: {
                      [checkedValues.target.value]:
                        !checkedValues.target.checked,
                    },
                    redo: {
                      [checkedValues.target.value]:
                        checkedValues.target.checked,
                    },
                    message: t("edit_table", {
                      tableName: table.name,
                      extra: "[field]",
                    }),
                  },
                ]);
                setRedoStack([]);
                updateField(tid, data.id, {
                  unsigned: checkedValues.target.checked,
                });
              }}
            />
          </div>
        )}
      <div className="font-semibold">{t("comment")}</div>
      <TextArea
        className="my-2"
        placeholder={t("comment")}
        value={data.comment}
        readonly={layout.readOnly}
        autosize
        rows={2}
        onChange={(value) => updateField(tid, data.id, { comment: value })}
        onFocus={(e) => setEditField({ comment: e.target.value })}
        onBlur={(e) => {
          if (e.target.value === editField.comment) return;
          setUndoStack((prev) => [
            ...prev,
            {
              action: Action.EDIT,
              element: ObjectType.TABLE,
              component: "field",
              tid: tid,
              fid: data.id,
              undo: editField,
              redo: { comment: e.target.value },
              message: t("edit_table", {
                tableName: table.name,
                extra: "[field]",
              }),
            },
          ]);
          setRedoStack([]);
        }}
      />
      <Button
        icon={<IconDeleteStroked />}
        type="danger"
        block
        disabled={layout.readOnly}
        onClick={() => deleteField(data, tid)}
      >
        {t("delete")}
      </Button>
    </div>
  );
}
