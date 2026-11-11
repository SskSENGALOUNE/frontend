import { createElement } from "react";
import { colorFor, iconFor } from "@/lib/category-icons";

const SIZES = {
  xs: { box: "size-6", icon: "size-3.5" },
  sm: { box: "size-8", icon: "size-4" },
  md: { box: "size-10", icon: "size-5" },
  lg: { box: "size-12", icon: "size-6" },
};

/** Tinted circle with the category's icon. */
export function CategoryIcon({
  icon,
  color,
  name,
  size = "md",
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const c = colorFor(color, name);
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${s.box}`}
      style={{ background: `var(--cat-${c}-bg)`, color: `var(--cat-${c})` }}
      aria-hidden
    >
      {/* icons are module-level components looked up by key, so createElement does not remount them */}
      {createElement(iconFor(icon), { className: s.icon, strokeWidth: 2 })}
    </span>
  );
}
