const { doc } = require("../config/excel");
const QuickChart = require("quickchart-js");

async function generarResumen(ctx) {
  const user = ctx.from.username || ctx.from.id;
  console.log(`[COMMAND] /resumen solicitado por @${user}`);
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
}

module.exports = { generarResumen };
