import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, COLOR_CHOICES, colorFor, DEFAULT_ICON, iconFor } from "./category-icons";

describe("category icons", () => {
  it("maps every default backend icon key", () => {
    for (const k of ["briefcase", "gift", "plus", "utensils", "car", "bag", "receipt", "heart", "film", "book", "dots"]) {
      expect(CATEGORY_ICONS[k], k).toBeDefined();
      expect(iconFor(k)).toBe(CATEGORY_ICONS[k]);
    }
  });
  it("falls back for unknown or missing keys", () => {
    expect(iconFor("nope")).toBe(DEFAULT_ICON);
    expect(iconFor(null)).toBe(DEFAULT_ICON);
    expect(iconFor(undefined)).toBe(DEFAULT_ICON);
  });
});

describe("category colors", () => {
  it("keeps a valid stored color", () => {
    expect(colorFor("pink", "anything")).toBe("pink");
  });
  it("derives a stable palette color from the name otherwise", () => {
    const a = colorFor(null, "ອາຫານ ແລະ ເຄື່ອງດື່ມ");
    expect(COLOR_CHOICES).toContain(a);
    expect(colorFor(null, "ອາຫານ ແລະ ເຄື່ອງດື່ມ")).toBe(a);
    expect(colorFor("#ff0000", "ອາຫານ ແລະ ເຄື່ອງດື່ມ")).toBe(a); // unknown value -> derived
  });
  it("spreads default categories over several colors", () => {
    const names = ["ເງິນເດືອນ", "ເງິນໂບນັດ", "ລາຍຮັບອື່ນໆ", "ອາຫານ ແລະ ເຄື່ອງດື່ມ", "ຄ່າເດີນທາງ", "ຊື້ເຄື່ອງ", "ຄ່ານ້ຳ ຄ່າໄຟ ຄ່າໂທ", "ສຸຂະພາບ", "ບັນເທີງ", "ການສຶກສາ", "ລາຍຈ່າຍອື່ນໆ"];
    expect(new Set(names.map((n) => colorFor(null, n))).size).toBeGreaterThanOrEqual(4);
  });
});

describe("suggestIcon", () => {
  it("picks icons from Lao and English names", async () => {
    const { suggestIcon } = await import("./category-icons");
    expect(suggestIcon("ນ້ຳມັນ")).toBe("fuel");
    expect(suggestIcon("ກິນເຂົ້າ")).toBe("utensils");
    expect(suggestIcon("ກິນເຂົ້ານຳໝູ່")).toBe("utensils");
    expect(suggestIcon("ກາເຟ")).toBe("coffee");
    expect(suggestIcon("Gym")).toBe("gym");
    expect(suggestIcon("ຄ່າເຊົ່າຫ້ອງ")).toBe("home");
    expect(suggestIcon("ຄ່າລົດ")).toBe("car");
    expect(suggestIcon("Other")).toBe("dots");
    expect(suggestIcon("xyz")).toBeNull();
    expect(suggestIcon("  ")).toBeNull();
  });
});
