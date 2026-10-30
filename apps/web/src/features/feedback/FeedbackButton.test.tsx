import { resolvePermissions, Role, type SessionUser } from '@telesales/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/ApiClient';
import { sessionQueryKey } from '../auth/hooks/useSession';
import { FeedbackButton } from './FeedbackButton';

beforeAll(() => {
  // jsdom has no <dialog> methods or object URLs.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  URL.createObjectURL = () => 'blob:preview';
  URL.revokeObjectURL = () => undefined;
});

function renderMenu() {
  const user: SessionUser = {
    id: '00000000-0000-0000-0000-000000000001',
    employeeNo: null,
    email: 'user@example.co.jp',
    name: 'テスト',
    roles: [Role.Sales],
    permissions: resolvePermissions([Role.Sales]),
    mustChangePassword: false,
  };
  const queryClient = new QueryClient();
  queryClient.setQueryData(sessionQueryKey, user);
  queryClient.setQueryData(['feedback', 'mine'], []);
  const router = createMemoryRouter(
    [
      {
        path: '/schedule',
        element: (
          <main>
            <h1>スケジュール</h1>
            <FeedbackButton variant="menu" />
          </main>
        ),
      },
    ],
    { initialEntries: ['/schedule?date=2026-10-30'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ご意見・不具合の報告', () => {
  it('sends the type, text, screen and a pasted screenshot', async () => {
    const upload = vi
      .spyOn(apiClient, 'upload')
      .mockResolvedValue({ id: 'f1', number: 3 } as never);
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /ご意見・不具合の報告/ }));
    expect(screen.getByText('スケジュール', { selector: 'dd' })).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: /不具合/ }));
    await userEvent.type(screen.getByRole('textbox'), '保存できません');
    const shot = new File(['png'], 'image.png', { type: 'image/png' });
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [shot] } });
    expect(await screen.findByRole('button', { name: /を外す/ })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: '送る' }));
    expect(await screen.findByText('送りました（No.3）')).toBeTruthy();
    const [path, form] = upload.mock.calls[0] as [string, FormData];
    expect(path).toBe('/feedback');
    expect(form.get('type')).toBe('BUG');
    expect(form.get('body')).toBe('保存できません');
    expect(form.get('screenPath')).toBe('/schedule?date=2026-10-30');
    expect(form.get('screenName')).toBe('スケジュール');
    const files = form.getAll('files') as File[];
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toMatch(/^screenshot-\d{8}-\d{6}\.png$/);
  });

  it('stays open when the file picker is closed without choosing', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /ご意見・不具合の報告/ }));
    const picker = document.querySelector('input[type="file"]');
    expect(picker).toBeTruthy();
    fireEvent(picker as Element, new Event('cancel', { bubbles: true }));
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });

  it('stays open when Chrome asks to close it as the file picker is cancelled', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /ご意見・不具合の報告/ }));
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
    picker.click();
    // Chrome: a close request on the dialog itself …
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog.hasAttribute('open')).toBe(true);
    // … or it closes the dialog outright: it is put back.
    dialog.removeAttribute('open');
    fireEvent(dialog, new Event('close'));
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('still closes with Esc when no file picker is involved', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /ご意見・不具合の報告/ }));
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('refuses files it cannot attach', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /ご意見・不具合の報告/ }));
    const exe = new File(['x'], 'tool.exe', { type: 'application/x-msdownload' });
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [exe] } });
    expect(await screen.findByText(/「tool.exe」は添付できない種類です/)).toBeTruthy();
  });
});
