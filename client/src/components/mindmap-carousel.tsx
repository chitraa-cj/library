import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MindMapNode {
  label: string;
  x: number;
  y: number;
  size?: "lg" | "md" | "sm";
  children?: { label: string; x: number; y: number }[];
}

interface MindMapSlide {
  title: string;
  subtitle: string;
  centerLabel: string;
  nodes: MindMapNode[];
  accentColor?: string;
}

const slides: MindMapSlide[] = [
  {
    title: "Prasthāna Traya",
    subtitle: "The Three Pillars of Vedanta",
    centerLabel: "Advaita\nVedānta",
    nodes: [
      {
        label: "Upaniṣads",
        x: 50,
        y: 15,
        size: "md",
        children: [
          { label: "Īśā", x: 20, y: 8 },
          { label: "Kena", x: 38, y: 5 },
          { label: "Kaṭha", x: 62, y: 5 },
          { label: "Muṇḍaka", x: 80, y: 8 },
        ],
      },
      {
        label: "Bhagavad Gītā",
        x: 18,
        y: 65,
        size: "md",
        children: [
          { label: "Jñāna Yoga", x: 5, y: 50 },
          { label: "Karma Yoga", x: 5, y: 78 },
          { label: "Bhakti Yoga", x: 22, y: 85 },
        ],
      },
      {
        label: "Brahma Sūtra",
        x: 82,
        y: 65,
        size: "md",
        children: [
          { label: "Samanvaya", x: 95, y: 50 },
          { label: "Avirodha", x: 95, y: 65 },
          { label: "Sādhana", x: 95, y: 78 },
        ],
      },
    ],
  },
  {
    title: "Tat Tvam Asi",
    subtitle: "The Mahāvākyas — Great Utterances",
    centerLabel: "Brahman\n=\nĀtman",
    nodes: [
      {
        label: "प्रज्ञानं ब्रह्म",
        x: 50,
        y: 12,
        size: "md",
        children: [
          { label: "Consciousness is Brahman", x: 50, y: 4 },
        ],
      },
      {
        label: "अहं ब्रह्मास्मि",
        x: 12,
        y: 50,
        size: "md",
        children: [
          { label: "I am Brahman", x: 5, y: 38 },
        ],
      },
      {
        label: "तत्त्वमसि",
        x: 88,
        y: 50,
        size: "md",
        children: [
          { label: "Thou art That", x: 88, y: 38 },
        ],
      },
      {
        label: "अयमात्मा ब्रह्म",
        x: 50,
        y: 88,
        size: "md",
        children: [
          { label: "This Self is Brahman", x: 50, y: 96 },
        ],
      },
    ],
  },
  {
    title: "Pañca Kośa",
    subtitle: "The Five Sheaths of the Self",
    centerLabel: "Ātman\n(Pure Self)",
    nodes: [
      {
        label: "Annamaya",
        x: 50,
        y: 8,
        size: "sm",
        children: [
          { label: "Physical Body", x: 50, y: 2 },
        ],
      },
      {
        label: "Prāṇamaya",
        x: 15,
        y: 30,
        size: "sm",
        children: [
          { label: "Vital Energy", x: 5, y: 22 },
        ],
      },
      {
        label: "Manomaya",
        x: 85,
        y: 30,
        size: "sm",
        children: [
          { label: "Mind", x: 95, y: 22 },
        ],
      },
      {
        label: "Vijñānamaya",
        x: 15,
        y: 72,
        size: "sm",
        children: [
          { label: "Intellect", x: 5, y: 80 },
        ],
      },
      {
        label: "Ānandamaya",
        x: 85,
        y: 72,
        size: "sm",
        children: [
          { label: "Bliss", x: 95, y: 80 },
        ],
      },
    ],
  },
  {
    title: "Avasthā Traya",
    subtitle: "Three States of Consciousness",
    centerLabel: "Turīya\n(The Fourth)",
    nodes: [
      {
        label: "Jāgrat",
        x: 18,
        y: 30,
        size: "md",
        children: [
          { label: "Waking State", x: 5, y: 18 },
          { label: "Viśva (Individual)", x: 5, y: 40 },
        ],
      },
      {
        label: "Svapna",
        x: 82,
        y: 30,
        size: "md",
        children: [
          { label: "Dream State", x: 95, y: 18 },
          { label: "Taijasa (Luminous)", x: 95, y: 40 },
        ],
      },
      {
        label: "Suṣupti",
        x: 50,
        y: 85,
        size: "md",
        children: [
          { label: "Deep Sleep", x: 35, y: 95 },
          { label: "Prājña (Knower)", x: 65, y: 95 },
        ],
      },
    ],
  },
  {
    title: "Sādhanā Catuṣṭaya",
    subtitle: "Four Qualifications for Liberation",
    centerLabel: "Mokṣa\n(Liberation)",
    nodes: [
      {
        label: "Viveka",
        x: 50,
        y: 10,
        size: "md",
        children: [
          { label: "Discrimination", x: 50, y: 2 },
        ],
      },
      {
        label: "Vairāgya",
        x: 10,
        y: 50,
        size: "md",
        children: [
          { label: "Dispassion", x: 3, y: 38 },
        ],
      },
      {
        label: "Ṣaṭ-sampatti",
        x: 90,
        y: 50,
        size: "md",
        children: [
          { label: "Six Virtues", x: 90, y: 38 },
        ],
      },
      {
        label: "Mumukṣutva",
        x: 50,
        y: 90,
        size: "md",
        children: [
          { label: "Desire for Freedom", x: 50, y: 98 },
        ],
      },
    ],
  },
];

function MindMapSVG({ slide, isActive }: { slide: MindMapSlide; isActive: boolean }) {
  const centerX = 50;
  const centerY = 50;

  return (
    <div className={`absolute inset-0 transition-opacity duration-700 ${isActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className="absolute inset-0 flex flex-col">
        <div className="text-center pt-3 sm:pt-4 px-4 shrink-0">
          <h3 className="font-serif text-sm sm:text-lg font-semibold text-primary" data-testid={`text-mindmap-title-${slide.title.replace(/\s+/g, '-').toLowerCase()}`}>
            {slide.title}
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{slide.subtitle}</p>
        </div>

        <div className="flex-1 relative min-h-0">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id={`center-glow-${slide.title}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="0.3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx={centerX} cy={centerY} r="18" fill={`url(#center-glow-${slide.title})`} />

            {slide.nodes.map((node, i) => (
              <g key={i}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={node.x}
                  y2={node.y}
                  stroke="hsl(var(--primary))"
                  strokeOpacity="0.2"
                  strokeWidth="0.3"
                  strokeDasharray="1 0.5"
                />
                {node.children?.map((child, j) => (
                  <line
                    key={j}
                    x1={node.x}
                    y1={node.y}
                    x2={child.x}
                    y2={child.y}
                    stroke="hsl(var(--primary))"
                    strokeOpacity="0.12"
                    strokeWidth="0.2"
                    strokeDasharray="0.5 0.5"
                  />
                ))}
              </g>
            ))}

            <circle
              cx={centerX}
              cy={centerY}
              r="10"
              fill="hsl(var(--primary))"
              fillOpacity="0.08"
              stroke="hsl(var(--primary))"
              strokeOpacity="0.3"
              strokeWidth="0.3"
            />
            <circle
              cx={centerX}
              cy={centerY}
              r="9"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeOpacity="0.15"
              strokeWidth="0.15"
            />
            {slide.centerLabel.split("\n").map((line, i, arr) => (
              <text
                key={i}
                x={centerX}
                y={centerY + (i - (arr.length - 1) / 2) * 3.2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="hsl(var(--primary))"
                fontSize="2.8"
                fontFamily="var(--font-serif)"
                fontWeight="600"
              >
                {line}
              </text>
            ))}

            {slide.nodes.map((node, i) => {
              const r = node.size === "lg" ? 7 : node.size === "sm" ? 4.5 : 5.5;
              return (
                <g key={`node-${i}`}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--primary))"
                    strokeOpacity="0.35"
                    strokeWidth="0.25"
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="hsl(var(--foreground))"
                    fontSize={node.size === "sm" ? "1.8" : "2.1"}
                    fontFamily="var(--font-serif)"
                    fontWeight="500"
                  >
                    {node.label}
                  </text>

                  {node.children?.map((child, j) => (
                    <text
                      key={`child-${j}`}
                      x={child.x}
                      y={child.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="hsl(var(--muted-foreground))"
                      fontSize="1.6"
                      fontFamily="var(--font-sans)"
                    >
                      {child.label}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

export function MindMapCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, []);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(goNext, 6000);
    return () => clearInterval(interval);
  }, [isPaused, goNext]);

  return (
    <div
      className="relative w-full aspect-[16/9] sm:aspect-[2.2/1] max-h-[320px] sm:max-h-[360px] rounded-xl border border-primary/15 bg-gradient-to-br from-card/90 via-background to-accent/10 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-testid="mindmap-carousel"
    >
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 text-3xl sm:text-5xl text-primary/[0.04] font-serif select-none pointer-events-none">ॐ</div>
      <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-2xl sm:text-4xl text-primary/[0.04] font-serif select-none pointer-events-none rotate-12">श्री</div>

      {slides.map((slide, i) => (
        <MindMapSVG key={i} slide={slide} isActive={i === activeIndex} />
      ))}

      <Button
        variant="ghost"
        size="icon"
        className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-background/50 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
        data-testid="button-mindmap-prev"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-background/50 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); goNext(); }}
        data-testid="button-mindmap-next"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-5 h-1.5 bg-primary/70"
                : "w-1.5 h-1.5 bg-primary/25 hover:bg-primary/40"
            }`}
            onClick={() => setActiveIndex(i)}
            data-testid={`button-mindmap-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}