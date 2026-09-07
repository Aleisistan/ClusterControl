import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { SocketService } from '../services/socket.service';
import { TelemetryService } from '../services/telemetry.service';
import { WeatherService } from '../services/weather.service';
import { ClusterService } from '../services/cluster.service';
import { CameraService } from '../services/camera.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  telemetry: any[] = [];
  latest: any;
  avgTemperature: number = 0;
  avgHumidity: number = 0;
  weather: any;
  forecast: any;
  currentTime = new Date();
  clusterTime = '';
  clusterDate = '';
  cameraIp = '';
  snapshotUrl: string = '';
  cameraStreamUrl: string = '';
  selectedCluster: any;
  clusters: any[] = [];
  selectedClusterId = 1;
  temperatureView = 'avg';
  humidityView = 'avg';
  
  lastWsTime: number = 0;
  camera1Loaded = false;
  camera2Loaded = false;
  camera1StreamUrl = environment.camera1Url;
  camera2StreamUrl = environment.camera2Url;
  private routeSubscription?: Subscription;
  private pendingClusterId: number | null = null;
  private unsubscribeTelemetry?: () => void;

  lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'Temperatura Promedio °C' },
      { data: [], label: 'Humedad Promedio %' }
    ]
  };

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true
  };

  constructor(
    private telemetryService: TelemetryService,
    private socketService: SocketService,
    private weatherService: WeatherService,
    private clusterService: ClusterService,
    private cameraService: CameraService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  loadCamera(): void {
   // 1. Obtener el clusterId activo (soporta si selectedCluster es un objeto o un ID)
  const clusterId = this.selectedClusterId || this.selectedCluster?.id;

  if (!clusterId) {
    console.warn('No hay un cluster seleccionado para cargar la cámara');
    return;
  }

  // 2. Apuntar directamente al endpoint Proxy de NestJS
  // Si tu backend soporta parámetro por cluster: `${environment.apiUrl}/camera/stream/${clusterId}`
  // Si tu backend usa la URL global del .env: `${environment.apiUrl}/camera/stream`
  this.snapshotUrl = `${environment.apiUrl}/camera/stream`;

  console.log('Stream de cámara vinculado a:', this.snapshotUrl);

  }

  ngOnInit(): void {
    this.loadCamera();
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
        if (!Array.isArray(clusters) || clusters.length === 0) {
          console.warn('No hay clusters para mostrar');
          return;
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
      //this.cameraService.getCameraIp().subscribe((data: any) => {
        //this.cameraIp = data.ip;
        //this.updateSnapshot();
      //});
      this.loadCamera();
    }, 30000);

    setInterval(() => {
      this.currentTime = new Date();
      this.updateClusterTime();
    }, 1000);

    this.updateSnapshot();
  };
getLightClass(): string {
  if (!this.latest) {
    return '';
  }

  return this.latest.puerta
    ? 'light-on'
    : 'light-off';
};
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.unsubscribeTelemetry?.();
  }

  onClusterChange(clusterId: number): void {
  const id = Number(clusterId);
  if (!id) return;

  this.selectedClusterId = id;
  this.lastWsTime = 0;

  // Actualiza el cluster seleccionado en memoria
  this.applyClusterSelection(id);

  // Navega y refresca
  this.navigateWithClusterId(id);
  this.latest = undefined;
  this.avgTemperature = 0;
  this.avgHumidity = 0;

  this.loadCamera();
  this.loadTelemetry();
  this.loadWeather();
  this.updateClusterTime(); // <--- Aquí ya calculará la hora con el nuevo timezone
  this.updateCameraStream();
}
  loadTelemetry(): void {
    // 1. Obtener telemetría inicial
    this.telemetryService
      .getLatest(this.selectedClusterId)
      .subscribe((data: any) => {
        if (data) {
          this.latest = data;
          this.avgTemperature = (this.latest.temperature1 + this.latest.temperature2) / 2;
          this.avgHumidity = (this.latest.humidity1 + this.latest.humidity2) / 2;
        }
      });

    // 2. Obtener historial para el gráfico
    this.telemetryService
      .getHistory(this.selectedClusterId)
      .subscribe((data: any) => {
        this.telemetry = Array.isArray(data) ? data : [];
        this.lineChartData = {
          labels: this.telemetry.map((item: any) =>
            new Date(item.created_at).toLocaleTimeString()
          ),
          datasets: [
            {
              data: this.telemetry.map(
                (item: any) => (item.temperature1 + item.temperature2) / 2
              ),
              label: 'Temperatura Promedio °C'
            },
            {
              data: this.telemetry.map(
                (item: any) => (item.humidity1 + item.humidity2) / 2
              ),
              label: 'Humedad Promedio %'
            }
          ]
        };
      });

    // 3. Suscribirse a WebSocket pasando la función callback
    this.socketService.onClusterTelemetry((data: any) => {
      const payloadClusterId = data?.clusterId ?? data?.cluster_id;
      
      if (data && Number(payloadClusterId) === Number(this.selectedClusterId)) {
        this.lastWsTime = Date.now();
        this.latest = data;
        this.avgTemperature = (data.temperature1 + data.temperature2) / 2;
        this.avgHumidity = (data.humidity1 + data.humidity2) / 2;
      }
    });
  }

  isClusterOnline(): boolean {
    if (!this.lastWsTime) return false;
    const diff = (Date.now() - this.lastWsTime) / 1000;
    return diff < 12;
  }

  private applyClusterSelection(clusterId: number): void {
    this.selectedClusterId = Number(clusterId);
    this.selectedCluster = this.clusters.find(
      (cluster: any) => Number(cluster.id) === this.selectedClusterId
    );
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
    if (!this.selectedCluster) return;

    const { lat, lon } = this.selectedCluster;

    this.weatherService.getWeather(lat, lon).subscribe((data: any) => {
      this.weather = data;
    });

    this.weatherService.getForecast(lat, lon).subscribe((data: any) => {
      if (data?.list) {
        this.forecast = data.list.slice(0, 5);
      }
    });
  }

 updateSnapshot(): void {
  if (!this.cameraIp) return;

  // Limpia cualquier protocolo o parámetro previo en la IP
  const cleanIp = this.cameraIp
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0];

  // Construye la URL exacta del stream
  this.snapshotUrl = `http://${cleanIp}:81/stream`;
  console.log('Stream URL activa:', this.snapshotUrl);
}
  private updateCameraStream(): void {
    const clusterId = Number(this.selectedClusterId);
    this.camera1Loaded = false;
    if (!clusterId) {
      this.cameraStreamUrl = '';
      return;
    }

  this.cameraStreamUrl =
    `/camera/stream/${clusterId}?t=${Date.now()}`;

  console.log(
    '[CAMERA] Stream seleccionado:',
    this.cameraStreamUrl,
  );
}
updateClusterTime(): void {
  console.log('[DEBUG] Cluster activo actual:', this.selectedCluster);

  const tz = this.selectedCluster?.timezone 
          || this.selectedCluster?.timeZone 
          || this.selectedCluster?.time_zone;

  if (!tz) {
    console.warn('[DEBUG] No hay timezone en el cluster seleccionado');
    return;
  }

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

 getTimezoneLabel(): string {
  const tz = this.selectedCluster?.timezone 
          || this.selectedCluster?.timeZone 
          || this.selectedCluster?.time_zone;

  if (!tz) return '';

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