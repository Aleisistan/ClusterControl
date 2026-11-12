import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  interval,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';

import { AuthService, AuthUser } from '../services/auth.service';
import {
  CameraPayload,
  CameraRecord,
  CameraService,
  CameraUpdatePayload,
} from '../services/camera.service';
import { ClusterPayload, ClusterRecord, ClusterService } from '../services/cluster.service';
import { LocationSearchResult, LocationSearchService } from '../services/location-search.service';

const DEVICE_ONLINE_WINDOW_MS = 60_000;
const CLUSTER_STATUS_REFRESH_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-admin-clusters-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-clusters-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-clusters-page.component.css',
})
export class AdminClustersPageComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  clusters: ClusterRecord[] = [];
  cameraForms: Record<number, Array<{ id?: number; name: string; ip: string }>> = {};
  cameraSaving: Record<string, boolean> = {};
  locationOptions: LocationSearchResult[] = [];
  deviceSetupCluster: ClusterRecord | null = null;
  isSearchingLocations = false;

  clusterForm: ClusterPayload & { id: number | null } = {
    id: null,
    name: '',
    location: '',
    lat: null,
    lon: null,
    deviceId: '',
    timezone: '',
  };

  clusterMessage = '';
  clusterAttempted = false;
  isLoadingClusters = false;
  private readonly locationSearchSubject = new Subject<string>();
  private readonly destroyed$ = new Subject<void>();
  private selectedLocationLabel = '';

  constructor(
    private authService: AuthService,
    private clusterService: ClusterService,
    private cameraService: CameraService,
    private locationSearchService: LocationSearchService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.loadSession();

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.locationSearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroyed$),
        switchMap((query) => {
          this.isSearchingLocations = query.length >= 3;
          return query.length >= 3
            ? this.locationSearchService.search(query).pipe(catchError(() => of([])))
            : of([]);
        }),
      )
      .subscribe((locations) => {
        this.locationOptions = locations;
        this.isSearchingLocations = false;
      });

    this.loadClusters();
    interval(CLUSTER_STATUS_REFRESH_INTERVAL_MS)
      .pipe(
        takeUntil(this.destroyed$),
        exhaustMap(() =>
          this.clusterService.getClusters().pipe(
            catchError((error) => {
              this.clusterMessage = this.extractErrorMessage(
                error,
                'No se pudo actualizar el estado de los dispositivos.',
              );
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((clusters) => {
        if (clusters) {
          this.clusters = clusters;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.locationSearchSubject.complete();
  }

  loadClusters(): void {
    this.isLoadingClusters = true;

    this.clusterService
      .getClusters()
      .pipe(finalize(() => (this.isLoadingClusters = false)))
      .subscribe({
        next: (clusters) => {
          this.clusters = clusters;
          this.cameraForms = Object.fromEntries(
            clusters.map((cluster) => [
              cluster.id,
              Array.from({ length: 2 }, (_, index) => {
                const camera = cluster.cameras?.[index];
                return {
                  id: camera?.id,
                  name: camera?.name || `Cámara ${index + 1}`,
                  ip: camera?.ip || '',
                };
              }),
            ]),
          );
        },
        error: (error) => {
          this.clusterMessage = this.extractErrorMessage(error, 'No se pudieron cargar los clusters.');
        },
      });
  }

  saveCluster(): void {
    this.clusterAttempted = true;
    this.clusterMessage = '';

    const validation = this.clusterValidationMessage;
    if (validation) {
      this.clusterMessage = validation;
      return;
    }

    const payload: ClusterPayload = {
      name: this.clusterForm.name.trim(),
      location: this.normalizeText(this.clusterForm.location),
      lat: this.toOptionalNumber(this.clusterForm.lat),
      lon: this.toOptionalNumber(this.clusterForm.lon),
      deviceId: this.clusterForm.id
        ? this.normalizeText(this.clusterForm.deviceId)
        : undefined,
      timezone: this.normalizeText(this.clusterForm.timezone),
    };

    const request = this.clusterForm.id
      ? this.clusterService.updateCluster(this.clusterForm.id, payload)
      : this.clusterService.createCluster(payload);

    request.subscribe({
      next: (cluster) => {
        const isEditing = this.clusterForm.id !== null;
        this.clusterMessage = isEditing
          ? 'Cluster actualizado correctamente.'
          : 'Cluster creado correctamente.';
        this.deviceSetupCluster = isEditing ? null : cluster;
        this.resetClusterForm();
        this.loadClusters();
      },
      error: (error) => {
        this.clusterMessage = this.extractErrorMessage(error, 'No se pudo guardar el cluster.');
      },
    });
  }

  editCluster(cluster: ClusterRecord): void {
    this.clusterForm = {
      id: cluster.id,
      name: cluster.name,
      location: cluster.location || '',
      lat: cluster.lat ?? null,
      lon: cluster.lon ?? null,
      deviceId: cluster.deviceId || '',
      timezone: cluster.timezone || '',
    };
    this.selectedLocationLabel = cluster.location || '';
  }

  deleteCluster(cluster: ClusterRecord): void {
    if (!confirm(`¿Eliminar el cluster ${cluster.name}?`)) {
      return;
    }

    this.clusterService.deleteCluster(cluster.id).subscribe({
      next: () => {
        this.clusterMessage = 'Cluster eliminado correctamente.';
        this.loadClusters();
      },
      error: (error) => {
        this.clusterMessage = this.extractErrorMessage(error, 'No se pudo eliminar el cluster.');
      },
    });
  }

  saveCamera(cluster: ClusterRecord, index: number): void {
    const form = this.cameraForms[cluster.id]?.[index];
    const name = form?.name.trim() || '';
    const ip = form?.ip.trim() || '';

    if (!name || name.length > 100 || !ip) {
      this.clusterMessage =
        'Indica el nombre y la dirección IP o URL de la cámara.';
      return;
    }

    this.clusterMessage = '';
    const savingKey = this.cameraFormKey(cluster.id, index);
    this.cameraSaving[savingKey] = true;

    let request: Observable<CameraRecord>;
    if (form?.id) {
      const payload: CameraUpdatePayload = { name, ip };
      request = this.cameraService.updateCamera(form.id, payload);
    } else {
      const deviceId = cluster.deviceId?.trim();
      if (!deviceId) {
        this.clusterMessage = 'El cluster no tiene un device ID asignado.';
        this.cameraSaving[savingKey] = false;
        return;
      }

      const payload: CameraPayload = { name, ip, deviceId };
      request = this.cameraService.createCamera(payload);
    }

    request
      .pipe(finalize(() => (this.cameraSaving[savingKey] = false)))
      .subscribe({
        next: () => {
          this.clusterMessage = 'Cámara guardada correctamente.';
          this.loadClusters();
        },
        error: (error) => {
          this.clusterMessage = this.extractErrorMessage(
            error,
            'No se pudo guardar la cámara. Comprueba la IP o URL del stream.',
          );
        },
      });
  }

  deleteCamera(cluster: ClusterRecord, index: number): void {
    const camera = this.cameraForms[cluster.id]?.[index];
    if (!camera?.id || !confirm(`¿Eliminar ${camera.name} de ${cluster.name}?`)) {
      return;
    }

    this.cameraService.deleteCamera(camera.id).subscribe({
      next: () => {
        this.clusterMessage = 'Cámara eliminada correctamente.';
        this.loadClusters();
      },
      error: (error) => {
        this.clusterMessage = this.extractErrorMessage(
          error,
          'No se pudo eliminar la cámara.',
        );
      },
    });
  }

  cameraFormKey(clusterId: number, index: number): string {
    return `${clusterId}-${index}`;
  }

  resetClusterForm(): void {
    this.clusterForm = {
      id: null,
      name: '',
      location: '',
      lat: null,
      lon: null,
      deviceId: '',
      timezone: '',
    };
    this.locationOptions = [];
    this.selectedLocationLabel = '';
  }

  dismissDeviceSetup(): void {
    this.deviceSetupCluster = null;
  }

  deviceStatus(cluster: ClusterRecord): 'online' | 'offline' | 'never' {
    if (!cluster.lastSeenAt) {
      return 'never';
    }

    const lastSeenTime = Date.parse(cluster.lastSeenAt);
    if (!Number.isFinite(lastSeenTime)) {
      return 'never';
    }

    return Date.now() - lastSeenTime <= DEVICE_ONLINE_WINDOW_MS
      ? 'online'
      : 'offline';
  }

  onLocationInput(): void {
    const query = this.clusterForm.location?.trim() || '';
    if (query !== this.selectedLocationLabel) {
      this.clusterForm.lat = null;
      this.clusterForm.lon = null;
      this.clusterForm.timezone = '';
      this.selectedLocationLabel = '';
    }

    this.locationSearchSubject.next(query);
  }

  selectLocation(location: LocationSearchResult): void {
    this.clusterForm.location = location.label;
    this.clusterForm.lat = location.latitude;
    this.clusterForm.lon = location.longitude;
    this.clusterForm.timezone = location.timezone;
    this.selectedLocationLabel = location.label;
    this.locationOptions = [];
    this.isSearchingLocations = false;
  }

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  get clusterValidationMessage(): string {
    const name = this.clusterForm.name.trim();
    const location = this.clusterForm.location?.trim() || '';
    const deviceId = this.clusterForm.deviceId?.trim() || '';
    if (!name) {
      return 'El nombre del cluster es obligatorio.';
    }

    if (name.length > 100) {
      return 'El nombre no puede superar 100 caracteres.';
    }

    if (!location) {
      return 'Selecciona una ubicación de la lista para cargar sus coordenadas.';
    }

    if (location.length > 200) {
      return 'La ubicación no puede superar 200 caracteres.';
    }

    if (deviceId.length > 100) {
      return 'El device ID no puede superar 100 caracteres.';
    }

    if (this.clusterForm.lat === null || this.clusterForm.lon === null) {
      return 'Selecciona una ubicación de los resultados para cargar sus coordenadas.';
    }

    if (Number.isNaN(Number(this.clusterForm.lat))) {
      return 'La latitud debe ser numérica.';
    }

    if (Number.isNaN(Number(this.clusterForm.lon))) {
      return 'La longitud debe ser numérica.';
    }

    return '';
  }

  get shouldShowClusterValidationMessage(): boolean {
    return this.clusterAttempted && !!this.clusterValidationMessage;
  }

  private normalizeText(value: string | null | undefined): string | undefined {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
  }

  private toOptionalNumber(value: number | null | undefined): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return Number(value);
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: string | string[] }; message?: string };

    if (Array.isArray(response?.error?.message)) {
      return response.error.message.join(', ');
    }

    if (typeof response?.error?.message === 'string') {
      return response.error.message;
    }

    if (typeof response?.message === 'string') {
      return response.message;
    }

    return fallback;
  }
}