import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './theme-toggle';

const mocks = vi.hoisted(() => ({
  getCurrentTheme: vi.fn(),
  toggleTheme: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/lib/theme-actions', () => ({
  getCurrentTheme: mocks.getCurrentTheme,
  toggleTheme: mocks.toggleTheme,
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    mocks.getCurrentTheme.mockResolvedValue('light');
    mocks.toggleTheme.mockResolvedValue('dark');
  });

  it('applies the server theme to the document root on mount', async () => {
    render(<ThemeToggle />);

    await waitFor(() => expect(screen.getByRole('switch')).toBeInTheDocument());

    expect(document.documentElement).toHaveClass('light-mode');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('updates the document root immediately when toggled', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(document.documentElement).not.toHaveClass('light-mode'));
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
