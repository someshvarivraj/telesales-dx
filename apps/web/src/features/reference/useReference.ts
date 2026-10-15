import type {
  AppSettingsDto,
  CalendarDayDto,
  OptionCategory,
  OptionDto,
  PersonDto,
  Role,
} from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

const LONG = 10 * 60_000;

export function useOptions() {
  return useQuery({
    queryKey: ['options'],
    queryFn: ({ signal }) => apiClient.get<OptionDto[]>('/options', signal),
    staleTime: LONG,
  });
}

/** Active options of one category, for selects. */
export function useOptionList(category: OptionCategory) {
  const query = useOptions();
  const items = (query.data ?? []).filter((option) => option.category === category);
  return {
    items,
    selectOptions: items.map((option) => ({ value: option.code, label: option.label })),
    labelOf: (code: string | null | undefined) =>
      code ? (items.find((option) => option.code === code)?.label ?? code) : '',
  };
}

export function usePeople(role?: Role) {
  return useQuery({
    queryKey: ['people', role ?? 'all'],
    queryFn: ({ signal }) => apiClient.get<PersonDto[]>(`/people${toQuery({ role })}`, signal),
    staleTime: LONG,
  });
}

export function useHolidays(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', from, to],
    queryFn: ({ signal }) =>
      apiClient.get<CalendarDayDto[]>(`/calendar${toQuery({ from, to })}`, signal),
    staleTime: LONG,
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => apiClient.get<AppSettingsDto>('/settings', signal),
    staleTime: LONG,
  });
}
