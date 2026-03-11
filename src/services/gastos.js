const { doc } = require("../config/excel");

async function guardarGasto(datos) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    // Forzamos el formato de moneda argentina para el monto
    const montoFormateado = Number(datos.monto).toFixed(2).replace(".", ",");

    await sheet.addRow({
      Fecha: new Date().toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
      Monto: montoFormateado,
      Concepto: datos.concepto,
      Categoria: datos.categoria,
      Link_Foto: datos.driveUrl || "Manual",
    });
    return true;
  } catch (error) {
    console.error("Error al guardar en Excel:", error);
    throw error;
  }
}

module.exports = { guardarGasto };