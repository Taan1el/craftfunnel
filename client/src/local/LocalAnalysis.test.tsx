import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from '../test/axe';
import { emptyWorkspace } from './analysis';
import { LocalAnalysis } from './LocalAnalysis';
const store = vi.hoisted(() => ({ loadWorkspaceSnapshot: vi.fn(), saveWorkspace: vi.fn() }));
vi.mock('./workspace', () => store);
const importer = vi.hoisted(() => ({ importFile: vi.fn() }));
vi.mock('./importFile', () => importer);
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
  it('keeps focus inside while parsing and restores keyboard navigation after failure', async () => {
    let rejectImport!: (error: Error) => void;
    importer.importFile.mockImplementationOnce(() => new Promise((_, reject) => { rejectImport = reject; }));
    render(<LocalAnalysis />);
    const opener = screen.getByRole('button', { name: 'Import file' });
    await waitFor(() => expect(opener).toBeEnabled()); fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [new File(['{}'], 'synthetic.json')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Import and save' }));
    const dialog = screen.getByRole('dialog');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fireEvent(document, tab); expect(tab.defaultPrevented).toBe(true); expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(dialog).toBeInTheDocument();
    await act(async () => rejectImport(new Error('synthetic.json: invalid data')));
    expect(screen.getByRole('alert')).toHaveTextContent('synthetic.json: invalid data');
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    opener.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(screen.getByLabelText('File type')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus();
    expect(store.saveWorkspace).not.toHaveBeenCalled();
  });
  it('does not change displayed data when storage rejects a save', async () => {
    store.saveWorkspace.mockRejectedValueOnce(new Error('Workspace changed in another tab.'));
    render(<LocalAnalysis />); await waitFor(() => expect(screen.getByRole('button', { name: 'Apply steps' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Event names, one per line'), { target: { value: 'enter\nleave' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply steps' }));
    await screen.findByText('Workspace changed in another tab.'); expect(screen.getByRole('columnheader', { name: 'signup' })).toBeInTheDocument(); expect(screen.queryByRole('columnheader', { name: 'leave' })).not.toBeInTheDocument();
  });
});
