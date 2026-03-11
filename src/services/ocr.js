const Tesseract = require("tesseract.js");
const axios = require("axios");

async function procesarComprobante(fileLink, apiKey) {
  let finalImageUrl = "Sin link (Test)";

  // 1. Intento de subida a ImgBB
  if (apiKey && apiKey !== "skip") {
    try {
      const imgbbResponse = await axios.get("https://api.imgbb.com/1/upload", {
        params: { key: apiKey, image: fileLink },
      });
      finalImageUrl = imgbbResponse.data.data.url;
    } catch (err) {
      console.error("Error en ImgBB, usando backup:", err.message);
      finalImageUrl = fileLink;
    }
  } else {
    finalImageUrl = fileLink;
  }

  // 2. OCR con Tesseract
  const { data: { text } } = await Tesseract.recognize(fileLink, "spa+eng");

  // 3. Lógica de extracción de monto (la misma que ya tenías)
  const todosLosNumeros = text.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g) || [];
  const candidatos = todosLosNumeros
    .map((n) => n.replace(/\./g, "").replace(",", "."))
    .map((n) => parseFloat(n))
    .filter((n) => n > 100 && n < 1000000);

  candidatos.sort((a, b) => b - a);
  const montoFinal = candidatos[0];

  return { montoFinal, finalImageUrl };
}

module.exports = { procesarComprobante };