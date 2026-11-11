import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCameraDto } from './create-camera.dto';
import { UpdateCameraDto } from './update-camera.dto';

describe('camera address DTOs', () => {
  it('accepts and preserves a full HTTP stream URL when creating a camera', () => {
    const dto = plainToInstance(CreateCameraDto, {
      name: 'Entrada',
      ip: 'https://hoktastream3.webcamera.pl/krakow_cam_6f3258/krakow_cam_6f3258.stream/playlist.m3u8',
      deviceId: '34',
    });

    expect(dto.ip).toBe(
      'https://hoktastream3.webcamera.pl/krakow_cam_6f3258/krakow_cam_6f3258.stream/playlist.m3u8',
    );
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('continues to accept a bare IP for an ESP32 camera', () => {
    const dto = plainToInstance(CreateCameraDto, {
      name: 'ESP32',
      ip: '192.168.1.50',
      deviceId: '34',
    });

    expect(dto.ip).toBe('192.168.1.50');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('accepts a bare IP when updating a camera', () => {
    const dto = plainToInstance(UpdateCameraDto, {
      ip: '192.168.1.51',
    });

    expect(dto.ip).toBe('192.168.1.51');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects non-HTTP URLs', () => {
    const dto = plainToInstance(UpdateCameraDto, {
      ip: 'ftp://camera.example.com/stream',
    });

    expect(validateSync(dto)).not.toHaveLength(0);
  });
});
