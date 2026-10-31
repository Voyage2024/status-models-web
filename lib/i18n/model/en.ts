const en = {
  back: "All models",
  newFace: "New face",
  measurements: "Measurements",
  height: "Height",
  bust: "Bust",
  waist: "Waist",
  hips: "Hips",
  shoes: "Shoes",
  hair: "Hair",
  eyes: "Eyes",
  representedIn: "Markets",
  motherAgency: "Mother agency",
  compCard: "Download comp card",
  compCardHint: "PDF · A5 · print ready",
  book: "Book this model",
  portfolio: "Portfolio",
  digitals: "Digitals",
  editorial: "Editorial",
  campaign: "Campaign",
  noPhotos: "Portfolio is being updated.",
  metaDescription: (name: string, params: string) =>
    `${name} — model represented by STATUS INTERNATIONAL mother agency.${params ? ` ${params}.` : ""} Portfolio and comp card.`,
  board: {
    title: "The Board",
    lead: "Women and new faces in development and on placement with partner agencies.",
    all: "All",
    count: (n: number) => `${n} ${n === 1 ? "model" : "models"}`,
    empty: "The board is being updated.",
    metaDescription: "The STATUS INTERNATIONAL board: models and new faces of the mother agency with measurements, portfolios and comp cards.",
  },
  // Цвета хранятся в базе по-английски (model_measurements.hair_color / eye_color), ключ — в нижнем регистре.
  hairColors: {
    black: "Black", "dark brown": "Dark brown", brown: "Brown", "light brown": "Light brown", auburn: "Auburn", red: "Red",
    "dark blonde": "Dark blonde", blonde: "Blonde", "light blonde": "Light blonde", grey: "Grey",
  } as Record<string, string>,
  eyeColors: {
    brown: "Brown", "dark brown": "Dark brown", hazel: "Hazel", green: "Green", "grey-green": "Grey-green", blue: "Blue",
    "grey-blue": "Grey-blue", "blue-green": "Blue-green", grey: "Grey", black: "Black",
  } as Record<string, string>,
  categories: { women: "Women", men: "Men", new_faces: "New faces", other: "Talent" },
};

export default en;
