import { dateLabel } from "./format";

/**
 * Version of this build, set by deploy/release.sh (e.g. "20261111-093015", the Mac's local time
 * when it was built). "dev" when running locally.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

/** "20261111-093015" -> { date: "2026-11-11", time: "09:30" }, or null for "dev". */
export function parseVersion(v: string): { date: string; time: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\d{2}$/.exec(v);
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

/** "11 ພະຈິກ 2026 · 09:30" for a release tag, or a note that this is not a deployed build. */
export function versionLabel(v: string): string {
  const p = parseVersion(v);
  return p ? `${dateLabel(p.date)} · ${p.time}` : "ລຸ້ນທົດລອງ (ຍັງບໍ່ໄດ້ deploy)";
}

export interface ChangelogEntry {
  /**
   * Release tag this entry went out in. Leave it off on the newest entry: it then shows the
   * version of the running build. When adding a new entry on top, fill in the tag of the one below.
   */
  version?: string;
  items: string[];
}

/** What changed in each release, newest first, in Lao. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    items: [
      "ຕິດຕັ້ງເປັນແອັບໃນໜ້າຈໍມືຖືໄດ້ (Add to Home Screen) ມີໄອຄອນຂອງຕົວເອງ ແລະ ເປີດເຕັມຈໍ",
      "ເປົ້າໝາຍອອມ: ໜ້າໃໝ່ໃນເມນູ “ເພີ່ມເຕີມ” ຕັ້ງເປົ້າໄດ້, ກັນເງິນອອມອັດຕະໂນມັດທຸກວັນທີ 25, ກົດອອມເພີ່ມເອງໄດ້. ເງິນທີ່ອອມນັບເປັນລາຍຈ່າຍໝວດ “ເງິນອອມ”",
      "ລາຍງານ 12 ເດືອນໃນໜ້າພາບລວມ: ກຣາຟລາຍຮັບ/ລາຍຈ່າຍ 12 ຮອບ, ຄ່າສະເລ່ຍ, ຍອດເຫຼືອລວມ, ຕາຕະລາງ ແລະ % ຂຶ້ນ/ລົງ ຂອງແຕ່ລະໝວດທຽບກັບເດືອນກ່ອນ",
      "ຍອດດ່ວນ + ລາຍການໂປດ: ປຸ່ມຍອດດ່ວນສະແດງຍອດທີ່ໃຊ້ເລື້ອຍໆຂອງໝວດທີ່ເລືອກ ແລະ ມີລາຍການໂປດ ກົດເທື່ອດຽວໃສ່ລາຍການໄດ້ເລີຍ",
      "ຮອບເງິນເດືອນ: ທຸກໜ້ານັບຈາກວັນທີ 25 ຫາ 24 ຂອງເດືອນຖັດໄປ ເຊັ່ນ ພະຈິກ = 25/10 – 24/11",
      "ປຸ່ມຍອດດ່ວນຂຶ້ນແຖວໃໝ່ເອງ ບໍ່ຕ້ອງເລື່ອນຂ້າງໃນມືຖື",
    ],
  },
  {
    version: "20261006-231457",
    items: [
      "ເປີດໃຊ້ງານຄັ້ງທຳອິດ: ບັນທຶກລາຍຮັບ ລາຍຈ່າຍ, ບັນທຶກຫຼາຍລາຍການພ້ອມກັນ, ພາບລວມ, ລາຍການ, ງົບປະມານ, ລາຍການປະຈຳ, ໝວດ ແລະ ໂປຣໄຟລ໌",
    ],
  },
];
