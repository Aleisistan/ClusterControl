import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { finalize } from 'rxjs';

import { AuthService, AuthUser } from '../services/auth.service';
import { UserPayload, UserRecord, UserService } from '../services/user.service';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-page.component.html',
  styleUrl: './admin-users-page.component.css',
})
export class AdminUsersPageComponent implements OnInit {
  currentUser: AuthUser | null = null;
  users: UserRecord[] = [];

  userForm: { id: number | null; username: string; password: string; role: string } = {
    id: null,
    username: '',
    password: '',
    role: 'USER',
  };

  userMessage = '';
  userAttempted = false;
  isLoadingUsers = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
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

    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoadingUsers = true;

    this.userService
      .getUsers()
      .pipe(finalize(() => (this.isLoadingUsers = false)))
      .subscribe({
        next: (users) => {
          this.users = users;
        },
        error: (error) => {
          this.userMessage = this.extractErrorMessage(error, 'No se pudieron cargar los usuarios.');
        },
      });
  }

  saveUser(): void {
    this.userAttempted = true;
    this.userMessage = '';

    const validation = this.userValidationMessage;
    if (validation) {
      this.userMessage = validation;
      return;
    }

    const username = this.userForm.username.trim();
    const password = this.userForm.password.trim();

    const payload: UserPayload = {
      username,
      role: this.userForm.role || 'USER',
    };

    if (password) {
      payload.password = password;
    }

    const request = this.userForm.id
      ? this.userService.updateUser(this.userForm.id, payload)
      : this.userService.createUser(payload);

    request.subscribe({
      next: () => {
        this.userMessage = this.userForm.id
          ? 'Usuario actualizado correctamente.'
          : 'Usuario creado correctamente.';
        this.resetUserForm();
        this.loadUsers();
      },
      error: (error) => {
        this.userMessage = this.extractErrorMessage(error, 'No se pudo guardar el usuario.');
      },
    });
  }

  editUser(user: UserRecord): void {
    this.userForm = {
      id: user.id,
      username: user.username,
      password: '',
      role: user.role || 'USER',
    };
  }

  deleteUser(user: UserRecord): void {
    if (!confirm(`¿Eliminar al usuario ${user.username}?`)) {
      return;
    }

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.userMessage = 'Usuario eliminado correctamente.';
        this.loadUsers();
      },
      error: (error) => {
        this.userMessage = this.extractErrorMessage(error, 'No se pudo eliminar el usuario.');
      },
    });
  }

  resetUserForm(): void {
    this.userForm = {
      id: null,
      username: '',
      password: '',
      role: 'USER',
    };
  }

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  get userValidationMessage(): string {
    const username = this.userForm.username.trim();
    const password = this.userForm.password.trim();
    const role = this.userForm.role?.trim();

    if (username.length < 3) {
      return 'El usuario debe tener entre 3 y 30 caracteres.';
    }

    if (!['USER', 'ADMIN'].includes(role)) {
      return 'El rol debe ser USER o ADMIN.';
    }

    if (!this.userForm.id && password.length < 6) {
      return 'La contraseña es obligatoria y debe tener al menos 6 caracteres.';
    }

    if (password && password.length < 6) {
      return 'La contraseña nueva debe tener al menos 6 caracteres.';
    }

    return '';
  }

  get shouldShowUserValidationMessage(): boolean {
    return this.userAttempted && !!this.userValidationMessage;
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