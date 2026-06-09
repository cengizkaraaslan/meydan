import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image as RNImage, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Type } from "@/theme/aurora";
import { impactH, successH, tapH } from "@/lib/haptics";

/** Görseli verilen çerçeveyi KAPLAYACAK şekilde ölçekler (cover). */
function coverFit(iw: number, ih: number, fw: number, fh: number) {
  const r = Math.max(fw / iw, fh / ih);
  return { w: iw * r, h: ih * r };
}

type Rect = { originX: number; originY: number; width: number; height: number };

/** Kırpma + yeniden boyutlandırma — kurulu yeni context API, eski API'ye fallback. */
async function cropTo(uri: string, rect: Rect, outW: number): Promise<string> {
  try {
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri).crop(rect).resize({ width: outW });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
    return out.uri;
  } catch {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: rect }, { resize: { width: outW } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return out.uri;
  }
}

interface Props {
  /** Kırpılacak görsel uri'si. null → modal kapalı. */
  uri: string | null;
  /** Çerçeve oranı (genişlik/yükseklik). 1 = kare (avatar). */
  aspect?: number;
  /** Çıktı genişliği (px). */
  outWidth?: number;
  title?: string;
  /** true → kendi Modal'ını AÇMAZ; içeriği döner (üst sihirbazın tek Modal'ı içine gömülür). */
  embedded?: boolean;
  /** Onay butonu etiketi (sihirbazda "İleri", tek başına "Uygula"). */
  confirmLabel?: string;
  onDone: (uri: string) => void;
  onCancel: () => void;
}

/**
 * Yeniden kullanılabilir resim kırpma ekranı (avatar + etkinlik görseli).
 * Sabit oranlı çerçeve; görsel sürüklenip iki parmakla yakınlaştırılır,
 * çerçevede görünen alan kırpılır (expo-image-manipulator).
 */
export function ImageCropper({ uri, aspect = 1, outWidth = 1080, title, embedded, confirmLabel, onDone, onCancel }: Props) {
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Çerçeve boyutu — ekrana sığacak şekilde, oran korunarak.
  let FW = SW - 32;
  let FH = FW / aspect;
  const MAXH = SH * 0.6;
  if (FH > MAXH) {
    FH = MAXH;
    FW = FH * aspect;
  }

  const baseW = useSharedValue(0);
  const baseH = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  useEffect(() => {
    if (!uri) return;
    setSize(null);
    setBase(null);
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    const apply = (w: number, h: number) => {
      setSize({ w, h });
      const b = coverFit(w, h, FW, FH);
      setBase(b);
      baseW.value = b.w;
      baseH.value = b.h;
    };
    RNImage.getSize(uri, apply, () => apply(FW, FH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, FW, FH]);

  const clamp = () => {
    "worklet";
    const dw = baseW.value * scale.value;
    const dh = baseH.value * scale.value;
    const maxX = Math.max(0, (dw - FW) / 2);
    const maxY = Math.max(0, (dh - FH) / 2);
    if (tx.value > maxX) tx.value = maxX;
    if (tx.value < -maxX) tx.value = -maxX;
    if (ty.value > maxY) ty.value = maxY;
    if (ty.value < -maxY) ty.value = -maxY;
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
      clamp();
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      let s = savedScale.value * e.scale;
      if (s < 1) s = 1;
      if (s > 5) s = 5;
      scale.value = s;
      clamp();
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const confirm = async () => {
    if (!uri || !base || !size) return;
    impactH();
    setBusy(true);
    try {
      const s = scale.value;
      const dw = base.w * s;
      const dh = base.h * s;
      // Çerçeve koordinatında görselin sol-üstü (merkezleme + kullanıcı kaydırması).
      const imgLeft = FW / 2 - dw / 2 + tx.value;
      const imgTop = FH / 2 - dh / 2 + ty.value;
      const ratio = size.w / dw; // ekran(display) → kaynak piksel
      let originX = (0 - imgLeft) * ratio;
      let originY = (0 - imgTop) * ratio;
      let width = FW * ratio;
      let height = FH * ratio;
      originX = Math.max(0, Math.min(originX, size.w - 1));
      originY = Math.max(0, Math.min(originY, size.h - 1));
      width = Math.max(1, Math.min(width, size.w - originX));
      height = Math.max(1, Math.min(height, size.h - originY));
      const rect: Rect = {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(width),
        height: Math.round(height),
      };
      const cropped = await cropTo(uri, rect, outWidth);
      successH();
      onDone(cropped);
    } catch {
      onDone(uri); // kırpılamazsa orijinali ver (best-effort)
    } finally {
      setBusy(false);
    }
  };

  const inner = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <Text style={[Type.h2, { color: "#fff", textAlign: "center", marginBottom: 4 }]}>{title ?? "Kırp"}</Text>
        <Text style={[Type.label, { color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 }]}>
          Sürükle • iki parmakla yakınlaştır
        </Text>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View style={[styles.frame, { width: FW, height: FH, borderColor: T.primary }]}>
            {base && uri ? (
              <GestureDetector gesture={composed}>
                <Animated.View style={[{ width: base.w, height: base.h }, aStyle]}>
                  <Image source={{ uri }} style={{ width: base.w, height: base.h }} contentFit="fill" />
                </Animated.View>
              </GestureDetector>
            ) : (
              <ActivityIndicator color="#fff" />
            )}
          </View>
        </View>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={() => { tapH(); onCancel(); }} style={[styles.btn, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Text style={[Type.title, { color: "#fff" }]}>{t("cancel")}</Text>
          </Pressable>
          <Pressable onPress={confirm} disabled={busy || !base} style={[styles.btn, { backgroundColor: T.primary, opacity: busy || !base ? 0.6 : 1 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[Type.title, { color: "#fff" }]}>{confirmLabel ?? t("f_apply")}</Text>}
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView>
  );

  // Sihirbaz içinde (embedded): kendi Modal'ını açma, içeriği döndür.
  if (embedded) return inner;
  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      {inner}
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 2, borderRadius: 10 },
  bar: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
