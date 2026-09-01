import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchForm from '@/components/SearchForm';

describe('SearchForm', () => {
  it('labels the search field and exposes the loading state', () => {
    render(<SearchForm onSearch={vi.fn()} loading />);
    expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Searching...' })).toBeDisabled();
  });

  it('calls onSearch with the typed value on submit', async () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} loading={false} />);
    await userEvent.type(screen.getByRole('textbox'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith('ABC123');
  });

  it('disables the button while loading', () => {
    render(<SearchForm onSearch={vi.fn()} loading={true} />);
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });
});
