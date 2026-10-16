import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use the backend stream route so camera access can be shared', () => {
    const url = component.buildCameraStreamUrl(7);

    expect(url).toContain('/camera/stream/7');
    expect(url).not.toContain(':81/stream');
  });

  it('should use the seven complete calendar days before today', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 6, 14, 30));
    component.historyFilter = '7d';

    const range = component['getHistoryRange']();

    expect(range?.from).toEqual(new Date(2026, 8, 29, 0, 0, 0, 0));
    expect(range?.to).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
    jasmine.clock().uninstall();
  });

  it('should format a recovered outage duration', () => {
    expect(
      component.formatOutageDuration(
        '2026-10-06T12:00:00.000Z',
        '2026-10-06T13:02:05.000Z',
      ),
    ).toBe('1 h 2 min 5 s');
  });

  it('should estimate an outage from the last expected telemetry interval to recovery', () => {
    const outage = component['toOutageHistoryEntry'](
      { id: 10, createdAt: '2026-10-06T12:00:00.000Z' },
      { id: 14, createdAt: '2026-10-06T12:01:00.000Z' },
    );

    expect(outage).toEqual({
      id: 'outage-10-14',
      eventType: 'disconnect',
      createdAt: '2026-10-06T12:01:00.000Z',
      startedAt: '2026-10-06T12:00:15.000Z',
      endedAt: '2026-10-06T12:01:00.000Z',
    });
  });

  it('should plot the selected humidity sensor instead of the average', () => {
    component.telemetry = [
      {
        id: 1,
        createdAt: '2026-10-06T12:00:00.000Z',
        temperature1: 20,
        temperature2: 22,
        humidity1: 34,
        humidity2: 40,
      },
      {
        id: 2,
        createdAt: '2026-10-06T12:05:00.000Z',
        temperature1: 20,
        temperature2: 22,
        humidity1: 24,
        humidity2: 40,
      },
    ];
    component.chartHumidityView = 's1';

    component.onSensorViewChange();

    expect(component.lineChartData.datasets[1].label).toBe('Humedad Sensor 1 %');
    expect(component.lineChartData.datasets[1].data).toEqual([
      { id: 1, x: new Date('2026-10-06T12:00:00.000Z').getTime(), y: 34 },
      { id: 2, x: new Date('2026-10-06T12:05:00.000Z').getTime(), y: 24 },
    ]);
  });

  it('should keep plotting the humidity average when average view is selected', () => {
    component.telemetry = [
      {
        id: 1,
        createdAt: '2026-10-06T12:00:00.000Z',
        temperature1: 20,
        temperature2: 22,
        humidity1: 34,
        humidity2: 40,
      },
    ];
    component.chartHumidityView = 'avg';

    component.onSensorViewChange();

    expect(component.lineChartData.datasets[1].label).toBe('Humedad Promedio %');
    expect(component.lineChartData.datasets[1].data).toEqual([
      { id: 1, x: new Date('2026-10-06T12:00:00.000Z').getTime(), y: 37 },
    ]);
  });

  it('should mark days without telemetry records', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 6, 14, 30));
    component.historyFilter = '7d';
    component['periodTelemetry'] = [
      { createdAt: new Date(2026, 9, 2, 12).toISOString() },
    ];

    component['refreshHistoryBuckets']();

    expect(component.historyBuckets).toHaveSize(7);
    expect(component.historyBuckets.filter((bucket) => bucket.hasRecords)).toHaveSize(1);
    expect(component.historyBuckets.filter((bucket) => !bucket.hasRecords)).toHaveSize(6);
    jasmine.clock().uninstall();
  });

  it('should create eight consecutive selectable three-hour periods for the last-24-hours filter', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 6, 14, 30));
    component.historyFilter = '24h';
    component['periodTelemetry'] = [];

    component['refreshHistoryBuckets']();

    expect(component.historyBuckets).toHaveSize(8);
    expect(
      component.historyBuckets.every(
        (bucket, index, buckets) =>
          bucket.end.getTime() - bucket.start.getTime() ===
            3 * 60 * 60 * 1000 - 1 &&
          (index === 0 ||
            bucket.start.getTime() === buckets[index - 1].end.getTime() + 1),
      ),
    ).toBeTrue();
    expect(component.historyBuckets.every((bucket) => !bucket.hasRecords)).toBeTrue();
    jasmine.clock().uninstall();
  });
});
