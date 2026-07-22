import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { boundedFetch } from '@/lib/api-client';
import FilterProfilesDropdown, { FilterProfile } from '../FilterProfilesDropdown';

jest.mock('@/lib/api-client', () => ({
  boundedFetch: jest.fn(),
}));

const fetchMock = boundedFetch as jest.MockedFunction<typeof boundedFetch>;

function response(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe('FilterProfilesDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('auth_token', 'token');
  });

  it('applies the default profile after loading it', async () => {
    const profile: FilterProfile = {
      id: 'default-profile',
      name: '기본 보기',
      filters: [{ column: 0, operator: 'contains', value: '서울' }],
      hiddenCols: [2],
      isDefault: true,
      createdAt: '2026-07-18T00:00:00.000Z',
    };
    fetchMock.mockResolvedValue(response([profile]));
    const onApplyProfile = jest.fn();

    render(
      <FilterProfilesDropdown
        sheetId="sheet-1"
        onApplyProfile={onApplyProfile}
        onClearFilters={jest.fn()}
      />,
    );

    await waitFor(() => expect(onApplyProfile).toHaveBeenCalledWith(profile));
    expect(screen.getByRole('button', { name: /기본 보기/ })).toBeInTheDocument();
  });

  it('saves the filter and current hidden row and column snapshot', async () => {
    fetchMock
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: 'created' }))
      .mockResolvedValueOnce(response([]));

    render(
      <FilterProfilesDropdown
        sheetId="sheet-1"
        onApplyProfile={jest.fn()}
        onClearFilters={jest.fn()}
        getProfileSnapshot={() => ({ hiddenRows: [4], hiddenCols: [2] })}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /필터 프로필/ }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.change(screen.getByPlaceholderText('프로필 이름'), { target: { value: '서울만' } });
    fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('필터 값'), { target: { value: '서울' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, request] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      name: '서울만',
      filters: [{ column: 1, operator: 'contains', value: '서울' }],
      hiddenRows: [4],
      hiddenCols: [2],
      isDefault: false,
    });
  });

  it('clears the previous sheet overlay when the loaded sheet has no default profile', async () => {
    fetchMock.mockResolvedValue(response([]));
    const onClearFilters = jest.fn();

    render(
      <FilterProfilesDropdown
        sheetId="sheet-2"
        onApplyProfile={jest.fn()}
        onClearFilters={onClearFilters}
      />,
    );

    await waitFor(() => expect(onClearFilters).toHaveBeenCalledTimes(1));
  });
});
