import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isRtl } from "../../utils/languages.js";

/**
 * Difficulty of each question in the order it was served (step line, 1-5),
 * with a marker per question: filled circle = correct, hollow square = not
 * correct (shape AND color, so it works without color). Hover/focus shows a
 * tooltip; a visually hidden table carries the same data. In right-to-left
 * languages the time axis runs right to left.
 */
const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 34, left: 40 };

function DifficultyPathChart({ path }) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState(null);
  const points = path.filter((p) => p.difficulty);
  if (!points.length) return <p className="text-sm text-ink-muted">{t("learning.noPath")}</p>;

  const rtl = isRtl(i18n.language);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xOf = (i) => {
    const x = points.length > 1 ? PAD.left + i * step : PAD.left + innerW / 2;
    return rtl ? W - x : x;
  };
  const yOf = (d) => PAD.top + innerH - ((d - 1) / 4) * innerH;
  // Step line: level until the next question, then jump to its difficulty.
  const line = points
    .map((p, i) => (i === 0 ? `M${xOf(0)},${yOf(p.difficulty)}` : `H${xOf(i)} V${yOf(p.difficulty)}`))
    .join(" ");
  const status = (p) => (p.correct ? t("review.state.correct") : p.answered ? t("review.state.wrong") : t("review.state.unanswered"));

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("learning.pathLabel")}>
          {[1, 2, 3, 4, 5].map((d) => (
            <g key={d}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(d)} y2={yOf(d)} className="stroke-line" strokeWidth="1" />
              <text x={rtl ? W - PAD.left + 14 : PAD.left - 14} y={yOf(d) + 4} textAnchor="middle" className="fill-ink-subtle text-[11px]">
                {d}
              </text>
            </g>
          ))}
          <path d={line} fill="none" className="stroke-primary-600" strokeWidth="2" strokeLinejoin="round" />
          {points.map((p, i) => {
            const x = xOf(i);
            const y = yOf(p.difficulty);
            const tip = t("learning.pathTip", { number: p.index, difficulty: p.difficulty, status: status(p) });
            return (
              <g
                key={p.index}
                tabIndex={0}
                onMouseEnter={() => setHover({ x, y, tip })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ x, y, tip })}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none"
              >
                <title>{tip}</title>
                {/* Larger invisible hit target than the mark */}
                <circle cx={x} cy={y} r="12" fill="transparent" />
                {p.correct ? (
                  <circle cx={x} cy={y} r="5.5" className="fill-success-600 stroke-surface" strokeWidth="2" />
                ) : (
                  <rect x={x - 5} y={y - 5} width="10" height="10" rx="1.5" className="fill-surface stroke-danger-600" strokeWidth="2" />
                )}
              </g>
            );
          })}
          <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-ink-subtle text-[11px]">
            {t("learning.pathXAxis")}
          </text>
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control bg-ink px-2 py-1 text-xs text-white shadow-raised"
            style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, marginTop: -10 }}
            role="tooltip"
          >
            {hover.tip}
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="5" className="fill-success-600" />
          </svg>
          {t("review.state.correct")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" className="fill-surface stroke-danger-600" strokeWidth="2" />
          </svg>
          {t("learning.notCorrect")}
        </span>
        <span>{t("learning.pathYAxis")}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{t("learning.pathLabel")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("learning.question")}</th>
            <th scope="col">{t("bank.difficultyLabel")}</th>
            <th scope="col">{t("users.status")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.index}>
              <td>{p.index}</td>
              <td>{p.difficulty}</td>
              <td>{status(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default DifficultyPathChart;
