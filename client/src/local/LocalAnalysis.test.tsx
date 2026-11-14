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
  beforeEach(() => { vi.clearAllMocks(); store.loadWorkspaceSnapshot.mockResolvedValue({ data: emptyWorkspace(), revision: 0 }); store.saveWorkspace.mockResolvedValue(1); });
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
  const openImport = async () => {
    const { container } = render(<LocalAnalysis />);
    const opener = screen.getByRole('button', { name: 'Import file' });
    await waitFor(() => expect(opener).toBeEnabled()); fireEvent.click(opener);
    return Object.assign(opener, { container });
  };
  const chooseBackup = () => { fireEvent.change(screen.getByLabelText('File type'), { target: { value: 'backup' } }); fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [new File(['{}'], 'backup.json')] } }); fireEvent.click(screen.getByRole('button', { name: 'Import and save' })); };
  const backup = () => ({ ...emptyWorkspace(), events: [{ user: 'a', event: 'visit', time: 0 }, { user: 'a', event: 'signup', time: 1 }], payments: [{ id: 'p', amount: '1', currency: 'USD', row: 2 }] });
  it('asks before a backup replaces the workspace, naming what is replaced, and keeps focus in the dialog', async () => {
    store.loadWorkspaceSnapshot.mockResolvedValue({ data: { ...emptyWorkspace(), events: [{ user: 'x', event: 'visit', time: 5 }] }, revision: 3 });
    importer.importFile.mockResolvedValueOnce({ data: backup() });
    const opener = await openImport(); chooseBackup();
    const keep = await screen.findByRole('button', { name: 'Keep current workspace' });
    expect(screen.getByRole('heading', { name: 'Replace the whole workspace?' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('replaces everything saved in this browser: 1 events, 0 payment rows, 0 order rows');
    expect(screen.getByRole('dialog')).toHaveTextContent('The backup holds 2 events, 1 payment rows, and 0 order rows');
    expect(store.saveWorkspace).not.toHaveBeenCalled(); expect(keep).toHaveFocus(); expect((await axe(opener.container)).violations).toEqual([]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(screen.getByRole('button', { name: 'Replace workspace' })).toHaveFocus();
    fireEvent.click(keep); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus(); expect(store.saveWorkspace).not.toHaveBeenCalled();
  });
  it('replaces the workspace only after the confirmation', async () => {
    importer.importFile.mockResolvedValueOnce({ data: backup() });
    await openImport(); chooseBackup();
    fireEvent.click(await screen.findByRole('button', { name: 'Replace workspace' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(store.saveWorkspace).toHaveBeenCalledTimes(1); expect(store.saveWorkspace.mock.calls[0][0].events).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Workspace replaced from the backup');
  });
  it('does not ask for a dataset import and shows the skipped-row report', async () => {
    importer.importFile.mockResolvedValueOnce({ data: [{ user: 'a', event: 'visit', time: 0 }], report: { imported: 1, skipped: 2, reasons: ['Line 3: timestamp "x" is not an accepted format or not a real date.', 'Line 9: user_id and event must contain 1 to 500 characters.'] } });
    await openImport(); fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [new File(['x'], 'events.csv')] } }); fireEvent.click(screen.getByRole('button', { name: 'Import and save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Replace the whole workspace?')).not.toBeInTheDocument(); expect(store.saveWorkspace).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Imported 1 row, skipped 2.'); expect(screen.getByRole('status')).toHaveTextContent('Line 9: user_id and event');
  });
  it('shows the day-resolution note only for date-only timestamps', async () => {
    store.loadWorkspaceSnapshot.mockResolvedValue({ data: { ...emptyWorkspace(), events: [{ user: 'a', event: 'visit', time: 86_400_000 }, { user: 'a', event: 'signup', time: 86_400_000 }] }, revision: 0 });
    const first = render(<LocalAnalysis />); expect(await screen.findByText('Timestamps have day resolution; same-day steps are ordered by row.')).toBeInTheDocument();
    first.unmount();
    store.loadWorkspaceSnapshot.mockResolvedValue({ data: { ...emptyWorkspace(), events: [{ user: 'a', event: 'visit', time: 86_400_001 }] }, revision: 0 });
    render(<LocalAnalysis />); await waitFor(() => expect(screen.getByRole('button', { name: 'Import file' })).toBeEnabled());
    expect(screen.queryByText(/day resolution/)).not.toBeInTheDocument();
  });
  it('prints very small p-values with a floor and offers the case option on billing', async () => {
    store.loadWorkspaceSnapshot.mockResolvedValue({ data: { ...emptyWorkspace(), experiment: [100000, 1000, 100000, 1500] }, revision: 0 });
    render(<LocalAnalysis />); expect(await screen.findByText(/p < 0\.0001/)).toBeInTheDocument(); expect(screen.queryByText(/p = 0\.0000/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Billing' })); expect(screen.getByLabelText('Match IDs ignoring upper and lower case')).toBeChecked();
  });
});
