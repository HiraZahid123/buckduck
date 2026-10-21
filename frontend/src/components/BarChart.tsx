'use client';

import React, { useState } from 'react';

interface BarChartProps {
  data: any[];
  valueKey: string;
  labelKey: string;
  height?: number;
  color?: string;
  tipLabel?: string;
}

export default function BarChart({
  data = [],
  valueKey,
  labelKey,
  height = 220,
  color = 'var(--blue-600)',
  tipLabel = '',
}: BarChartProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (!data || data.length === 0) {
    return <div className="empty small center muted" style={{ padding: 40 }}>No data yet</div>;
  }

  const W = 640;
  const H = height;
  const pl = 52;
  const pb = 28;
  const pt = 10;
  const pr = 8;

  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / p;
  const nice = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;

  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const bw = Math.min(46, (iw / data.length) * 0.62);
  const step = iw / data.length;

  const gridLevels = [0, 0.5, 1];

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid lines & axis labels */}
        {gridLevels.map((g) => {
          const y = pt + ih - g * ih;
          const val = Math.round(nice * g);
          return (
            <g key={g}>
              <line
                x1={pl}
                x2={W - pr}
                y1={y}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={pl - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--ink-3)"
              >
                ${val.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0;
          const h = Math.max(2, (v / nice) * ih);
          const x = pl + i * step + (step - bw) / 2;
          const y = pt + ih - h;
          const r = Math.min(4, bw / 2);
          const path = `M${x},${pt + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${pt + ih} Z`;

          return (
            <g key={i}>
              <rect
                x={pl + i * step}
                y={pt}
                width={step}
                height={ih}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      text: `${d[labelKey]}${tipLabel ? ' · ' + tipLabel : ''}: $${v.toLocaleString()}`,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 10,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <path d={path} fill={color} pointerEvents="none" />
              <text
                x={x + bw / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--ink-3)"
              >
                {d[labelKey]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--navy-950)',
            color: '#fff',
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
