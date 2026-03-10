---
## 🚀 Despliegue e Infraestructura
Este bot está hosteado en **Oracle Cloud (Always Free)** utilizando una instancia de Ubuntu 24.04.

El flujo de despliegue está automatizado mediante **GitHub Actions**:
* **CI/CD:** Cada `push` a la rama `main` dispara un workflow que actualiza el código en el servidor.
* **Contenedores:** Se utiliza **Docker** y **Docker Compose** para gestionar el entorno de Node.js de forma aislada y eficiente.
* **Mantenimiento:** Incluye tareas programadas (Cron) para limpieza de imágenes y optimización de memoria Swap.