import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { PatientHeader } from './patient-header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/patients/p-1',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

describe('PatientHeader', () => {
  it('renders patient sections in Spanish', () => {
    render(<PatientHeader patientId="p-1" />);

    expect(screen.getByRole('heading', { name: 'Paciente' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones del paciente' })).toBeInTheDocument();
    expect(screen.getByText('Resumen')).toBeInTheDocument();
    expect(screen.getByText('Historia clínica')).toBeInTheDocument();
    expect(screen.getByText('Cirugías')).toBeInTheDocument();
    expect(screen.getByText('Imágenes')).toBeInTheDocument();
    expect(screen.getByText('Informes')).toBeInTheDocument();
  });
});
