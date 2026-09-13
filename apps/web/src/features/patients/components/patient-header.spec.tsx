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
  it('renders the 7 clinical categories in Spanish', () => {
    render(<PatientHeader patientId="p-1" />);

    expect(screen.getByRole('heading', { name: 'Paciente' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones del paciente' })).toBeInTheDocument();
    expect(screen.getByText('Datos del paciente')).toBeInTheDocument();
    expect(screen.getByText('Antecedentes')).toBeInTheDocument();
    expect(screen.getByText('Enfermedad actual')).toBeInTheDocument();
    expect(screen.getByText('Exploración física')).toBeInTheDocument();
    expect(screen.getByText('Pruebas complementarias')).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico')).toBeInTheDocument();
    expect(screen.getByText('Tratamiento')).toBeInTheDocument();
  });
});
