import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";

type Mode = "menu" | "confirmDelete" | "edit";

interface Props {
  /** Açık gönderi id'si (null → kapalı). */
  postId: string | null;
  /** Düzenleme alanına ön-doldurulacak mevcut metin. */
  initialText: string;
  onClose: () => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

/** Kendi gönderim için alttan açılan aksiyon menüsü: Düzenle / Sil / İptal (+ inline düzenleme). */
export function PostActionsModal({ postId, initialText, onClose, onEdit, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const [mode, setMode] = useState<Mode>("menu");
  const [text, setText] = useState(initialText);

  // Her açılışta menü moduna ve mevcut metne sıfırla.
  useEffect(() => {
    if (postId) {
      setMode("menu");
      setText(initialText);
    }
  }, [postId, initialText]);

  const visible = !!postId;

  const close = () => {
    tapH();
    onClose();
  };

  const saveEdit = () => {
    const trimmed = text.trim();
    if (!postId || !trimmed) return;
    tapH();
    onEdit(postId, trimmed);
  };

  const confirmDelete = () => {
    if (!postId) return;
    tapH();
    onDelete(postId);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          <Pressable
            style={[
              styles.card,
              { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: (insets.bottom || 12) + 8 },
              glow("#000", 18, 0.3),
            ]}
            onPress={() => { /* kart içine dokunma kapanmasın */ }}
          >
            <View style={[styles.handle, { backgroundColor: T.hairline }]} />

            {mode === "edit" ? (
              <>
                <Text style={[Type.label, { color: T.textDim, textAlign: "center", marginBottom: 10 }]}>
                  Gönderiyi düzenle
                </Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Metnini güncelle…"
                  placeholderTextColor={T.textFaint}
                  style={[
                    styles.input,
                    { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline },
                  ]}
                  multiline
                  autoFocus
                />
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => { tapH(); setMode("menu"); }}
                    style={[styles.row, styles.rowHalf, { backgroundColor: T.surfaceStrong }]}
                  >
                    <Text style={[Type.body, { color: T.text, fontWeight: "600" }]}>Vazgeç</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveEdit}
                    disabled={!text.trim()}
                    style={[
                      styles.row,
                      styles.rowHalf,
                      { backgroundColor: text.trim() ? T.primary : T.surfaceStrong },
                    ]}
                  >
                    <Text style={[Type.body, { color: text.trim() ? "#fff" : T.textFaint, fontWeight: "700" }]}>
                      Kaydet
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : mode === "confirmDelete" ? (
              <>
                <Text style={[Type.body, { color: T.text, textAlign: "center", marginTop: 4, marginBottom: 14 }]}>
                  Bu gönderi silinsin mi?
                </Text>
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => { tapH(); setMode("menu"); }}
                    style={[styles.row, styles.rowHalf, { backgroundColor: T.surfaceStrong }]}
                  >
                    <Text style={[Type.body, { color: T.text, fontWeight: "600" }]}>Vazgeç</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmDelete}
                    style={[styles.row, styles.rowHalf, { backgroundColor: "rgba(255,59,48,0.14)" }]}
                  >
                    <Text style={[Type.body, { color: "#FF3B30", fontWeight: "700" }]}>Sil</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[Type.label, { color: T.textDim, textAlign: "center", marginBottom: 6 }]}>
                  Gönderi
                </Text>
                <Pressable
                  onPress={() => { tapH(); setMode("edit"); }}
                  style={[styles.row, { backgroundColor: T.surfaceStrong }]}
                >
                  <Text style={[Type.body, { color: T.text }]}>✏️  Düzenle</Text>
                </Pressable>
                <Pressable
                  onPress={() => { tapH(); setMode("confirmDelete"); }}
                  style={[styles.row, { backgroundColor: "rgba(255,59,48,0.10)" }]}
                >
                  <Text style={[Type.body, { color: "#FF3B30", fontWeight: "600" }]}>🗑️  Sil</Text>
                </Pressable>
                <Pressable onPress={close} style={[styles.row, { backgroundColor: T.surface }]}>
                  <Text style={[Type.body, { color: T.textDim, fontWeight: "600" }]}>İptal</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  card: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  row: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowHalf: { flex: 1 },
  confirmRow: { flexDirection: "row", gap: 10 },
  input: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    maxHeight: 160,
    marginBottom: 12,
    ...Type.body,
  },
});
