# 🤖 Telegram Expense Bot — v2.0 (Modular)

Sistema automatizado para la gestión de gastos personales mediante **Telegram**, **Google Sheets** y **OCR**. Este bot permite registrar gastos de forma manual o mediante fotos de comprobantes, organizándolos por categorías y generando reportes visuales.

---

## 🚀 Funcionalidades Principales

- **📸 Procesamiento OCR:** Envía una foto de un ticket y el bot extraerá el monto automáticamente usando **Tesseract.js**.
- **☁️ Almacenamiento en la Nube:** Las imágenes se hostean en **ImgBB** para mantener un registro visual persistente en la planilla de Google.
- **📊 Reportes Visuales:** Comando `/resumen` para generar un gráfico de torta dinámico con los gastos del mes (vía **QuickChart**).
- **🗑️ Gestión de Errores:** Comando `/borrar` para eliminar el último registro cargado de forma rápida y segura con confirmación.
- **📂 Organización Inteligente:** Clasificación por categorías mediante teclados interactivos (Inline Keyboards).

---

## 🏗️ Arquitectura y Tecnologías

El proyecto ha sido refactorizado a una estructura **modular** para facilitar el mantenimiento y la escalabilidad de nuevas funciones:

- **Lenguaje:** Node.js (Telegraf.js framework).
- **Infraestructura:** Docker & Docker Compose.
- **CI/CD:** GitHub Actions (Auto-deploy a Oracle Cloud).
- **Base de Datos:** Google Sheets API v4.
- **Ambientes:** Separación total entre `Producción` (rama `main`) y `Testing` (rama `develop`).

 ### Estructura del Proyecto

```
├── src/
│   ├── commands/     # Lógica de comandos (/resumen, /borrar)
│   ├── config/       # Conexión y auth de Google Sheets
│   ├── constants/    # Categorías y botones (Buttons/Categories)
│   └── services/     # Lógica de OCR, ImgBB y escritura en Excel
├── index.js          # Punto de entrada y orquestador del Bot
├── docker-compose.yml# Configuración de contenedores
└── .github/          # Flujos de GitHub Actions (CI/CD)
```
## 🛠️ Instalación y Configuración
1. **Clonar repositorio**
```
git clone https://github.com/MartinLeiva7/telegram-bot.git
```

2. **Variables de Entorno:** Crear un archivo .env con las siguientes llaves:

    *   **BOT**\_TOKEN: Token de BotFather.

    *   **SHEET**\_ID: ID de tu Google Sheet.

    *   **GOOGLE**\_JSON\_KEY: Credenciales de la Service Account (**JSON**).

    *   **IMGBB**\_API\_KEY: **API** Key para hosting de imágenes.

    *   **HOST**\_PORT: Puerto para el Health Check (default: **8000**).

3. **Despliegue con Docker**

```
docker compose up -d --build
```
## 📈 Comandos Disponibles

`/start` - Inicia el bot y muestra la ayuda.

`/resumen` - Genera un gráfico y desglose de gastos del mes actual.

`/borrar `- Busca y permite eliminar el último gasto registrado.

`[monto] [concepto]` - Registro manual rápido (Ej: 5000 Cine).

## 🛡️ Notas de Desarrollo (CI/CD)

Este repositorio cuenta con un flujo de **Integración Continua**:

- Los cambios en la rama develop se despliegan en el **Ambiente de Test** (Puerto **8001**).

- Los cambios en la rama main se despliegan en el **Ambiente de Producción** (Puerto **8000**).

**Desarrollado por** [**Martin Leiva**](https://[www.google.com/search?q=https://github.com/MartinLeiva7&authuser=1](https://www.google.com/search?q=https://github.com/MartinLeiva7&authuser=1)) 🚀
