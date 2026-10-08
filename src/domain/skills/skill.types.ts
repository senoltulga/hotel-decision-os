import type { Issue } from '../case/case.types.ts';

export type SkillResult<T> =
  | Readonly<{ success: true; value: T }>
  | Readonly<{ success: false; issues: readonly Issue[] }>;

export function failure(code: string, path: string, message: string): SkillResult<never> {
  return { success: false, issues: [{ code, path, message }] };
}
