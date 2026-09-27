import { Collapse, Button } from "@douyinfe/semi-ui";
import { IconEyeOpened, IconEyeClosed } from "@douyinfe/semi-icons";
import { IconPlus } from "@douyinfe/semi-icons";
import {
  useSelect,
  useDiagram,
  useSaveState,
  useLayout,
  useUndoRedo,
} from "../../../hooks";
import { Action, ObjectType, State } from "../../../data/constants";
import { useTranslation } from "react-i18next";
import { DragHandle } from "../../SortableList/DragHandle";
import { SortableList } from "../../SortableList/SortableList";
import SearchBar from "./SearchBar";
import Empty from "../Empty";
import TableInfo from "./TableInfo";

export default function TablesTab() {
  const { tables, addTable, setTables } = useDiagram();
  const { selectedElement, setSelectedElement } = useSelect();
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { setSaveState } = useSaveState();

  return (
    <>
      <div className="flex gap-2 mb-3">
        <SearchBar tables={tables} />
        <Button
          icon={<IconPlus />}
          onClick={() => addTable()}
          disabled={layout.readOnly}
          className="rounded-lg"
        >
          {t("add_table")}
        </Button>
      </div>
      {tables.length === 0 ? (
        <Empty title={t("no_tables")} text={t("no_tables_text")} />
      ) : (
        <Collapse
          activeKey={
            selectedElement.open && selectedElement.element === ObjectType.TABLE
              ? `${selectedElement.id}`
              : ""
          }
          keepDOM={false}
          lazyRender
          onChange={(k) =>
            setSelectedElement((prev) => ({
              ...prev,
              open: true,
              id: k[0],
              element: ObjectType.TABLE,
            }))
          }
          accordion
          className="sidebar-collapse"
        >
          <SortableList
            keyPrefix="tables-tab"
            items={tables}
            onChange={(newTables) => setTables(newTables)}
            afterChange={() => setSaveState(State.SAVING)}
            renderItem={(item) => <TableListItem table={item} />}
          />
        </Collapse>
      )}
    </>
  );
}

function TableListItem({ table }) {
  const { layout } = useLayout();
  const { updateTable } = useDiagram();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { t } = useTranslation();

  const toggleTableVisibility = (e) => {
    e.stopPropagation();
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "self",
        tid: table.id,
        undo: { hidden: table.hidden },
        redo: { hidden: !table.hidden },
        message: t("edit_table", {
          tableName: table.name,
          extra: "[hidden]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(table.id, { hidden: !table.hidden });
  };

  return (
    <div id={`scroll_table_${table.id}`} className="mb-1">
      <Collapse.Panel
        className="relative rounded-lg border border-color hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
        header={
          <div className="flex items-center justify-between w-full px-2 py-1.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <DragHandle readOnly={layout.readOnly} id={table.id} />
              <div className="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-sm">
                {table.name}
              </div>
            </div>
            <button
              className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              onClick={toggleTableVisibility}
              title={table.hidden ? t("show") : t("hide")}
            >
              {table.hidden ? <IconEyeClosed size="small" /> : <IconEyeOpened size="small" />}
            </button>
            <div
              className="w-1 h-full absolute top-0 left-0 bottom-0 rounded-l-lg"
              style={{ backgroundColor: table.color }}
            />
          </div>
        }
        itemKey={`${table.id}`}
      >
        <TableInfo data={table} />
      </Collapse.Panel>
    </div>
  );
}
