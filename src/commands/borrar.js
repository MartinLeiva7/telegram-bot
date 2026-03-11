const { doc } = require("../config/excel");

async function borrarUltimoGasto(ctx) {
  const user = ctx.from.username || ctx.from.id;
  console.log(`[COMMAND] /borrar solicitado por @${user}`);
  try {
    await ctx.reply("🔍 Buscando el último registro...");
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      return await ctx.reply("No hay gastos registrados para borrar. 🤷‍♂️");
    }

    const ultimaFila = rows[rows.length - 1];
    const rowNumber = ultimaFila.rowNumber;

    await ctx.reply(
      `⚠️ *¿Estás seguro de borrar este gasto?*\n\n` +
        `📅 Fecha: ${ultimaFila.get("Fecha")}\n` +
        `💰 Monto: $${ultimaFila.get("Monto")}\n` +
        `📝 Concepto: ${ultimaFila.get("Concepto")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Sí, borrar",
                callback_data: `confirm_delete_${rowNumber}`,
              },
              { text: "❌ No, dejarlo", callback_data: "cancelar_borrado" },
            ],
          ],
        },
      },
    );
  } catch (error) {
    console.error("Error al buscar último gasto:", error);
    await ctx.reply("❌ Error al intentar acceder a los registros.");
  }
}

// También movemos la lógica del borrado real
async function confirmarBorrado(ctx) {
  try {
    const rowNumber = parseInt(ctx.match.input.replace("confirm_delete_", ""));
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const filaABorrar = rows.find((r) => r.rowNumber === rowNumber);

    if (filaABorrar) {
      await filaABorrar.delete();
      await ctx.editMessageText("🗑️ Registro eliminado correctamente.");
    } else {
      await ctx.editMessageText("❌ No se pudo encontrar el registro.");
    }
  } catch (error) {
    console.error("Error al borrar fila:", error);
    await ctx.reply("❌ Error al intentar borrar la fila.");
  }
  await ctx.answerCbQuery();
}

module.exports = { borrarUltimoGasto, confirmarBorrado };
