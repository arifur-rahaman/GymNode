import { describe, expect, it } from "vitest";
import bn from "./bn.json";
import en from "./en.json";

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe("translations", () => {
  it("bn and en have exactly the same keys", () => {
    expect(keys(en as Tree).sort()).toEqual(keys(bn as Tree).sort());
  });
  it("no empty strings", () => {
    for (const tree of [bn, en] as Tree[]) {
      const empty = keys(tree).filter((k) => {
        const value = k
          .split(".")
          .reduce<Tree | string>((node, part) => (node as Tree)[part] as Tree | string, tree);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
