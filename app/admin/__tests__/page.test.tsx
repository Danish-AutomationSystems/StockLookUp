import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from '@/app/admin/page';

type MockResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

function mockJsonResponse(body: unknown, ok = true): MockResponse {
  return {
    ok,
    json: async () => body,
  };
}

function setupFetchMock({
  getBody = {
    headers: ['SKU', 'Name', 'Price', 'Color'],
    config: { searchColumn: 'SKU', resultColumns: ['Name'] },
  },
  postResponse = mockJsonResponse({ success: true }),
}: {
  getBody?: unknown;
  postResponse?: MockResponse;
} = {}) {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (url !== '/api/admin/config') {
      throw new Error(`Unexpected URL: ${url}`);
    }

    if (!options || options.method === undefined) {
      return Promise.resolve(mockJsonResponse(getBody));
    }

    return Promise.resolve(postResponse);
  });

  global.fetch = fetchMock as typeof fetch;
  return fetchMock;
}

async function waitForPageToLoad() {
  await waitFor(() => expect(screen.getByLabelText('Search column')).toBeInTheDocument());
}

function getDisplayedColumnSelect(rowNumber: number) {
  return screen.getByLabelText(`Displayed column ${rowNumber}`);
}

function getOptionValues(select: HTMLElement) {
  return within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value);
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads one search select and one displayed select, then lets admins add and remove displayed rows', async () => {
    setupFetchMock();
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitForPageToLoad();

    expect(screen.getByLabelText('Search column')).toHaveValue('SKU');
    expect(getDisplayedColumnSelect(1)).toHaveValue('Name');
    expect(screen.queryByLabelText('Displayed column 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add display column' }));
    expect(getDisplayedColumnSelect(2)).toHaveValue('');

    await user.selectOptions(getDisplayedColumnSelect(2), 'Price');
    expect(getDisplayedColumnSelect(2)).toHaveValue('Price');

    await user.click(screen.getByRole('button', { name: 'Remove displayed column 1' }));

    expect(screen.queryByLabelText('Displayed column 2')).not.toBeInTheDocument();
    expect(getDisplayedColumnSelect(1)).toHaveValue('Price');
  });

  it('removes displayed rows that match the new search column and restores one empty row when needed', async () => {
    setupFetchMock({
      getBody: {
        headers: ['SKU', 'Name', 'Price'],
        config: { searchColumn: 'SKU', resultColumns: ['Name'] },
      },
    });
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitForPageToLoad();

    expect(getDisplayedColumnSelect(1)).toHaveValue('Name');

    await user.selectOptions(screen.getByLabelText('Search column'), 'Name');

    expect(getDisplayedColumnSelect(1)).toHaveValue('');
    expect(getOptionValues(getDisplayedColumnSelect(1))).toEqual(['', 'SKU', 'Price']);
  });

  it('excludes the search column and other selected values from each displayed row while keeping the current value available', async () => {
    setupFetchMock({
      getBody: {
        headers: ['SKU', 'Name', 'Price', 'Color'],
        config: { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] },
      },
    });

    render(<AdminPage />);

    await waitForPageToLoad();

    expect(getOptionValues(getDisplayedColumnSelect(1))).toEqual(['', 'Name', 'Color']);
    expect(getOptionValues(getDisplayedColumnSelect(2))).toEqual(['', 'Price', 'Color']);
  });

  it('posts displayed columns in order and only shows Saved. after an OK response', async () => {
    const fetchMock = setupFetchMock();
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitForPageToLoad();

    await user.click(screen.getByRole('button', { name: 'Add display column' }));
    await user.selectOptions(getDisplayedColumnSelect(2), 'Price');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/config',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ searchColumn: 'SKU', resultColumns: ['Name', 'Price'] }),
        })
      );
    });

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('rejects save while a displayed row is empty', async () => {
    const fetchMock = setupFetchMock({
      getBody: {
        headers: ['SKU', 'Name', 'Price'],
        config: { searchColumn: 'SKU', resultColumns: [] },
      },
    });
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitForPageToLoad();

    expect(getDisplayedColumnSelect(1)).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Displayed column 1 is required.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a safe server validation message when POST fails', async () => {
    setupFetchMock({
      postResponse: mockJsonResponse(
        { error: 'Invalid configuration', details: ['Result column "SKU" cannot be the search column'] },
        false
      ),
    });
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitForPageToLoad();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Error: Result column "SKU" cannot be the search column')).toBeInTheDocument();
  });

  it('shows error message when GET request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    }) as typeof fetch;

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText('Failed to load configuration. Refresh to try again.')).toBeInTheDocument()
    );
  });

  it('shows error message when GET fetch is rejected', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as typeof fetch;

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText('Failed to load configuration. Refresh to try again.')).toBeInTheDocument()
    );
  });

  it('shows network error status when POST fetch is rejected', async () => {
    setupFetchMock();
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitForPageToLoad();

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as typeof fetch;

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Network error, try again.')).toBeInTheDocument();
  });
});
