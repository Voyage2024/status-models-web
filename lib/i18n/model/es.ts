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
  categories: { women: "Mujeres", men: "Hombres", new_faces: "New faces", other: "Talento" },
};

export default es;
