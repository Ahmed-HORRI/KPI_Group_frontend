export const SUBJECT_TREE_MAX_LEVELS = 5;

export function indexSubjectTree(nodes = [], index = new Map()) {
  nodes.forEach((node) => {
    index.set(String(node.id), node);
    indexSubjectTree(node.children || [], index);
  });
  return index;
}

export function findSelectedSubject(index, subjectId, subjectPath) {
  if (subjectId && index.has(String(subjectId))) return index.get(String(subjectId));
  const value = String(subjectPath || "").trim().toLowerCase();
  if (!value) return null;
  const nodes = Array.from(index.values());
  const pathMatch = nodes.find((node) => String(node.full_path || "").toLowerCase() === value);
  if (pathMatch) return pathMatch;
  const nameMatches = nodes.filter((node) => String(node.name || "").toLowerCase() === value);
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function getSubjectFlowIds(index, nodeId) {
  const ids = [];
  const visited = new Set();
  let node = index.get(String(nodeId));
  while (node && !visited.has(String(node.id))) {
    visited.add(String(node.id));
    ids.unshift(String(node.id));
    node = index.get(String(node.parent_id));
  }
  return ids;
}

export function getSubjectFlowColumns(roots, selectedIds) {
  const columns = [roots];
  let nodes = roots;
  for (const id of selectedIds) {
    if (columns.length >= SUBJECT_TREE_MAX_LEVELS) break;
    const node = nodes.find((entry) => String(entry.id) === String(id));
    if (!node?.children?.length) break;
    nodes = node.children;
    columns.push(nodes);
  }
  return columns;
}

export function isFinalSubject(node, level) {
  return !node.children?.length || level >= SUBJECT_TREE_MAX_LEVELS - 1;
}

export function subjectMatchesSearch(node, search) {
  const value = search.trim().toLowerCase();
  return !value ||
    String(node.name || "").toLowerCase().includes(value) ||
    String(node.full_path || "").toLowerCase().includes(value) ||
    (node.children || []).some((child) => subjectMatchesSearch(child, value));
}
