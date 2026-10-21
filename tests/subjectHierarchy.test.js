import assert from "node:assert/strict";
import test from "node:test";
import {
  findSelectedSubject,
  getSubjectFlowColumns,
  getSubjectFlowIds,
  indexSubjectTree,
  isFinalSubject,
  subjectMatchesSearch,
} from "../src/pages/Responsibles/components/subjectHierarchy.js";

const leaf = { id: "3", parent_id: "2", name: "Sales", full_path: "Company Success / Cash generation / Sales", children: [] };
const cash = { id: "2", parent_id: "1", name: "Cash generation", full_path: "Company Success / Cash generation", children: [leaf] };
const otherSales = { id: "5", parent_id: "4", name: "Sales", full_path: "Development / Sales", children: [] };
const roots = [
  { id: "1", parent_id: null, name: "Company Success", full_path: "Company Success", children: [cash] },
  { id: "4", parent_id: null, name: "Development", full_path: "Development", children: [otherSales] },
];
const index = indexSubjectTree(roots);

test("parents open their branch while only final subjects can be confirmed", () => {
  assert.equal(isFinalSubject(roots[0], 0), false);
  assert.equal(isFinalSubject(cash, 1), false);
  assert.equal(isFinalSubject(leaf, 2), true);
  assert.deepEqual(getSubjectFlowColumns(roots, ["1", "2"]), [roots, [cash], [leaf]]);
  assert.deepEqual(getSubjectFlowColumns(roots, ["4"]), [roots, [otherSales]]);
});

test("editing restores the correct branch even when subject names repeat", () => {
  assert.equal(findSelectedSubject(index, "5", leaf.full_path), otherSales);
  assert.equal(findSelectedSubject(index, "", leaf.full_path.toUpperCase()), leaf);
  assert.equal(findSelectedSubject(index, "", "Sales"), null);
  assert.deepEqual(getSubjectFlowIds(index, "3"), ["1", "2", "3"]);
});

test("filtering finds descendants without hiding the ancestors needed to reach them", () => {
  assert.equal(subjectMatchesSearch(roots[0], "  SALES  "), true);
  assert.equal(subjectMatchesSearch(cash, "Sales"), true);
  assert.equal(subjectMatchesSearch(roots[1], "Cash generation"), false);
  assert.equal(subjectMatchesSearch(roots[0], "No such subject"), false);
});

test("the fifth level confirms a subject and does not expose a sixth column", () => {
  let node = { id: "6", name: "Level six", children: [] };
  for (let depth = 5; depth >= 1; depth--) {
    node = { id: String(depth), name: `Level ${depth}`, children: [node] };
  }
  const deepRoots = [node];
  const deepIndex = indexSubjectTree(deepRoots);
  assert.equal(getSubjectFlowColumns(deepRoots, ["1", "2", "3", "4", "5"]).length, 5);
  assert.equal(isFinalSubject(deepIndex.get("4"), 3), false);
  assert.equal(isFinalSubject(deepIndex.get("5"), 4), true);
});
