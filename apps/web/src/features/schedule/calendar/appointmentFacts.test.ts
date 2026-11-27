import type { PlanDto } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import { appointmentFacts } from './appointmentFacts';

const appointment = (details: Partial<NonNullable<PlanDto['appointment']>>) =>
  ({
    id: 'a1',
    companyName: 'テスト工業',
    format: 'VISIT',
    status: 'SCHEDULED',
    isTelema: true,
    meetingUrl: null,
    address: null,
    nearestStation: null,
    department: null,
    contactName: null,
    ...details,
  }) as NonNullable<PlanDto['appointment']>;

describe('appointment details on the sales calendar (request 11/27)', () => {
  it('lists address, station, department and contact in that order', () => {
    const facts = appointmentFacts(
      appointment({
        address: '大阪市中央区本町1-2-3',
        nearestStation: '本町駅',
        department: '人事部',
        contactName: '田中',
      }),
    );
    expect(facts.map((fact) => [fact.label, fact.value])).toEqual([
      ['住所', '大阪市中央区本町1-2-3'],
      ['最寄駅', '本町駅'],
      ['部署', '人事部'],
      ['訪問先担当者', '田中 様'],
    ]);
  });

  it('leaves out what is not filled in', () => {
    expect(appointmentFacts(appointment({ contactName: '山本' })).map((f) => f.key)).toEqual([
      'contact',
    ]);
  });
});
