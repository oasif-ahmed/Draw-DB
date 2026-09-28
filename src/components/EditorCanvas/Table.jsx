import { useMemo, useState, useRef, useEffect } from "react";
import {
  Action,
  Tab,
  ObjectType,
  tableHeaderHeight,
  tableColorStripHeight,
} from "../../data/constants";
import {
  IconChevronDown,
  IconChevronUp,
  IconMore,
  IconMinus,
  IconDeleteStroked,
  IconEditStroked,
  IconCopyStroked,
  IconKeyStroked,
  IconLock,
  IconUnlock,
} from "@douyinfe/semi-icons";
import { nanoid } from "nanoid";
import {
  Popover,
  Tag,
  Button,
  ButtonGroup,
  SideSheet,
  Divider,
  Input,
  Select,
} from "@douyinfe/semi-ui";
import {
  useLayout,
  useSettings,
  useDiagram,
  useSelect,
  useUndoRedo,
  useTransform,
} from "../../hooks";
import TableInfo from "../EditorSidePanel/TablesTab/TableInfo";
import { useTranslation } from "react-i18next";
import { resolveType } from "../../utils/customTypes";
import { isRtl } from "../../i18n/utils/rtl";
import i18n from "../../i18n/i18n";
import {
  getCommentHeight,
  getFieldOffsetY,
  getTableHeight,
  getTableWidth,
  getVisibleFieldEntries,
  getVisibleFields,
  getRelationshipFields,
} from "../../utils/utils";
import ResizeHandles from "./ResizeHandles";
import { dbToTypes } from "../../data/datatypes";
import { getCustomTypesForDb } from "../../utils/customTypes";

export default function Table({
  tableData,
  onPointerDown,
  setHoveredTable,
  handleGripField,
  setLinkingLine,
}) {
  const [hoveredField, setHoveredField] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [resizeEngaged, setResizeEngaged] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editingFieldPart, setEditingFieldPart] = useState(null);
  const [editNameValue, setEditNameValue] = useState("");
  const inputRef = useRef(null);
  const { layout } = useLayout();
  const {
    database,
    tables,
    relationships,
    addTable,
    deleteTable,
    deleteField,
    updateTable,
    updateField,
  } = useDiagram();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { settings } = useSettings();
  const { transform } = useTransform();
  const { t } = useTranslation();
  const {
    selectedElement,
    setSelectedElement,
    bulkSelectedElements,
    setBulkSelectedElements,
  } = useSelect();

  const borderColor = useMemo(
    () => (settings.mode === "light" ? "border-zinc-300" : "border-zinc-600"),
    [settings.mode],
  );

  const width = getTableWidth(tableData);

  const height = getTableHeight(
    tableData,
    settings.showComments,
    relationships,
  );

  const visibleFieldEntries = useMemo(
    () => getVisibleFieldEntries(tableData, relationships),
    [tableData, relationships],
  );

  const visibleFields = useMemo(
    () => getVisibleFields(tableData, relationships),
    [tableData, relationships],
  );

  const isSelected = useMemo(() => {
    return (
      (selectedElement.id == tableData.id &&
        selectedElement.element === ObjectType.TABLE) ||
      bulkSelectedElements.some(
        (e) => e.type === ObjectType.TABLE && e.id === tableData.id,
      )
    );
  }, [selectedElement, tableData, bulkSelectedElements]);

  const toggleTableCollapse = (e) => {
    e.stopPropagation();
    if (layout.readOnly) return;

    const collapsed = !tableData.collapsed;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "self",
        tid: tableData.id,
        undo: { collapsed: tableData.collapsed },
        redo: { collapsed },
        message: t("edit_table", {
          tableName: tableData.name,
          extra: "[collapse fields]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(tableData.id, { collapsed });
  };

  const lockUnlockTable = (e) => {
    const locking = !tableData.locked;
    updateTable(tableData.id, { locked: locking });

    const lockTable = () => {
      setSelectedElement({
        ...selectedElement,
        element: ObjectType.NONE,
        id: -1,
        open: false,
      });
      setBulkSelectedElements((prev) =>
        prev.filter(
          (el) => el.id !== tableData.id || el.type !== ObjectType.TABLE,
        ),
      );
    };

    const unlockTable = () => {
      const elementInBulk = {
        id: tableData.id,
        type: ObjectType.TABLE,
        initialCoords: { x: tableData.x, y: tableData.y },
        currentCoords: { x: tableData.x, y: tableData.y },
      };
      if (e.ctrlKey || e.metaKey) {
        setBulkSelectedElements((prev) => [...prev, elementInBulk]);
      } else {
        setBulkSelectedElements([elementInBulk]);
      }
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: false,
      }));
    };

    if (locking) {
      lockTable();
    } else {
      unlockTable();
    }
  };

  const duplicateTable = () => {
    if (layout.readOnly) return;
    const duplicated = {
      ...tableData,
      id: nanoid(),
      name: `${tableData.name}_copy`,
      x: tableData.x + 24,
      y: tableData.y + 24,
      fields: tableData.fields.map((f) => ({ ...f, id: nanoid() })),
      indices: tableData.indices.map((idx) => ({ ...idx, id: nanoid() })),
    };
    addTable({ table: duplicated });
  };

  const openEditor = () => {
    if (!layout.sidebar) {
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: true,
      }));
    } else {
      setSelectedElement((prev) => ({
        ...prev,
        currentTab: Tab.TABLES,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: true,
      }));
      if (selectedElement.currentTab !== Tab.TABLES) return;
      document
        .getElementById(`scroll_table_${tableData.id}`)
        .scrollIntoView({ behavior: "smooth" });
    }
  };

  const getFieldReference = (fieldData) => {
    let matchedEndFieldId = null;
    const rel = relationships.find((r) => {
      if (r.startTableId !== tableData.id) return false;
      const pair = getRelationshipFields(r).find(
        (p) => p.startFieldId === fieldData.id,
      );
      if (!pair) return false;
      matchedEndFieldId = pair.endFieldId;
      return true;
    });
    if (!rel) return null;

    const refTable = tables.find((tbl) => tbl.id === rel.endTableId);
    const refField = refTable?.fields.find((f) => f.id === matchedEndFieldId);
    if (!refTable || !refField) return null;

    return { tableName: refTable.name, fieldName: refField.name };
  };

  const resizeTable = ({ width: nextWidth, x: nextX }) => {
    updateTable(
      tableData.id,
      nextX === undefined
        ? { width: nextWidth }
        : { width: nextWidth, x: nextX },
    );
    if (nextX === undefined) return;
    setBulkSelectedElements((prev) =>
      prev.map((el) =>
        el.type === ObjectType.TABLE && el.id === tableData.id
          ? {
              ...el,
              initialCoords: { ...el.initialCoords, x: nextX },
              currentCoords: { ...el.currentCoords, x: nextX },
            }
          : el,
      ),
    );
  };

  const commitResize = (initial, final) => {
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "self",
        tid: tableData.id,
        undo: initial,
        redo: final,
        message: t("edit_table", {
          tableName: tableData.name,
          extra: "[width]",
        }),
      },
    ]);
    setRedoStack([]);
  };

  const startEditField = (fieldId, part, currentValue) => {
    if (layout.readOnly) return;
    setEditingFieldId(fieldId);
    setEditingFieldPart(part);
    setEditNameValue(currentValue);
  };

  const commitEditField = (fieldId, part, value) => {
    if (value === editNameValue) {
      setEditingFieldId(null);
      setEditingFieldPart(null);
      return;
    }
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field",
        tid: tableData.id,
        fid: fieldId,
        undo: { [part]: editNameValue },
        redo: { [part]: value },
        message: t("edit.table", {
          tableName: tableData.name,
          extra: "[field]",
        }),
      },
    ]);
    setRedoStack([]);
    updateField(tableData.id, fieldId, { [part]: value });
    setEditingFieldId(null);
    setEditingFieldPart(null);
  };

  const toggleFieldPrimary = (fieldData) => {
    if (layout.readOnly) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field",
        tid: tableData.id,
        fid: fieldData.id,
        undo: { primary: fieldData.primary },
        redo: { primary: !fieldData.primary },
        message: t("edit.table", {
          tableName: tableData.name,
          extra: "[field]",
        }),
      },
    ]);
    setRedoStack([]);
    updateField(tableData.id, fieldData.id, { primary: !fieldData.primary });
  };

  const toggleFieldNotNull = (fieldData) => {
    if (layout.readOnly) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field",
        tid: tableData.id,
        fid: fieldData.id,
        undo: { notNull: fieldData.notNull },
        redo: { notNull: !fieldData.notNull },
        message: t("edit.table", {
          tableName: tableData.name,
          extra: "[field]",
        }),
      },
    ]);
    setRedoStack([]);
    updateField(tableData.id, fieldData.id, { notNull: !fieldData.notNull });
  };

  const handleTypeChange = (fieldData, value) => {
    if (layout.readOnly || value === fieldData.type) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field",
        tid: tableData.id,
        fid: fieldData.id,
        undo: { type: fieldData.type },
        redo: { type: value },
        message: t("edit.table", {
          tableName: tableData.name,
          extra: "[field]",
        }),
      },
    ]);
    setRedoStack([]);
    const typeInfo = resolveType(database, value);
    const incr = fieldData.increment && !!typeInfo.canIncrement;

    if (value === "ENUM" || value === "SET") {
      updateField(tableData.id, fieldData.id, {
        type: value,
        default: "",
        values: fieldData.values ? [...fieldData.values] : [],
        increment: incr,
      });
    } else if (typeInfo.isSized || typeInfo.hasPrecision) {
      updateField(tableData.id, fieldData.id, {
        type: value,
        size: typeInfo.defaultSize,
        increment: incr,
      });
    } else if (!typeInfo.hasDefault || incr) {
      updateField(tableData.id, fieldData.id, {
        type: value,
        increment: incr,
        default: "",
        size: "",
        values: [],
      });
    } else if (typeInfo.hasCheck) {
      updateField(tableData.id, fieldData.id, {
        type: value,
        check: "",
        increment: incr,
      });
    } else {
      updateField(tableData.id, fieldData.id, {
        type: value,
        increment: incr,
        size: "",
        values: [],
      });
    }
    setEditingFieldId(null);
    setEditingFieldPart(null);
  };

  useEffect(() => {
    if (editingFieldId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingFieldId, editingFieldPart]);

  if (tableData.hidden) return null;

  return (
    <>
      <foreignObject
        key={tableData.id}
        x={tableData.x}
        y={tableData.y}
        width={width}
        height={height}
        className="group drop-shadow-lg rounded-md cursor-move"
        onPointerDown={onPointerDown}
        onPointerEnter={(e) => e.isPrimary && setHovered(true)}
        onPointerLeave={(e) => e.isPrimary && setHovered(false)}
      >
        <div
          onDoubleClick={openEditor}
          className={`border-2 hover:border-dashed hover:border-blue-400
               select-none rounded-lg w-full table-card backdrop-blur-md ${
                 settings.mode === "light"
                   ? "bg-white/60 text-zinc-800"
                   : "bg-zinc-900/60 text-zinc-200"
               } ${
                 resizeEngaged
                   ? "border-dashed border-blue-400"
                   : isSelected
                     ? "border-solid border-blue-500"
                     : borderColor
               }`}
          style={{ direction: "ltr" }}
        >
          <div
            className="h-[10px] w-full rounded-t-md table-color-strip"
            style={{
              backgroundColor: tableData.color,
            }}
          />
          <div
            className={`${
              visibleFieldEntries.length === 0
                ? "rounded-b-md"
                : "border-b border-gray-400"
            } ${
              settings.mode === "light" ? "bg-white/40" : "bg-zinc-900/40"
            } ${tableData.comment && settings.showComments ? "pb-3" : ""}`}
          >
            <div
              className={`overflow-hidden font-bold h-[40px] flex justify-between items-center gap-2`}
            >
              <div className="px-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
                {tableData.name}
              </div>
              <div className="hidden group-hover:flex items-center shrink-0 pe-2 gap-1">
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={tableData.locked ? t("unlock_table") : t("lock_table")}
                  disabled={layout.readOnly}
                  onClick={lockUnlockTable}
                >
                  {tableData.locked ? <IconLock size="small" /> : <IconUnlock size="small" />}
                </button>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={layout.readOnly}
                  aria-label={
                    tableData.collapsed
                      ? t("expand_unlinked_columns")
                      : t("collapse_unlinked_columns")
                  }
                  title={
                    tableData.collapsed
                      ? t("expand_unlinked_columns")
                      : t("collapse_unlinked_columns")
                  }
                  onClick={toggleTableCollapse}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {tableData.collapsed ? <IconChevronDown size="small" /> : <IconChevronUp size="small" />}
                </button>
                <Popover
                  key={tableData.id}
                  content={
                    <div className="popover-theme flex flex-col py-1 min-w-[160px]">
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors" onClick={openEditor}>
                        <IconEditStroked size="small" />
                        {t("edit")}
                      </button>
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors disabled:opacity-40" onClick={duplicateTable} disabled={layout.readOnly}>
                        <IconCopyStroked size="small" />
                        {t("duplicate")}
                      </button>
                      <Divider className="!my-1" />
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left transition-colors disabled:opacity-40" onClick={() => deleteTable(tableData.id)} disabled={layout.readOnly}>
                        <IconDeleteStroked size="small" />
                        {t("delete")}
                      </button>
                    </div>
                  }
                  position="rightTop"
                  style={{ padding: 8 }}
                  showArrow
                  trigger="click"
                >
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                    <IconMore size="small" />
                  </button>
                </Popover>
              </div>
            </div>
            {tableData.comment && settings.showComments && (
              <div className="text-xs px-3 line-clamp-5">
                {tableData.comment}
              </div>
            )}
          </div>

          {visibleFieldEntries.map(({ field: e }, i) => {
            const resolved = resolveType(database, e.type);
            const reference = getFieldReference(e);
            return settings.showFieldSummary ? (
              <Popover
                key={e.id ?? i}
                content={
                  <div className="popover-theme">
                    <div
                      className="flex justify-between items-center pb-2"
                      style={{ direction: "ltr" }}
                    >
                      <p className="me-4 font-bold">{e.name}</p>
                      <p
                        className={
                          "ms-4 font-mono " +
                          (resolved.isCustom ? "" : resolved.color)
                        }
                        style={
                          resolved.isCustom ? { color: resolved.color } : {}
                        }
                      >
                        {e.type +
                          ((resolved.isSized || resolved.hasPrecision) &&
                          e.size &&
                          e.size !== ""
                            ? "(" + e.size + ")"
                            : "")}
                      </p>
                    </div>
                    <hr />
                    {e.primary && (
                      <Tag color="blue" className="me-2 my-2">
                        {t("primary_key")}
                      </Tag>
                    )}
                    {e.unique && (
                      <Tag color="amber" className="me-2 my-2">
                        {t("unique")}
                      </Tag>
                    )}
                    {e.notNull && (
                      <Tag color="blue" className="me-2 my-2">
                        {t("not_null")}
                      </Tag>
                    )}
                    {e.increment && (
                      <Tag color="green" className="me-2 my-2">
                        {t("autoincrement")}
                      </Tag>
                    )}
                    {reference && (
                      <Tag color="light-blue" className="me-2 my-2">
                        {t("foreign_key")}
                      </Tag>
                    )}
                    {reference && (
                      <p>
                        <strong>{t("references")}: </strong>
                        {reference.tableName}({reference.fieldName})
                      </p>
                    )}
                    <p>
                      <strong>{t("default_value")}: </strong>
                      {e.default === "" ? t("not_set") : e.default}
                    </p>
                    <p className="max-w-80">
                      <strong>{t("comment")}: </strong>
                      {e.comment === "" ? t("not_set") : e.comment}
                    </p>
                  </div>
                }
                position="right"
                showArrow
                style={
                  isRtl(i18n.language)
                    ? { direction: "rtl" }
                    : { direction: "ltr" }
                }
              >
                {field(e, i)}
              </Popover>
            ) : (
              field(e, i)
            );
          })}
        </div>
      </foreignObject>
      {!layout.readOnly && !tableData.locked && (
        <ResizeHandles
          x={tableData.x}
          y={tableData.y}
          width={width}
          height={height}
          zoom={transform.zoom}
          visible={hovered}
          onResize={resizeTable}
          onResizeEnd={commitResize}
          onEngagedChange={setResizeEngaged}
        />
      )}
      <SideSheet
        title={t("edit")}
        size="small"
        visible={
          selectedElement.element === ObjectType.TABLE &&
          selectedElement.id === tableData.id &&
          selectedElement.open &&
          !layout.sidebar
        }
        onCancel={() =>
          setSelectedElement((prev) => ({
            ...prev,
            open: !prev.open,
          }))
        }
        style={{ paddingBottom: "16px" }}
      >
        <div className="sidesheet-theme">
          <TableInfo data={tableData} />
        </div>
      </SideSheet>
    </>
  );

  function field(fieldData, index) {
    const fieldResolved = resolveType(database, fieldData.type);
    const showFieldComment = fieldData.comment && settings.showComments;
    const isEditingName = editingFieldId === fieldData.id && editingFieldPart === "name";
    const isEditingType = editingFieldId === fieldData.id && editingFieldPart === "type";

    const typeOptions = [
      ...Object.keys(dbToTypes[database]).map((value) => ({
        label: value,
        value,
      })),
      ...Object.keys(getCustomTypesForDb(database)).map((value) => ({
        label: value,
        value,
      })),
    ];

    return (
      <div
        className={`${
          index === visibleFields.length - 1 ? "" : "border-b border-gray-400"
        } group w-full overflow-hidden field-row-animated`}
        onPointerEnter={(e) => {
          if (!e.isPrimary) return;
          setHoveredField(index);
          setHoveredTable({
            tableId: tableData.id,
            fieldId: fieldData.id,
          });
        }}
        onPointerLeave={(e) => {
          if (!e.isPrimary) return;
          setHoveredField(null);
          setHoveredTable({
            tableId: null,
            fieldId: null,
          });
        }}
        onPointerDown={(e) => {
          e.target.releasePointerCapture(e.pointerId);
        }}
      >
        <div className="h-[36px] px-2 py-1 flex justify-between items-center gap-1">
          <div
            className={`${
              hoveredField === index ? "text-zinc-400" : ""
            } flex items-center gap-2 overflow-hidden min-w-0`}
          >
            <button
              className="shrink-0 w-[10px] h-[10px] bg-[#3b82f6] rounded-full opacity-60 hover:opacity-100 transition-opacity"
              onPointerDown={(e) => {
                if (!e.isPrimary) return;
                handleGripField();
                const fieldY =
                  tableData.y +
                  getFieldOffsetY(
                    visibleFields,
                    index,
                    width,
                    settings.showComments,
                  ) +
                  tableHeaderHeight +
                  tableColorStripHeight +
                  getCommentHeight(
                    tableData.comment,
                    width,
                    settings.showComments,
                  ) +
                  14;
                setLinkingLine((prev) => ({
                  ...prev,
                  startFieldId: fieldData.id,
                  startTableId: tableData.id,
                  startX: tableData.x + 15,
                  startY: fieldY,
                  endX: tableData.x + 15,
                  endY: fieldY,
                }));
              }}
            />
            {isEditingName ? (
              <input
                ref={inputRef}
                className="flex-1 px-1 py-0.5 text-sm rounded border border-blue-400 bg-white/80 dark:bg-zinc-800/80 outline-none min-w-0"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={() => commitEditField(fieldData.id, "name", editNameValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(fieldData.id, "name", editNameValue);
                  if (e.key === "Escape") {
                    setEditingFieldId(null);
                    setEditingFieldPart(null);
                  }
                }}
              />
            ) : (
              <span
                className="overflow-hidden text-ellipsis whitespace-nowrap cursor-text hover:text-blue-500 transition-colors"
                onClick={() => startEditField(fieldData.id, "name", fieldData.name)}
              >
                {fieldData.name}
              </span>
            )}
          </div>
          <div className="text-zinc-400 flex items-center gap-1 shrink-0">
            {hoveredField === index && !isEditingName && !isEditingType ? (
              <>
                <button
                  className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${
                    fieldData.primary
                      ? "bg-blue-500 text-white shadow-sm"
                      : "hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-400 hover:text-blue-600"
                  }`}
                  title={t("primary")}
                  onClick={() => toggleFieldPrimary(fieldData)}
                >
                  <IconKeyStroked size="small" />
                </button>
                <button
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-mono transition-all ${
                    !fieldData.notNull
                      ? "bg-blue-500 text-white shadow-sm"
                      : "hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-400 hover:text-blue-600"
                  }`}
                  title={t("nullable")}
                  onClick={() => toggleFieldNotNull(fieldData)}
                >
                  ?
                </button>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={layout.readOnly}
                  onClick={() => {
                    if (layout.readOnly) return;
                    deleteField(fieldData, tableData.id);
                  }}
                  title={t("delete")}
                >
                  <IconMinus size="small" />
                </button>
              </>
            ) : settings.showDataTypes ? (
              isEditingType ? (
                <Select
                  className="w-[100px]"
                  size="small"
                  value={fieldData.type}
                  optionList={typeOptions}
                  onChange={(value) => handleTypeChange(fieldData, value)}
                  onBlur={() => {
                    setEditingFieldId(null);
                    setEditingFieldPart(null);
                  }}
                  autoFocus
                />
              ) : (
                <div className="flex gap-1 items-center">
                  {fieldData.primary && <IconKeyStroked className="text-blue-500" />}
                  {!fieldData.notNull && <span className="font-mono text-blue-400">?</span>}
                  <span
                    className={
                      "font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded field-type-badge cursor-pointer " +
                      (fieldResolved.isCustom ? "" : fieldResolved.color)
                    }
                    style={
                      fieldResolved.isCustom
                        ? {
                            color: fieldResolved.color,
                            backgroundColor: `${fieldResolved.color}15`,
                          }
                        : {}
                    }
                    onClick={() => startEditField(fieldData.id, "type", fieldData.type)}
                  >
                    {fieldData.type +
                      ((fieldResolved.isSized || fieldResolved.hasPrecision) &&
                      fieldData.size &&
                      fieldData.size !== ""
                        ? `(${fieldData.size})`
                        : "")}
                  </span>
                </div>
              )
            ) : null}
          </div>
        </div>
        {showFieldComment && (
          <div className="ms-3 px-3 pb-3">
            <div
              className={`text-xs line-clamp-2 ${settings.mode === "light" ? "text-zinc-600" : "text-zinc-200"}`}
            >
              {fieldData.comment}
            </div>
          </div>
        )}
      </div>
    );
  }
}
