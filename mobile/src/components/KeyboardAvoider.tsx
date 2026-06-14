import React, { useEffect, useState } from "react";
import { Keyboard, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Klavye açılınca içeriği klavye yüksekliği kadar yukarı iter.
 *
 * Neden KeyboardAvoidingView değil: Edge-to-edge (Android 15 / Expo SDK 56) açıkken
 * `windowSoftInputMode=adjustResize` pencereyi artık küçültmüyor; klavye bir inset olarak
 * geliyor. RN'in KeyboardAvoidingView'ı (behavior=height/undefined) Android'de input'u
 * klavyenin üstüne çıkaramıyor. Çözüm: klavye yüksekliğini okuyup alttan boşluk veririz.
 *
 * `modal`: RN `Modal` AYRI bir Android penceresi açar. O pencerede reanimated `useAnimatedStyle`
 * görünmez kalıyor (stil uygulanmıyor) → reanimated tabanlı çözüm Modal'da çalışmıyor. Bu yüzden
 * Modal için reanimated'ı bırakıp düz React state + düz View ile (JS `Keyboard` event'leriyle)
 * padding veriyoruz.
 */
export function KeyboardAvoider({
  children,
  style,
  modal = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  modal?: boolean;
}) {
  return modal ? (
    <KeyboardAvoiderModal style={style}>{children}</KeyboardAvoiderModal>
  ) : (
    <KeyboardAvoiderNative style={style}>{children}</KeyboardAvoiderNative>
  );
}

/** Normal ekranlar (Modal değil): reanimated native inset — her karede akıcı. */
function KeyboardAvoiderNative({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const animStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, keyboard.height.value - insets.bottom),
  }));
  return <Animated.View style={[{ flex: 1 }, style, animStyle]}>{children}</Animated.View>;
}

/** Modal içi: düz state + düz View (reanimated Modal penceresinde stil uygulamıyor). */
function KeyboardAvoiderModal({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // insets.bottom ÇIKARMA: edge-to-edge'de keyboardDidShow yüksekliği zaten ekranın altından
  // klavye tepesine kadarki tüm mesafeyi verir; insets.bottom düşünce input klavyenin biraz
  // altında kalıyordu. Tam kbHeight kadar boşlukla input klavyenin üstüne tam çıkar.
  const pad = kbHeight > 0 ? kbHeight : 0;
  return <View style={[{ flex: 1, paddingBottom: pad }, style]}>{children}</View>;
}
