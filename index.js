const { Telegraf } = require("telegraf");
const http = require("http");
// 1. Importamos la configuración del Excel desde nuestro nuevo módulo
const { doc } = require("./src/config/excel");
const {
  borrarUltimoGasto,
  confirmarBorrado,
} = require("./src/commands/borrar");
const { generarResumen } = require("./src/commands/resumen");
const { procesarComprobante } = require("./src/services/ocr");

// 2. Cargar variables de entorno
const BOT_TOKEN = process.env.BOT_TOKEN;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const HOST_PORT = process.env.HOST_PORT || 8000; // Render asigna el puerto automáticamente

// 3. Inicializamos el Bot
const bot = new Telegraf(BOT_TOKEN);

// 4. Categorias
const CATEGORIES = [
  [
    { text: "🏗️ Mano de Obra", callback_data: "cat_Obra-Mano" },
    { text: "🧱 Materiales", callback_data: "cat_Obra-Mat" },
  ],
  [
    { text: "🏠 Alquiler/Serv", callback_data: "cat_Vivienda" },
    { text: "🛒 Super/Carne", callback_data: "cat_Supermercado" },
  ],
  [
    { text: "🍕 Comida/Ocio", callback_data: "cat_Comida-Ocio" },
    { text: "🚗 Nafta/Auto", callback_data: "cat_TransHOST_PORTe" },
  ],
  [
    { text: "🤵 Personal", callback_data: "cat_Personal" },
    { text: "❓ Otros", callback_data: "cat_Otros" },
  ],
  [{ text: "❌ No es correcto", callback_data: "cancelar" }],
];

// Objeto para guardar temporalmente el gasto antes de elegir categoría
const temporalGasto = new Map();

// --- FUNCIONALIDAD: Borrar último gasto ---
bot.command("borrar", borrarUltimoGasto);

bot.action(/^confirm_delete_/, confirmarBorrado);

bot.action("cancelar_borrado", async (ctx) => {
  await ctx.editMessageText("Operación cancelada. El gasto sigue a salvo. 🙂");
  await ctx.answerCbQuery();
});

// Comando /resumen
bot.command("resumen", generarResumen);

// En lugar de bot.on('callback_query', ...), usa esto:
bot.action(/^cat_/, async (ctx) => {
  const userId = ctx.from.id;
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
        Link_Foto: gasto.driveUrl, // <-- Añade esta columna a tu Excel si quieres ver el link
      });
      temporalGasto.delete(userId);
      await ctx.editMessageText(
        `✅ Guardado: $${gasto.monto} en ${categoria} (${gasto.concepto})`,
      );
    } catch (error) {
      await ctx.reply("❌ Error al guardar.");
    }
  }
  await ctx.answerCbQuery();
});

// Agregar este action para cuando el monto sea incorrecto
bot.action("cancelar", async (ctx) => {
  temporalGasto.delete(ctx.from.id);
  await ctx.editMessageText(
    "Operación cancelada. Puedes escribir el gasto manualmente.",
  );
  await ctx.answerCbQuery();
});

bot.on("photo", async (ctx) => {
  const user = ctx.from.username || ctx.from.id;
  console.log(`[PHOTO] Procesando imagen de @${user}`);

  try {
    await ctx.reply("🔍 Analizando comprobante...");

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    // Llamamos al servicio (pasándole el link y la key)
    const { montoFinal, finalImageUrl } = await procesarComprobante(
      fileLink.href, 
      IMGBB_API_KEY
    );

    if (montoFinal) {
      temporalGasto.set(ctx.from.id, {
        monto: montoFinal.toString(),
        driveUrl: finalImageUrl,
        esperandoConcepto: false,
      });

      await ctx.reply(
        `💰 ¿El monto *$${montoFinal.toLocaleString("es-AR")}* es correcto?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Sí, es correcto", callback_data: "monto_ok" }],
              [{ text: "❌ No, escribir manual", callback_data: "cancelar" }],
            ],
          },
        }
      );
    } else {
      await ctx.reply("No detecté el monto. Por favor, escribe: [monto] [concepto]");
    }
  } catch (error) {
    console.error("Error general en photo:", error);
    await ctx.reply("Error al procesar la imagen.");
  }
});

// Cuando el monto de la foto es correcto, pedimos el concepto
bot.action("monto_ok", async (ctx) => {
  const gasto = temporalGasto.get(ctx.from.id);
  if (gasto) {
    gasto.esperandoConcepto = true; // Ahora esperamos que el usuario escriba el nombre
    await ctx.editMessageText(
      `Monto confirmado: *$${parseFloat(gasto.monto).toLocaleString(
        "es-AR",
      )}*.\n\n✍️ Ahora escribe el **Concepto** (ej: La Huella, Albañil, etc):`,
      { parse_mode: "Markdown" },
    );
  }
  await ctx.answerCbQuery();
});

// Modificamos el bot.on("text") para que sea el "cerebro"
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const mensaje = ctx.message.text;
  const gastoTemporal = temporalGasto.get(userId);

  // CASO A: El bot estaba esperando el concepto de una foto confirmada
  if (gastoTemporal && gastoTemporal.esperandoConcepto) {
    gastoTemporal.concepto = mensaje;
    gastoTemporal.esperandoConcepto = false;
    return await ctx.reply(`Concepto: *${mensaje}*. ¿Categoría?`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: CATEGORIES },
    });
  }

  // CASO B: Ingreso manual normal [monto] [concepto]
  const partes = mensaje.split(" ");
  if (partes.length >= 2 && !isNaN(partes[0].replace(",", "."))) {
    const montoLimpio = partes[0].replace(/\./g, "").replace(",", ".");
    const monto = parseFloat(montoLimpio);
    const concepto = partes.slice(1).join(" ");

    temporalGasto.set(userId, { monto, concepto, driveUrl: "Manual" });

    await ctx.reply(
      `¿Categoría para *$${parseFloat(monto).toLocaleString("es-AR")}*?`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: CATEGORIES },
      },
    );
  } else {
    await ctx.reply(
      "Usa el formato: [monto] [concepto]\nO envía una foto de un comprobante.",
    );
  }
});

// Si los datos están bien, mostramos las categorías
bot.action("confirmar_foto", async (ctx) => {
  await ctx.editMessageText("Perfecto. ¿A qué categoría corresponde?", {
    reply_markup: { inline_keyboard: CATEGORIES }, // Reutilizamos tu constante
  });
  await ctx.answerCbQuery();
});

// Si quiere editar el concepto
bot.action("editar_concepto", async (ctx) => {
  const gasto = temporalGasto.get(ctx.from.id);
  if (gasto) {
    gasto.esperandoConcepto = true; // Marcamos que el próximo texto será el nombre
    await ctx.reply(
      `Escribe el nombre del comercio para el gasto de $${gasto.monto}:`,
    );
  }
  await ctx.answerCbQuery();
});

bot.launch();
console.log("Bot en marcha...");

// Mini servidor para que Koyeb crea que es una web y pase el Health Check
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot vivo");
  })
  .listen(HOST_PORT, () => {
    console.log(`Servidor de monitoreo corriendo en puerto ${HOST_PORT}`);
  });
