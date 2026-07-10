import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";

import type { CardDeck, CardPosition, FlowConnection } from "./cardDeck";
import { CardNode, type CardNodeData } from "./CardNode";

const nodeTypes = {
  card: CardNode,
} satisfies NodeTypes;

export type AuthoringSelection =
  | Readonly<{ kind: "card"; id: string }>
  | Readonly<{ kind: "connection"; id: string }>
  | undefined;

export type AuthoringCanvasProps = {
  deck: CardDeck;
  selection: AuthoringSelection;
  onSelect: (selection: AuthoringSelection) => void;
  onConnectCards: (from: string, to: string) => void;
  onMoveCard: (id: string, position: CardPosition) => void;
};

function edgeLabel(connection: FlowConnection): string | undefined {
  const mapping = connection.mapping?.trim();
  if (mapping) return mapping;
  const outcome = connection.outcome?.trim();
  if (outcome) return `output = ${outcome}`;
  return connection.contract?.trim() || undefined;
}

// The editable counterpart of the read-only FlowCanvas: its own React Flow
// instance (only one of the two is mounted at a time) with drag and connect
// enabled. The deck is the single source of truth — nodes and edges are
// derived, and only position changes are written back.
export function AuthoringCanvas({
  deck,
  selection,
  onSelect,
  onConnectCards,
  onMoveCard,
}: AuthoringCanvasProps) {
  const nodes = useMemo<Node<CardNodeData, "card">[]>(
    () =>
      deck.cards.map((card) => ({
        id: card.id,
        type: "card",
        position: card.position,
        data: { card, isSelected: selection?.kind === "card" && selection.id === card.id },
      })),
    [deck.cards, selection],
  );

  const edges = useMemo<Edge[]>(
    () =>
      deck.connections.map((connection) => {
        const label = edgeLabel(connection);
        const isSelected = selection?.kind === "connection" && selection.id === connection.id;
        return {
          id: connection.id,
          source: connection.from,
          target: connection.to,
          ...(label ? { label } : {}),
          className: isSelected ? "authoring-edge is-selected" : "authoring-edge",
          markerEnd: { type: MarkerType.ArrowClosed },
        };
      }),
    [deck.connections, selection],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<CardNodeData, "card">>[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          onMoveCard(change.id, change.position);
        }
      }
    },
    [onMoveCard],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        onConnectCards(connection.source, connection.target);
      }
    },
    [onConnectCards],
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onNodeClick={(_event, node) => onSelect({ kind: "card", id: node.id })}
        onEdgeClick={(_event, edge) => onSelect({ kind: "connection", id: edge.id })}
        onPaneClick={() => onSelect(undefined)}
        nodesDraggable
        nodesConnectable
        elementsSelectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
