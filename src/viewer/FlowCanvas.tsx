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
import type { LaneNodeData } from "./layoutHierarchy";

type LaneNodeType = Node<LaneNodeData, "laneGroup">;

function LaneGroup({ data }: NodeProps<LaneNodeType>) {
  return (
    <div className="lane-group" data-depth={data.depth}>
      <span className="lane-label">{data.label}</span>
    </div>
  );
}

const nodeTypes = {
  activity: ActivityNode,
  laneGroup: LaneGroup,
} satisfies NodeTypes;

export type FlowCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (nodeId: string) => void;
  toolbar?: React.ReactNode;
  overlay?: React.ReactNode;
};

export function FlowCanvas({ nodes, edges, onNodeClick, toolbar, overlay }: FlowCanvasProps) {
  return (
    <div className="flow-canvas">
      {toolbar && <div className="flow-toolbar">{toolbar}</div>}
      <div className="flow-body">
        {overlay && <div className="flow-overlay">{overlay}</div>}
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
