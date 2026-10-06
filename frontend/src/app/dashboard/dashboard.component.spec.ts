import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prefer the direct camera IP stream when the camera is configured', () => {
    const url = component.buildCameraStreamUrl('192.168.2.54');

    expect(url).toBe('http://192.168.2.54:81/stream');
  });

  it('should fall back to the backend stream route when no direct camera IP exists', () => {
    const url = component.buildCameraStreamUrl('');

    expect(url).toContain('/camera/stream/');
  });
});
