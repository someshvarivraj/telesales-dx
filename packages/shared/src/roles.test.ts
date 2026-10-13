import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, Permission, resolvePermissions } from './permissions.js';
import { ALL_ROLES, isRole, Role, sortRoles } from './roles.js';

describe('roles', () => {
  it('recognises every defined role and rejects others', () => {
    for (const role of ALL_ROLES) {
      expect(isRole(role)).toBe(true);
    }
    expect(isRole('MANAGER')).toBe(false);
  });

  it('sorts roles in display order', () => {
    expect(sortRoles([Role.Admin, Role.Telema])).toEqual([Role.Telema, Role.Admin]);
  });
});

describe('resolvePermissions (spec v1 §4)', () => {
  it('lets everyone view and comment', () => {
    for (const role of ALL_ROLES) {
      const permissions = resolvePermissions([role]);
      expect(permissions).toContain(Permission.ViewData);
      expect(permissions).toContain(Permission.WriteComments);
    }
  });

  it('keeps viewers read-only apart from comments', () => {
    expect(resolvePermissions([Role.Viewer])).toEqual([
      Permission.ViewData,
      Permission.WriteComments,
    ]);
  });

  it('gives the lead everything a telemarketer has, plus import and allocation', () => {
    const telema = resolvePermissions([Role.Telema]);
    const lead = resolvePermissions([Role.TelemaLead]);
    expect(telema.every((permission) => lead.includes(permission))).toBe(true);
    expect(lead).toEqual(
      expect.arrayContaining([Permission.ImportLists, Permission.ConfirmAllocation]),
    );
    expect(telema).not.toContain(Permission.ImportLists);
  });

  it('stops sales from booking telemarketing appointments but lets them request changes', () => {
    const sales = resolvePermissions([Role.Sales]);
    expect(sales).not.toContain(Permission.ManageTelemaAppointments);
    expect(sales).toEqual(
      expect.arrayContaining([Permission.SendChangeRequests, Permission.ManageSalesAppointments]),
    );
  });

  it('merges several roles and individual grants', () => {
    const permissions = resolvePermissions([Role.Telema], [Permission.EditAreaTable]);
    expect(permissions).toContain(Permission.EditAreaTable);
    expect(resolvePermissions([Role.Admin])).toEqual(ALL_PERMISSIONS);
  });
});
