import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResultCard from '@/components/ResultCard';

describe('ResultCard', () => {
  it('renders each column as a label/value pair', () => {
    render(<ResultCard result={{ Name: 'Widget', Price: '9.99' }} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('9.99')).toBeInTheDocument();
  });
});
