import type { PlanDto } from '@telesales/shared';
import { Building2, MapPin, TrainFront, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

type Appointment = NonNullable<PlanDto['appointment']>;

export interface AppointmentFact {
  key: string;
  label: string;
  icon: ReactNode;
  value: string;
}

/**
 * What sales wants to see at a glance on an appointment (request 11/27): the company, where it
 * is, the nearest station, the department and whom to ask for. Empty ones are left out.
 */
export function appointmentFacts(appointment: Appointment, iconSize = 'size-3'): AppointmentFact[] {
  const facts: (AppointmentFact | null)[] = [
    appointment.address
      ? {
          key: 'address',
          label: '住所',
          icon: <MapPin className={iconSize} />,
          value: appointment.address,
        }
      : null,
    appointment.nearestStation
      ? {
          key: 'station',
          label: '最寄駅',
          icon: <TrainFront className={iconSize} />,
          value: appointment.nearestStation,
        }
      : null,
    appointment.department
      ? {
          key: 'department',
          label: '部署',
          icon: <Building2 className={iconSize} />,
          value: appointment.department,
        }
      : null,
    appointment.contactName
      ? {
          key: 'contact',
          label: '訪問先担当者',
          icon: <UserRound className={iconSize} />,
          value: `${appointment.contactName} 様`,
        }
      : null,
  ];
  return facts.filter((fact): fact is AppointmentFact => fact !== null);
}
