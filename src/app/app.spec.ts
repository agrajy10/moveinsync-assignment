import { formatDate } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { dummyAlerts } from './dummy-alerts';

const newestFirst = [...dummyAlerts].sort((first, second) =>
  second.createdAt.localeCompare(first.createdAt),
);

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header h1')?.textContent).toBe('Alert console');
  });

  it('should render the alert count and filters with None selected', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const filters = [...compiled.querySelectorAll<HTMLSelectElement>('main select')];

    expect(compiled.querySelector('main h2')?.textContent).toBe('Alerts (60)');
    expect(filters.map((filter) => filter.labels?.[0]?.textContent)).toEqual([
      'Status',
      'Severity',
      'Source',
    ]);
    expect(filters.map((filter) => filter.selectedOptions[0]?.textContent)).toEqual([
      'None',
      'None',
      'None',
    ]);
    expect(filters.map((filter) => [...filter.options].map((option) => option.value))).toEqual([
      ['', 'OPEN', 'ESCALATED', 'AUTO_CLOSED', 'RESOLVED'],
      ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      ['', 'tracking-svc', 'billing-svc', 'auth-svc'],
    ]);
    expect(filters.map((filter) => [...filter.options].map((option) => option.text))).toEqual([
      ['None', 'OPEN', 'ESCALATED', 'AUTO_CLOSED', 'RESOLVED'],
      ['None', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      ['None', 'tracking-svc', 'billing-svc', 'auth-svc'],
    ]);
  });

  it('should render all 60 alerts newest first with severity and status pills', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = [...compiled.querySelectorAll('tbody tr')];

    expect([...compiled.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
      'ID',
      'Source',
      'Severity',
      'Status',
      'Created At',
      'Actions',
    ]);
    expect(rows).toHaveLength(60);
    expect(rows.map((row) => row.querySelector('th')?.textContent.trim())).toEqual(
      newestFirst.map((alert) => alert.id),
    );
    expect(rows.map((row) => row.querySelector('.alert-pill[data-severity]')?.textContent)).toEqual(
      newestFirst.map((alert) => alert.severity),
    );
    expect(rows.map((row) => row.querySelector('.alert-pill[data-status]')?.textContent)).toEqual(
      newestFirst.map((alert) => alert.status),
    );
    const timestamps = [...compiled.querySelectorAll<HTMLTimeElement>('tbody time')];
    expect(timestamps.map((time) => time.dateTime)).toEqual(
      newestFirst.map((alert) => alert.createdAt),
    );
    expect(timestamps.map((time) => time.textContent)).toEqual(
      newestFirst.map((alert) => formatDate(alert.createdAt, 'MMM d, y, HH:mm', 'en-US')),
    );
  });

  it('should offer a Resolve action for open and escalated alerts and focus their resolution note', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = [...compiled.querySelectorAll<HTMLButtonElement>('.alert-resolve-button')];
    const eligibleAlerts = newestFirst.filter(
      ({ status }) => status === 'OPEN' || status === 'ESCALATED',
    );

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(
      eligibleAlerts.map(({ id }) => `Resolve ${id}`),
    );
    expect(buttons.every((button) => button.textContent.trim() === 'Resolve')).toBe(true);

    buttons[0].click();
    await fixture.whenStable();
    expect(compiled.querySelector('aside h3')?.textContent).toBe(eligibleAlerts[0].id);
    expect(document.activeElement).toBe(compiled.querySelector('aside input'));
  });

  it('should show matching alerts or an empty state as filters change', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const visibleIds = () =>
      [...compiled.querySelectorAll('tbody th')].map((cell) => cell.textContent.trim());
    const heading = compiled.querySelector('main h2');
    const clearButton = compiled.querySelector<HTMLButtonElement>('.clear-filters-button')!;
    expect(clearButton.disabled).toBe(true);

    async function selectFilter(id: string, value: string) {
      const select = compiled.querySelector<HTMLSelectElement>(`#${id}`)!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    }

    compiled.querySelector<HTMLButtonElement>('tbody button')!.click();
    await fixture.whenStable();
    expect(compiled.querySelector('aside')).not.toBeNull();

    await selectFilter('status', 'ESCALATED');
    expect(clearButton.disabled).toBe(false);
    expect(compiled.querySelector('aside')).toBeNull();
    const escalated = newestFirst.filter(({ status }) => status === 'ESCALATED');
    expect(visibleIds()).toEqual(escalated.map(({ id }) => id));
    expect(heading?.textContent).toBe(`Alerts (${escalated.length})`);

    await selectFilter('severity', 'HIGH');
    const highEscalated = escalated.filter(({ severity }) => severity === 'HIGH');
    expect(visibleIds()).toEqual(highEscalated.map(({ id }) => id));

    await selectFilter('source', 'billing-svc');
    expect(visibleIds()).toEqual(['AL-020']);
    expect(heading?.textContent).toBe('Alerts (1)');

    await selectFilter('source', '');
    expect(visibleIds()).toEqual(highEscalated.map(({ id }) => id));

    await selectFilter('severity', '');
    await selectFilter('status', '');
    expect(visibleIds()).toHaveLength(60);
    expect(heading?.textContent).toBe('Alerts (60)');
    expect(clearButton.disabled).toBe(true);

    await selectFilter('status', 'AUTO_CLOSED');
    await selectFilter('severity', 'CRITICAL');
    await selectFilter('source', 'auth-svc');
    expect(heading?.textContent).toBe('Alerts (0)');
    expect(compiled.querySelector('table')).toBeNull();
    expect(compiled.querySelector('[role="status"] h3')?.textContent).toBe(
      'No alerts match your filters',
    );

    await selectFilter('source', '');
    expect(compiled.querySelector('[role="status"]')).toBeNull();
    expect(visibleIds()).toEqual(['AL-035', 'AL-034']);

    await selectFilter('source', 'auth-svc');
    clearButton.click();
    await fixture.whenStable();
    expect(clearButton.disabled).toBe(true);
    const filters = [...compiled.querySelectorAll<HTMLSelectElement>('.alert-filters select')];
    expect(filters.map((filter) => filter.value)).toEqual(['', '', '']);
    expect(heading?.textContent).toBe('Alerts (60)');
    expect(visibleIds()).toEqual(newestFirst.map(({ id }) => id));
  });

  it('should generate chronological histories that match each alert status', () => {
    for (const alert of dummyAlerts) {
      const statuses = alert.history.map((event) => event.status);
      const expectedStatuses = {
        OPEN: [['OPEN']],
        ESCALATED: [['OPEN', 'ESCALATED']],
        AUTO_CLOSED: [['OPEN', 'AUTO_CLOSED']],
        RESOLVED: [
          ['OPEN', 'RESOLVED'],
          ['OPEN', 'ESCALATED', 'RESOLVED'],
        ],
      };
      expect(expectedStatuses[alert.status]).toContainEqual(statuses);
      expect(alert.history[0].ts).toBe(alert.createdAt);

      const timestamps = alert.history.map((event) => Date.parse(event.ts));
      expect(timestamps.every(Number.isFinite)).toBe(true);
      expect(timestamps).toEqual([...new Set(timestamps)].sort((first, second) => first - second));
    }
  });

  it('should open the sidebar on row selection and show the selected alert details and timeline', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('aside')).toBeNull();

    const rows = compiled.querySelectorAll('tbody tr');
    rows[0].querySelector('td')!.click();
    await fixture.whenStable();
    expect(compiled.querySelector('aside h3')?.textContent).toBe(newestFirst[0].id);

    const alertIndex = newestFirst.findIndex(({ status }) => status === 'RESOLVED');
    const alert = newestFirst[alertIndex];
    const button = rows[alertIndex].querySelector('button')!;
    button.click();
    await fixture.whenStable();

    const panel = compiled.querySelector('aside')!;
    expect(panel.querySelector('h3')?.textContent).toBe(alert.id);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.querySelector('.alert-details dd')?.textContent).toBe(alert.source);
    expect(panel.querySelector<HTMLTimeElement>('.alert-details time')?.dateTime).toBe(
      alert.createdAt,
    );
    expect(panel.querySelector('h4')?.textContent).toBe('Timeline');
    expect(
      [...panel.querySelectorAll('.timeline [data-status]')].map((event) => event.textContent),
    ).toEqual(alert.history.map((event) => event.status));
    const times = [...panel.querySelectorAll<HTMLTimeElement>('.timeline time')];
    expect(times.map((time) => time.dateTime)).toEqual(alert.history.map((event) => event.ts));
    expect(times.map((time) => time.textContent)).toEqual(
      alert.history.map((event) => formatDate(event.ts, 'MMM d, y, HH:mm', 'en-US')),
    );
  });

  it('should require a resolution note in the sidebar form', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll<HTMLButtonElement>('.alert-row-button');
    buttons[0].click();
    await fixture.whenStable();
    const form = compiled.querySelector<HTMLFormElement>('aside form');
    const input = form?.querySelector('input');

    expect(input?.labels?.[0]?.textContent).toBe('Resolution note (required)');
    expect(form?.querySelector('button[type="submit"]')?.textContent.trim()).toBe('Resolve');
    expect(form?.checkValidity()).toBe(false);
    input!.value = '   ';
    expect(form?.checkValidity()).toBe(false);
    input!.value = 'Issue fixed';
    expect(form?.checkValidity()).toBe(true);

    buttons[1].click();
    await fixture.whenStable();
    expect(compiled.querySelector<HTMLInputElement>('aside input')?.value).toBe('');

    const escalatedIndex = newestFirst.findIndex(({ status }) => status === 'ESCALATED');
    buttons[escalatedIndex].click();
    await fixture.whenStable();
    expect(compiled.querySelector('aside form')).not.toBeNull();

    for (const status of ['AUTO_CLOSED', 'RESOLVED']) {
      const index = newestFirst.findIndex((alert) => alert.status === status);
      buttons[index].click();
      await fixture.whenStable();
      expect(compiled.querySelector('aside form')).toBeNull();
    }
  });

  it('should resolve a filtered alert after the delay and show the note beside its new event', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const statusFilter = compiled.querySelector<HTMLSelectElement>('#status')!;
    statusFilter.value = 'OPEN';
    statusFilter.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const action = compiled.querySelector<HTMLButtonElement>('.alert-resolve-button')!;
    const row = action.closest('tr')!;
    action.click();
    await fixture.whenStable();
    const form = compiled.querySelector<HTMLFormElement>('aside form')!;
    const input = form.querySelector('input')!;
    const submit = form.querySelector('button')!;

    input.value = '   ';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(submit.disabled).toBe(false);

    input.value = '  Issue fixed  ';
    submit.click();
    await fixture.whenStable();
    expect(submit.disabled).toBe(true);
    expect(submit.textContent.trim()).toBe('Resolving…');
    expect(row.querySelector('[data-status]')?.textContent).toBe('OPEN');

    await new Promise((resolve) => setTimeout(resolve, 800));
    await fixture.whenStable();
    expect(row.isConnected).toBe(false);
    expect(compiled.querySelector('aside form')).toBeNull();
    const event = compiled.querySelector('aside .timeline li:last-child')!;
    expect(event.querySelector('[data-status]')?.textContent).toBe('RESOLVED');
    expect(event.querySelector('.timeline-note')?.textContent).toBe('Issue fixed');

    statusFilter.value = 'RESOLVED';
    statusFilter.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const resolvedRow = compiled.querySelector('tbody tr.is-selected')!;
    expect(resolvedRow.querySelector('[data-status]')?.textContent).toBe('RESOLVED');
    expect(resolvedRow.querySelector('.alert-resolve-button')).toBeNull();
  });
});
