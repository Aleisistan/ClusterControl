#pragma once

#include <math.h>

// Reemplaza estas funciones por la lectura de los sensores de la placa.
// Mientras devuelvan NAN, el sketch no publicara telemetria incompleta.
inline float readTemperature1() { return NAN; }
inline float readTemperature2() { return NAN; }
inline float readHumidity1() { return NAN; }
inline float readHumidity2() { return NAN; }

// Ajusta estas lecturas a la electronica del equipo.
inline bool readExtractorState() { return false; }
inline bool readAirConditionerState() { return false; }
inline bool readDoorState() { return false; }
inline bool readLightState() { return false; }
