import {
  Sun,
  Globe2,
  Palette,
  Trees,
  Heart,
  Sailboat,
  Sprout,
  Coffee,
  FlaskConical,
} from "lucide-react";
import { dreams, innerBoard, fastTrackBoard } from "../game/content";
import type { GameState, Player, Space } from "../game/types";
const colors: Record<string, { bg: string; fg: string }> = {
  payday: { bg: "#e6bc61", fg: "#664b21" },
  opportunity: { bg: "#d6e5d4", fg: "#386553" },
  business: { bg: "#d6e5d4", fg: "#386553" },
  market: { bg: "#d8e8eb", fg: "#4b7887" },
  expense: { bg: "#f0d6cc", fg: "#a76650" },
  charity: { bg: "#e3ddeb", fg: "#8a739c" },
  baby: { bg: "#f2e1d0", fg: "#ae8a63" },
  downsized: { bg: "#e3ddeb", fg: "#8a739c" },
  dream: { bg: "#f1e0ae", fg: "#a28635" },
  audit: { bg: "#f0d6cc", fg: "#a76650" },
  divorce: { bg: "#e3ddeb", fg: "#8a739c" },
  lawsuit: { bg: "#f0d6cc", fg: "#a76650" },
};
export function Avatar({
  player,
  size = 40,
}: {
  player: Pick<Player, "name" | "color" | "id">;
  size?: number;
}) {
  const i = Number(player.id.replace("p", "")) || 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={player.name}
      className="avatar"
    >
      <defs>
        <clipPath id={`av-${player.id}-${size}`}>
          <circle cx="32" cy="32" r="31" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av-${player.id}-${size})`}>
        <circle
          cx="32"
          cy="32"
          r="32"
          fill={
            [
              "#deebe2",
              "#f4e6cf",
              "#e7e2ef",
              "#f3ded6",
              "#dceaf0",
              "#e6ebd7",
              "#ebe0f0",
              "#d8ecee",
              "#f4decc",
            ][i]
          }
        />
        <path d="M9 65c1-18 10-26 23-26s22 8 23 26" fill={player.color} />
        <path
          d="M26 37v9q6 7 12 0V36"
          fill={
            [
              "#d4a37f",
              "#b87755",
              "#e6bda0",
              "#ad7355",
              "#d4a37f",
              "#956047",
              "#9a674c",
              "#ca976e",
              "#b47753",
            ][i]
          }
        />
        <ellipse
          cx="32"
          cy="27"
          rx="14"
          ry="17"
          fill={
            [
              "#edc4a4",
              "#d89b73",
              "#f3d4b8",
              "#cd956f",
              "#e9bc96",
              "#bd855e",
              "#be8967",
              "#edc19a",
              "#d89d75",
            ][i]
          }
        />
        <path
          d={
            i % 2 === 0
              ? "M17 28V19C17 2 47 3 47 21v11l-5-13c-6 6-14 7-21 4l-3 10z"
              : "M17 32C7 12 24 5 33 7 51 5 53 24 46 36l-5-16c-10 5-17 1-18 0z"
          }
          fill={
            [
              "#343d35",
              "#343331",
              "#695040",
              "#3c3533",
              "#604739",
              "#303730",
              "#2e2c30",
              "#282f35",
              "#704832",
            ][i]
          }
        />
        <circle cx="27" cy="29" r="1.3" fill="#3d3630" />
        <circle cx="37" cy="29" r="1.3" fill="#3d3630" />
        <path
          d="M28 36q4 3 8 0"
          fill="none"
          stroke="#8e5f4f"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        {i === 0 && (
          <g stroke="#50665b" strokeWidth="1.4" fill="none">
            <rect x="21" y="25" width="9" height="7" rx="2" />
            <rect x="34" y="25" width="9" height="7" rx="2" />
            <path d="M30 28h4" />
          </g>
        )}
        <path
          d="M23 47l9 8 9-8"
          fill="none"
          stroke="#fff"
          strokeOpacity=".5"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
function track(
  cols: number,
  rows: number,
  x: number,
  y: number,
  step: number,
): [number, number][] {
  const p: [number, number][] = [];
  for (let c = 0; c < cols; c++) p.push([x + c * step, y]);
  for (let r = 1; r < rows; r++) p.push([x + (cols - 1) * step, y + r * step]);
  for (let c = cols - 2; c >= 0; c--)
    p.push([x + c * step, y + (rows - 1) * step]);
  for (let r = rows - 2; r > 0; r--) p.push([x, y + r * step]);
  return p;
}
const outer = track(10, 8, 70, 65, 95),
  inner = track(8, 6, 165, 160, 95);
function Symbol({ kind, x, y }: { kind: string; x: number; y: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <g transform={`translate(${x - 13},${y - 13})`} {...common}>
      {kind === "payday" ? (
        <>
          <circle cx="13" cy="13" r="11" />
          <path d="M16 7h-5a3 3 0 000 6h4a3 3 0 010 6h-5M13 4v18" />
        </>
      ) : kind === "opportunity" || kind === "business" ? (
        <>
          <rect x="3" y="8" width="20" height="15" rx="3" />
          <path d="M8 8V4h10v4M3 14q10 6 20 0M13 14v5" />
        </>
      ) : kind === "market" ? (
        <>
          <path d="M3 22h21M5 17v-5M12 17V8M19 17V3M3 10l7-5 6 2 8-6" />
        </>
      ) : kind === "dream" ? (
        <>
          <path d="M13 2l3 7 8 1-6 6 2 8-7-4-7 4 2-8-6-6 8-1z" />
        </>
      ) : kind === "charity" ? (
        <>
          <path d="M13 23S1 16 2 9C3 2 11 2 13 8c3-6 11-6 12 1 1 6-12 14-12 14z" />
        </>
      ) : kind === "expense" ? (
        <>
          <path d="M4 8h18v15H4zM8 8V5a5 5 0 0110 0v3M9 13h0M17 13h0" />
        </>
      ) : kind === "baby" ? (
        <>
          <circle cx="13" cy="14" r="10" />
          <path d="M13 4q7-5 3 3M8 12h0M18 12h0M9 18q4 3 8 0" />
        </>
      ) : (
        <>
          <path d="M13 3l11 20H2zM13 10v5M13 19h0" />
        </>
      )}
    </g>
  );
}
export function CityArt() {
  return (
    <g>
      <ellipse cx="504" cy="480" rx="224" ry="52" fill="#dde5d6" />
      <path d="M281 475l116-58 228 14 97 44-208 64z" fill="#eae9db" />
      <path
        d="M309 468l198 18 175-26M399 425l-5 77M579 433l17 73"
        fill="none"
        stroke="#fffaf0"
        strokeWidth="11"
      />
      <path
        d="M309 468l198 18 175-26"
        fill="none"
        stroke="#c9cdbd"
        strokeWidth="1.6"
        strokeDasharray="6 7"
      />
      <g>
        <path d="M365 433V332l65-22 56 27v108l-53 18z" fill="#e1b68e" />
        <path d="M430 310v153l56-18V337z" fill="#cfa078" />
        <path d="M356 333l74-31 65 31-64 25z" fill="#759b86" />
        {[0, 1, 2].map((r) => (
          <g key={r}>
            {[0, 1, 2].map((c) => (
              <path
                key={c}
                d={`M${375 + c * 17} ${352 + r * 27}v15l9 3v-15z`}
                fill="#fff5db"
              />
            ))}
            <path
              d={`M445 ${355 + r * 27}v15l12-4v-15zM465 ${348 + r * 27}v15l10-4v-15z`}
              fill="#f7e2c1"
            />
          </g>
        ))}
        <path d="M405 444v-28l14 4v29" fill="#687e6c" />
      </g>
      <g>
        <path d="M498 432V282l57-24 60 28v155l-55 25z" fill="#a9c5b9" />
        <path d="M555 258v208l60-25V286z" fill="#83ac99" />
        <path d="M491 283l64-31 68 31-65 29z" fill="#cbd7c2" />
        <path d="M535 265v-28l12-6v29" fill="#afc2b2" />
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            {[0, 1, 2].map((c) => (
              <path
                key={c}
                d={`M${507 + c * 15} ${313 + r * 29}v17l8 3v-17z`}
                fill="#eaf0d9"
              />
            ))}
            <path
              d={`M570 ${319 + r * 29}v17l11-5v-17zM589 ${310 + r * 29}v17l11-5v-17z`}
              fill="#c8dfcc"
            />
          </g>
        ))}
        <path d="M534 451v-26l13 4v28" fill="#426e5c" />
      </g>
      <g>
        <path d="M610 468v-77l40-17 43 20v77l-40 21z" fill="#eacbb0" />
        <path d="M650 374v118l43-21v-77z" fill="#dcb695" />
        <path d="M601 393l49-41 52 44-49 22z" fill="#cc8971" />
        <path
          d="M621 417v17l13 5v-17zM665 421v17l13-6v-17zM666 454v27l13-6v-27z"
          fill="#fbf0d5"
        />
        <path d="M611 452l35 13v12l-35-13z" fill="#739f8a" />
      </g>
      <g>
        <path d="M315 460v-47l31-14 32 15v47l-31 15z" fill="#eac582" />
        <path d="M347 399v77l31-15v-47z" fill="#d4ae6d" />
        <path d="M307 414l39-27 40 29-40 17z" fill="#80998b" />
        <path d="M325 433v17l12 5v-17zM356 434v17l11-5v-17z" fill="#fff3cf" />
      </g>
      {[
        [300, 434],
        [334, 486],
        [471, 472],
        [628, 507],
        [704, 447],
        [670, 356],
        [355, 369],
      ].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + 14} rx="13" ry="5" fill="#c2d3bb" />
          <path d={`M${x} ${y + 15}v-31`} stroke="#8b9272" strokeWidth="3" />
          <ellipse
            cx={x}
            cy={y - 19}
            rx="14"
            ry="22"
            fill={i % 2 ? "#7f9f79" : "#9db78b"}
          />
          <path d={`M${x} ${y + 5}v-30`} stroke="#72936a" strokeWidth="1.2" />
        </g>
      ))}
      <g fill="#f8f8ed">
        <path d="M307 292q-12-15-27 0-19 0-16 12h68q4-12-13-12z" />
        <path d="M663 283q-12-15-27 0-19 0-16 12h68q4-12-13-12z" />
      </g>
      <circle cx="692" cy="244" r="23" fill="#e9c36c" opacity=".7" />
      <path
        d="M472 267l8-5 8 4M618 245l7-5 8 4"
        stroke="#8e9c83"
        strokeWidth="2"
        fill="none"
      />
    </g>
  );
}
export default function Board({ game }: { game: GameState }) {
  const outerBoard = fastTrackBoard(game.players);
  const chosenDreams = dreams.filter((d) =>
    game.players.some((p) => p.dream === d.id),
  );
  const humanDream = dreams.find((d) => d.id === game.players[0].dream)!;
  const dreamSpace =
    outerBoard.findIndex((s) => s.content === humanDream.id) + 1;
  const dreamIcons = {
    sun: Sun,
    globe: Globe2,
    palette: Palette,
    tree: Trees,
    heart: Heart,
    sail: Sailboat,
    leaf: Sprout,
    coffee: Coffee,
    science: FlaskConical,
  };
  const dreamLabels: Record<string, string> = {
    coast: "COASTAL HOME",
    travel: "WORLD TRAVEL",
    studio: "ART STUDIO",
    forest: "FOREST CABIN",
    foundation: "FOUNDATION",
    sailing: "OCEAN VOYAGE",
    farm: "LITTLE FARM",
    time: "A YEAR OFF",
    research: "SCIENCE LAB",
  };
  function spaces(
    board: Space[],
    points: [number, number][],
    stage: "rat" | "fast",
  ) {
    return board.map((space, i) => {
      const [x, y] = points[i],
        c = colors[space.kind],
        players = game.players.filter(
          (p) => p.stage === stage && p.position === i && !p.eliminated,
        ),
        active = players.some((p) => p.id === game.players[game.current].id),
        claimed = space.content && game.claimed.includes(space.content);
      const dream =
        space.kind === "dream"
          ? dreams.find((d) => d.id === space.content)
          : undefined;
      const yours = dream?.id === humanDream.id;
      const DreamIcon = dream
        ? dreamIcons[dream.icon as keyof typeof dreamIcons]
        : null;
      return (
        <g
          key={`${stage}${i}`}
          className={`board-space ${active ? "active-space" : ""} ${yours ? "your-dream-space" : ""}`}
          tabIndex={0}
          aria-label={`${stage === "rat" ? "Inner" : "Outer"} track, space ${i + 1}: ${space.label}${yours ? ". Your dream" : ""}${players.length ? `. ${players.map((p) => p.name).join(", ")} here` : ""}`}
        >
          <title>
            {space.label}
            {yours ? " · YOUR DREAM" : ""}
            {claimed ? " · Owned" : ""}
          </title>
          {yours && (
            <rect
              x={x - 43}
              y={y - 42}
              width="86"
              height="84"
              rx="17"
              fill="none"
              stroke="#9b6720"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          )}
          <rect
            x={x - 39}
            y={y - 38}
            width="78"
            height="76"
            rx="13"
            fill={yours ? "#ffe5a0" : c.bg}
            stroke={yours ? "#704a14" : active ? "#245e50" : "#f9f8ee"}
            strokeWidth={yours || active ? 3 : 2}
          />
          <g style={{ color: dream ? "#74551c" : c.fg }}>
            {DreamIcon ? (
              <DreamIcon
                x={x - 17}
                y={y - 25}
                width={34}
                height={34}
                strokeWidth={1.6}
              />
            ) : (
              <Symbol kind={space.kind} x={x} y={y - 6} />
            )}
          </g>
          <text
            x={x}
            y={y + 24}
            textAnchor="middle"
            fill={dream ? "#74551c" : c.fg}
            fontSize="9.5"
            fontWeight="600"
            fontFamily="inherit"
          >
            {space.kind === "business"
              ? "BUSINESS"
              : space.kind === "dream"
                ? dreamLabels[space.content!]
                : space.kind === "opportunity"
                  ? "OPPORTUNITY"
                  : space.kind === "expense"
                    ? "LIFE HAPPENS"
                    : space.label.toUpperCase()}
          </text>
          {yours && (
            <g>
              <rect
                x={x - 33}
                y={y + 31}
                width="66"
                height="15"
                rx="5"
                fill="#704a14"
              />
              <text
                x={x}
                y={y + 42}
                textAnchor="middle"
                fill="#fffdf5"
                fontSize="8"
                fontWeight="800"
              >
                YOUR DREAM
              </text>
            </g>
          )}
          {claimed && <circle cx={x + 27} cy={y - 25} r="5" fill="#386553" />}
        </g>
      );
    });
  }
  return (
    <div className="board-wrap">
      <svg
        className="game-board"
        viewBox="0 0 1000 805"
        role="group"
        aria-label="Game board: a 24-space Rat Race inside a 32-space Fast Track"
      >
        <rect x="15" y="10" width="970" height="785" rx="32" fill="#f0f0e4" />
        <rect x="113" y="112" width="774" height="582" rx="26" fill="#e7ebdc" />
        <rect x="211" y="207" width="579" height="391" rx="22" fill="#e3e9db" />
        {spaces(outerBoard, outer, "fast")}
        {spaces(innerBoard, inner, "rat")}
        <CityArt />
        {game.players
          .filter((p) => !p.eliminated)
          .map((p) => {
            const [x, y] = (p.stage === "rat" ? inner : outer)[p.position];
            const group = game.players.filter(
              (v) =>
                !v.eliminated &&
                v.stage === p.stage &&
                v.position === p.position,
            );
            const index = group.findIndex((v) => v.id === p.id),
              clustered = group.length > 4,
              offset = clustered
                ? ((index % 3) - 1) * 21
                : -(group.length - 1) * 9 + index * 18,
              offsetY = clustered ? Math.floor(index / 3) * 21 - 10 : 0;
            return (
              <g
                key={p.id}
                className="board-token"
                style={{
                  transform: `translate(${x + offset}px,${y - 40 + offsetY}px)`,
                }}
                aria-label={`${p.name}'s token`}
              >
                <circle
                  r={clustered ? 10 : 13}
                  fill={p.color}
                  stroke="#fffdf5"
                  strokeWidth="3"
                />
                <text
                  y="4"
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="700"
                >
                  {p.human ? "Y" : p.name[0]}
                </text>
              </g>
            );
          })}
        <text
          x="500"
          y="553"
          textAnchor="middle"
          fill="#3e6451"
          fontSize="18"
          letterSpacing="5"
          fontWeight="700"
        >
          THE CITY IS YOURS
        </text>
        <text x="500" y="575" textAnchor="middle" fill="#7a8b70" fontSize="12">
          Build a life beyond the paycheck.
        </text>
        <g transform="translate(265 222)">
          <circle r="4" fill="#4f8870" />
          <text x="12" y="4" fontSize="10" fill="#5e7964" letterSpacing="1.5">
            RAT RACE
          </text>
        </g>
        <text
          x="855"
          y="795"
          textAnchor="middle"
          fontSize="9"
          fill="#8d947d"
          letterSpacing="2"
        >
          THE FAST TRACK ↗
        </text>
      </svg>
      <details className="dream-map-key">
        <summary>
          <span aria-hidden="true">★</span> Your dream: {humanDream.name}{" "}
          <span>
            Outer space {dreamSpace} · {chosenDreams.length} dreams in this
            match
          </span>
        </summary>
        <ul>
          {chosenDreams.map((d) => (
            <li key={d.id}>
              <strong>
                {d.name}
                {d.id === humanDream.id ? " · Yours ★" : ""}
              </strong>
              <span>
                Outer space{" "}
                {outerBoard.findIndex((s) => s.content === d.id) + 1} ·{" "}
                {game.players
                  .filter((p) => p.dream === d.id)
                  .map((p) => p.name)
                  .join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
