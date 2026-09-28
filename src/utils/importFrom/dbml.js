import { parseDbml } from "../dbml/parse";
import { reconcileDbml } from "../dbml/reconcile";

export function fromDBML(src, database) {
  const parsed = parseDbml(src, database);
  return reconcileDbml(parsed, null, database);
}
