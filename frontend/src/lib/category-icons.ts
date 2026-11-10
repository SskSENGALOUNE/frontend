import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CirclePlus,
  Clapperboard,
  Coffee,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  type LucideIcon,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

/** Icon keys stored in categories.icon. The first 11 are the backend's default categories. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  gift: Gift,
  plus: CirclePlus,
  utensils: Utensils,
  car: Car,
  bag: ShoppingBag,
  receipt: Receipt,
  heart: HeartPulse,
  film: Clapperboard,
  book: BookOpen,
  dots: Ellipsis,
  coffee: Coffee,
  fuel: Fuel,
  bus: Bus,
  plane: Plane,
  home: House,
  zap: Zap,
  wifi: Wifi,
  phone: Smartphone,
  cart: ShoppingCart,
  shirt: Shirt,
  baby: Baby,
  pet: PawPrint,
  gym: Dumbbell,
  school: GraduationCap,
  game: Gamepad2,
  tools: Wrench,
  salary: Banknote,
  coins: HandCoins,
  savings: PiggyBank,
};

export const ICON_CHOICES = Object.keys(CATEGORY_ICONS);

export const DEFAULT_ICON: LucideIcon = Tag;

export function iconFor(key: string | null | undefined): LucideIcon {
  return (key && CATEGORY_ICONS[key]) || DEFAULT_ICON;
}

/** Palette keys stored in categories.color; each maps to --cat-<key> / --cat-<key>-bg tokens in globals.css. */
export const COLOR_CHOICES = ["green", "teal", "blue", "indigo", "purple", "pink", "orange", "amber"] as const;
export type CategoryColor = (typeof COLOR_CHOICES)[number];

/** The category's own color when valid, otherwise one derived from its name (stable across renders). */
export function colorFor(color: string | null | undefined, name: string): CategoryColor {
  if (color && (COLOR_CHOICES as readonly string[]).includes(color)) return color as CategoryColor;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return COLOR_CHOICES[h % COLOR_CHOICES.length];
}

// Keywords (Lao, Thai-style spellings users type, English) -> icon key, checked in order.
const ICON_HINTS: [RegExp, string][] = [
  [/ກາເຟ|ກາແຟ|ຊາ|coffee|cafe|tea/i, "coffee"],
  [/ນ້ຳມັນ|ນ້ຳມັນລົດ|ປ້ຳ|fuel|gas|petrol/i, "fuel"],
  [/ກິນ|ເຂົ້າ|ອາຫານ|ຂະໜົມ|ເບຍ|ເຄື່ອງດື່ມ|food|eat|lunch|dinner|meal|drink/i, "utensils"],
  [/ລົດເມ|ລົດໂດຍສານ|bus/i, "bus"],
  [/ລົດ|ແທັກຊີ|ຕຸກຕຸກ|ເດີນທາງ|ຂົນສົ່ງ|car|taxi|transport|grab|loca/i, "car"],
  [/ຍົນ|ທ່ຽວ|plane|flight|travel|trip/i, "plane"],
  [/ຄ່າເຊົ່າ|ເຮືອນ|ຫ້ອງ|rent|home|house/i, "home"],
  [/ໄຟ|electric|power/i, "zap"],
  [/ເນັດ|ອິນເຕີເນັດ|wifi|internet/i, "wifi"],
  [/ໂທ|ບັດເຕີມ|phone|mobile/i, "phone"],
  [/ຕະຫຼາດ|ຊຸບເປີ|ມາກ|grocery|market|mart/i, "cart"],
  [/ເສື້ອ|ເຄື່ອງນຸ່ງ|ໂສ້ງ|cloth|shirt|fashion/i, "shirt"],
  [/ຊື້|ຊ໊ອບ|shop/i, "bag"],
  [/ລູກ|ເດັກ|baby|kid|child/i, "baby"],
  [/ໝາ|ແມວ|ສັດ|pet|dog|cat/i, "pet"],
  [/ຢິມ|ອອກກຳລັງ|ກິລາ|gym|sport|fitness/i, "gym"],
  [/ໂຮງຮຽນ|ຮຽນ|ສຶກສາ|ຄ່າຮຽນ|school|study|course|education/i, "school"],
  [/ປຶ້ມ|book/i, "book"],
  [/ຢາ|ໝໍ|ໂຮງໝໍ|ສຸຂະພາບ|health|doctor|hospital|medicine/i, "heart"],
  [/ໜັງ|ຮູບເງົາ|ບັນເທີງ|movie|film|netflix/i, "film"],
  [/ເກມ|game/i, "game"],
  [/ສ້ອມ|ຊ່າງ|repair|fix|tool/i, "tools"],
  [/ບິນ|ຄ່ານ້ຳ|bill|utility/i, "receipt"],
  [/ຂອງຂວັນ|ຂວັນ|ໂບນັດ|gift|bonus/i, "gift"],
  [/ເງິນເດືອນ|salary|wage/i, "briefcase"],
  [/ເງິນເກັບ|ອອມ|ອອມເງິນ|saving/i, "savings"],
  [/ຂາຍ|ລາຍໄດ້|ດອກເບ້ຍ|sell|income|interest/i, "coins"],
  [/ແປງ|ທົ່ວໄປ|ອື່ນ|other|misc/i, "dots"],
];

/** Icon key that fits a category name, or null when nothing matches. */
export function suggestIcon(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  return ICON_HINTS.find(([re]) => re.test(n))?.[1] ?? null;
}
