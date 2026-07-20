"use client";

import { useEffect, useRef, useState } from "react";
import {
  sankey,
  sankeyLinkHorizontal,
  type SankeyNodeMinimal,
  type SankeyLinkMinimal,
} from "d3-sankey";
import type { SankeyData } from "@/lib/types";
import { GROUPS } from "@/lib/categories";
import { CATEGORICAL, CHART } from "@/lib/palette";
import { money0 } from "@/lib/format";

type N = SankeyNodeMinimal<{ name: string }, object> & { name: string };
type L = SankeyLinkMinimal<{ name: string }, object>;

const GREEN = "#199e70";

// Color a node by role: income hub/sources/savings are green; expense groups
// take a stable categorical hue; leaves inherit their parent group's hue.
function nodeColors(nodes: { name: string }[], links: SankeyData["links"]): string[] {
  const colors = new Array<string>(nodes.length).fill("");
  const expenseGroups = GROUPS.filter((g) => g !== "Income");

  nodes.forEach((n, i) => {
    if (n.name === "Income" || n.name === "Savings") colors[i] = GREEN;
    const gi = expenseGroups.indexOf(n.name as (typeof expenseGroups)[number]);
    if (gi >= 0) colors[i] = CATEGORICAL[gi % CATEGORICAL.length];
  });

  // Sources feeding the Income hub are income → green.
  const hubIndex = nodes.findIndex((n) => n.name === "Income");
  for (const l of links) {
    if (l.target === hubIndex && !colors[l.source]) colors[l.source] = GREEN;
  }
  // Leaves inherit their parent group's color.
  for (const l of links) {
    if (!colors[l.target] && colors[l.source]) colors[l.target] = colors[l.source];
  }
  // Fallback.
  return colors.map((c) => c || CHART.textMuted);
}

export function SankeyChart({ data }: { data: SankeyData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data.nodes.length) return null;

  const colors = nodeColors(data.nodes, data.links);
  const leafCount = data.nodes.filter(
    (_, i) => !data.links.some((l) => l.source === i)
  ).length;

  // Fit the whole flow into the card; labels sit above nodes so columns don't
  // collide even at phone width.
  const canvasWidth = width;
  const height = Math.max(380, leafCount * 40);
  const padX = 6;

  const layout = sankey<{ name: string }, object>()
    .nodeWidth(12)
    .nodePadding(22)
    .extent([
      [padX, 20],
      [canvasWidth - padX, height - 8],
    ]);

  const graph = layout({
    nodes: data.nodes.map((d) => ({ ...d })),
    links: data.links.map((d) => ({ ...d })),
  });

  const total =
    graph.nodes.find((n) => (n as N).name === "Income")?.value ?? 0;
  const maxDepth = Math.max(...(graph.nodes as N[]).map((n) => n.depth ?? 0));

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <svg width={canvasWidth} height={height} className="block">
        {/* links */}
        <g fill="none">
          {(graph.links as (L & { width?: number })[]).map((l, i) => {
            const targetIdx = data.links[i]?.target ?? -1;
            const color = colors[targetIdx] ?? CHART.textMuted;
            return (
              <path
                key={i}
                d={sankeyLinkHorizontal()(l as never) ?? undefined}
                stroke={color}
                strokeOpacity={0.28}
                strokeWidth={Math.max(1, l.width ?? 1)}
              />
            );
          })}
        </g>
        {/* nodes */}
        <g>
          {(graph.nodes as N[]).map((n, i) => {
            const x0 = n.x0 ?? 0;
            const y0 = n.y0 ?? 0;
            const x1 = n.x1 ?? 0;
            const y1 = n.y1 ?? 0;
            const pct = total > 0 ? ((n.value ?? 0) / total) * 100 : 0;
            // Labels sit above the node bar (in the padding gap) so columns
            // never overlap. The tall central hub is the exception: center it
            // vertically to its left, clear of the group labels.
            const isHub = n.name === "Income";
            const isLast = (n.depth ?? 0) === maxDepth;
            const labelX = isHub ? x0 - 6 : isLast ? x1 : x0;
            const labelY = isHub ? (y0 + y1) / 2 : y0 - 6;
            return (
              <g key={i}>
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={Math.max(1, y1 - y0)}
                  fill={colors[i]}
                  rx={2}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={isHub || isLast ? "end" : "start"}
                  dominantBaseline={isHub ? "middle" : "auto"}
                  fontSize={11}
                  fill={CHART.textPrimary}
                >
                  <tspan fontWeight={600}>{n.name}</tspan>
                  <tspan fill={CHART.textMuted}>
                    {"  "}
                    {money0(n.value ?? 0)} ({pct.toFixed(0)}%)
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
