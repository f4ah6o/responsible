import React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";

import { ActivityNode } from "./ActivityNode";
import type { LaneNodeData, LaneSeparatorData } from "./layoutHierarchy";

type LaneNodeType = Node<LaneNodeData, "laneGroup">;
type LaneSeparatorType = Node<LaneSeparatorData, "laneSeparator">;

function LaneGroup({ data }: NodeProps<LaneNodeType>) {
  return (
    <div className="lane-group">
      <span className="lane-label">{data.label}</span>
    </div>
  );
}

function LaneSeparator({ data }: NodeProps<LaneSeparatorType>) {
  return <div className="lane-separator">{data.label}</div>;
}

const nodeTypes = {
  activity: ActivityNode,
  laneGroup: LaneGroup,
  laneSeparator: LaneSeparator,
} satisfies NodeTypes;

export type FlowCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (nodeId: string) => void;
  toolbar?: React.ReactNode;
};

export function FlowCanvas({ nodes, edges, onNodeClick, toolbar }: FlowCanvasProps) {
  return (
    <div className="flow-canvas">
      {toolbar && <div className="flow-toolbar">{toolbar}</div>}
      <div className="flow-body">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_event, node) => onNodeClick(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.15, includeHiddenNodes: false }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
