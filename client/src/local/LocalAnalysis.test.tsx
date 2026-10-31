import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from '../test/axe';
import { emptyWorkspace } from './analysis';
import { LocalAnalysis } from './LocalAnalysis';
const store = vi.hoisted(() => ({ loadWorkspaceSnapshot: vi.fn(), saveWorkspace: vi.fn() }));
vi.mock('./workspace', () => store);
describe('local analysis screens', () => {
  beforeEach(() => { store.loadWorkspaceSnapshot.mockResolvedValue({ data: emptyWorkspace(), revision: 0 }); store.saveWorkspace.mockResolvedValue(1); });
  it('has accessible funnel, experiments, billing and import dialog', async () => {
    const { container } = render(<LocalAnalysis />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import file' })).toBeEnabled());
    expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Billing' })); expect((await axe(container)).violations).toEqual([]);
    const opener = screen.getByRole('button', { name: 'Import file' }); fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Import and save' })); expect(screen.getByRole('alert')).toHaveTextContent('Choose a file'); expect(store.saveWorkspace).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus();
  });
  it('does not change displayed data when storage rejects a save', async () => {
    store.saveWorkspace.mockRejectedValueOnce(new Error('Workspace changed in another tab.'));
    render(<LocalAnalysis />); await waitFor(() => expect(screen.getByRole('button', { name: 'Apply steps' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Event names, one per line'), { target: { value: 'enter\nleave' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply steps' }));
    await screen.findByText('Workspace changed in another tab.'); expect(screen.getByRole('columnheader', { name: 'signup' })).toBeInTheDocument(); expect(screen.queryByRole('columnheader', { name: 'leave' })).not.toBeInTheDocument();
  });
});
