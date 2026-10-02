import { Routes } from '@angular/router';

import { AdminClustersPageComponent } from './pages/admin-clusters-page.component';
import { AdminUsersPageComponent } from './pages/admin-users-page.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginPageComponent } from './pages/login-page.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    title: 'Cluster Control | Login',
    component: LoginPageComponent,
  },
  {
    path: 'dashboard',
    title: 'Cluster Control | Dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    children: [
      {
        path: '',
        redirectTo: '/login',
        pathMatch: 'full',
      },
      {
        path: 'users',
        title: 'Cluster Control | Usuarios',
        component: AdminUsersPageComponent,
      },
      {
        path: 'clusters',
        title: 'Cluster Control | Clusters',
        component: AdminClustersPageComponent,
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];