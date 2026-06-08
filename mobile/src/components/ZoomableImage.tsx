import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

interface Props {
  /** Gösterilecek görsel uri'si. */
  uri: string;
  /** Modal açık mı. */
  visible: boolean;
  /** Modal kapanma isteği (✕ / arka plan / donanım geri). */
  onClose: () => void;
}

/**
 * Tam ekran, pinch + çift-dokunuş ile yakınlaştırılabilir görsel modal'ı.
 * - Pinch: 1–4 arası ölçek; bırakınca 1'in altına inerse 1'e snap.
 * - Çift dokunuş: 1 ↔ 2.5 toggle (withTiming).
 * - Yakınlaştırılmışken iki parmakla/tek parmakla sürüklenebilir (pan).
 * - Tek dokunuş (ölçek 1 iken) modalı kapatır.
 */
export function ZoomableImage({ uri, visible, onClose }: Props) {
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const clamp = () => {
    "worklet";
    // Yakınlaştırma oranına göre kayma sınırı (görsel ekranı doldurur kabul edilir).
    const maxX = Math.max(0, (SW * scale.value - SW) / 2);
    const maxY = Math.max(0, (SH * scale.value - SH) / 2);
    if (tx.value > maxX) tx.value = maxX;
    if (tx.value < -maxX) tx.value = -maxX;
    if (ty.value > maxY) ty.value = maxY;
    if (ty.value < -maxY) ty.value = -maxY;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      let s = savedScale.value * e.scale;
      if (s < 0.5) s = 0.5; // canlı küçülmeye izin ver, snap onEnd'de
      if (s > MAX_SCALE) s = MAX_SCALE;
      scale.value = s;
      clamp();
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        reset();
      } else {
        savedScale.value = scale.value;
        clamp();
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return; // ölçek 1 iken sürükleme yok
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
      clamp();
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1) runOnJS(onClose)();
    });

  // Çift dokunuş tek dokunuştan önce değerlendirilsin.
  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const composed = Gesture.Race(taps, Gesture.Simultaneous(pinch, pan));

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const handleClose = () => {
    // Kapanışta ölçeği sıfırla ki tekrar açıldığında 1'den başlasın.
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.bg}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[StyleSheet.absoluteFill, aStyle]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            </Animated.View>
          </GestureDetector>
          {/* Kapat butonu — gesture katmanının üstünde */}
          <Pressable onPress={handleClose} hitSlop={12} style={[styles.close, { top: insets.top + 10 }]}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: { color: "#fff", fontSize: 20, fontWeight: "700" },
});
