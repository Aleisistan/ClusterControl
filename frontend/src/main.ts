import 'bootstrap';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

async function bootstrap() {
  const response = await fetch('/runtime-config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load runtime configuration: ${response.status}`);
  }

  const runtimeConfig: unknown = await response.json();
  if (
    typeof runtimeConfig !== 'object' ||
    runtimeConfig === null ||
    !('apiUrl' in runtimeConfig) ||
    typeof runtimeConfig.apiUrl !== 'string' ||
    !runtimeConfig.apiUrl.trim() ||
    !('socketUrl' in runtimeConfig) ||
    typeof runtimeConfig.socketUrl !== 'string'
  ) {
    throw new Error('Runtime configuration must contain apiUrl and socketUrl strings.');
  }

  environment.apiUrl = runtimeConfig.apiUrl.replace(/\/$/, '');
  environment.socketUrl = runtimeConfig.socketUrl.replace(/\/$/, '');
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err) => console.error('Application startup failed:', err));
