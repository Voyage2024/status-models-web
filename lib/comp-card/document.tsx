import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { MeasurementRow } from "./format";

// Те же гарнитуры, что на сайте, статичные TTF с латиницей и кириллицей (react-pdf не умеет variable fonts).
const fonts = path.join(process.cwd(), "lib/comp-card/fonts");
Font.register({
  family: "Cormorant",
  fonts: [
    { src: path.join(fonts, "CormorantGaramond-Light.ttf"), fontWeight: 300 },
    { src: path.join(fonts, "CormorantGaramond-LightItalic.ttf"), fontWeight: 300, fontStyle: "italic" },
  ],
});
Font.register({
  family: "Manrope",
  fonts: [
    { src: path.join(fonts, "Manrope-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fonts, "Manrope-Medium.ttf"), fontWeight: 500 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export const COMP_CARD_TEMPLATE_VERSION = 1;

// Печатная версия стиля: бумага вместо чёрного фона, шампань темнее, чтобы не терялась на белом.
const c = { paper: "#f7f4ef", ink: "#0a0a0a", mist: "#7a766f", line: "#d9d4cb", champagne: "#a88a4f" };

const s = StyleSheet.create({
  page: { backgroundColor: c.paper, color: c.ink, fontFamily: "Manrope", fontSize: 7 },
  eyebrow: { fontFamily: "Manrope", fontWeight: 500, fontSize: 6, letterSpacing: 1.9 },
  frontPhoto: { position: "absolute", top: 0, left: 0, right: 0, bottom: 128, objectFit: "cover" },
  placeholder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 128, backgroundColor: "#151515", alignItems: "center", justifyContent: "center" },
  monogram: { fontFamily: "Cormorant", fontStyle: "italic", fontWeight: 300, fontSize: 120, color: "#2a2a2a" },
  frontBand: { position: "absolute", left: 28, right: 28, bottom: 26, height: 82, justifyContent: "flex-end" },
  name: { fontFamily: "Cormorant", fontWeight: 300, fontSize: 40, lineHeight: 0.95, letterSpacing: 0.5 },
  rule: { height: 0.5, backgroundColor: c.line },
  back: { paddingTop: 26, paddingHorizontal: 28, paddingBottom: 24, flexDirection: "column", height: "100%" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", flexGrow: 1, flexBasis: 0 },
  stats: { flexShrink: 0, flexDirection: "row", flexWrap: "wrap", marginTop: 14, borderTopWidth: 0.5, borderTopColor: c.line },
  stat: { width: "25%", height: 38, paddingTop: 7 },
  statValue: { fontFamily: "Cormorant", fontWeight: 300, fontSize: 15, lineHeight: 1.25, marginTop: 3 },
  footer: { flexShrink: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: c.line },
});

// Верхний регистр строкой, а не textTransform: react-pdf меряет ширину по исходному тексту,
// и с разрядкой «Cabelo» или «Mulheres» переносились по буквам, первая часть терялась.
const upper = (text: string) => text.toLocaleUpperCase();

/** Длинная фамилия («Герасимова») уменьшает кегль, чтобы не вылезать за плашку шириной ~250pt. */
const nameSize = (name: string) => Math.min(40, Math.floor(250 / (Math.max(...name.split(" ").map((w) => w.length)) * 0.74)));

export type CompCardPhoto = { data: Buffer; format: "jpg" | "png" };

export type CompCardData = {
  name: string;
  label: string; // «Women · New face»
  rows: MeasurementRow[];
  cover: CompCardPhoto | null;
  photos: CompCardPhoto[];
  url: string; // status-models.com/en/models/kira-raab
  motherAgency: string;
};

function Wordmark({ align = "left" }: { align?: "left" | "right" }) {
  return (
    <View style={{ alignItems: align === "left" ? "flex-start" : "flex-end" }}>
      <Text style={{ fontFamily: "Cormorant", fontWeight: 300, fontSize: 13, letterSpacing: 3.2 }}>STATUS</Text>
      <Text style={[s.eyebrow, { fontSize: 5, letterSpacing: 2.4, marginTop: 1, color: c.mist }]}>INTERNATIONAL</Text>
    </View>
  );
}

/** Сетка фото на обороте: 4 фото — 2×2, 3 — одно большое и два, 1–2 — в ряд. */
function BackPhotos({ photos }: { photos: CompCardPhoto[] }) {
  const gap = 6;
  if (!photos.length) return <View style={{ flexGrow: 1, backgroundColor: "#ebe6de" }} />;
  if (photos.length === 3) {
    return (
      <View style={[s.grid, { flexDirection: "row" }]}>
        <Image src={photos[0]} style={{ width: "58%", height: "100%", objectFit: "cover" }} />
        <View style={{ width: "40%", justifyContent: "space-between" }}>
          <Image src={photos[1]} style={{ width: "100%", height: "49%", objectFit: "cover" }} />
          <Image src={photos[2]} style={{ width: "100%", height: "49%", objectFit: "cover" }} />
        </View>
      </View>
    );
  }
  const rows = photos.length === 4 ? 2 : 1;
  return (
    <View style={s.grid}>
      {photos.map((p, i) => (
        <Image
          key={i}
          src={p}
          style={{
            width: `${(100 - (photos.length === 1 ? 0 : 2)) / (photos.length === 1 ? 1 : 2)}%`,
            height: rows === 2 ? "49%" : "100%",
            marginBottom: rows === 2 && i < 2 ? gap : 0,
            objectFit: "cover",
          }}
        />
      ))}
    </View>
  );
}

export function CompCardDocument({ data }: { data: CompCardData }) {
  const initials = data.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <Document title={`${data.name} — Comp Card`} author="STATUS INTERNATIONAL" creator="status-models.com" subject="Comp card">
      {/* Лицевая сторона: обложка в край, имя на светлой плашке */}
      <Page size="A5" style={s.page}>
        {data.cover ? (
          <Image src={data.cover} style={s.frontPhoto} />
        ) : (
          <View style={s.placeholder}>
            <Text style={s.monogram}>{initials}</Text>
          </View>
        )}
        <View style={s.frontBand}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View style={{ maxWidth: "70%" }}>
              <Text style={[s.eyebrow, { color: c.champagne, marginBottom: 8 }]}>{upper(data.label)}</Text>
              <Text style={[s.name, { fontSize: nameSize(data.name) }]}>{upper(data.name)}</Text>
            </View>
            <Wordmark align="right" />
          </View>
        </View>
      </Page>

      {/* Оборот: фото, параметры, контакты агентства */}
      <Page size="A5" style={s.page}>
        <View style={s.back}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Cormorant", fontWeight: 300, fontSize: 20 }}>{upper(data.name)}</Text>
            <Text style={[s.eyebrow, { color: c.mist }]}>{upper(data.label)}</Text>
          </View>

          <BackPhotos photos={data.photos} />

          {data.rows.length > 0 && (
            <View style={s.stats}>
              {data.rows.map((r) => (
                <View key={r.key} style={s.stat}>
                  <Text style={[s.eyebrow, { color: c.mist }]}>{upper(r.label)}</Text>
                  <Text style={s.statValue}>
                    {r.metric}
                    {r.imperial ? <Text style={{ fontFamily: "Manrope", fontSize: 6, color: c.mist }}>{`  ${r.imperial}`}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.footer}>
            <Wordmark />
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.eyebrow, { color: c.champagne }]}>{upper(data.motherAgency)}</Text>
              <Text style={{ marginTop: 4, fontSize: 7, color: c.mist }}>{data.url}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
