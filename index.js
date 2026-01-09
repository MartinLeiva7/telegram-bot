const { Telegraf } = require("telegraf");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const QuickChart = require("quickchart-js");
const Tesseract = require("tesseract.js");
const axios = require("axios");

// 1. Cargar variables de entorno
const BOT_TOKEN = process.env.BOT_TOKEN;
const SHEET_ID = process.env.SHEET_ID;
// Para la clave de Google, la pasaremos como un string JSON
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_JSON_KEY);

const serviceAccountAuth = new JWT({
  email: GOOGLE_CREDS.client_email,
  key: GOOGLE_CREDS.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
const bot = new Telegraf(BOT_TOKEN);

// Objeto para guardar temporalmente el gasto antes de elegir categoría
const temporalGasto = new Map();

// Comando /resumen
bot.command("resumen", async (ctx) => {
  try {
    await ctx.reply(
      "📊 Calculando el resumen de este mes y generando gráfico..."
    );

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1; // Enero es 0
    const anioActual = ahora.getFullYear();

    let totalMes = 0;
    const porCategoria = {};

    rows.forEach((row) => {
      const fechaStr = row.get("Fecha");
      if (!fechaStr) return;

      const [fechaParte] = fechaStr.split(" ");
      const [dia, mes, anio] = fechaParte.split("/");

      if (parseInt(mes) === mesActual && parseInt(anio) === anioActual) {
        const monto = parseFloat(row.get("Monto").toString().replace(",", "."));
        const cat = row.get("Categoria") || "Sin categoría";

        if (!isNaN(monto)) {
          totalMes += monto;
          porCategoria[cat] = (porCategoria[cat] || 0) + monto;
        }
      }
    });

    if (totalMes === 0) {
      return await ctx.reply("Aún no tienes gastos registrados este mes. 😶");
    }

    // --- Parte nueva para el gráfico ---
    const chartLabels = Object.keys(porCategoria);
    const chartData = Object.values(porCategoria);
    const backgroundColors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#A1F0C0",
      "#FFDDC1",
      "#DAA06D",
      "#7CB9E8",
      "#CFCFC4", // Puedes agregar más colores
    ];

    const myChart = new QuickChart();
    myChart
      .setConfig({
        type: "pie",
        data: {
          labels: chartLabels,
          datasets: [
            {
              data: chartData,
              backgroundColor: backgroundColors.slice(0, chartLabels.length), // Usar solo los colores necesarios
            },
          ],
        },
        options: {
          title: {
            display: true,
            text: `Gastos de ${ahora.toLocaleString("es-AR", {
              month: "long",
            })}`,
          },
        },
      })
      .setWidth(500)
      .setHeight(300)
      .setVersion("2"); // Usar la versión 2 de Chart.js si da problemas la última

    const chartUrl = await myChart.getUrl(); // <--- Sin etiquetas extra

    // --- Fin de parte nueva para el gráfico ---

    // Armar el mensaje de respuesta (igual que antes)
    let mensaje = `💰 *Resumen de ${ahora.toLocaleString("es-AR", {
      month: "long",
    })}* 💰\n`;
    mensaje += `----------------------------\n`;

    for (const [cat, subtotal] of Object.entries(porCategoria)) {
      mensaje += `🔹 *${cat}:* $${subtotal.toLocaleString("es-AR")}\n`;
    }

    mensaje += `----------------------------\n`;
    mensaje += `TOTAL: *$${totalMes.toLocaleString("es-AR")}*`;

    // Primero enviamos el gráfico y luego el texto
    await ctx.replyWithPhoto(chartUrl); // <--- Enviamos la imagen del gráfico
    await ctx.replyWithMarkdown(mensaje); // <--- Luego el texto
  } catch (error) {
    console.error("Error en /resumen:", error);
    await ctx.reply("❌ Error al generar el resumen.");
  }
});

// En lugar de bot.on('callback_query', ...), usa esto:
bot.action(/^cat_/, async (ctx) => {
  const userId = ctx.from.id;

  // telegraf extrae automáticamente el data en ctx.match
  const categoria = ctx.match.input.replace("cat_", "");
  const gasto = temporalGasto.get(userId);

  if (gasto) {
    try {
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];

      await sheet.addRow({
        Fecha: new Date().toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
        }),
        Monto: gasto.monto,
        Concepto: gasto.concepto,
        Categoria: categoria,
      });

      // Borramos el Map ANTES de responder para evitar doble clic
      temporalGasto.delete(userId);

      await ctx.editMessageText(
        `✅ Registrado: $${gasto.monto} en ${gasto.concepto} (${categoria})`
      );
    } catch (error) {
      console.error("Error al guardar:", error);
      await ctx.reply("❌ Error al guardar en Sheets.");
    }
  } else {
    await ctx.reply("⚠️ El dato expiró o ya fue procesado.");
  }

  await ctx.answerCbQuery();
});

// Agregar este action para cuando el monto sea incorrecto
bot.action("cancelar", async (ctx) => {
  temporalGasto.delete(ctx.from.id);
  await ctx.editMessageText(
    "Operación cancelada. Puedes escribir el gasto manualmente."
  );
  await ctx.answerCbQuery();
});

bot.on("photo", async (ctx) => {
  try {
    await ctx.reply("🔍 Analizando comprobante... por favor espera.");

    // 1. Obtener la URL de la foto (la de mejor calidad)
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);

    // 2. Usar Tesseract para leer la imagen
    // Usamos 'spa' para español y 'eng' para números
    const {
      data: { text },
    } = await Tesseract.recognize(fileUrl.href, "spa+eng");

    console.log("Texto extraído:", text); // Esto es para que veas en Koyeb qué leyó

    // 3. Buscar el monto con una Expresión Regular (Regex)
    // Busca números que tengan formato de moneda (ej: 1.500,00 o 1500.00)
    const regexMontoPro =
      /(?:Total|Importe|Pagaste|[Pp]ago)?\s?\$?\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i;

    const match = text.match(regexMontoPro);
    let montoFinal = null;

    if (match && match[1]) {
      // Limpiamos el monto (ej: "33.000" -> "33000")
      montoFinal = match[1].replace(/\./g, "").replace(",", ".");
    } else {
      // Si no encontró el "Total", buscamos cualquier número que parezca un precio alto (> 100)
      const todosLosNumeros =
        text.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?/g) || [];
      const candidatos = todosLosNumeros
        .map((n) => n.replace(/\./g, "").replace(",", "."))
        .filter((n) => parseFloat(n) > 100); // Ignoramos números pequeños como la hora

      if (candidatos.length > 0) {
        montoFinal = candidatos[0];
      }
    }

    if (montoFinal) {
      // Guardamos en el Map temporal como si lo hubiera escrito el usuario
      temporalGasto.set(ctx.from.id, {
        monto: montoFinal,
        concepto: "Comprobante",
      });

      await ctx.reply(
        `He detectado un monto de *$${parseFloat(montoFinal).toLocaleString(
          "es-AR"
        )}*.\n¿En qué categoría lo guardamos?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🛒 Super", callback_data: "cat_Supermercado" },
                { text: "🍔 Comida", callback_data: "cat_Comida" },
              ],
              [
                { text: "🏠 Hogar", callback_data: "cat_Hogar" },
                { text: "💡 Servicios", callback_data: "cat_Servicios" },
              ],
              [
                { text: "🎉 Ocio", callback_data: "cat_Ocio" },
                { text: "❓ Otros", callback_data: "cat_Otros" },
              ],
              [{ text: "❌ No es correcto", callback_data: "cancelar" }],
            ],
          },
        }
      );
    }
  } catch (error) {
    console.error("Error procesando imagen:", error);
    await ctx.reply(
      "Hubo un error al leer la imagen. Intenta escribir el gasto manualmente."
    );
  }
});

bot.on("text", async (ctx) => {
  const mensaje = ctx.message.text;
  const partes = mensaje.split(" ");

  if (partes.length >= 2 && !isNaN(partes[0].replace(",", "."))) {
    const monto = partes[0];
    const concepto = partes.slice(1).join(" ");

    // Guardamos los datos temporalmente usando el ID del usuario como llave
    temporalGasto.set(ctx.from.id, { monto, concepto });

    // Enviamos los botones
    await ctx.reply(`¿En qué categoría guardamos los $${monto}?`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🛒 Super", callback_data: "cat_Supermercado" },
            { text: "🍔 Comida", callback_data: "cat_Comida" },
          ],
          [
            { text: "🏠 Hogar", callback_data: "cat_Hogar" },
            { text: "💡 Servicios", callback_data: "cat_Servicios" },
          ],
          [
            { text: "🎉 Ocio", callback_data: "cat_Ocio" },
            { text: "❓ Otros", callback_data: "cat_Otros" },
          ],
        ],
      },
    });
  } else {
    await ctx.reply("Usa el formato: [monto] [concepto]");
  }
});

bot.launch();
console.log("Bot en marcha...");

// Mini servidor para que Koyeb crea que es una web y pase el Health Check
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot vivo");
  })
  .listen(process.env.PORT || 8000);
