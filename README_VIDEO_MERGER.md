# Video Merger para VueSchool Downloader

Esta herramienta permite unir los archivos de video y audio descargados de VueSchool en un solo archivo MP4 de alta calidad.

## Requisitos

-   Python 3.6 o superior
-   FFmpeg instalado y disponible en el PATH del sistema

## Instalación de dependencias

### Instalar Python

Descarga e instala Python desde [python.org](https://www.python.org/downloads/)

### Instalar FFmpeg

1. Descarga FFmpeg desde [ffmpeg.org](https://ffmpeg.org/download.html)
2. Asegúrate de que esté disponible en el PATH del sistema

## Uso

### Desde la línea de comandos

```bash
# Unir todos los cursos en la carpeta de descargas
node src/utils/mergeVideos.js

# Especificar una carpeta de entrada diferente
node src/utils/mergeVideos.js -i "ruta/a/carpeta"

# Procesar un curso específico
node src/utils/mergeVideos.js -c "Nombre del Curso"

# Conservar archivos originales después de la mezcla
node src/utils/mergeVideos.js -k
```

### Desde el código

```javascript
import { mergeVideos } from "./src/utils/mergeVideos.js";

// Unir todos los cursos en la carpeta de descargas predeterminada
await mergeVideos();

// Especificar opciones
await mergeVideos({
    inputDir: "./ruta/a/carpeta",
    courseName: "Nombre del Curso", // opcional
    keepOriginals: true, // conservar archivos originales
});
```

## Estructura de archivos

La herramienta busca pares de archivos de video y audio con el siguiente formato:

-   Video: `01-Nombre de la lección.fhls-fastly_skyfire-XXX.mp4`
-   Audio: `01-Nombre de la lección.fhls-fastly_skyfire-audio-high-English.mp4`

Por defecto, los archivos originales se eliminarán automáticamente después de una mezcla exitosa. Si deseas conservarlos, utiliza la opción `-k` o `keepOriginals: true`.

Los archivos unidos se guardarán en la carpeta `downloads` con la siguiente estructura:

```
downloads/
  Nombre del Curso/
    01-Nombre de la lección.mp4
    02-Nombre de la lección.mp4
    ...
```

## Integración con el flujo de trabajo

Esta herramienta puede integrarse con el flujo de trabajo existente para unir automáticamente los archivos después de la descarga. Para ello, se puede modificar el archivo `scraper.js` para llamar a la función `mergeVideos` después de completar la descarga de un curso.
