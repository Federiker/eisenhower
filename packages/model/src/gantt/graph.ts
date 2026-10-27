/** What the dependency checks need of a task: its id and the tasks it depends on. */
type Linked = { readonly id: string; readonly dependsOn: readonly string[] };

/**
 * Whether `from` depends on `to`, directly or through other tasks (following each task's `dependsOn`). A task
 * reaches itself only through a cycle.
 */
export function dependsOnTask(tasks: readonly Linked[], from: string, to: string): boolean {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const stack = [...(byId.get(from)?.dependsOn ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.dependsOn ?? []));
  }
  return false;
}

/**
 * A task that depends on itself through others, or null when there is no cycle: one depth-first walk over every
 * task (without recursion, so a long chain of tasks cannot overflow the stack).
 */
export function cycleMember(tasks: readonly Linked[]): string | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  // Absent: not visited; 1: on the current path; 2: finished, no cycle through it.
  const state = new Map<string, 1 | 2>();
  for (const root of tasks) {
    if (state.has(root.id)) continue;
    const path: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    state.set(root.id, 1);
    while (path.length > 0) {
      const top = path.at(-1)!;
      const successors = byId.get(top.id)?.dependsOn ?? [];
      if (top.next >= successors.length) {
        state.set(top.id, 2);
        path.pop();
        continue;
      }
      const id = successors[top.next]!;
      top.next += 1;
      if (state.get(id) === 1) return id;
      if (!state.has(id) && byId.has(id)) {
        state.set(id, 1);
        path.push({ id, next: 0 });
      }
    }
  }
  return null;
}
