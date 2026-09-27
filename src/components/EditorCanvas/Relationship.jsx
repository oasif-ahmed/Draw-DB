import { useMemo, useRef, useState, useEffect } from "react";
import { Cardinality, ObjectType, Tab } from "../../data/constants";
import { calcPath, calcCompositePath } from "../../utils/calcPath";
import { useDiagram, useSettings, useLayout, useSelect } from "../../hooks";
import { useTranslation } from "react-i18next";
import { SideSheet } from "@douyinfe/semi-ui";
import RelationshipInfo from "../EditorSidePanel/RelationshipsTab/RelationshipInfo";
import {
  getVisibleFieldIndex,
  getVisibleFields,
  getRelationshipFields,
  getTableWidth,
} from "../../utils/utils";

const labelFontSize = 16;

const CARDINALITY_COLORS = {
  one_to_one: { start: "#3b82f6", end: "#3b82f6", gradient: "url(#grad-one-to-one)" },
  one_to_many: { start: "#3b82f6", end: "#3b82f6", gradient: "url(#grad-one-to-many)" },
  many_to_one: { start: "#3b82f6", end: "#3b82f6", gradient: "url(#grad-many-to-one)" },
};

const CARDINALITY_LABELS = {
  one_to_one: "1:1",
  one_to_many: "1:N",
  many_to_one: "N:1",
};

function getCardinalityKey(data, t) {
  const key = data.cardinality;
  if (key === Cardinality.ONE_TO_ONE || key === t(Cardinality.ONE_TO_ONE))
    return "one_to_one";
  if (key === Cardinality.ONE_TO_MANY || key === t(Cardinality.ONE_TO_MANY))
    return "one_to_many";
  if (key === Cardinality.MANY_TO_ONE || key === t(Cardinality.MANY_TO_ONE))
    return "many_to_one";
  return "one_to_one";
}

export default function Relationship({ data }) {
  const { settings } = useSettings();
  const { tables, relationships } = useDiagram();
  const { layout } = useLayout();
  const { selectedElement, setSelectedElement } = useSelect();
  const { t } = useTranslation();

  const pathValues = useMemo(() => {
    const startTable = tables.find((t) => t.id === data.startTableId);
    const endTable = tables.find((t) => t.id === data.endTableId);

    if (!startTable || !endTable || startTable.hidden || endTable.hidden)
      return null;

    const startFields = getVisibleFields(startTable, relationships);
    const endFields = getVisibleFields(endTable, relationships);

    const pairs = getRelationshipFields(data);

    return {
      startFieldIndex: getVisibleFieldIndex(
        startTable,
        data.startFieldId,
        relationships,
      ),
      endFieldIndex: getVisibleFieldIndex(
        endTable,
        data.endFieldId,
        relationships,
      ),
      startFieldIndices: pairs.map((p) =>
        getVisibleFieldIndex(startTable, p.startFieldId, relationships),
      ),
      endFieldIndices: pairs.map((p) =>
        getVisibleFieldIndex(endTable, p.endFieldId, relationships),
      ),
      startTable: {
        x: startTable.x,
        y: startTable.y,
        width: getTableWidth(startTable),
        comment: startTable.comment,
        fields: startFields,
      },
      endTable: {
        x: endTable.x,
        y: endTable.y,
        width: getTableWidth(endTable),
        comment: endTable.comment,
        fields: endFields,
      },
    };
  }, [tables, relationships, data]);

  const isComposite = (pathValues?.startFieldIndices?.length ?? 0) > 1;

  const composite = useMemo(() => {
    if (!pathValues || !isComposite) return null;
    return calcCompositePath(
      {
        startTable: pathValues.startTable,
        endTable: pathValues.endTable,
        startFieldIndices: pathValues.startFieldIndices,
        endFieldIndices: pathValues.endFieldIndices,
      },
      1,
      settings.showComments,
    );
  }, [pathValues, isComposite, settings.showComments]);

  const pathRef = useRef();
  const labelRef = useRef();
  const [hovered, setHovered] = useState(false);

  const cardinalityKey = getCardinalityKey(data, t);
  const cardColors = CARDINALITY_COLORS[cardinalityKey];

  let cardinalityStart = "1";
  let cardinalityEnd = "1";

  switch (data.cardinality) {
    case t(Cardinality.MANY_TO_ONE):
    case Cardinality.MANY_TO_ONE:
      cardinalityStart = data.manyLabel || "n";
      cardinalityEnd = "1";
      break;
    case t(Cardinality.ONE_TO_MANY):
    case Cardinality.ONE_TO_MANY:
      cardinalityStart = "1";
      cardinalityEnd = data.manyLabel || "n";
      break;
    case t(Cardinality.ONE_TO_ONE):
    case Cardinality.ONE_TO_ONE:
      cardinalityStart = "1";
      cardinalityEnd = "1";
      break;
    default:
      break;
  }

  let cardinalityStartX = 0;
  let cardinalityEndX = 0;
  let cardinalityStartY = 0;
  let cardinalityEndY = 0;
  let labelX = 0;
  let labelY = 0;

  let labelWidth = labelRef.current?.getBBox().width ?? 0;
  let labelHeight = labelRef.current?.getBBox().height ?? 0;

  const cardinalityOffset = 28;

  if (composite) {
    labelX = composite.labelPoint.x - (labelWidth ?? 0) / 2;
    labelY = composite.labelPoint.y - 20;
    cardinalityStartX = composite.startCardinality.x;
    cardinalityStartY = composite.startCardinality.y;
    cardinalityEndX = composite.endCardinality.x;
    cardinalityEndY = composite.endCardinality.y;
  } else if (pathRef.current) {
    const pathLength = pathRef.current.getTotalLength();

    const labelPoint = pathRef.current.getPointAtLength(pathLength / 2);
    labelX = labelPoint.x - (labelWidth ?? 0) / 2;
    labelY = labelPoint.y - 20;

    const point1 = pathRef.current.getPointAtLength(cardinalityOffset);
    cardinalityStartX = point1.x;
    cardinalityStartY = point1.y;
    const point2 = pathRef.current.getPointAtLength(
      pathLength - cardinalityOffset,
    );
    cardinalityEndX = point2.x;
    cardinalityEndY = point2.y;
  }

  const edit = () => {
    if (!layout.sidebar) {
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.RELATIONSHIP,
        id: data.id,
        open: true,
      }));
    } else {
      setSelectedElement((prev) => ({
        ...prev,
        currentTab: Tab.RELATIONSHIPS,
        element: ObjectType.RELATIONSHIP,
        id: data.id,
        open: true,
      }));
      if (selectedElement.currentTab !== Tab.RELATIONSHIPS) return;
      document
        .getElementById(`scroll_ref_${data.id}`)
        .scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!pathValues) return null;

  const pathD = composite
    ? composite.path
    : calcPath(pathValues, 1, settings.showComments);

  const pathClass =
    cardinalityKey === "one_to_many"
      ? "relationship-path-one-to-many"
      : cardinalityKey === "many_to_one"
        ? "relationship-path-many-to-one"
        : "relationship-path-one-to-one";

  const baseColor = data.color ?? (settings.mode === "dark" ? "#a1a1aa" : "#71717a");

  return (
    <>
      <g
        className="select-none group"
        onDoubleClick={edit}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <defs>
          <linearGradient
            id={`grad-start-${data.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={cardColors.start} />
            <stop offset="100%" stopColor={cardColors.end} />
          </linearGradient>
          <linearGradient
            id={`grad-end-${data.id}`}
            x1="100%"
            y1="0%"
            x2="0%"
            y2="0%"
          >
            <stop offset="0%" stopColor={cardColors.end} />
            <stop offset="100%" stopColor={cardColors.start} />
          </linearGradient>
          <filter id={`glow-${data.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id={`one-start-${data.id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 9 0 L 9 10" stroke={cardColors.start} strokeWidth={2} fill="none" />
          </marker>
          <marker
            id={`many-start-${data.id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight={8}
            orient="auto-start-reverse"
          >
            <path d="M 9 5 L 2 0 M 9 5 L 0 5 M 9 5 L 2 10" stroke={cardColors.start} strokeWidth={1.5} fill="none" />
          </marker>
          <marker
            id={`one-end-${data.id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={8}
            markerHeight={8}
            orient="auto-start-reverse"
          >
            <path d="M 9 0 L 9 10" stroke={cardColors.end} strokeWidth={2} fill="none" />
          </marker>
          <marker
            id={`many-end-${data.id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={8}
            markerHeight={8}
            orient="auto-start-reverse"
          >
            <path d="M 9 5 L 2 0 M 9 5 L 0 5 M 9 5 L 2 10" stroke={cardColors.end} strokeWidth={1.5} fill="none" />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          cursor="pointer"
        />
        <path
          ref={pathRef}
          d={pathD}
          className={`relationship-path ${pathClass}`}
          style={{
            stroke: hovered ? undefined : baseColor,
            filter: hovered ? `drop-shadow(0 0 6px ${cardColors.end}80)` : undefined,
          }}
          fill="none"
          cursor="pointer"
          markerStart={
            !composite
              ? cardinalityKey === "one_to_one"
                ? `url(#one-start-${data.id})`
                : cardinalityKey === "one_to_many"
                  ? `url(#one-start-${data.id})`
                  : `url(#many-start-${data.id})`
              : undefined
          }
          markerEnd={
            !composite
              ? cardinalityKey === "one_to_one"
                ? `url(#one-end-${data.id})`
                : cardinalityKey === "one_to_many"
                  ? `url(#many-end-${data.id})`
                  : `url(#one-end-${data.id})`
              : undefined
          }
        />
        {settings.showRelationshipLabels && (
          <text
            x={labelX}
            y={labelY + 1}
            fill={cardColors.end}
            fontSize={14}
            fontWeight={700}
            fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
            textAnchor="middle"
          >
            {CARDINALITY_LABELS[cardinalityKey]}
          </text>
        )}
        {(composite || pathRef.current) && settings.showCardinality && (
          <>
            <CardinalityLabel
              x={cardinalityStartX}
              y={cardinalityStartY}
              text={cardinalityStart}
              color={cardColors.start}
              gradientId={`grad-start-${data.id}`}
            />
            <CardinalityLabel
              x={cardinalityEndX}
              y={cardinalityEndY}
              text={cardinalityEnd}
              color={cardColors.end}
              gradientId={`grad-end-${data.id}`}
            />
          </>
        )}
      </g>
      <SideSheet
        title={t("edit")}
        size="small"
        visible={
          selectedElement.element === ObjectType.RELATIONSHIP &&
          selectedElement.id === data.id &&
          selectedElement.open &&
          !layout.sidebar
        }
        onCancel={() => {
          setSelectedElement((prev) => ({
            ...prev,
            open: false,
          }));
        }}
        style={{ paddingBottom: "16px" }}
      >
        <div className="sidesheet-theme">
          <RelationshipInfo data={data} />
        </div>
      </SideSheet>
    </>
  );
}

function CardinalityLabel({ x, y, text, color, gradientId }) {
  const charCount = text.length;
  const fontSize = 11;
  const pillWidth = Math.max(charCount * 8 + 14, 24);
  const pillHeight = 24;

  return (
    <g className="cardinality-pill">
      <rect
        x={x - pillWidth / 2}
        y={y - pillHeight / 2}
        rx={pillHeight / 2}
        ry={pillHeight / 2}
        width={pillWidth}
        height={pillHeight}
        fill="#3b82f6"
      />
      <text
        x={x}
        y={y + fontSize * 0.35}
        fill="white"
        fontWeight={600}
        fontSize={fontSize}
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
}
