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

  it('should prefer the direct camera IP stream when the camera is configured', () => {
    const url = component.buildCameraStreamUrl('192.168.2.54');

    expect(url).toBe('http://192.168.2.54:81/stream');
  });

  it('should fall back to the backend stream route when no direct camera IP exists', () => {
    const url = component.buildCameraStreamUrl('');

    expect(url).toContain('/camera/stream/');
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
