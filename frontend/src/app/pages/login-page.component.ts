import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { finalize } from 'rxjs';

import { AuthService, LoginPayload } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginPageComponent implements OnInit {
  loginForm: LoginPayload = {
    username: '',
    password: '',
  };

  loginError = '';
  sessionMessage = '';
  loginAttempted = false;
  isLoggingIn = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  login(): void {
    this.loginAttempted = true;
    this.loginError = '';
    this.sessionMessage = '';

    const validation = this.loginValidationMessage;
    if (validation) {
      this.loginError = validation;
      return;
    }

    this.isLoggingIn = true;

    this.authService
      .login(this.loginForm)
      .pipe(finalize(() => (this.isLoggingIn = false)))
      .subscribe({
        next: () => {
          this.sessionMessage = 'Sesión iniciada correctamente.';
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.loginError = this.extractErrorMessage(
            error,
            'No fue posible iniciar sesión.',
          );
        },
      });
  }

  get loginValidationMessage(): string {
    const username = this.loginForm.username.trim();
    const password = this.loginForm.password.trim();

    if (username.length < 3) {
      return 'El usuario debe tener al menos 3 caracteres.';
    }

    if (password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }

    return '';
  }

  get shouldShowLoginValidationMessage(): boolean {
    return this.loginAttempted && !!this.loginValidationMessage;
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