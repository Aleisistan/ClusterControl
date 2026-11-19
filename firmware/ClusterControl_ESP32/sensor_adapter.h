#pragma once

#include <Arduino.h>
#include <DHT.h>
#include "config.h"

// Pines y tipo idénticos al firmware operativo.
#define DHTPIN 4
#define DHTPIN2 14
#define DHTTYPE DHT11
#define DOOR_SENSOR_PIN 27

static DHT dhtSensor1(DHTPIN, DHTTYPE);
static DHT dhtSensor2(DHTPIN2, DHTTYPE);

inline void setupSensors() {
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  dhtSensor1.begin();
  dhtSensor2.begin();
}

inline float readTemperature1() { return dhtSensor1.readTemperature(); }
inline float readHumidity1() { return dhtSensor1.readHumidity(); }
inline float readTemperature2() { return dhtSensor2.readTemperature(); }
inline float readHumidity2() { return dhtSensor2.readHumidity(); }

// Firmware original interpretaba HIGH como puerta abierta.
inline bool readDoorState() {
  return digitalRead(DOOR_SENSOR_PIN) == HIGH;
}

inline bool sensorsAreValid(float t1, float h1, float t2, float h2) {
  return isfinite(t1) && isfinite(h1) && isfinite(t2) && isfinite(h2)
      && t1 >= -40.0f && t1 <= 80.0f
      && t2 >= -40.0f && t2 <= 80.0f
      && h1 >= 0.0f && h1 <= 100.0f
      && h2 >= 0.0f && h2 <= 100.0f;
}
