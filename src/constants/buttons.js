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
    { text: "🚗 Nafta/Auto", callback_data: "cat_Transporte" },
  ],
  [
    { text: "🤵 Personal", callback_data: "cat_Personal" },
    { text: "❓ Otros", callback_data: "cat_Otros" },
  ],
  [{ text: "❌ No es correcto", callback_data: "cancelar" }],
];

module.exports = { CATEGORIES };