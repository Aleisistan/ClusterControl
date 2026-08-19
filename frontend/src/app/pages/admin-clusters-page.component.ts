import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { finalize } from 'rxjs';

import { AuthService, AuthUser } from '../services/auth.service';
import { ClusterPayload, ClusterRecord, ClusterService } from '../services/cluster.service';

@Component({
  selector: 'app-admin-clusters-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-clusters-page.component.html',
  styleUrl: './admin-clusters-page.component.css',
})
export class AdminClustersPageComponent implements OnInit {
  currentUser: AuthUser | null = null;
  clusters: ClusterRecord[] = [];

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

  constructor(
    private authService: AuthService,
    private clusterService: ClusterService,
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

    this.loadClusters();
  }

  loadClusters(): void {
    this.isLoadingClusters = true;

    this.clusterService
      .getClusters()
      .pipe(finalize(() => (this.isLoadingClusters = false)))
      .subscribe({
        next: (clusters) => {
          this.clusters = clusters;
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
      deviceId: this.normalizeText(this.clusterForm.deviceId),
      timezone: this.normalizeText(this.clusterForm.timezone),
    };

    const request = this.clusterForm.id
      ? this.clusterService.updateCluster(this.clusterForm.id, payload)
      : this.clusterService.createCluster(payload);

    request.subscribe({
      next: () => {
        this.clusterMessage = this.clusterForm.id
          ? 'Cluster actualizado correctamente.'
          : 'Cluster creado correctamente.';
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
  }

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  get clusterValidationMessage(): string {
    const name = this.clusterForm.name.trim();
    const location = this.clusterForm.location?.trim() || '';
    const deviceId = this.clusterForm.deviceId?.trim() || '';
    const timezone = this.clusterForm.timezone?.trim() || '';

    if (!name) {
      return 'El nombre del cluster es obligatorio.';
    }

    if (name.length > 100) {
      return 'El nombre no puede superar 100 caracteres.';
    }

    if (location.length > 200) {
      return 'La ubicación no puede superar 200 caracteres.';
    }

    if (deviceId.length > 100) {
      return 'El device ID no puede superar 100 caracteres.';
    }

    if (timezone.length > 100) {
      return 'La zona horaria no puede superar 100 caracteres.';
    }

    if (this.clusterForm.lat !== null && this.clusterForm.lat !== undefined && Number.isNaN(Number(this.clusterForm.lat))) {
      return 'La latitud debe ser numérica.';
    }

    if (this.clusterForm.lon !== null && this.clusterForm.lon !== undefined && Number.isNaN(Number(this.clusterForm.lon))) {
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