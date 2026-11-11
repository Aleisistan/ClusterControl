import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { DashboardComponent } from './dashboard.component';
import { environment } from '../../environments/environment';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const chartPoints = (data: unknown): Array<Record<string, unknown>> =>
    data as Array<Record<string, unknown>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideCharts(withDefaultRegisterables()),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('accepts simulator telemetry for the development dashboard', () => {
    expect(component['acceptsDashboardTelemetrySource']('device')).toBeTrue();
    expect(component['acceptsDashboardTelemetrySource']('simulator')).toBe(
      environment.telemetrySource === 'operational',
    );
    expect(
      component['acceptsDashboardTelemetrySource']('industrial-test'),
    ).toBeFalse();
  });

  it('should classify temperature using the datacenter ranges', () => {
    component.latest = { temperature1: 20, temperature2: 20 };

    component.avgTemperature = 15;
    expect(component.getTemperatureClass()).toBe('warning');

    component.avgTemperature = 17;
    expect(component.getTemperatureClass()).toBe('warning');

    component.avgTemperature = 30;
    expect(component.getTemperatureClass()).toBe('warning');

    component.avgTemperature = 31;
    expect(component.getTemperatureClass()).toBe('critical');

    component.avgTemperature = 14;
    expect(component.getTemperatureClass()).toBe('critical');
  });

  it('should classify humidity using the datacenter ranges', () => {
    component.latest = { humidity1: 40, humidity2: 40 };

    component.avgHumidity = 30;
    expect(component.getHumidityClass()).toBe('normal');

    component.avgHumidity = 25;
    expect(component.getHumidityClass()).toBe('warning');

    component.avgHumidity = 60;
    expect(component.getHumidityClass()).toBe('normal');

    component.avgHumidity = 65;
    expect(component.getHumidityClass()).toBe('warning');

    component.avgHumidity = 19;
    expect(component.getHumidityClass()).toBe('critical');
  });

  it('should limit chart zoom to a five-minute window', () => {
    const zoomOptions = component.lineChartOptions?.plugins?.zoom as {
      limits?: { x?: { minRange?: number } };
    };

    expect(zoomOptions.limits?.x?.minRange).toBe(5 * 60_000);
  });

  it('should use the backend stream route so camera access can be shared', () => {
    const url = component.buildCameraStreamUrl(7);

    expect(url).toContain('/camera/stream/7');
    expect(url).not.toContain(':81/stream');
  });

  it('should build the camera URL from the backend proxy', () => {
    const url = component.buildCameraStreamUrl(7);

    expect(url).toContain(
      `${environment.apiUrl}/camera/stream/7`,
    );
  });

  it('should play a hostname HLS URL directly', () => {
    const streamUrl =
      'https://hoktastream3.webcamera.pl/krakow_cam_6f3258/krakow_cam_6f3258.stream/playlist.m3u8';
    component.selectedClusterId = 7;
    component.selectedCluster = {
      id: 7,
      camera: { ip: streamUrl },
    };

    component['updateCameraStream']();

    expect(component.cameraIsHls).toBeTrue();
    expect(component.cameraIsDirectUrl).toBeTrue();
    expect(component.cameraStreamUrl).toBe(streamUrl);
    component.ngOnDestroy();
  });

  it('should send an IP-based HLS URL through the API relay', () => {
    const streamUrl = 'http://192.168.1.50:8080/cam/live.m3u8?channel=1';
    component.selectedClusterId = 7;
    component.selectedCluster = {
      id: 7,
      camera: { ip: streamUrl },
    };

    component['updateCameraStream']();

    expect(component.cameraIsHls).toBeTrue();
    expect(component.cameraIsDirectUrl).toBeFalse();
    expect(component.cameraStreamUrl).toContain(
      `${environment.apiUrl}/camera/stream/7`,
    );
    component.ngOnDestroy();
  });

  it('should send an IP-based MJPEG URL with a custom path through the API relay', () => {
    component.selectedClusterId = 7;
    component.selectedCluster = {
      id: 7,
      camera: { ip: 'http://192.168.1.50:8080/camera/live?channel=2' },
    };

    component['updateCameraStream']();

    expect(component.cameraIsDirectUrl).toBeFalse();
    expect(component.cameraStreamUrl).toContain(
      `${environment.apiUrl}/camera/stream/7`,
    );
    component.ngOnDestroy();
  });

  it('should build separate API stream URLs for two cameras in one cluster', () => {
    component.selectedClusterId = 7;
    component.selectedCluster = {
      id: 7,
      cameras: [
        { id: 21, name: 'Entrada', ip: '192.168.1.50' },
        { id: 22, name: 'Salida', ip: '192.168.1.51' },
      ],
    };

    component['updateCameraStream']();

    expect(component.cameraViews).toHaveSize(2);
    expect(component.cameraViews[0].streamUrl).toContain('cameraId=21');
    expect(component.cameraViews[1].streamUrl).toContain('cameraId=22');
    component.ngOnDestroy();
  });

  it('should mark a camera inactive and record it when a refreshed stream times out', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T15:00:00.000Z'));
    component.historyFilter = '24h';
    component.camera1Loaded = false;
    component['unavailableCameras'].clear();

    component.camera1Loaded = true;
    component['refreshCameraSource'](1, 7);
    jasmine.clock().tick(10_000);

    expect(component.camera1Loaded).toBeFalse();
    expect(component.stateHistory).toHaveSize(1);
    expect(component.stateHistory[0]).toEqual(
      jasmine.objectContaining({
        eventType: 'camera-state-change',
        cameraName: 'Cámara del cluster',
        from: 'Activa',
        to: 'Inactiva',
      }),
    );
    jasmine.clock().tick(1);
    component.onCameraLoad(1);
    expect(component.stateHistory).toHaveSize(2);
    expect(component.stateHistory[0]).toEqual(
      jasmine.objectContaining({
        cameraName: 'Cámara del cluster',
        from: 'Inactiva',
        to: 'Activa',
      }),
    );
    component.ngOnDestroy();
    jasmine.clock().uninstall();
  });

  it('should retry a failed camera stream without periodic reloads', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T15:00:00.000Z'));
    component.historyFilter = '24h';
    component.camera1Loaded = true;

    component.onCameraError(1);

    expect(component.camera1Loaded).toBeFalse();
    expect(component.stateHistory).toHaveSize(1);
    expect(component['cameraRetryTimeouts'].has(1)).toBeTrue();

    jasmine.clock().tick(15_000);

    expect(component['cameraRetryTimeouts'].has(1)).toBeFalse();
    expect(component['pendingCameraChecks'].has(1)).toBeTrue();
    component.ngOnDestroy();
    jasmine.clock().uninstall();
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

  it('should use the last five minutes', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T15:00:00.000Z'));
    component.historyFilter = '5m';

    const range = component['getHistoryRange']();

    expect(range?.from).toEqual(new Date('2026-10-16T14:55:00.000Z'));
    expect(range?.to).toEqual(new Date('2026-10-16T15:00:00.000Z'));
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

  it('should report when the latest sensor reading is stale', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T15:00:00.000Z'));
    component.latest = { createdAt: '2026-10-16T14:40:00.000Z' };

    expect(component.getLatestTelemetryStatus()).toBe('Sin actualización hace 20 min');
    jasmine.clock().uninstall();
  });

  it('should show the age of the latest real device telemetry with minutes', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T15:00:00.000Z'));
    component.latestDeviceTelemetry = {
      createdAt: '2026-10-15T21:33:00.000Z',
    };

    expect(component.getDeviceTelemetryStatus()).toBe(
      'Sin actualizar hace 17 h 27 min',
    );
    jasmine.clock().uninstall();
  });

  it('should display repeated industrial test errors only once', () => {
    const connectionFailure = 'test_api_root_is_available (ConnectionError)';
    const telemetryFailure =
      'test_target_device_publishes_live_telemetry (AssertionError)';

    expect(
      component.getIndustrialTestFailureMessages([
        connectionFailure,
        connectionFailure,
        telemetryFailure,
      ]),
    ).toBe(
      'El servidor de la aplicación no respondió durante la prueba. Compruebe que el contenedor esté iniciado. | No llegaron datos reales del dispositivo durante la espera. Las pruebas no generan telemetría real; compruebe que el equipo esté encendido, conectado y configurado con el ID correcto.',
    );
  });

  it('should mark the latest sensor reading as recent within the reporting gap', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T15:00:00.000Z'));
    component.latest = { createdAt: '2026-10-16T14:59:01.000Z' };

    expect(component.getLatestTelemetryStatus()).toBe('Lectura reciente');
    jasmine.clock().uninstall();
  });

  it('should not report telemetry gaps shorter than one minute', () => {
    const previous = { createdAt: '2026-10-16T14:59:00.000Z' };
    const current = { createdAt: '2026-10-16T14:59:59.000Z' };

    expect(component['hasTelemetryGap'](previous, current)).toBeFalse();
  });

  it('should report telemetry gaps longer than one minute', () => {
    const previous = { createdAt: '2026-10-16T14:59:00.000Z' };
    const current = { createdAt: '2026-10-16T15:00:01.000Z' };

    expect(component['hasTelemetryGap'](previous, current)).toBeTrue();
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
    expect(chartPoints(component.lineChartData.datasets[1].data)).toEqual([
      {
        id: 1,
        x: new Date('2026-10-06T12:00:00.000Z').getTime(),
        humidity1: 34,
        humidity2: 40,
        y: 34,
      },
      {
        id: 2,
        x: new Date('2026-10-06T12:05:00.000Z').getTime(),
        humidity1: 24,
        humidity2: 40,
        y: 24,
      },
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
    expect(chartPoints(component.lineChartData.datasets[1].data)).toEqual([
      {
        id: 1,
        x: new Date('2026-10-06T12:00:00.000Z').getTime(),
        humidity1: 34,
        humidity2: 40,
        y: 37,
      },
    ]);
  });

  it('should keep one actual telemetry reading per 20-second chart interval', () => {
    component.telemetry = [
      {
        id: 1,
        createdAt: '2026-10-06T12:00:01.000Z',
        temperature1: 20,
        temperature2: 22,
        humidity1: 34,
        humidity2: 40,
      },
      {
        id: 2,
        createdAt: '2026-10-06T12:00:15.000Z',
        temperature1: 21,
        temperature2: 23,
        humidity1: 33,
        humidity2: 39,
      },
      {
        id: 3,
        createdAt: '2026-10-06T12:00:21.000Z',
        temperature1: 22,
        temperature2: 24,
        humidity1: 32,
        humidity2: 38,
      },
    ];
    component.chartHumidityView = 's1';

    component.onSensorViewChange();

    expect(chartPoints(component.lineChartData.datasets[1].data)).toEqual([
      {
        id: 2,
        x: new Date('2026-10-06T12:00:15.000Z').getTime(),
        humidity1: 33,
        humidity2: 39,
        y: 33,
      },
      {
        id: 3,
        x: new Date('2026-10-06T12:00:21.000Z').getTime(),
        humidity1: 32,
        humidity2: 38,
        y: 32,
      },
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
