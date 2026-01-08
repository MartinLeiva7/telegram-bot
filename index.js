const { Telegraf } = require("telegraf");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

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

// Manejador de los clics en los botones
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const categoria = ctx.callback_query.data.replace("cat_", "");
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
        Categoria: categoria, // <--- Aquí usamos la nueva columna
      });

      await ctx.editMessageText(
        `✅ Registrado: $${gasto.monto} en ${gasto.concepto} (${categoria})`
      );
      temporalGasto.delete(userId); // Limpiamos la memoria temporal
    } catch (error) {
      console.error(error);
      await ctx.reply("❌ Error al guardar en Sheets");
    }
  } else {
    await ctx.reply(
      "⚠️ Error: El dato expiró. Por favor, escribe el gasto de nuevo."
    );
  }

  await ctx.answerCbQuery(); // Quita el relojito del botón en Telegram
});

// Comando /resumen
bot.command("resumen", async (ctx) => {
  try {
    await ctx.reply("📊 Calculando el resumen de este mes...");

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1; // Enero es 0
    const anioActual = ahora.getFullYear();

    let totalMes = 0;
    const porCategoria = {};

    rows.forEach((row) => {
      // Asumiendo que la fecha en el Sheet se guarda como "DD/MM/YYYY HH:MM:SS"
      const fechaStr = row.get("Fecha");
      if (!fechaStr) return;

      // Parseamos la fecha manualmente para mayor seguridad
      const [fechaParte] = fechaStr.split(" ");
      const [dia, mes, anio] = fechaParte.split("/");

      if (parseInt(mes) === mesActual && parseInt(anio) === anioActual) {
        // Limpiamos el monto por si tiene comas o signos de pesos
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

    // Armar el mensaje de respuesta
    let mensaje = `💰 *Resumen de ${ahora.toLocaleString("es-AR", {
      month: "long",
    })}* 💰\n`;
    mensaje += `----------------------------\n`;

    for (const [cat, subtotal] of Object.entries(porCategoria)) {
      mensaje += `🔹 *${cat}:* $${subtotal.toLocaleString("es-AR")}\n`;
    }

    mensaje += `----------------------------\n`;
    mensaje += `TOTAL: *$${totalMes.toLocaleString("es-AR")}*`;

    await ctx.replyWithMarkdown(mensaje);
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Error al generar el resumen.");
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
