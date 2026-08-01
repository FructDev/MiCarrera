# Mi Carrera

Aplicación web para controlar el pensum universitario, materias aprobadas y en curso, calificaciones, índice acumulado, progreso y planificación de próximos períodos.

## Funcionalidades

- Inicio limpio con asistente para configurar universidad, carrera y escala académica.
- Demostración opcional que solo se carga cuando el usuario la selecciona.
- Dashboard académico adaptable a móvil, tableta y escritorio.
- Pensum interactivo por semestre, cuatrimestre o trimestre.
- Estados: aprobada, en curso, pendiente, reprobada, retirada y convalidada.
- Cálculo configurable del índice en escala de 4.00 o 5.00.
- Simulación del índice con calificaciones futuras.
- Planificador basado en prerrequisitos y carga de créditos.
- Importación de PDF, imágenes con OCR, Excel, CSV y JSON.
- Exportación de respaldo JSON y pensum CSV.
- Almacenamiento privado en IndexedDB, modo oscuro y funcionamiento PWA.

## Ejecutar localmente

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev
```

Para probar exactamente la versión estática de GitHub Pages:

```bash
npm run build:github
npx vite preview --config vite.github.config.ts --outDir github-pages-dist
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube todos los archivos de este proyecto a la rama `main`.
3. Abre **Settings → Pages** en el repositorio.
4. En **Build and deployment**, selecciona **GitHub Actions**.
5. Abre la pestaña **Actions** y espera a que termine “Publicar en GitHub Pages”.

El flujo incluido en `.github/workflows/deploy-pages.yml` construirá y publicará la aplicación automáticamente con cada cambio enviado a `main`.

## Formato recomendado para importar

La carpeta `public` incluye `plantilla-pensum.csv`. Las columnas reconocidas son:

| Campo | Ejemplo |
| --- | --- |
| codigo | INF-101 |
| materia | Programación I |
| creditos | 4 |
| periodo | 2 |
| estado | Aprobada |
| nota | 92 |
| prerrequisitos | INF-100;MAT-101 |

Los documentos PDF e imágenes pasan por una revisión editable porque el diseño de cada universidad es diferente. El OCR descarga el modelo de idioma la primera vez que se utiliza, pero el documento se procesa dentro del navegador.

## Privacidad

No se utiliza un backend. Los datos académicos se guardan en IndexedDB en el dispositivo del usuario. Para moverlos a otro navegador o equipo, utiliza **Documentos → Crear respaldo completo** y luego **Restaurar respaldo**.
