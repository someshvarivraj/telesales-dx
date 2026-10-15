import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

const FRUITS = [
  { value: 'apple', label: 'りんご' },
  { value: 'banana', label: 'バナナ' },
  { value: 'cherry', label: 'さくらんぼ' },
];

function Harness({ options = FRUITS }: { options?: typeof FRUITS }) {
  const [value, setValue] = useState('');
  return (
    <>
      <Select
        aria-label="果物"
        placeholder="選択してください"
        options={options}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <output>{value}</output>
    </>
  );
}

describe('Select', () => {
  it('shows the placeholder, opens a list and picks with the mouse', () => {
    render(<Harness />);
    const box = screen.getByRole('combobox', { name: '果物' });
    expect(box).toHaveTextContent('選択してください');
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('option', { name: 'バナナ' }));
    expect(screen.getByRole('status')).toHaveTextContent('banana');
    expect(box).toHaveTextContent('バナナ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('works with the keyboard', () => {
    render(<Harness />);
    const box = screen.getByRole('combobox', { name: '果物' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent('banana');
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('adds a search box to long lists', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ value: `p${i}`, label: `都道府県${i}` }));
    render(<Harness options={many} />);
    fireEvent.click(screen.getByRole('combobox', { name: '果物' }));
    fireEvent.change(screen.getByRole('textbox', { name: '検索' }), { target: { value: '県12' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
