import type { GameThemeId } from "@/lib/game-themes";

/** タイピング画面用：テーマの「それっぽい」簡易 SVG イラスト（オリジナル図形） */
export function TypingCategoryArt({ theme }: { theme: GameThemeId }) {
  const common = "mx-auto block max-h-36 w-full max-w-[200px] drop-shadow-lg";

  switch (theme) {
    case "manabi":
      return (
        <svg className={common} viewBox="0 0 110 100" aria-hidden>
          <title>学び（本と鉛筆）</title>
          <rect x="18" y="22" width="56" height="68" rx="3" fill="#1E3A8A" stroke="#172554" strokeWidth="2" />
          <rect x="24" y="30" width="44" height="48" fill="#F8FAFC" opacity="0.95" />
          <line x1="30" y1="40" x2="62" y2="40" stroke="#64748B" strokeWidth="2" />
          <line x1="30" y1="50" x2="58" y2="50" stroke="#64748B" strokeWidth="2" />
          <line x1="30" y1="60" x2="60" y2="60" stroke="#64748B" strokeWidth="2" />
          <path d="M72 18 L95 28 L88 72 L65 62 Z" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <polygon points="78,12 82,22 72,20" fill="#FDE68A" stroke="#B45309" strokeWidth="1" />
          <g stroke="#10B981" strokeWidth="2" strokeLinecap="round">
            <line x1="28" y1="84" x2="40" y2="84" />
            <line x1="34" y1="78" x2="34" y2="90" />
            <line x1="48" y1="84" x2="60" y2="84" />
            <line x1="66" y1="78" x2="74" y2="90" />
            <line x1="74" y1="78" x2="66" y2="90" />
          </g>
        </svg>
      );
    case "norimono":
      return (
        <svg className={common} viewBox="0 0 130 90" aria-hidden>
          <title>乗り物（電車と飛行機）</title>
          <ellipse cx="95" cy="28" rx="32" ry="12" fill="#E0E7FF" stroke="#4338CA" strokeWidth="2" />
          <path d="M65 32 L125 24 L128 32 L70 38 Z" fill="#6366F1" stroke="#312E81" strokeWidth="1.5" />
          <polygon points="128,28 135,30 128,34" fill="#A5B4FC" />
          <rect x="0" y="62" width="130" height="8" fill="#6B7280" />
          <rect x="12" y="42" width="72" height="22" rx="4" fill="#38BDF8" stroke="#0369A1" strokeWidth="2" />
          <rect x="68" y="46" width="14" height="10" rx="1" fill="#BAE6FD" />
          <circle cx="28" cy="66" r="8" fill="#111827" />
          <circle cx="78" cy="66" r="8" fill="#111827" />
        </svg>
      );
    case "kyara":
      return (
        <svg className={common} viewBox="0 0 110 100" aria-hidden>
          <title>キャラクター（ブロックと星）</title>
          <rect x="12" y="48" width="28" height="28" fill="#5D9E2F" stroke="#365314" strokeWidth="2" />
          <rect x="44" y="40" width="28" height="36" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
          <rect x="76" y="52" width="24" height="24" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <path
            d="M55 12 L58 22 L68 22 L60 28 L63 38 L55 32 L47 38 L50 28 L42 22 L52 22 Z"
            fill="#FCD34D"
            stroke="#B45309"
            strokeWidth="1"
          />
          <circle cx="88" cy="18" r="6" fill="#F472B6" stroke="#BE185D" strokeWidth="1" />
          <circle cx="22" cy="24" r="5" fill="#5DECF5" stroke="#0891B2" strokeWidth="1" />
        </svg>
      );
    case "seikatsu":
      return (
        <svg className={common} viewBox="0 0 110 95" aria-hidden>
          <title>生活（家と太陽）</title>
          <path d="M55 8 L95 42 L85 42 L85 78 L25 78 L25 42 L15 42 Z" fill="#FDE68A" stroke="#B45309" strokeWidth="2" />
          <rect x="42" y="52" width="26" height="26" fill="#92400E" stroke="#451A03" strokeWidth="2" />
          <circle cx="22" cy="22" r="14" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
          <path d="M22 10 L22 6 M22 34 L22 38 M10 22 L6 22 M34 22 L38 22 M14 14 L11 11 M30 30 L33 33 M30 14 L33 11 M14 30 L11 33" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="88" cy="72" rx="12" ry="8" fill="#86EFAC" stroke="#166534" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}
