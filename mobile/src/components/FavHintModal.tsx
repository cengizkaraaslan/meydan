import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { onFavAdded } from "@/lib/favHint";

/**
 * Favorilere ekleme bilgilendirme modalı.
 * favHint'e abone olur; favori eklendiğinde sayaç (AsyncStorage) kontrolü yapar.
 * Modal ömür boyu en fazla 3 kez gösterilir; sonra hiç gösterilmez.
 * Metinler Türkçe HARDCODE (i18n kullanılmaz). Kökte TEK kez mount edilir.
 */
const COUNT_KEY = "meydanfest:favHintCount";
const MAX = 3;

export function FavHintModal() {
  const { t: T } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = onFavAdded(() => {
      // Favori eklendi sinyali: sayacı oku, 3'e ulaşıldıysa hiçbir şey yapma.
      void (async () => {
        try {
          const raw = await AsyncStorage.getItem(COUNT_KEY);
          const count = raw ? parseInt(raw, 10) || 0 : 0;
          if (count >= MAX) return;
          await AsyncStorage.setItem(COUNT_KEY, String(count + 1));
          setVisible(true);
        } catch {
          /* sessizce geç */
        }
      })();
    });
    return unsub;
  }, []);

  const close = () => setVisible(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: T.scrim }]} onPress={close}>
        {/* İçerik kartına basınca kapanmasın diye iç Pressable olayı yutar. */}
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: T.bgElevated, borderColor: T.hairline },
            glow(T.primary, 26, 0.5),
          ]}
        >
          <LinearGradient
            colors={T.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.icon, glow(T.primary, 18, 0.6)]}
          >
            <Text style={{ fontSize: 34 }}>❤️</Text>
          </LinearGradient>

          <Text style={[Type.h2, { color: T.text, textAlign: "center", marginTop: 16 }]}>
            ❤️ Favorilere eklendi
          </Text>
          <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: 8 }]}>
            Bu etkinlik favorilerine eklendi. Profilim sayfasındaki favoriler bölümünden takip
            edebilirsin.
          </Text>

          <Pressable onPress={close} style={styles.btnWrap}>
            <LinearGradient
              colors={T.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <Text style={[Type.title, { color: "#fff", textAlign: "center" }]}>Tamam</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 24,
    paddingBottom: 22,
    alignItems: "center",
  },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  btnWrap: { width: "100%", marginTop: 22 },
  btn: { borderRadius: Radius.pill, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
});
