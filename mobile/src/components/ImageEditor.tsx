import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Slider from "@react-native-community/slider";
import {
  Canvas,
  Image as SkiaImage,
  ColorMatrix,
  useImage,
  Skia,
  ImageFormat,
} from "@shopify/react-native-skia";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageCropper } from "./ImageCropper";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Type } from "@/theme/aurora";
import { tapH, impactH, successH } from "@/lib/haptics";
import { saveBase64Jpeg } from "@/lib/fileStore";
import { PRESETS, buildMatrix, NEUTRAL, type Adjust } from "@/lib/imageFilters";

/** Tek bir ayar slider'ı satırı. */
function AdjustSlider({
  label,
  value,
  min,
  max,
  onChange,
  color,
  T,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: string;
  T: ReturnType<typeof useTheme>["t"];
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[Type.label, { color: T.textDim, marginBottom: 2 }]}>{label}</Text>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={onChange}
        minimumTrackTintColor={color}
        maximumTrackTintColor={T.hairline}
        thumbTintColor="#fff"
      />
    </View>
  );
}

/**
 * Skia tabanlı renk/filtre ekranı (kırpılmış görsele uygulanır).
 * Hazır filtreler + Parlaklık/Kontrast/Doygunluk/Sıcaklık; çıktı Skia ile encode edilir.
 */
function ImageAdjust({
  uri,
  outWidth = 1080,
  embedded,
  onDone,
  onBack,
  onCancel,
}: {
  uri: string | null;
  outWidth?: number;
  embedded?: boolean;
  onDone: (uri: string) => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const img = useImage(uri ?? undefined);
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);
  const [presetIdx, setPresetIdx] = useState(0);
  const [tab, setTab] = useState<"filter" | "adjust">("filter");
  const [busy, setBusy] = useState(false);

  // uri değişince ayarları sıfırla
  useEffect(() => {
    setAdjust(NEUTRAL);
    setPresetIdx(0);
    setTab("filter");
  }, [uri]);

  const matrix = useMemo(() => buildMatrix(adjust, PRESETS[presetIdx].m), [adjust, presetIdx]);

  // Önizleme boyutu (görsel oranına göre, ekrana sığacak şekilde).
  const iw = img ? img.width() : 1;
  const ih = img ? img.height() : 1;
  let FW = SW - 16;
  let FH = FW * (ih / iw);
  const MAXH = SH * 0.56;
  if (FH > MAXH) {
    FH = MAXH;
    FW = FH * (iw / ih);
  }

  const exportImage = async () => {
    if (!uri || !img) return;
    impactH();
    setBusy(true);
    try {
      const outH = Math.max(1, Math.round(outWidth * (ih / iw)));
      const surface = Skia.Surface.MakeOffscreen(outWidth, outH);
      if (!surface) throw new Error("surface");
      const canvas = surface.getCanvas();
      const paint = Skia.Paint();
      paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
      canvas.drawImageRect(
        img,
        Skia.XYWHRect(0, 0, iw, ih),
        Skia.XYWHRect(0, 0, outWidth, outH),
        paint,
      );
      const snap = surface.makeImageSnapshot();
      const b64 = snap.encodeToBase64(ImageFormat.JPEG, 90);
      const out = await saveBase64Jpeg(b64, "mf_edit");
      successH();
      onDone(out);
    } catch {
      onDone(uri); // encode başarısızsa kırpılmış (filtresiz) görseli ver
    } finally {
      setBusy(false);
    }
  };

  const inner = (
      <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top + 8 }}>
        <Text style={[Type.h2, { color: "#fff", textAlign: "center", marginBottom: 10 }]}>{t("f_apply")}</Text>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {img ? (
            <Canvas style={{ width: FW, height: FH, borderRadius: 12 }}>
              {/* contain: kırpılmış görselin TAMAMINI göster (zoom/kırpma yok). */}
              <SkiaImage image={img} x={0} y={0} width={FW} height={FH} fit="contain">
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </Canvas>
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>

        {/* Sekme: Filtre / Ayar */}
        <View style={styles.tabs}>
          <Pressable onPress={() => { tapH(); setTab("filter"); }} style={[styles.tab, tab === "filter" && { borderColor: T.primary }]}>
            <Text style={[Type.label, { color: tab === "filter" ? "#fff" : "rgba(255,255,255,0.6)" }]}>Filtre</Text>
          </Pressable>
          <Pressable onPress={() => { tapH(); setTab("adjust"); }} style={[styles.tab, tab === "adjust" && { borderColor: T.primary }]}>
            <Text style={[Type.label, { color: tab === "adjust" ? "#fff" : "rgba(255,255,255,0.6)" }]}>Ayar</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, minHeight: 150 }}>
          {tab === "filter" ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
              {PRESETS.map((p, i) => (
                <Pressable
                  key={p.key}
                  onPress={() => { tapH(); setPresetIdx(i); }}
                  style={[styles.presetChip, { borderColor: presetIdx === i ? T.primary : "rgba(255,255,255,0.15)", borderWidth: presetIdx === i ? 2 : 1 }]}
                >
                  {img ? (
                    <Canvas style={{ width: 60, height: 60 }}>
                      <SkiaImage image={img} x={0} y={0} width={60} height={60} fit="cover">
                        <ColorMatrix matrix={buildMatrix(NEUTRAL, p.m)} />
                      </SkiaImage>
                    </Canvas>
                  ) : (
                    <View style={{ width: 60, height: 60, backgroundColor: "#222" }} />
                  )}
                  <Text style={[Type.micro, { color: presetIdx === i ? "#fff" : "rgba(255,255,255,0.6)", textAlign: "center", paddingVertical: 4 }]}>{p.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={{ paddingVertical: 8 }}>
              <AdjustSlider label="Parlaklık" value={adjust.brightness} min={-0.4} max={0.4} color={T.primary} T={T} onChange={(v) => setAdjust((a) => ({ ...a, brightness: v }))} />
              <AdjustSlider label="Kontrast" value={adjust.contrast} min={0.6} max={1.5} color={T.primary} T={T} onChange={(v) => setAdjust((a) => ({ ...a, contrast: v }))} />
              <AdjustSlider label="Doygunluk" value={adjust.saturation} min={0} max={2} color={T.primary} T={T} onChange={(v) => setAdjust((a) => ({ ...a, saturation: v }))} />
              <AdjustSlider label="Sıcaklık" value={adjust.temperature} min={-1} max={1} color={T.primary} T={T} onChange={(v) => setAdjust((a) => ({ ...a, temperature: v }))} />
            </View>
          )}
        </View>

        <View style={[styles.bar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={() => { tapH(); onBack(); }} style={[styles.btn, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Text style={[Type.title, { color: "#fff" }]}>{t("back")}</Text>
          </Pressable>
          <Pressable onPress={exportImage} disabled={busy || !img} style={[styles.btn, { backgroundColor: T.primary, opacity: busy || !img ? 0.6 : 1 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[Type.title, { color: "#fff" }]}>{t("send")}</Text>}
          </Pressable>
        </View>
      </View>
  );

  // Sihirbaz içinde (embedded): kendi Modal'ını açma, içeriği döndür.
  if (embedded) return inner;
  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      {inner}
    </Modal>
  );
}

interface Props {
  uri: string | null;
  /** Kırpma oranı. Sayı = sabit (1 = kare). "auto" = fotoğrafın kendi oranı (kesmez). */
  aspect?: number | "auto";
  outWidth?: number;
  title?: string;
  /** true → kırpma adımını ATLA; görselin kendi oranı korunur (story zoom sorununu çözer). */
  noCrop?: boolean;
  onDone: (uri: string) => void;
  onCancel: () => void;
}

/**
 * Tam resim düzenleyici: önce kırp (ImageCropper), sonra filtre/renk (Skia).
 * noCrop=true ise kırpma atlanır → görsel kendi oranıyla doğrudan filtre adımına gider.
 */
export function ImageEditor({ uri, aspect = 1, outWidth = 1080, title, noCrop, onDone, onCancel }: Props) {
  const [cropped, setCropped] = useState<string | null>(null);
  const [step, setStep] = useState<"crop" | "adjust">(noCrop ? "adjust" : "crop");

  useEffect(() => {
    if (!uri) {
      setCropped(null);
      setStep(noCrop ? "adjust" : "crop");
      return;
    }
    if (noCrop) {
      setCropped(uri); // kırpmayı atla → doğrudan filtre
      setStep("adjust");
    } else {
      setCropped(null);
      setStep("crop");
    }
  }, [uri, noCrop]);

  const close = () => {
    setCropped(null);
    onCancel();
  };

  // İKİ ADIMLI SİHİRBAZ — TEK Modal. "İleri" deyince adım YERİNDE değişir (Instagram
  // gibi); ayrı modal kapanıp açılmaz. 1) Kırp → İleri → 2) Filtre → Bitir.
  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {step === "crop" && !noCrop ? (
          <ImageCropper
            embedded
            uri={uri}
            aspect={aspect}
            outWidth={outWidth}
            title={title}
            confirmLabel="İleri →"
            onDone={(c) => { setCropped(c); setStep("adjust"); }}
            onCancel={close}
          />
        ) : (
          <ImageAdjust
            embedded
            uri={cropped}
            outWidth={outWidth}
            onDone={(u) => { setCropped(null); onDone(u); }}
            onBack={() => { if (noCrop) close(); else setStep("crop"); }}
            onCancel={close}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 4 },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: "transparent" },
  presetChip: { borderRadius: 12, overflow: "hidden", alignItems: "center" },
  bar: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
