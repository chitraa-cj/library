import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { Book, Verse } from "@shared/schema";

interface MindmapViewProps {
  onSelectVerse: (bookId: string, verseNumber: number) => void;
}

interface BookWithVerses extends Book {
  verses: Verse[];
}

interface MindmapNode {
  id: string;
  label: string;
  shortLabel: string;
  verseNumber: number;
  group: string;
  x: number;
  y: number;
}

const themeGroups: Record<string, { label: string; color: string; verses: number[] }> = {
  intro: { label: "Introduction", color: "#c2410c", verses: [0] },
  knowledge: { label: "Path of Knowledge", color: "#b45309", verses: [1, 2] },
  nature: { label: "Nature of Self", color: "#a16207", verses: [3, 4, 5] },
  unity: { label: "Unity & Freedom", color: "#4d7c0f", verses: [6, 7] },
  supreme: { label: "Supreme Self", color: "#0d9488", verses: [8] },
  vidya: { label: "Vidyā & Avidyā", color: "#0369a1", verses: [9, 10, 11] },
  worship: { label: "Worship & Results", color: "#7c3aed", verses: [12, 13, 14] },
  prayers: { label: "Final Prayers", color: "#be185d", verses: [15, 16, 17, 18] },
};

export function MindmapView({ onSelectVerse }: MindmapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { data: books = [], isLoading: booksLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const bookId = books[0]?.id;

  const { data: bookData, isLoading: bookLoading } = useQuery<BookWithVerses>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  const isLoading = booksLoading || bookLoading;
  const verses = bookData?.verses || [];

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.4));
  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-mindmap-node]")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslate({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("[data-mindmap-node]")) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - translate.x,
        y: e.touches[0].clientY - translate.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setTranslate({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (containerRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale((s) => Math.max(0.4, Math.min(2.5, s + delta)));
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Skeleton className="h-64 w-64 rounded-full" />
      </div>
    );
  }

  const centerX = 500;
  const centerY = 400;
  const groupEntries = Object.entries(themeGroups);
  const groupRadius = 220;
  const nodeRadius = 80;

  const groupPositions = groupEntries.map(([key, group], idx) => {
    const angle = (idx / groupEntries.length) * 2 * Math.PI - Math.PI / 2;
    return {
      key,
      ...group,
      x: centerX + groupRadius * Math.cos(angle),
      y: centerY + groupRadius * Math.sin(angle),
      angle,
    };
  });

  const nodes: MindmapNode[] = [];
  groupPositions.forEach((gp) => {
    const verseCount = gp.verses.length;
    gp.verses.forEach((vn, vi) => {
      const verse = verses.find((v) => v.verseNumber === vn);
      if (!verse) return;
      const spread = verseCount > 1 ? ((vi - (verseCount - 1) / 2) * 0.25) : 0;
      const nodeAngle = gp.angle + spread;
      const dist = groupRadius + nodeRadius;
      nodes.push({
        id: verse.id,
        label: verse.sectionTitle || `Verse ${vn}`,
        shortLabel: vn === 0 ? "Intro" : `${vn}`,
        verseNumber: vn,
        group: gp.key,
        x: centerX + dist * Math.cos(nodeAngle),
        y: centerY + dist * Math.sin(nodeAngle),
      });
    });
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs text-muted-foreground">
          Tap a node to read
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} data-testid="button-zoom-reset">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1000 800"
          className="w-full h-full"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {groupPositions.map((gp) => (
            <line
              key={`center-${gp.key}`}
              x1={centerX}
              y1={centerY}
              x2={gp.x}
              y2={gp.y}
              stroke={gp.color}
              strokeWidth="2"
              strokeOpacity="0.3"
              strokeDasharray="4 4"
            />
          ))}

          {nodes.map((node) => {
            const gp = groupPositions.find((g) => g.key === node.group)!;
            return (
              <line
                key={`line-${node.id}`}
                x1={gp.x}
                y1={gp.y}
                x2={node.x}
                y2={node.y}
                stroke={gp.color}
                strokeWidth="1.5"
                strokeOpacity="0.4"
              />
            );
          })}

          <circle cx={centerX} cy={centerY} r="45" fill="hsl(var(--primary))" fillOpacity="0.15" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.4" />
          <text x={centerX} y={centerY - 8} textAnchor="middle" className="text-2xl font-serif" fill="hsl(var(--primary))" fillOpacity="0.8">ॐ</text>
          <text x={centerX} y={centerY + 16} textAnchor="middle" className="text-[10px] font-medium" fill="hsl(var(--foreground))" fillOpacity="0.7">Īśāvāsyo-</text>
          <text x={centerX} y={centerY + 28} textAnchor="middle" className="text-[10px] font-medium" fill="hsl(var(--foreground))" fillOpacity="0.7">paniṣad</text>

          {groupPositions.map((gp) => (
            <g key={`group-${gp.key}`}>
              <circle cx={gp.x} cy={gp.y} r="30" fill={gp.color} fillOpacity="0.12" stroke={gp.color} strokeWidth="1.5" strokeOpacity="0.5" />
              <text x={gp.x} y={gp.y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[9px] font-medium" fill={gp.color}>
                {gp.label.length > 14 ? gp.label.slice(0, 12) + "..." : gp.label}
              </text>
            </g>
          ))}

          {nodes.map((node) => {
            const gp = groupPositions.find((g) => g.key === node.group)!;
            const isHovered = hoveredNode === node.id;
            return (
              <g
                key={`node-${node.id}`}
                data-mindmap-node
                className="cursor-pointer"
                onClick={() => bookId && onSelectVerse(bookId, node.verseNumber)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                data-testid={`mindmap-node-${node.verseNumber}`}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 24 : 20}
                  fill={gp.color}
                  fillOpacity={isHovered ? 0.25 : 0.15}
                  stroke={gp.color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={isHovered ? 0.8 : 0.5}
                  filter={isHovered ? "url(#glow)" : undefined}
                  style={{ transition: "all 0.2s ease" }}
                />
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-bold font-serif"
                  fill={gp.color}
                  style={{ pointerEvents: "none" }}
                >
                  {node.shortLabel}
                </text>
                {isHovered && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect
                      x={node.x - 70}
                      y={node.y - 50}
                      width="140"
                      height="24"
                      rx="4"
                      fill="hsl(var(--card))"
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />
                    <text
                      x={node.x}
                      y={node.y - 34}
                      textAnchor="middle"
                      className="text-[9px]"
                      fill="hsl(var(--foreground))"
                    >
                      {node.label.length > 28 ? node.label.slice(0, 26) + "..." : node.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
