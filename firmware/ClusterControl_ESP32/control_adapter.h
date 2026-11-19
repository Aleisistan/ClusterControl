#pragma once

#include <Arduino.h>
#include <IRsend.h>
#include "config.h"

#define IR_LED_PIN 25
#define RELAY_EXTRACTOR 18
#define RELAY_PIN 19

static IRsend irsend(IR_LED_PIN);

bool extractorState = false;
bool extractorPorTemp = false;
bool extractorPorHum = false;
bool aireEncendido = false;
bool puertaAbierta = false;
bool puertaAnterior = false;
bool luzEncendida = false;

float serialTemp1 = NAN, serialHum1 = NAN;
float serialTemp2 = NAN, serialHum2 = NAN;
bool serialLecturaValida = false;

inline void setupControls() {
  pinMode(RELAY_EXTRACTOR, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  // Relés activos en LOW: HIGH equivale a apagado.
  digitalWrite(RELAY_EXTRACTOR, HIGH);
  digitalWrite(RELAY_PIN, HIGH);

  irsend.begin();
}

inline void setExtractor(bool state) {
  if (extractorState == state) return;
  extractorState = state;
  digitalWrite(RELAY_EXTRACTOR, state ? LOW : HIGH);
  Serial.printf("[CONTROL] Extractor %s\n", state ? "ENCENDIDO" : "APAGADO");
}

inline void setAire(bool encender) {
  if (encender == aireEncendido) return;

  // Se conserva el comando POWER del firmware original.
  // Es un comando toggle: validar el estado real del equipo en la prueba.
  irsend.sendCOOLIX(IR_POWER);
  aireEncendido = encender;
  Serial.printf("[CONTROL] Aire %s\n", encender ? "ENCENDIDO" : "APAGADO");
}

inline void setLuz(bool state) {
  luzEncendida = state;
  digitalWrite(RELAY_PIN, state ? LOW : HIGH);
  Serial.printf("[CONTROL] Luz %s\n", state ? "ENCENDIDA" : "APAGADA");
}
