import type { ModelDictionary } from ".";

const pt: ModelDictionary = {
  back: "Todos os modelos",
  newFace: "New face",
  measurements: "Medidas",
  height: "Altura",
  bust: "Busto",
  waist: "Cintura",
  hips: "Quadril",
  shoes: "Sapato",
  hair: "Cabelo",
  eyes: "Olhos",
  representedIn: "Mercados",
  motherAgency: "Agência mãe",
  compCard: "Baixar comp card",
  compCardHint: "PDF · A5 · pronto para impressão",
  book: "Reservar modelo",
  portfolio: "Portfólio",
  digitals: "Digitals",
  editorial: "Editorial",
  campaign: "Campanhas",
  noPhotos: "O portfólio está sendo atualizado.",
  metaDescription: (name, params) =>
    `${name} — modelo representada pela agência mãe STATUS INTERNATIONAL.${params ? ` ${params}.` : ""} Portfólio e comp card.`,
  board: {
    title: "The Board",
    lead: "Modelos e new faces em desenvolvimento e colocadas em agências parceiras.",
    all: "Todas",
    count: (n) => `${n} ${n === 1 ? "modelo" : "modelos"}`,
    empty: "O board está sendo atualizado.",
    metaDescription: "O board da STATUS INTERNATIONAL: modelos e new faces da agência mãe com medidas, portfólio e comp card.",
  },
  categories: { women: "Mulheres", men: "Homens", new_faces: "New faces", other: "Talentos" },
};

export default pt;
