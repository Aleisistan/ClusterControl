
# Diseño electrónico con KiCad

## ¿Qué es KiCad?

KiCad es una herramienta de software libre y de código abierto utilizada para diseñar circuitos electrónicos y desarrollar placas de circuito impreso (PCB).
Sitio Web: https://www.kicad.org/
Permite realizar el diseño completo de un circuito, desde la representación esquemática de sus componentes y conexiones eléctricas hasta el diseño físico de la placa, definiendo la ubicación de los componentes y las pistas de cobre.

En el proyecto **ClusterControl**, KiCad se utiliza para documentar y desarrollar los circuitos electrónicos asociados al sistema de automatización, monitoreo climático y control mediante ESP32.

## Funcionamiento general

El proceso de diseño se desarrolla en dos etapas principales:

1. **Diseño del esquema eléctrico:** se incorporan los componentes electrónicos, se definen sus conexiones y se verifica la coherencia del circuito.
2. **Diseño de la PCB:** se asignan las huellas físicas de los componentes, se distribuyen sobre la placa y se trazan las pistas que permiten realizar las conexiones eléctricas.

Finalmente, KiCad permite generar archivos de fabricación y documentación técnica para construir la placa electrónica.

## Principales archivos del proyecto

| Archivo | Función |
|---|---|
| `.kicad_pro` | Contiene la configuración general del proyecto. |
| `.kicad_sch` | Almacena el esquema eléctrico y las conexiones entre componentes. |
| `.kicad_pcb` | Contiene el diseño físico de la placa de circuito impreso. |
| `.kicad_sym` | Biblioteca de símbolos electrónicos personalizados. |
| `.kicad_mod` | Define las huellas físicas (*footprints*) de los componentes. |
| `.kicad_dru` | Contiene reglas de diseño para verificar las restricciones de fabricación. |
| `.kicad_wks` | Define plantillas personalizadas para las hojas de documentación. |

No todos estos archivos están necesariamente presentes en cada proyecto. Los archivos principales son el `.kicad_pro`, el `.kicad_sch` y, cuando existe un diseño de placa, el `.kicad_pcb`.

## Integración con ClusterControl

La incorporación de los proyectos KiCad al repositorio permite mantener centralizados los diseños electrónicos junto con el firmware del ESP32 y el resto del software de la plataforma.

Esto facilita:

- Consultar los esquemas eléctricos y las conexiones.
- Modificar y mantener los diseños electrónicos.
- Reproducir los circuitos y desarrollar nuevas versiones.
- Documentar las conexiones entre sensores, relés, actuadores y controladores.
- Mantener un historial de modificaciones mediante Git y GitHub.

**Objetivo:** disponer de una documentación técnica centralizada que permita mantener y evolucionar tanto el hardware como el software de ClusterControl.
