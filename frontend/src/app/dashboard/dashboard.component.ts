import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { environment } from '../../environments/environment';
import { SocketService } from '../services/socket.service';
import { TelemetryService } from '../services/telemetry.service';
import { WeatherService } from "../services/weather.service";
import { ClusterService } from "../services/cluster.service";
import { FormsModule } from '@angular/forms';
import { CameraService } from '../services/camera.service';
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
  cameraIp = '';
  snapshotUrl: string = '';
  selectedCluster: any;
  clusters: any[] = [];
  selectedClusterId = 1;
  temperatureView = 'avg';
  humidityView = 'avg';
  
  clusterDate = '';
  lastWsTime: number = 0;
  private routeSubscription?: Subscription;
  private pendingClusterId: number | null = null;

  onClusterChange() {

  console.log('CAMBIO DE CLUSTER');
  // reset estado WS
  this.lastWsTime = 0;
  this.selectedCluster =
    this.clusters.find(
      c => c.id == this.selectedClusterId
    );

  this.navigateWithClusterId(Number(this.selectedClusterId));

  console.log('Cluster seleccionado', this.selectedCluster);
  console.log(
  'RESET TIMESTAMP',
  this.selectedClusterId
);

  this.loadTelemetry();

  this.loadWeather();
  this.updateClusterTime();

}

ngOnDestroy() {
  this.routeSubscription?.unsubscribe();
}

private applyClusterSelection(clusterId: number) {
  this.selectedClusterId = Number(clusterId);
  this.selectedCluster = this.clusters.find(
    (cluster) => Number(cluster.id) === Number(this.selectedClusterId),
  );
}

private navigateWithClusterId(clusterId: number) {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { clusterId },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
get displayedTemperature(): number {

  if (!this.latest) return 0;

  switch (this.temperatureView) {

    case 's1':
      return this.latest.temperature1;

    case 's2':
      return this.latest.temperature2;

    default:
      return this.avgTemperature;
  }
}

get displayedHumidity(): number {

  if (!this.latest) return 0;

  switch (this.humidityView) {

    case 's1':
      return this.latest.humidity1;

    case 's2':
      return this.latest.humidity2;

    default:
      return this.avgHumidity;
  }
}
  // -------- GRAFICO --------

  lineChartData: ChartConfiguration<'line'>['data'] = {

    labels: [],

    datasets: [

      {
        data: [],
        label: 'Temperatura °C'
      }

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
  ) { }
  getTemperatureClass(): string {

    if (!this.latest) return 'normal';

    if (this.avgTemperature >= 32) {
      return 'critical';
    }

    if (this.avgTemperature >= 28) {
      return 'warning';
    }

    return 'normal';

  }
  getHumidityClass(): string {

    if (!this.latest) return 'normal';

    if (this.avgHumidity >= 80) {
      return 'critical';
    }

    if (45 <= this.avgHumidity && this.avgHumidity  < 55) {
      return 'normal';
    }
    return 'warning';

  }
  getTimezoneLabel(): string {

  if (!this.selectedCluster?.timezone) {
    return '';
  }

  const now = new Date();

  const utc = new Date(
    now.toLocaleString('en-US', {
      timeZone: 'UTC'
    })
  );

  const local = new Date(
    now.toLocaleString('en-US', {
      timeZone: this.selectedCluster.timezone
    })
  );

  const offset =
    (local.getTime() - utc.getTime())
    / (1000 * 60 * 60);

  return `UTC${offset >= 0 ? '+' : ''}${offset}`;
}
  getDoorClass(): string {

    if (!this.latest) return 'normal';

    return this.latest.puerta
      ? 'critical'
      : 'normal';

  }
  getAirClass(): string {

    if (!this.latest) return 'air-off';

    return this.latest.aire
      ? 'air-on'
      : 'air-off';

  }
  getExtractorClass(): string {

    if (!this.latest) return 'extractor-off';

    return this.latest.extractor
      ? 'extractor-on'
      : 'extractor-off';

  }
  getWeatherClass(): string {

    if (!this.weather) return 'weather-default';

    const main = this.weather.weather[0].main;

    const icon = this.weather.weather[0].icon;

    // -------- NOCHE --------

    if (icon.includes('n')) {
      return 'weather-night';
    }

    // -------- CLIMA --------

    switch (main) {

      case 'Clear':
        return 'weather-clear';

      case 'Rain':
        return 'weather-rain';

      case 'Clouds':
        return 'weather-clouds';

      case 'Thunderstorm':
        return 'weather-storm';

      default:
        return 'weather-default';

    }

  }
  ngOnInit() {
   const initialClusterId = this.route.snapshot.queryParamMap.get('clusterId');
   this.pendingClusterId = initialClusterId ? Number(initialClusterId) : null;

   this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
    const queryClusterId = params.get('clusterId');
    this.pendingClusterId = queryClusterId ? Number(queryClusterId) : null;

    if (this.clusters.length > 0) {
      this.applyClusterSelection(this.pendingClusterId ?? this.selectedClusterId);
    }
   });

   this.clusterService.getClusters()
    .subscribe((clusters: any) => {

  this.clusters = clusters;

  if (clusters.length > 0) {

    const initialSelectedId =
      this.pendingClusterId && clusters.some((cluster: any) => Number(cluster.id) === Number(this.pendingClusterId))
        ? this.pendingClusterId
        : clusters[0].id;

    this.applyClusterSelection(initialSelectedId);

    this.navigateWithClusterId(this.selectedClusterId);

    this.loadTelemetry();

    this.loadWeather();
    
    setInterval(() => {
    this.updateClusterTime();
    }, 1000);
    
  }
});
/*this.socketService.onTelemetry(
  (data: any) => {

    console.log('WS', data);
console.log(data);
console.log(data.cluster);
console.log('FECHA WS:', data.created_at);
console.log('LATEST=', this.latest);
console.log('CREATED_AT=', this.latest.created_at);
console.log('PUERTA MQTT:', data.puerta);
    console.log('TIPO:', typeof data.puerta);

    if (
      data.cluster?.id !==
    this.selectedClusterId
    )  {
  console.log(
    'IGNORADO',
    data.cluster?.id,
    '!=',
    this.selectedClusterId
  );
  return;
}

console.log(
  'ACEPTADO',
  data.cluster?.id
);
this.socketService.onTelemetry(
  (data: any) => {

    console.log(
      'RECIBIDO',
      data.cluster?.id
    );

    if (
      data.cluster?.id !==
      this.selectedClusterId
    ) {
      console.log(
        'IGNORADO',
        data.cluster?.id,
        '!=',
        this.selectedClusterId
      );
      return;
    }

    console.log(
      'ACEPTADO',
      data.cluster?.id
    );

    this.lastWsTime = Date.now();

    console.log(
      'lastWsTime actualizado:',
      this.lastWsTime
    );

    this.latest = data;
  }
);

this.lastWsTime = Date.now();

console.log(
  'lastWsTime actualizado:',
  this.lastWsTime
);

    this.latest = data;

    this.avgTemperature =
      (
        data.temperature1 +
        data.temperature2
      ) / 2;

    this.avgHumidity =
      (
        data.humidity1 +
        data.humidity2
      ) / 2;
console.log(
  'ACTUALIZADO',
  this.avgTemperature,
  this.avgHumidity
);*/
this.socketService.onTelemetry(
  (data: any) => {

    console.log(
      'RECIBIDO',
      data.cluster?.id
    );

    if (
      Number(data.cluster?.id) !==
      Number(this.selectedClusterId)
    ) {

      console.log(
        'IGNORADO',
        data.cluster?.id,
        '!=',
        this.selectedClusterId
      );

      return;
    }

    console.log(
      'ACEPTADO',
      data.cluster?.id
    );
console.log(
  'PUERTA RECIBIDA:',
  data.puerta
);

console.log(
  'TIPO PUERTA:',
  typeof data.puerta
);
    this.lastWsTime = Date.now();

    console.log(
      'lastWsTime actualizado:',
      this.lastWsTime
    );

    this.latest = data;

    this.avgTemperature =
      (
        data.temperature1 +
        data.temperature2
      ) / 2;

    this.avgHumidity =
      (
        data.humidity1 +
        data.humidity2
      ) / 2;

    console.log(
      'ACTUALIZADO',
      this.avgTemperature,
      this.avgHumidity
    );
  }
);




  setInterval(() => {
  this.cameraService
  .getCameraIp()
  .subscribe((data: any) => {

    this.cameraIp = data.ip;

    console.log('IP CAMARA:', this.cameraIp);

    this.updateSnapshot();

  });
},30000);

  setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    // Inicialización
    this.updateSnapshot();

    if (!this.cameraIp) {
    return;
  }

  this.snapshotUrl =
    `http://${this.cameraIp}/capture?t=${Date.now()}`;

  }

  loadWeather() {

    if (!this.selectedCluster) {
      return;
    }

    const lat = this.selectedCluster.lat;
    const lon = this.selectedCluster.lon;

    console.log('Clima para', this.selectedCluster.name);
    console.log(lat, lon);

    this.weatherService
      .getWeather(lat, lon)
      .subscribe((data: any) => {

        this.weather = data;

      });

    this.weatherService
      .getForecast(lat, lon)
      .subscribe((data: any) => {

        this.forecast = data.list.slice(0, 5);

      });

  }
  updateSnapshot() {
    console.log('cameraIp=', this.cameraIp);
    if (!this.cameraIp) {
    return;
  }

  this.snapshotUrl =
    `http://${this.cameraIp}/capture?t=${Date.now()}`;
     console.log('snapshotUrl=', this.snapshotUrl);
  }
  
   updateClusterTime() {

  if (!this.selectedCluster?.timezone) {
    return;
  }

  const now = new Date();

  this.clusterTime = new Intl.DateTimeFormat(
    'es-AR',
    {
      timeZone: this.selectedCluster.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
  ).format(now);

  this.clusterDate = new Intl.DateTimeFormat(
    'es-AR',
    {
      timeZone: this.selectedCluster.timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  ).format(now);

  console.log('Timezone:', this.selectedCluster.timezone);
  console.log('Hora cluster:', this.clusterTime);
}
isClusterOnline(): boolean {

  console.log(
    'lastWsTime actual:',
    this.lastWsTime
  );

  if (!this.lastWsTime) {
    return false;
  }

  const diff =
    (Date.now() - this.lastWsTime) / 1000;

  console.log(
    'ONLINE?',
    diff < 10,
    'DIFF:',
    diff
  );

  return diff < 12;
}
  loadTelemetry() {
    this.telemetryService
      .getLatest(this.selectedClusterId)
      .subscribe((data: any) => {
         console.log('LATEST', data);

    this.latest = data[0];

    this.avgTemperature =
    (
      this.latest.temperature1 +
      this.latest.temperature2
    ) / 2;

    this.avgHumidity =
    (
      this.latest.humidity1 +
      this.latest.humidity2
    ) / 2;

  });

    this.telemetryService
      .getHistory(this.selectedClusterId)
      .subscribe((data: any) => {
        console.log(data);
        this.telemetry = data;

        this.lineChartData = {
          labels: this.telemetry.map(
            (item: any) =>
              new Date(item.created_at).toLocaleTimeString()
          ),
          datasets: [
            {
    data: this.telemetry.map(
      (item: any) =>
        (item.temperature1 + item.temperature2) / 2
    ),
    label: 'Temperatura Promedio °C'
  },
  {
    data: this.telemetry.map(
      (item: any) =>
        (item.humidity1 + item.humidity2) / 2
    ),
    label: 'Humedad Promedio %'
  }
          ]
        };
      });
  }
}
