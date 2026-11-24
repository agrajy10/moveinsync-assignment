import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { type Alert, dummyAlerts } from './dummy-alerts';

const filterFields = [
  { id: 'status', label: 'Status' },
  { id: 'severity', label: 'Severity' },
  { id: 'source', label: 'Source' },
] as const;

type FilterId = (typeof filterFields)[number]['id'];

@Component({
  imports: [DatePipe, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly alerts = signal(dummyAlerts);
  private readonly selectedAlertId = signal<string | undefined>(undefined);
  protected readonly selectedAlert = computed(() => {
    const id = this.selectedAlertId();
    return this.alerts().find((alert) => alert.id === id);
  });
  protected readonly resolvingAlerts = signal<ReadonlySet<string>>(new Set());
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly resolutionForm = viewChild<ElementRef<HTMLFormElement>>('resolutionForm');
  private readonly resolutionNote = viewChild<ElementRef<HTMLInputElement>>('resolutionNote');

  protected readonly filters = filterFields.map(({ id, label }) => ({
    id,
    label,
    options: [...new Set(dummyAlerts.map((alert) => alert[id]))],
  }));

  protected readonly selectedFilters = signal<Partial<Record<FilterId, string>>>({});
  protected readonly hasActiveFilters = computed(() =>
    filterFields.some(({ id }) => Boolean(this.selectedFilters()[id])),
  );

  protected readonly filteredAlerts = computed(() => {
    const selected = this.selectedFilters();
    return this.alerts()
      .filter((alert) =>
        filterFields.every(({ id }) => !selected[id] || alert[id] === selected[id]),
      )
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
  });

  protected setFilter(id: FilterId, value: string): void {
    this.selectedFilters.update((selected) => ({ ...selected, [id]: value }));

    const alert = this.selectedAlert();
    if (alert && !this.filteredAlerts().includes(alert)) {
      this.selectedAlertId.set(undefined);
    }
  }

  protected clearFilters(): void {
    this.selectedFilters.set({});
  }

  protected selectAlert(alert: Alert): void {
    if (this.selectedAlertId() !== alert.id) {
      this.resolutionForm()?.nativeElement.reset();
      this.selectedAlertId.set(alert.id);
    }
  }

  protected openResolution(alert: Alert, event: MouseEvent): void {
    event.stopPropagation();
    this.selectAlert(alert);
    afterNextRender(
      () => {
        if (this.selectedAlert() === alert) {
          this.resolutionNote()?.nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
  }

  protected canResolve(alert: Alert): boolean {
    return alert.status === 'OPEN' || alert.status === 'ESCALATED';
  }

  protected async resolveAlert(event: Event, alert: Alert, value: string): Promise<void> {
    event.preventDefault();
    const note = value.trim();
    if (!note || !this.canResolve(alert) || this.resolvingAlerts().has(alert.id)) {
      return;
    }

    this.resolvingAlerts.update((ids) => new Set(ids).add(alert.id));
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    if (this.destroyRef.destroyed) {
      return;
    }

    const ts = new Date().toISOString();
    this.alerts.update((alerts) =>
      alerts.map((item) =>
        item.id === alert.id
          ? {
              ...item,
              status: 'RESOLVED',
              history: [...item.history, { status: 'RESOLVED', ts, note }],
            }
          : item,
      ),
    );
    this.resolvingAlerts.update((ids) => {
      const remaining = new Set(ids);
      remaining.delete(alert.id);
      return remaining;
    });
  }
}
