import type { ModelDictionary } from ".";

const es: ModelDictionary = {
  back: "Todos los modelos",
  newFace: "New face",
  measurements: "Medidas",
  height: "Altura",
  bust: "Busto",
  waist: "Cintura",
  hips: "Cadera",
  shoes: "Calzado",
  hair: "Cabello",
  eyes: "Ojos",
  representedIn: "Mercados",
  motherAgency: "Agencia madre",
  compCard: "Descargar comp card",
  compCardHint: "PDF · A5 · listo para imprimir",
  book: "Reservar modelo",
  portfolio: "Portfolio",
  digitals: "Digitals",
  editorial: "Editorial",
  campaign: "Campañas",
  noPhotos: "El portfolio se está actualizando.",
  metaDescription: (name, params) =>
    `${name} — modelo representada por la agencia madre STATUS INTERNATIONAL.${params ? ` ${params}.` : ""} Portfolio y comp card.`,
  board: {
    title: "The Board",
    lead: "Modelos y new faces en desarrollo y colocadas en agencias asociadas.",
    all: "Todos",
    count: (n) => `${n} ${n === 1 ? "modelo" : "modelos"}`,
    empty: "El board se está actualizando.",
    metaDescription: "El board de STATUS INTERNATIONAL: modelos y new faces de la agencia madre con medidas, portfolio y comp card.",
  },
  hairColors: {
    black: "Negro", "dark brown": "Castaño oscuro", brown: "Castaño", "light brown": "Castaño claro", auburn: "Caoba", red: "Pelirrojo",
    "dark blonde": "Rubio oscuro", blonde: "Rubio", "light blonde": "Rubio claro", grey: "Canoso",
  },
  eyeColors: {
    brown: "Marrones", "dark brown": "Marrón oscuro", hazel: "Avellana", green: "Verdes", "grey-green": "Gris verdoso", blue: "Azules",
    "grey-blue": "Gris azulado", "blue-green": "Azul verdoso", grey: "Grises", black: "Negros",
  },
  categories: { women: "Mujeres", men: "Hombres", new_faces: "New faces", other: "Talento" },
};

export default es;
