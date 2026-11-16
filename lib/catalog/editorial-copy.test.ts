import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type InventoryRow = [slug: string, classes: string, decision: string, reason?: string];
type Copy = { description: string; short_description: string | null };
type Proposal = {
  id: string;
  slug: string;
  material: string;
  category: string;
  reason: string;
  before: Copy;
  after: Copy;
};

const directory = new URL("../../docs/catalog-copy-15c/", import.meta.url);
const inventory = JSON.parse(readFileSync(new URL("inventory.json", directory), "utf8")) as {
  database: InventoryRow[];
  static: InventoryRow[];
};
const { updates } = JSON.parse(readFileSync(new URL("updates.proposed.json", directory), "utf8")) as {
  updates: Proposal[];
};

describe("catalog editorial proposal", () => {
  it("only proposes changes to reviewed slugs and excludes the blank and parity-sensitive rows", () => {
    expect(new Set(updates.map(({ id }) => id)).size).toBe(updates.length);
    expect(updates.map(({ slug }) => slug)).toEqual(
      inventory.database.filter(([, , decision]) => decision === "alterar").map(([slug]) => slug)
    );
    expect(inventory.database.filter(([, classes]) => classes === "G")).toHaveLength(155);
    expect(inventory.database.filter(([, , , reason]) => reason?.startsWith("Bloqueio de paridade"))).toHaveLength(71);
  });

  it("limits updates to descriptions without changing description-derived in-stock labels", () => {
    expect(updates.filter(({ before, after }) => before.short_description !== after.short_description)).toHaveLength(7);
    for (const { before, after, reason } of updates) {
      expect(Object.keys(after).sort()).toEqual(["description", "short_description"]);
      expect(reason).toBeTruthy();
      expect(after.description).not.toBe(before.description);
      expect(after.description.toLowerCase().includes("sob encomenda")).toBe(
        before.description.toLowerCase().includes("sob encomenda")
      );
    }
  });

  it("keeps the leather bracelet's documented composition and removes its repeated headline and brand", () => {
    const example = updates.find(({ slug }) => slug === "bracelete-couro");
    expect(example?.before.description).toMatch(/^### Pulseira/);
    expect(example?.after.description).toMatch(/Prata 950.*banho de ródio.*zircônias azuis/);
    expect(example?.after.description).not.toMatch(/###|\*\*|Marjouxs Joias|exclusiv/i);
  });
});
