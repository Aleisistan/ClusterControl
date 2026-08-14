export const MQTT_TOPICS = {
  // Publicados por ESP32
  TELEMETRY: 'datacenter/ambiente',
  CAMERA_IP: 'datacenter/camera/ip',

  // Comandos enviados desde el backend
  EXTRACTOR_SET: 'datacenter/extractor/set',
  AIRE_SET: 'datacenter/aire/set',

  // Futuros
  DOOR_SET: 'datacenter/door/set',
  BUZZER_SET: 'datacenter/buzzer/set',
};
