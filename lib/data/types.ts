export type TalentCard = {
  slug: string;
  name: string;
  category: "women" | "men" | "new_faces" | "other";
  isNewFace: boolean;
  heightCm: number | null;
  cover: { src: string; alt: string; width: number | null; height: number | null } | null;
};

export type OfficeCard = {
  slug: string;
  city: string;
  country: string;
  name: string;
};
