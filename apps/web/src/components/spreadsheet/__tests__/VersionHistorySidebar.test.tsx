import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import VersionHistorySidebar from '../VersionHistorySidebar';

jest.mock('@/lib/api', () => ({
  api: {
    versions: {
      list: jest.fn(),
      create: jest.fn(),
      restore: jest.fn(),
    },
  },
}));

const versions = jest.mocked(api.versions);

describe('VersionHistorySidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    versions.list.mockResolvedValue([
      {
        id: 'version-1',
        name: '분기 마감',
        createdAt: '2026-07-18T06:00:00.000Z',
        createdBy: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
      },
    ]);
    versions.restore.mockResolvedValue();
  });

  it('loads server versions and restores a confirmed version', async () => {
    const onRestore = jest.fn();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <VersionHistorySidebar
        isOpen
        spreadsheetId="spreadsheet-1"
        onClose={jest.fn()}
        onRestore={onRestore}
      />,
    );

    expect(await screen.findByText('분기 마감')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이 버전으로 복원' }));

    await waitFor(() => expect(versions.restore).toHaveBeenCalledWith('version-1'));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('does not restore when confirmation is cancelled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <VersionHistorySidebar
        isOpen
        spreadsheetId="spreadsheet-1"
        onClose={jest.fn()}
        onRestore={jest.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '이 버전으로 복원' }));
    expect(versions.restore).not.toHaveBeenCalled();
  });
});
