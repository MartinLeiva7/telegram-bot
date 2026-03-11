const { Telegraf } = require("telegraf");
const QuickChart = require("quickchart-js");
const Tesseract = require("tesseract.js");
const axios = require("axios");
const http = require("http");
// 1. Importamos la configuración del Excel desde nuestro nuevo módulo
const { doc } = require("./src/config/excel");

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

// Comando /resumen
bot.command("resumen", async (ctx) => {
  try {
    await ctx.reply(
      "📊 Calculando el resumen de este mes y generando gráfico...",
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
  try {
    await ctx.reply("🔍 Analizando comprobante...");

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    let finalImageUrl = "Sin link (Test)";

    // --- SUBIDA CONDICIONAL: Solo si existe la Key y no estamos en modo bypass ---
    if (IMGBB_API_KEY && IMGBB_API_KEY !== "skip") {
      try {
        console.log("Subiendo a ImgBB...");
        const imgbbResponse = await axios.get("https://api.imgbb.com/1/upload", {
          params: {
            key: IMGBB_API_KEY,
            image: fileLink.href,
          },
        });
        finalImageUrl = imgbbResponse.data.data.url;
        console.log("Imagen subida exitosamente:", finalImageUrl);
      } catch (err) {
        console.error("Error en ImgBB, usando backup de Telegram:", err.message);
        finalImageUrl = fileLink.href;
      }
    } else {
      console.log("Modo TEST activo: Saltando subida a ImgBB.");
      finalImageUrl = fileLink.href; // Usamos el link directo de Telegram (dura 1 hora)
    }

    // --- OCR para el monto (Tesseract) ---
    const {
      data: { text },
    } = await Tesseract.recognize(fileLink.href, "spa+eng");

    const todosLosNumeros = text.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g) || [];
    const candidatos = todosLosNumeros
      .map((n) => n.replace(/\./g, "").replace(",", "."))
      .map((n) => parseFloat(n))
      .filter((n) => n > 100 && n < 1000000);

    candidatos.sort((a, b) => b - a);
    const montoFinal = candidatos[0];

    if (montoFinal) {
      // Guardamos los datos temporalmente
      temporalGasto.set(ctx.from.id, {
        monto: montoFinal.toString(),
        driveUrl: finalImageUrl, // Aunque la variable se llame driveUrl, ahora guarda el de ImgBB
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
        },
      );
    } else {
      await ctx.reply(
        "No detecté el monto. Por favor, escribe: [monto] [concepto]",
      );
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

// --- FUNCIONALIDAD: Borrar último gasto ---

bot.command("borrar", async (ctx) => {
  try {
    await ctx.reply("🔍 Buscando el último registro...");
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      return await ctx.reply("No hay gastos registrados para borrar. 🤷‍♂️");
    }

    // Obtenemos la última fila
    const ultimaFila = rows[rows.length - 1];
    const fecha = ultimaFila.get("Fecha");
    const monto = ultimaFila.get("Monto");
    const concepto = ultimaFila.get("Concepto");

    // Guardamos el índice de la fila para borrarla después si confirma
    // Usamos el número de fila real en el sheet
    const rowNumber = ultimaFila.rowNumber;

    await ctx.reply(
      `⚠️ *¿Estás seguro de borrar este gasto?*\n\n` +
      `📅 Fecha: ${fecha}\n` +
      `💰 Monto: $${monto}\n` +
      `📝 Concepto: ${concepto}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Sí, borrar", callback_data: `confirm_delete_${rowNumber}` },
              { text: "❌ No, dejarlo", callback_data: "cancelar_borrado" }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error al buscar último gasto:", error);
    await ctx.reply("❌ Error al intentar acceder a los registros.");
  }
});

// Callback para ejecutar el borrado real
bot.action(/^confirm_delete_/, async (ctx) => {
  try {
    const rowNumber = parseInt(ctx.match.input.replace("confirm_delete_", ""));
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    // Buscamos la fila por su número de fila
    const filaABorrar = rows.find(r => r.rowNumber === rowNumber);

    if (filaABorrar) {
      await filaABorrar.delete();
      await ctx.editMessageText("🗑️ Registro eliminado correctamente.");
    } else {
      await ctx.editMessageText("❌ No se pudo encontrar el registro. Quizás ya fue borrado.");
    }
  } catch (error) {
    console.error("Error al borrar fila:", error);
    await ctx.reply("❌ Error al intentar borrar la fila.");
  }
  await ctx.answerCbQuery();
});

bot.action("cancelar_borrado", async (ctx) => {
  await ctx.editMessageText("Operación cancelada. El gasto sigue a salvo. 🙂");
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
