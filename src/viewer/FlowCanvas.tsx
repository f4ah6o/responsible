import React, { forwardRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
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
      {/* Invisible anchor so directed-effect edges can terminate at the lane. */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="lane-effect-handle"
      />
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
  notice?: React.ReactNode;
};

export const FlowCanvas = forwardRef<HTMLDivElement, FlowCanvasProps>(function FlowCanvas(
  { nodes, edges, onNodeClick, toolbar, overlay, notice },
  ref,
) {
  return (
    // Wraps toolbar + canvas so a toolbar child (e.g. ExportControl) can call
    // useReactFlow() even though it renders as a sibling of <ReactFlow>.
    <ReactFlowProvider>
      <div className="flow-canvas" ref={ref}>
        {toolbar && <div className="flow-toolbar">{toolbar}</div>}
        <div className="flow-body">
          {overlay && <div className="flow-overlay">{overlay}</div>}
          {notice && <div className="flow-notice">{notice}</div>}
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
    </ReactFlowProvider>
  );
});
