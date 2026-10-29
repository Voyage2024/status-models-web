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
  categories: { women: "Women", men: "Men", new_faces: "New faces", other: "Talent" },
};

export default en;
