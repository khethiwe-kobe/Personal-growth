/** Circular avatar: uploaded photo, or initials on a pastel wash. */

const ACCENTS: Record<string, [string, string]> = {
  sage: ["#dfe8df", "#4d6a52"],
  blue: ["#dde5ee", "#4a5f7d"],
  lavender: ["#e6dff0", "#5d4f78"],
  blush: ["#f0dfe3", "#7d4f5c"],
  sand: ["#ede5d3", "#77653d"],
  stone: ["#e6e4de", "#5c5a52"],
};

const DARK_ACCENTS: Record<string, [string, string]> = {
  sage: ["#2b332c", "#b5c9b8"],
  blue: ["#272d36", "#a9bcd4"],
  lavender: ["#2e2a38", "#c0b3d8"],
  blush: ["#362a2e", "#d4aeb8"],
  sand: ["#343024", "#cfc09a"],
  stone: ["#30302c", "#bcbab2"],
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export default function Avatar({
  name, accent = "sage", userId, hasAvatar, size = 36, className = "",
}: {
  name: string; accent?: string; userId?: number;
  hasAvatar?: boolean; size?: number; className?: string;
}) {
  if (hasAvatar && userId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${userId}`}
        alt={name}
        width={size} height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const [bg, fg] = ACCENTS[accent] ?? ACCENTS.sage;
  const [dbg, dfg] = DARK_ACCENTS[accent] ?? DARK_ACCENTS.sage;
  return (
    <span
      className={`avatar-initials inline-flex select-none items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: size, height: size, fontSize: size * 0.38,
        ["--av-bg" as string]: bg, ["--av-fg" as string]: fg,
        ["--av-bg-d" as string]: dbg, ["--av-fg-d" as string]: dfg,
        background: "var(--av-bg)", color: "var(--av-fg)",
      }}
      aria-label={name}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}
