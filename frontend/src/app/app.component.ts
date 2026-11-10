import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Subscription } from 'rxjs';

import { AuthService, AuthUser } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  sessionHidden = false;
  private authSubscription?: Subscription;
  private lastScrollY = 0;
  private scrollDirectionDistance = 0;
  private scrollLockedUntil = 0;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.loadSession();
    this.authSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (window.innerWidth > 576) {
      this.sessionHidden = false;
      this.lastScrollY = window.scrollY;
      this.scrollDirectionDistance = 0;
      return;
    }

    const currentScrollY = window.scrollY;

    if (Date.now() < this.scrollLockedUntil) {
      this.lastScrollY = currentScrollY;
      this.scrollDirectionDistance = 0;
      return;
    }

    const scrollDelta = currentScrollY - this.lastScrollY;

    if (currentScrollY <= 8) {
      this.sessionHidden = false;
      this.scrollDirectionDistance = 0;
    } else if (scrollDelta > 0) {
      this.scrollDirectionDistance = Math.max(
        0,
        this.scrollDirectionDistance + scrollDelta,
      );
      if (this.scrollDirectionDistance >= 12) {
        this.setSessionHidden(true);
      }
    } else if (scrollDelta < 0) {
      this.scrollDirectionDistance = Math.min(
        0,
        this.scrollDirectionDistance + scrollDelta,
      );
      if (this.scrollDirectionDistance <= -12) {
        this.setSessionHidden(false);
      }
    }

    this.lastScrollY = currentScrollY;
  }

  private setSessionHidden(hidden: boolean): void {
    if (this.sessionHidden === hidden) {
      return;
    }

    this.sessionHidden = hidden;
    this.scrollDirectionDistance = 0;
    this.scrollLockedUntil = Date.now() + 420;
  }

  logout(): void {
    this.authService.logout();
    this.currentUser = null;
    this.router.navigate(['/login']);
  }

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(`${path}/`);
  }

  onMouseMove(event: MouseEvent): void {
  const main = event.currentTarget as HTMLElement;

  const rect = main.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  main.style.setProperty('--mouse-x', `${x}px`);
  main.style.setProperty('--mouse-y', `${y}px`);
}
}