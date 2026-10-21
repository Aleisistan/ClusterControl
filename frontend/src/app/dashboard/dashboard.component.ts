import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import zoomPlugin from 'chartjs-plugin-zoom';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { SocketService } from '../services/socket.service';
import {
  TelemetryService,
  TelemetryHistoryEntry,
  TelemetryOutageHistoryEntry,
  TelemetryStateHistoryEntry,
  CameraStateHistoryEntry,
  DoorSnapshotHistoryEntry,
} from '../services/telemetry.service';
import { WeatherService } from '../services/weather.service';
import { ClusterService } from '../services/cluster.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

Chart.register(zoomPlugin);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private static readonly TELEMETRY_INTERVAL_MS = 15_000;
  private static readonly OUTAGE_GAP_MS = 60_000;
  private static readonly CHART_MIN_RANGE_MS = 60_000;
  private static readonly CHART_HISTORY_LIMIT = 10_000;
  private static readonly CHART_SAMPLE_INTERVAL_MS = 20_000;
  private static readonly CAMERA_REFRESH_INTERVAL_MS = 15_000;
  private static readonly CAMERA_LOAD_TIMEOUT_MS = 10_000;

  @ViewChild(BaseChartDirective) telemetryChart?: BaseChartDirective;

  telemetry: any[] = [];
  latest: any;
  avgTemperature: number = 0;
  avgHumidity: number = 0;
  weather: any;
  forecast: any;
  currentTime = new Date();
  clusterTime = '';
  clusterDate = '';
  cameraStreamUrl: string = '';
  selectedCluster: any;
  clusters: any[] = [];
  selectedClusterId = 1;
  temperatureView = 'avg';
  humidityView = 'avg';
  chartTemperatureView = 's1';
  chartHumidityView = 's1';
  historyFilter = '24h';
  historyDate = this.toDateInputValue(new Date());
  historyFromDate = this.toDateInputValue(new Date());
  historyToDate = this.toDateInputValue(new Date());
  historyFilterError = '';
  historyBuckets: Array<{
    label: string;
    start: Date;
    end: Date;
    hasRecords: boolean;
  }> = [];
  selectedHistoryBucket: {
    label: string;
    start: Date;
    end: Date;
    hasRecords: boolean;
  } | null = null;
  stateHistory: TelemetryHistoryEntry[] = [];
  stateHistoryError = '';
  snapshotDownloadError = '';
  snapshotPreviewError = '';
  
  lastWsTime: number = 0;
  camera1Loaded = false;
  camera2Loaded = false;
  camera2StreamUrl = environment.camera2Url;
  private routeSubscription?: Subscription;
  private pendingClusterId: number | null = null;
  private unsubscribeTelemetry?: () => void;
  private unsubscribeDoorSnapshot?: () => void;
  private telemetryHistoryRequestId = 0;
  private periodTelemetry: any[] = [];
  private cameraHistorySequence = 0;
  private cameraRefreshInterval?: ReturnType<typeof setInterval>;
  private cameraLoadTimeouts = new Map<1 | 2, ReturnType<typeof setTimeout>>();
  private snapshotImageUrls = new Map<number, string>();
  private snapshotPreviewRequests = new Map<number, Subscription>();
  private snapshotPreviewFailures = new Set<number>();
  private pendingCameraChecks = new Set<1 | 2>();
  private unavailableCameras = new Set<1 | 2>();

  lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'Temperatura Promedio °C' },
      { data: [], label: 'Humedad Promedio %' }
    ]
  };

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Fecha y hora',
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 100,
          stepSize: DashboardComponent.CHART_SAMPLE_INTERVAL_MS,
          maxRotation: 45,
          minRotation: 0,
          callback: (value) =>
            this.formatTelemetryDate(new Date(Number(value)).toISOString()),
        },
      },
    },
    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          drag: {
            enabled: true,
          },
          mode: 'x',
        },
        limits: {
          x: {
            minRange: DashboardComponent.CHART_MIN_RANGE_MS,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const timestamp = items[0]?.parsed.x;
            return typeof timestamp === 'number'
              ? this.formatTelemetryDate(new Date(timestamp).toISOString())
              : '';
          },
          afterTitle: (items) => {
            const point = items[0]?.raw;
            return typeof point === 'object' &&
              point !== null &&
              'id' in point
              ? `Lectura ID: ${point.id}`
              : '';
          },
          afterBody: (items) => {
            const point = items.find((item) => item.datasetIndex === 1)
              ?.raw as { humidity1?: unknown; humidity2?: unknown } | undefined;
            if (
              !point ||
              typeof point.humidity1 !== 'number' ||
              typeof point.humidity2 !== 'number'
            ) {
              return [];
            }

            return [
              `Sensor 1: ${point.humidity1}%`,
              `Sensor 2: ${point.humidity2}%`,
            ];
          },
        },
      },
    },
  };

  constructor(
    private telemetryService: TelemetryService,
    private socketService: SocketService,
    private weatherService: WeatherService,
    private clusterService: ClusterService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.refreshCameraSource(2);
    this.cameraRefreshInterval = setInterval(() => {
      this.refreshCameraSource(1);
      this.refreshCameraSource(2);
    }, DashboardComponent.CAMERA_REFRESH_INTERVAL_MS);

    const initialClusterId = this.route.snapshot.queryParamMap.get('clusterId');
    this.pendingClusterId = initialClusterId ? Number(initialClusterId) : null;

    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      const queryClusterId = params.get('clusterId');
      this.pendingClusterId = queryClusterId ? Number(queryClusterId) : null;

      if (this.clusters.length > 0) {
        const clusterId = this.pendingClusterId ?? this.selectedClusterId;
        this.applyClusterSelection(clusterId);
        
        this.loadTelemetry();
        this.loadWeather();
      this.updateClusterTime();
      }
    });

    this.clusterService.getClusters().subscribe(
      (clusters: any[]) => {
        // Llama a la selección una vez que los clusters YA están en memoria
  if (this.clusters.length > 0) {
    const clusterId = this.pendingClusterId ?? this.selectedClusterId;
    this.applyClusterSelection(clusterId);
  }

        this.clusters = clusters;

        const initialSelectedId =
          this.pendingClusterId &&
          this.clusters.some((cluster: any) => Number(cluster.id) === Number(this.pendingClusterId))
            ? Number(this.pendingClusterId)
            : Number(this.clusters[0].id);

        this.applyClusterSelection(initialSelectedId);
        this.navigateWithClusterId(this.selectedClusterId);
        this.loadTelemetry();
        this.loadWeather();
        this.updateClusterTime();
      },
      (error: any) => console.error('ERROR OBTENIENDO CLUSTERS:', error)
    );

    setInterval(() => {
      this.currentTime = new Date();
      this.updateClusterTime();
    }, 1000);
  };
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.unsubscribeTelemetry?.();
    this.unsubscribeDoorSnapshot?.();
    this.clearDoorSnapshotPreviews();
    if (this.cameraRefreshInterval) clearInterval(this.cameraRefreshInterval);
    for (const timeout of this.cameraLoadTimeouts.values()) clearTimeout(timeout);
  }

  onClusterChange(clusterId: number): void {
  const id = Number(clusterId);
  if (!id) return;

  this.selectedClusterId = id;
  this.lastWsTime = 0;
  this.stateHistory = [];
  this.stateHistoryError = '';

  // Actualiza el cluster seleccionado en memoria
  this.applyClusterSelection(id);

  // Navega y refresca
  this.navigateWithClusterId(id);
  this.latest = undefined;
  this.avgTemperature = 0;
  this.avgHumidity = 0;

  this.loadTelemetry();
  this.loadWeather();
  this.updateClusterTime(); // <--- Aquí ya calculará la hora con el nuevo timezone
  this.updateCameraStream();
}

  onCameraLoad(cameraId: 1 | 2): void {
    this.clearCameraLoadTimeout(cameraId);
    this.pendingCameraChecks.delete(cameraId);
    const wasInactive = this.unavailableCameras.delete(cameraId);
    if (cameraId === 1) {
      this.camera1Loaded = true;
    } else {
      this.camera2Loaded = true;
    }

    if (wasInactive) {
      this.recordCameraStateChange(cameraId, 'Inactiva', 'Activa');
    }
  }

  onCameraError(cameraId: 1 | 2): void {
    this.clearCameraLoadTimeout(cameraId);
    this.pendingCameraChecks.delete(cameraId);
    const wasActive = cameraId === 1 ? this.camera1Loaded : this.camera2Loaded;
    if (cameraId === 1) {
      this.camera1Loaded = false;
    } else {
      this.camera2Loaded = false;
    }

    if (!wasActive) return;

    this.unavailableCameras.add(cameraId);
    this.recordCameraStateChange(cameraId, 'Activa', 'Inactiva');
  }

  private recordCameraStateChange(
    cameraId: 1 | 2,
    from: 'Activa' | 'Inactiva',
    to: 'Activa' | 'Inactiva',
  ): void {
    const createdAt = new Date();
    if (!this.isWithinHistoryRange(createdAt)) return;

    const cameraEvent: CameraStateHistoryEntry = {
      id: `camera-${cameraId}-${++this.cameraHistorySequence}`,
      eventType: 'camera-state-change',
      createdAt: createdAt.toISOString(),
      cameraName: cameraId === 1 ? 'Cámara Datacenter' : 'Cámara Exterior',
      from,
      to,
    };
    this.stateHistory = [...this.stateHistory, cameraEvent]
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      )
      .slice(0, 2000);
  }

  onHistoryFilterChange(): void {
    this.historyFilterError = '';
    if (this.historyFilter !== 'custom') {
      this.loadTelemetry();
    }
  }

  applyHistoryFilter(): void {
    this.historyFilterError = '';
    this.loadTelemetry();
  }

  loadTelemetry(): void {
    const range = this.getHistoryRange();
    if (!range) return;

    const clusterId = Number(this.selectedClusterId);
    const requestId = ++this.telemetryHistoryRequestId;
    this.selectedHistoryBucket = null;
    this.periodTelemetry = [];
    this.telemetry = [];
    this.historyBuckets = [];
    this.refreshTelemetryChart();
    this.clearDoorSnapshotPreviews();
    this.stateHistory = [];
    this.stateHistoryError = '';

    // 1. Obtener telemetría inicial
    this.telemetryService
      .getLatest(clusterId)
      .subscribe((data: any) => {
        if (data && Number(this.selectedClusterId) === clusterId) {
          this.latest = data;
          this.avgTemperature = (this.latest.temperature1 + this.latest.temperature2) / 2;
          this.avgHumidity = (this.latest.humidity1 + this.latest.humidity2) / 2;
        }
      });

    // 2. Obtener historial para el gráfico
    this.telemetryService
      .getHistory(clusterId, {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        limit: DashboardComponent.CHART_HISTORY_LIMIT,
      })
      .subscribe((data: any) => {
        if (
          requestId !== this.telemetryHistoryRequestId ||
          Number(this.selectedClusterId) !== clusterId
        ) {
          return;
        }

        const loadedHistory = Array.isArray(data) ? data : [];
        this.periodTelemetry = this.mergeTelemetrySamples(
          [loadedHistory, this.periodTelemetry],
          range,
        );
        this.telemetry = this.periodTelemetry;
        this.refreshTelemetryChart();
        this.refreshHistoryBuckets(range);
      });

    this.stateHistoryError = '';
    this.telemetryService
      .getStateHistory(this.selectedClusterId, {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        limit: 2000,
      })
      .subscribe({
        next: (data) => {
          if (
            requestId !== this.telemetryHistoryRequestId ||
            Number(this.selectedClusterId) !== clusterId
          ) {
            return;
          }

          const loadedHistory = Array.isArray(data) ? data : [];
          const liveEntries = this.stateHistory.filter(
            (entry) => !loadedHistory.some((loaded) => loaded.id === entry.id),
          );
          this.stateHistory = [...loadedHistory, ...liveEntries]
            .sort(
              (first, second) =>
                new Date(second.createdAt).getTime() -
                new Date(first.createdAt).getTime(),
            )
            .slice(0, 2000);
          this.savedDoorSnapshots.forEach((entry) =>
            this.loadDoorSnapshotPreview(entry),
          );
        },
        error: () => {
          if (
            requestId !== this.telemetryHistoryRequestId ||
            Number(this.selectedClusterId) !== clusterId
          ) {
            return;
          }

          this.stateHistory = [];
          this.stateHistoryError = 'No se pudo cargar el historial de cambios de estado.';
        },
      });

    // 3. Suscribirse a WebSocket pasando la función callback
    this.unsubscribeTelemetry?.();
    this.unsubscribeTelemetry = this.socketService.onClusterTelemetry((data: any) => {
      const payloadClusterId = data?.clusterId ?? data?.cluster_id;

      if (data && Number(payloadClusterId) === clusterId &&
          Number(this.selectedClusterId) === clusterId) {
        this.lastWsTime = Date.now();
        this.addTelemetrySample(data);
        const previous = this.latest;
        if (previous && Number(previous.id) !== Number(data.id)) {
          if (
            this.hasTelemetryGap(previous, data) &&
            this.isWithinHistoryRange(data.createdAt)
          ) {
            const outage = this.toOutageHistoryEntry(previous, data);
            if (!this.stateHistory.some((entry) => entry.id === outage.id)) {
              this.stateHistory = [...this.stateHistory, outage]
                .sort(
                  (first, second) =>
                    new Date(second.createdAt).getTime() -
                    new Date(first.createdAt).getTime(),
                )
                .slice(0, 2000);
            }
          }

          if (
            this.hasStateChanges(previous, data) &&
            this.isWithinHistoryRange(data.createdAt) &&
            !this.stateHistory.some((entry) => entry.id === Number(data.id))
          ) {
            this.stateHistory = [
              ...this.stateHistory,
              this.toStateHistoryEntry(previous, data),
            ]
              .sort(
                (first, second) =>
                  new Date(second.createdAt).getTime() -
                  new Date(first.createdAt).getTime(),
              )
              .slice(0, 2000);
          }
        }
        this.latest = data;
      
        this.avgTemperature = (data.temperature1 + data.temperature2) / 2;
        this.avgHumidity = (data.humidity1 + data.humidity2) / 2;
      }
    });
    this.unsubscribeDoorSnapshot?.();
    this.unsubscribeDoorSnapshot = this.socketService.onDoorSnapshot((data: any) => {
      if (
        Number(data?.clusterId) !== clusterId ||
        Number(this.selectedClusterId) !== clusterId ||
        !this.isWithinHistoryRange(data.createdAt)
      ) {
        return;
      }

      const snapshot: DoorSnapshotHistoryEntry = {
        id: `door-snapshot-${data.snapshotId}`,
        eventType: 'door-snapshot',
        snapshotId: Number(data.snapshotId),
        telemetryId: Number(data.telemetryId),
        createdAt: new Date(data.createdAt).toISOString(),
      };
      if (this.stateHistory.some((entry) => entry.id === snapshot.id)) return;

      this.stateHistory = [...this.stateHistory, snapshot]
        .sort(
          (first, second) =>
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime(),
        )
        .slice(0, 2000);
      this.loadDoorSnapshotPreview(snapshot);
    });
  }

  private addTelemetrySample(item: any): void {
    const range = this.getHistoryRange();
    const createdAt = new Date(item.createdAt);
    if (
      !range ||
      Number.isNaN(createdAt.getTime()) ||
      createdAt < range.from ||
      createdAt > range.to
    ) {
      return;
    }

    this.periodTelemetry = this.mergeTelemetrySamples(
      [[...this.periodTelemetry, item]],
      range,
    );
    this.refreshHistoryBuckets(range);

    if (this.selectedHistoryBucket) {
      if (
        createdAt < this.selectedHistoryBucket.start ||
        createdAt > this.selectedHistoryBucket.end
      ) {
        return;
      }
    } else {
      this.telemetry = this.periodTelemetry;
    }

    this.telemetry = this.mergeTelemetrySamples(
      [[...this.telemetry, item]],
      this.selectedHistoryBucket
        ? { from: this.selectedHistoryBucket.start, to: this.selectedHistoryBucket.end }
        : range,
    );
    this.refreshTelemetryChart();
  }

  private mergeTelemetrySamples(
    groups: any[][],
    range?: { from: Date; to: Date },
  ): any[] {
    const samples = new Map<number, any>();
    for (const group of groups) {
      for (const sample of group) {
        const createdAt = new Date(sample.createdAt);
        if (
          range &&
          (Number.isNaN(createdAt.getTime()) ||
            createdAt < range.from ||
            createdAt > range.to)
        ) {
          continue;
        }
        samples.set(Number(sample.id), sample);
      }
    }

    return [...samples.values()]
      .sort(
        (first, second) =>
          new Date(first.createdAt).getTime() -
          new Date(second.createdAt).getTime(),
      )
      .slice(-DashboardComponent.CHART_HISTORY_LIMIT);
  }

  private refreshHistoryBuckets(
    range = this.getHistoryRange(),
  ): void {
    if (!range) {
      this.historyBuckets = [];
      return;
    }

    const buckets: Array<{
      label: string;
      start: Date;
      end: Date;
      hasRecords: boolean;
    }> = [];
    const isHourly = this.historyFilter === '24h';
    const cursor = new Date(range.from);

    while (cursor <= range.to) {
      const start = new Date(cursor);
      const next = new Date(start);
      if (isHourly) {
        next.setTime(next.getTime() + 3 * 60 * 60 * 1000);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
      }
      const end = new Date(Math.min(next.getTime() - 1, range.to.getTime()));
      const hasRecords = this.periodTelemetry.some((item: any) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= start && createdAt <= end;
      });
      buckets.push({
        label: isHourly
          ? `${start.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${this.formatHour(start)}–${this.formatHour(next)}`
          : start.toLocaleDateString('es-AR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
            }),
        start,
        end,
        hasRecords,
      });
      cursor.setTime(next.getTime());
    }

    this.historyBuckets = buckets;
    if (this.selectedHistoryBucket) {
      this.selectedHistoryBucket =
        buckets.find(
          (bucket) =>
            bucket.start.getTime() === this.selectedHistoryBucket?.start.getTime(),
        ) ?? this.selectedHistoryBucket;
    }
  }

  private formatHour(date: Date): string {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  selectHistoryBucket(bucket: {
    label: string;
    start: Date;
    end: Date;
    hasRecords: boolean;
  }): void {
    this.selectedHistoryBucket = bucket;
    this.historyFilterError = '';
    const requestId = ++this.telemetryHistoryRequestId;
    this.telemetry = [];
    this.refreshTelemetryChart();

    if (!bucket.hasRecords) return;

    this.telemetryService
      .getHistory(Number(this.selectedClusterId), {
        from: bucket.start.toISOString(),
        to: bucket.end.toISOString(),
        limit: DashboardComponent.CHART_HISTORY_LIMIT,
      })
      .subscribe({
        next: (data: any) => {
          if (
            requestId !== this.telemetryHistoryRequestId ||
            !this.selectedHistoryBucket ||
            this.selectedHistoryBucket.start.getTime() !== bucket.start.getTime()
          ) {
            return;
          }

          this.telemetry = this.mergeTelemetrySamples(
            [Array.isArray(data) ? data : [], this.periodTelemetry],
            { from: bucket.start, to: bucket.end },
          );
          this.refreshTelemetryChart();
        },
        error: () => {
          if (requestId === this.telemetryHistoryRequestId) {
            this.historyFilterError = 'No se pudieron cargar las lecturas de este período.';
          }
        },
      });
  }

  showFullHistory(): void {
    this.selectedHistoryBucket = null;
    this.telemetry = this.periodTelemetry;
    this.historyFilterError = '';
    this.telemetryHistoryRequestId++;
    this.refreshTelemetryChart();
  }

  private refreshTelemetryChart(): void {
    const chartSamples = this.getChartSamples();
    this.lineChartData = {
      labels: [],
      datasets: [
        {
          data: chartSamples.map((item: any) => ({
            id: item.id,
            x: new Date(item.createdAt).getTime(),
            y: this.chartTemperatureView === 's1'
              ? item.temperature1
              : this.chartTemperatureView === 's2'
                ? item.temperature2
                : (item.temperature1 + item.temperature2) / 2,
          })),
          label: this.chartTemperatureView === 's1'
            ? 'Temperatura Sensor 1 °C'
            : this.chartTemperatureView === 's2'
              ? 'Temperatura Sensor 2 °C'
              : 'Temperatura Promedio °C'
        },
        {
          data: chartSamples.map((item: any) => ({
            id: item.id,
            x: new Date(item.createdAt).getTime(),
            humidity1: item.humidity1,
            humidity2: item.humidity2,
            y: this.chartHumidityView === 's1'
              ? item.humidity1
              : this.chartHumidityView === 's2'
                ? item.humidity2
                : (item.humidity1 + item.humidity2) / 2,
          })),
          label: this.chartHumidityView === 's1'
            ? 'Humedad Sensor 1 %'
            : this.chartHumidityView === 's2'
              ? 'Humedad Sensor 2 %'
              : 'Humedad Promedio %'
        }
      ]
    };
  }

  private getChartSamples(): any[] {
    const samplesByInterval = new Map<number, any>();

    for (const sample of this.telemetry) {
      const timestamp = new Date(sample.createdAt).getTime();
      if (!Number.isFinite(timestamp)) continue;

      const interval =
        Math.floor(timestamp / DashboardComponent.CHART_SAMPLE_INTERVAL_MS);
      samplesByInterval.set(interval, sample);
    }

    return [...samplesByInterval.entries()]
      .sort(([first], [second]) => first - second)
      .map(([, sample]) => sample);
  }

  onSensorViewChange(): void {
    this.refreshTelemetryChart();
  }

  getLatestTelemetryStatus(): string {
    if (!this.latest) return 'Sin lecturas disponibles';

    const timestamp = new Date(this.latest.createdAt).getTime();
    if (!Number.isFinite(timestamp)) return 'Hora de lectura no disponible';

    const ageMs = Math.max(0, Date.now() - timestamp);
    if (ageMs <= DashboardComponent.OUTAGE_GAP_MS) {
      return 'Lectura reciente';
    }

    const ageSeconds = Math.floor(ageMs / 1000);
    if (ageSeconds < 60) return `Sin actualización hace ${ageSeconds} s`;

    const ageMinutes = Math.floor(ageSeconds / 60);
    if (ageMinutes < 60) return `Sin actualización hace ${ageMinutes} min`;

    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) {
      return `Sin actualización hace ${ageHours} h ${ageMinutes % 60} min`;
    }

    return `Sin actualización hace ${Math.floor(ageHours / 24)} días`;
  }

  resetChartZoom(): void {
    this.telemetryChart?.chart?.resetZoom();
  }

  private formatTelemetryDate(value: string): string {
    return new Date(value).toLocaleString('es-AR', {
      timeZone: this.getClusterTimezone(),
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  getStateChanges(
    entry: TelemetryHistoryEntry,
  ): Array<{ label: string; from: string; to: string }> {
    const changes: Array<{ label: string; from: string; to: string }> = [];

    if (
      this.isOutage(entry) ||
      this.isCameraStateChange(entry) ||
      this.isDoorSnapshot(entry)
    ) {
      return changes;
    }

    if (entry.previousExtractor !== entry.extractor) {
      changes.push({
        label: 'Extractor',
        from: entry.previousExtractor ? 'Encendido' : 'Apagado',
        to: entry.extractor ? 'Encendido' : 'Apagado',
      });
    }
    if (entry.previousAire !== entry.aire) {
      changes.push({
        label: 'Aire',
        from: entry.previousAire ? 'Encendido' : 'Apagado',
        to: entry.aire ? 'Encendido' : 'Apagado',
      });
    }
    if (entry.previousPuerta !== entry.puerta) {
      changes.push({
        label: 'Puerta',
        from: entry.previousPuerta ? 'Abierta' : 'Cerrada',
        to: entry.puerta ? 'Abierta' : 'Cerrada',
      });
    }
    if (entry.previousLuzEncendida !== entry.luzEncendida) {
      changes.push({
        label: 'Luz',
        from: entry.previousLuzEncendida ? 'Encendida' : 'Apagada',
        to: entry.luzEncendida ? 'Encendida' : 'Apagada',
      });
    }

    return changes;
  }

  isOutage(entry: TelemetryHistoryEntry): entry is TelemetryOutageHistoryEntry {
    return 'eventType' in entry && entry.eventType === 'disconnect';
  }

  isCameraStateChange(entry: TelemetryHistoryEntry): entry is CameraStateHistoryEntry {
    return 'eventType' in entry && entry.eventType === 'camera-state-change';
  }

  isDoorSnapshot(entry: TelemetryHistoryEntry): entry is DoorSnapshotHistoryEntry {
    return 'eventType' in entry && entry.eventType === 'door-snapshot';
  }

  get savedDoorSnapshots(): DoorSnapshotHistoryEntry[] {
    return this.stateHistory.filter((entry) => this.isDoorSnapshot(entry));
  }

  getDoorSnapshotImageUrl(snapshotId: number): string | undefined {
    return this.snapshotImageUrls.get(snapshotId);
  }

  hasDoorSnapshotPreviewFailed(snapshotId: number): boolean {
    return this.snapshotPreviewFailures.has(snapshotId);
  }

  private loadDoorSnapshotPreview(entry: DoorSnapshotHistoryEntry): void {
    if (
      this.snapshotImageUrls.has(entry.snapshotId) ||
      this.snapshotPreviewRequests.has(entry.snapshotId)
    ) {
      return;
    }

    const request = this.telemetryService
      .getDoorSnapshotImage(entry.snapshotId)
      .subscribe({
        next: (image) => {
          this.snapshotPreviewRequests.delete(entry.snapshotId);
          this.snapshotPreviewFailures.delete(entry.snapshotId);
          this.snapshotImageUrls.set(
            entry.snapshotId,
            URL.createObjectURL(image),
          );
        },
        error: (error: unknown) => {
          this.snapshotPreviewRequests.delete(entry.snapshotId);
          this.snapshotPreviewFailures.add(entry.snapshotId);
          console.error('No se pudo cargar la vista previa de la captura:', error);
          this.snapshotPreviewError =
            'No se pudieron cargar algunas imágenes guardadas.';
        },
      });
    this.snapshotPreviewRequests.set(entry.snapshotId, request);
  }

  private clearDoorSnapshotPreviews(): void {
    for (const request of this.snapshotPreviewRequests.values()) {
      request.unsubscribe();
    }
    this.snapshotPreviewRequests.clear();

    for (const imageUrl of this.snapshotImageUrls.values()) {
      URL.revokeObjectURL(imageUrl);
    }
    this.snapshotImageUrls.clear();
    this.snapshotPreviewFailures.clear();
    this.snapshotPreviewError = '';
  }

  downloadDoorSnapshot(entry: DoorSnapshotHistoryEntry): void {
    this.snapshotDownloadError = '';
    this.telemetryService.getDoorSnapshotImage(entry.snapshotId).subscribe({
      next: (image) => {
        const imageUrl = URL.createObjectURL(image);
        const downloadLink = document.createElement('a');
        downloadLink.href = imageUrl;
        downloadLink.download = `captura-puerta-${entry.telemetryId}.jpg`;
        downloadLink.click();
        setTimeout(() => URL.revokeObjectURL(imageUrl), 0);
      },
      error: (error: unknown) => {
        console.error('No se pudo descargar la captura de puerta:', error);
        this.snapshotDownloadError = 'No se pudo descargar la captura de puerta.';
      },
    });
  }

  formatOutageDuration(startedAt: string, endedAt: string): string {
    const totalSeconds = Math.max(
      0,
      Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
    );
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days} d ${hours} h ${minutes} min ${seconds} s`;
    if (hours > 0) return `${hours} h ${minutes} min ${seconds} s`;
    if (minutes > 0) return `${minutes} min ${seconds} s`;
    return `${seconds} s`;
  }

  private hasStateChanges(previous: any, current: any): boolean {
    return (
      previous.extractor !== current.extractor ||
      previous.aire !== current.aire ||
      previous.puerta !== current.puerta ||
      previous.luzEncendida !== current.luzEncendida
    );
  }

  private hasTelemetryGap(previous: any, current: any): boolean {
    const previousTime = new Date(previous.createdAt).getTime();
    const currentTime = new Date(current.createdAt).getTime();

    return (
      !Number.isNaN(previousTime) &&
      !Number.isNaN(currentTime) &&
      currentTime - previousTime > DashboardComponent.OUTAGE_GAP_MS
    );
  }

  private toOutageHistoryEntry(
    previous: any,
    current: any,
  ): TelemetryOutageHistoryEntry {
    const startedAt = new Date(
      new Date(previous.createdAt).getTime() +
        DashboardComponent.TELEMETRY_INTERVAL_MS,
    );
    const endedAt = new Date(current.createdAt);

    return {
      id: `outage-${previous.id}-${current.id}`,
      eventType: 'disconnect',
      createdAt: endedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    };
  }

  private toStateHistoryEntry(
    previous: any,
    current: any,
  ): TelemetryStateHistoryEntry {
    return {
      id: Number(current.id),
      eventType: 'state-change',
      createdAt: new Date(current.createdAt).toISOString(),
      temperature1: current.temperature1,
      temperature2: current.temperature2,
      humidity1: current.humidity1,
      humidity2: current.humidity2,
      extractor: current.extractor,
      aire: current.aire,
      puerta: current.puerta,
      luzEncendida: current.luzEncendida,
      previousExtractor: previous.extractor,
      previousAire: previous.aire,
      previousPuerta: previous.puerta,
      previousLuzEncendida: previous.luzEncendida,
    };
  }

  private isWithinHistoryRange(value: string | Date): boolean {
    const range = this.getHistoryRange();
    const timestamp = new Date(value);
    return (
      !!range &&
      !Number.isNaN(timestamp.getTime()) &&
      timestamp >= range.from &&
      timestamp <= range.to
    );
  }

  private getHistoryRange(): { from: Date; to: Date } | null {
    const now = new Date();
    let from: Date;
    let to = now;

    switch (this.historyFilter) {
      case '5m':
        from = new Date(now.getTime() - 5 * 60 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        from = new Date(to);
        from.setDate(from.getDate() - 7);
        to = new Date(to.getTime() - 1);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'day': {
        const selectedDay = this.parseDateInput(this.historyDate);
        if (!selectedDay) {
          this.historyFilterError = 'Selecciona un día válido.';
          return null;
        }
        from = selectedDay;
        to = new Date(selectedDay);
        to.setDate(to.getDate() + 1);
        to.setMilliseconds(to.getMilliseconds() - 1);
        break;
      }
      case 'custom': {
        const selectedFrom = this.parseDateInput(this.historyFromDate);
        const selectedTo = this.parseDateInput(this.historyToDate);
        if (!selectedFrom || !selectedTo) {
          this.historyFilterError = 'Selecciona un rango válido.';
          return null;
        }
        from = selectedFrom;
        to = new Date(selectedTo);
        to.setDate(to.getDate() + 1);
        to.setMilliseconds(to.getMilliseconds() - 1);
        break;
      }
      default:
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    if (from > to) {
      this.historyFilterError = 'La fecha inicial no puede superar la fecha final.';
      return null;
    }

    return { from, to };
  }

  private parseDateInput(value: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isClusterOnline(): boolean {
    if (!this.lastWsTime) return false;
    const diff = (Date.now() - this.lastWsTime) / 1000;
    return diff < 12;
  }

 applyClusterSelection(clusterId: number | null): void {
  if (!this.clusters || this.clusters.length === 0) return;

  // 1. Asignar el cluster activo por ID o el primero por defecto
  const found = this.clusters.find(c => Number(c.id) === Number(clusterId));
  this.selectedCluster = found || this.clusters[0];
  this.selectedClusterId = this.selectedCluster?.id ?? null;

  // 2. Disparar todas las cargas con la información actualizada
  if (this.selectedCluster) {
    this.loadWeather();
    this.loadTelemetry();
    this.updateClusterTime();
    this.updateCameraStream();
  }
}

  private navigateWithClusterId(clusterId: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { clusterId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
loadWeather(): void {
  if (!this.selectedCluster?.lat || !this.selectedCluster?.lon) {
    console.warn('[WEATHER] El cluster no tiene lat/lon válidos:', this.selectedCluster);
    return;
  }

  const { lat, lon } = this.selectedCluster;

  this.weatherService.getWeather(lat, lon).subscribe({
    next: (data) => {
      console.log('[WEATHER] Datos recibidos del backend:', data); // <-- Revisa este log en F12
      this.weather = data;
    },
    error: (err) => console.error('[WEATHER] Error al llamar al backend:', err)
  });
}
  buildCameraStreamUrl(clusterId: number | null = this.selectedClusterId): string {
    if (!clusterId) {
      return '';
    }

    const token = this.authService.getToken();
    const query = new URLSearchParams({ t: Date.now().toString() });

    if (token) {
      query.set('token', token);
    }

    return `${environment.apiUrl}/camera/stream/${clusterId}?${query.toString()}`;
  }

  private updateCameraStream(): void {
    const clusterId = Number(this.selectedClusterId);
    this.camera1Loaded = false;
    this.refreshCameraSource(1, clusterId || null);
  }

  private refreshCameraSource(
    cameraId: 1 | 2,
    clusterId: number | null = Number(this.selectedClusterId) || null,
  ): void {
    const source =
      cameraId === 1
        ? this.buildCameraStreamUrl(clusterId)
        : environment.camera2Url;
    if (!source) return;

    this.clearCameraLoadTimeout(cameraId);
    this.pendingCameraChecks.add(cameraId);
    this.cameraLoadTimeouts.set(
      cameraId,
      setTimeout(() => {
        if (!this.pendingCameraChecks.has(cameraId)) return;
        this.onCameraError(cameraId);
      }, DashboardComponent.CAMERA_LOAD_TIMEOUT_MS),
    );

    const separator = source.includes('?') ? '&' : '?';
    const refreshedSource =
      `${source}${separator}_camera_check=${Date.now()}-${++this.cameraHistorySequence}`;
    if (cameraId === 1) {
      this.cameraStreamUrl = refreshedSource;
    } else {
      this.camera2StreamUrl = refreshedSource;
    }
  }

  private clearCameraLoadTimeout(cameraId: 1 | 2): void {
    const timeout = this.cameraLoadTimeouts.get(cameraId);
    if (timeout) clearTimeout(timeout);
    this.cameraLoadTimeouts.delete(cameraId);
  }

updateClusterTime(): void {
  // 1. Guard Clause: Si no hay cluster seleccionado, ignoramos la ejecución silenciosamente
  if (!this.selectedCluster) {
    return;
  }

  // 2. Extraer zona horaria
  const tz = this.selectedCluster.timezone 
          || this.selectedCluster.timeZone 
          || this.selectedCluster.time_zone;

  if (!tz) {
    console.warn('[DEBUG] El cluster está cargado pero no define un campo timezone:', this.selectedCluster);
    return;
  }

  // 3. Loguear solo cuando el objeto es válido
  console.log('[DEBUG] Cluster activo actual:', this.selectedCluster);

  const now = new Date();

  this.clusterTime = new Intl.DateTimeFormat('es-AR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  this.clusterDate = new Intl.DateTimeFormat('es-AR', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(now);
}
  get displayedTemperature(): number {
    if (!this.latest) return 0;
    switch (this.temperatureView) {
      case 's1': return this.latest.temperature1;
      case 's2': return this.latest.temperature2;
      default: return this.avgTemperature;
    }
  }

  get displayedHumidity(): number {
    if (!this.latest) return 0;
    switch (this.humidityView) {
      case 's1': return this.latest.humidity1;
      case 's2': return this.latest.humidity2;
      default: return this.avgHumidity;
    }
  }

  getTemperatureClass(): string {
    if (!this.latest) return 'normal';
    if (this.avgTemperature >= 32) return 'critical';
    if (this.avgTemperature >= 28) return 'warning';
    return 'normal';
  }

  getHumidityClass(): string {
    if (!this.latest) return 'normal';
    if (this.avgHumidity >= 80) return 'critical';
    if (this.avgHumidity >= 45 && this.avgHumidity < 55) return 'normal';
    return 'warning';
  }

  getClusterTimezone(): string {
    return this.selectedCluster?.timezone
      || this.selectedCluster?.timeZone
      || this.selectedCluster?.time_zone
      || 'UTC';
  }

  getTimezoneLabel(): string {
  const tz = this.getClusterTimezone();

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : tz;
  } catch (error) {
    return tz;
  }
}

  getDoorClass(): string {
    if (!this.latest) return 'normal';
    return this.latest.puerta ? 'critical' : 'normal';
  }

  isLightOn(): boolean {
    if (!this.latest) {
      return false;
    }

    return Boolean(this.latest.puerta) || Boolean(this.latest.luzEncendida);
  }

  getLightClass(): string {
    return this.isLightOn() ? 'on' : 'off';
  }
  getAirClass(): string {
    if (!this.latest) return 'air-off';
    return this.latest.aire ? 'air-on' : 'air-off';
  }

  getExtractorClass(): string {
    if (!this.latest) return 'extractor-off';
    return this.latest.extractor ? 'extractor-on' : 'extractor-off';
  }

  getWeatherClass(): string {
    if (!this.weather) return 'weather-default';

    const main = this.weather.weather[0].main;
    const icon = this.weather.weather[0].icon;

    if (icon.includes('n')) return 'weather-night';

    switch (main) {
      case 'Clear': return 'weather-clear';
      case 'Rain': return 'weather-rain';
      case 'Clouds': return 'weather-clouds';
      case 'Thunderstorm': return 'weather-storm';
      default: return 'weather-default';
    }
  }
}