import { DayBeforeResult } from '@telesales/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DayBeforeChoice } from './DayBeforePage';

describe('前日確認の結果 (11/17)', () => {
  it('offers the three choices before a result', () => {
    render(<DayBeforeChoice result={null} savingResult={null} onPick={() => undefined} />);
    expect(screen.getByRole('button', { name: '確認済み' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未確認' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '変更' })).toBeInTheDocument();
  });

  it('shows a recorded result as a status, not as a button', () => {
    render(
      <DayBeforeChoice
        result={DayBeforeResult.Confirmed}
        savingResult={null}
        onPick={() => undefined}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('確認済み');
    expect(screen.queryByRole('button', { name: '確認済み' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '結果を変える' })).toBeInTheDocument();
  });

  it('「結果を変える」 brings the choices back and records the new one', async () => {
    const onPick = vi.fn();
    render(
      <DayBeforeChoice result={DayBeforeResult.Confirmed} savingResult={null} onPick={onPick} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '結果を変える' }));
    await userEvent.click(screen.getByRole('button', { name: '変更' }));
    expect(onPick).toHaveBeenCalledWith(DayBeforeResult.Changed);
  });
});
