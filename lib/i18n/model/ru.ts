import type { ModelDictionary } from ".";

const ru: ModelDictionary = {
  back: "Все модели",
  newFace: "New face",
  measurements: "Параметры",
  height: "Рост",
  bust: "Грудь",
  waist: "Талия",
  hips: "Бёдра",
  shoes: "Обувь",
  hair: "Волосы",
  eyes: "Глаза",
  representedIn: "Рынки",
  motherAgency: "Материнское агентство",
  compCard: "Скачать Comp Card",
  compCardHint: "PDF · A5 · для печати",
  book: "Забронировать модель",
  portfolio: "Портфолио",
  digitals: "Диджиталы",
  editorial: "Editorial",
  campaign: "Кампании",
  noPhotos: "Портфолио обновляется.",
  metaDescription: (name, params) =>
    `${name} — модель материнского агентства STATUS INTERNATIONAL.${params ? ` ${params}.` : ""} Портфолио и Comp Card.`,
  board: {
    title: "The Board",
    lead: "Модели и новые лица, которые сейчас в развитии и на контрактах в партнёрских агентствах.",
    all: "Все",
    count: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "модель" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "модели" : "моделей"}`,
    empty: "Борд обновляется.",
    metaDescription: "Борд STATUS INTERNATIONAL: модели и новые лица материнского агентства с параметрами, портфолио и Comp Card.",
  },
  hairColors: {
    black: "Чёрные", "dark brown": "Тёмно-каштановые", brown: "Каштановые", "light brown": "Светло-каштановые", auburn: "Медно-каштановые",
    red: "Рыжие", "dark blonde": "Тёмно-русые", blonde: "Блонд", "light blonde": "Светлый блонд", grey: "Седые",
  },
  eyeColors: {
    brown: "Карие", "dark brown": "Тёмно-карие", hazel: "Ореховые", green: "Зелёные", "grey-green": "Серо-зелёные", blue: "Голубые",
    "grey-blue": "Серо-голубые", "blue-green": "Сине-зелёные", grey: "Серые", black: "Чёрные",
  },
  categories: { women: "Женщины", men: "Мужчины", new_faces: "Новые лица", other: "Таланты" },
};

export default ru;
