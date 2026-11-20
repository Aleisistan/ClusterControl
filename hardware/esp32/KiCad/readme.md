# Diseño de hardware ESP32

Esta carpeta contiene el proyecto electrónico de ClusterControl. Para
consultar o modificar el diseño, abre `Archivos KiCad.kicad_pro` en KiCad.

## Archivos principales

- `Archivos KiCad.kicad_sch`: esquema eléctrico.
- `Archivos KiCad.kicad_pcb`: diseño de la placa.
- `Archivos KiCad.net`: netlist exportada.
- `Archivos KiCad-PTH.drl` y `Archivos KiCad-NPTH.drl`: archivos de taladrado
  para agujeros metalizados y no metalizados.
- `DRC.rpt`: reporte de reglas de diseño; revísalo antes de fabricar.

La carpeta también incluye PDFs e imágenes de referencia (`DIAGRAMA.pdf`,
`PLACA.pdf` y vistas de capas). Son exportaciones, no reemplazan los archivos
fuente de KiCad.

Antes de fabricar, abre el diseño fuente, ejecuta las comprobaciones DRC y
genera los archivos de fabricación requeridos por el fabricante. Los PDFs y
taladros incluidos no constituyen por sí solos un paquete completo de
fabricación. Para conocer el pinout del firmware, consulta el
[README del ESP32](../../../firmware/ClusterControl_ESP32/README.md).
