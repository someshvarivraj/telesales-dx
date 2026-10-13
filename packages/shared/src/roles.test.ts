import { describe, expect, it } from 'vitest';
import { ALL_ROLES, isRole, Role, ROLE_HOME_PATH } from './roles.js';

describe('roles', () => {
  it('recognises every defined role', () => {
    for (const role of ALL_ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isRole('MANAGER')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it('gives each role its own home path', () => {
    const homes = new Set(ALL_ROLES.map((role) => ROLE_HOME_PATH[role]));
    expect(homes.size).toBe(ALL_ROLES.length);
    expect(ROLE_HOME_PATH[Role.Sales]).toBe('/sales');
  });
});
