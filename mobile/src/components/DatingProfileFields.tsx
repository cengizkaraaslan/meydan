import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Pill } from "@/ui/atoms";
import { Radius, Space, Type } from "@/theme/aurora";
import {
  useDProfile,
  ageFromBirthDate,
  zodiacFromBirthDate,
  INTERESTS,
  GOALS,
  LANGS,
  ZODIACS,
  EDUCATION,
  DRINKING,
  SMOKING,
  EXERCISE,
} from "@/lib/dprofile";

/**
 * Tanışma profili alanları — profil.tsx içinde bir bölüm olarak mount edilir.
 * Kendi içinde useDProfile() çağırır; tüm alanları render eder ve yerelde saklar.
 */
export function DatingProfileFields() {
  const { t: T } = useTheme();
  const { profile, update, toggleIn } = useDProfile();
  const [confirmHide, setConfirmHide] = useState(false);
  // Katlanabilir bölümler (ilgi alanları, hedef, diller, burç, eğitim) — açık olanların kümesi.
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set());
  const toggleSec = (id: string) =>
    setOpenSecs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Doğum tarihi parçaları (gün/ay/yıl) — profil.birthDate ("YYYY-MM-DD") ile senkron.
  const [bd, setBd] = useState({ d: "", m: "", y: "" });
  useEffect(() => {
    if (profile.birthDate) {
      const [y, m, d] = profile.birthDate.split("-");
      setBd({ d: d ?? "", m: m ?? "", y: y ?? "" });
    }
  }, [profile.birthDate]);

  const setBdPart = (part: "d" | "m" | "y", raw: string) => {
    const val = raw.replace(/[^0-9]/g, "");
    const next = { ...bd, [part]: val };
    setBd(next);
    if (next.d && next.m && next.y.length === 4) {
      const iso = `${next.y}-${next.m.padStart(2, "0")}-${next.d.padStart(2, "0")}`;
      // Doğum tarihi tamamlanınca burcu otomatik belirle ve kaydet (DB'ye de gider).
      update({ birthDate: iso, zodiac: zodiacFromBirthDate(iso) ?? profile.zodiac });
    } else {
      update({ birthDate: "" });
    }
  };

  // Yaşımı göster: kapatmaya çalışınca önce onay iste.
  const onToggleShowAge = (val: boolean) => {
    if (!val) {
      setConfirmHide(true);
      return;
    }
    update({ showAge: true });
  };

  const age = ageFromBirthDate(profile.birthDate);

  const inputStyle = {
    backgroundColor: T.surfaceStrong,
    borderColor: T.hairline,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: Radius.lg,
    color: T.text,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  } as const;

  /** Tek-seçim chip grubu: tekrar basınca seçimi kaldırır (toggle). */
  const renderSingle = (
    options: string[],
    current: string | null,
    onSelect: (value: string | null) => void,
  ) => (
    <View style={styles.chips}>
      {options.map((x) => (
        <Pill
          key={x}
          label={x}
          active={current === x}
          onPress={() => onSelect(current === x ? null : x)}
        />
      ))}
    </View>
  );

  /** Çoklu-seçim chip grubu. */
  const renderMulti = (
    options: string[],
    selected: string[],
    field: "interests" | "languages",
  ) => (
    <View style={styles.chips}>
      {options.map((x) => (
        <Pill
          key={x}
          label={x}
          active={selected.includes(x)}
          onPress={() => toggleIn(field, x)}
        />
      ))}
    </View>
  );

  const Header = ({ title }: { title: string }) => (
    <Text style={[Type.label, { color: T.textDim, marginBottom: Space.sm }]}>{title}</Text>
  );

  /** Katlanabilir bölüm: başlığa dokun → aç/kapat. Kapalıyken sağda seçim özeti. */
  const Section = ({ id, title, summary, children }: { id: string; title: string; summary: string; children: React.ReactNode }) => {
    const isOpen = openSecs.has(id);
    return (
      <View>
        <Pressable onPress={() => toggleSec(id)} style={styles.secHead} hitSlop={6}>
          <Text style={[Type.label, { color: T.textDim }]}>{title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
            {!isOpen ? (
              <Text style={[Type.label, { color: T.textFaint, maxWidth: 180 }]} numberOfLines={1}>{summary}</Text>
            ) : null}
            <Text style={{ color: T.textDim, fontSize: 12 }}>{isOpen ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {isOpen ? <View style={{ marginTop: Space.sm }}>{children}</View> : null}
      </View>
    );
  };

  return (
    <View style={{ gap: Space.lg }}>
      {/* 1. Hakkımda */}
      <View>
        <Header title="Hakkımda" />
        <TextInput
          style={[inputStyle, { minHeight: 96, textAlignVertical: "top" }]}
          multiline
          placeholder="Kendinden bahset…"
          placeholderTextColor={T.textFaint}
          value={profile.about}
          onChangeText={(about) => update({ about })}
        />
      </View>

      {/* 2. Doğum tarihi + Yaşımı göster */}
      <View>
        <Header title="Doğum tarihi" />
        <View style={styles.bdRow}>
          <TextInput
            style={[inputStyle, styles.bdSmall]}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="Gün"
            placeholderTextColor={T.textFaint}
            value={bd.d}
            onChangeText={(v) => setBdPart("d", v)}
          />
          <TextInput
            style={[inputStyle, styles.bdSmall]}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="Ay"
            placeholderTextColor={T.textFaint}
            value={bd.m}
            onChangeText={(v) => setBdPart("m", v)}
          />
          <TextInput
            style={[inputStyle, styles.bdYear]}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="Yıl"
            placeholderTextColor={T.textFaint}
            value={bd.y}
            onChangeText={(v) => setBdPart("y", v)}
          />
        </View>
        <View style={[styles.switchRow, { marginTop: Space.md }]}>
          <Text style={[Type.body, { color: age != null ? T.text : T.textFaint }]}>
            Yaşımı göster{age != null ? ` (${age})` : ""}
          </Text>
          <Switch
            value={profile.showAge}
            onValueChange={onToggleShowAge}
            disabled={age == null}
            trackColor={{ false: T.hairline, true: T.primary }}
          />
        </View>
        <Text style={[Type.label, { color: T.textFaint, marginTop: Space.sm }]}>
          {age == null
            ? "Yaş, doğum tarihinden otomatik hesaplanır. Önce doğum tarihini gir."
            : profile.showAge
              ? "Yaşın doğum tarihinden hesaplanıp profilinde görünür"
              : "Yaşın gizli — sen de başkalarının yaşını göremezsin"}
        </Text>
      </View>

      {/* 3. Boy + Kilo */}
      <View style={styles.pairRow}>
        <View style={{ flex: 1 }}>
          <Header title="Boy (cm)" />
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="170"
            placeholderTextColor={T.textFaint}
            value={profile.heightCm}
            onChangeText={(heightCm) => update({ heightCm })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Header title="Kilo (kg)" />
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="65"
            placeholderTextColor={T.textFaint}
            value={profile.weightKg}
            onChangeText={(weightKg) => update({ weightKg })}
          />
        </View>
      </View>

      {/* 4. İlgi alanları (çoklu) — katlanabilir */}
      <Section id="interests" title="İlgi alanları" summary={profile.interests.length ? `${profile.interests.length} seçili` : "Seç"}>
        {renderMulti(INTERESTS, profile.interests, "interests")}
      </Section>

      {/* 5. İlişki hedefi (tek) — katlanabilir */}
      <Section id="goal" title="İlişki hedefi" summary={profile.goal ?? "Seç"}>
        {renderSingle(GOALS, profile.goal, (goal) => update({ goal }))}
      </Section>

      {/* 6. Bildiğim diller (çoklu) — katlanabilir */}
      <Section id="languages" title="Bildiğim diller" summary={profile.languages.length ? profile.languages.join(", ") : "Seç"}>
        {renderMulti(LANGS, profile.languages, "languages")}
      </Section>

      {/* 7. Burç (tek) — katlanabilir */}
      <Section id="zodiac" title="Burç" summary={profile.zodiac ?? "Seç"}>
        {renderSingle(ZODIACS, profile.zodiac, (zodiac) => update({ zodiac }))}
      </Section>

      {/* 8. Eğitim (tek) — katlanabilir */}
      <Section id="education" title="Eğitim" summary={profile.education ?? "Seç"}>
        {renderSingle(EDUCATION, profile.education, (education) => update({ education }))}
      </Section>

      {/* 9. İçki (tek) */}
      <View>
        <Header title="İçki" />
        {renderSingle(DRINKING, profile.drinking, (drinking) => update({ drinking }))}
      </View>

      {/* 10. Sigara (tek) */}
      <View>
        <Header title="Sigara" />
        {renderSingle(SMOKING, profile.smoking, (smoking) => update({ smoking }))}
      </View>

      {/* 11. Egzersiz (tek) */}
      <View>
        <Header title="Egzersiz" />
        {renderSingle(EXERCISE, profile.exercise, (exercise) => update({ exercise }))}
      </View>

      {/* Yaşı gizleme onayı */}
      <Modal visible={confirmHide} transparent animationType="fade" onRequestClose={() => setConfirmHide(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmHide(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[Type.h2, { color: T.text }]}>Yaşını gizle?</Text>
            <Text style={[Type.body, { color: T.textDim, marginTop: 8 }]}>
              Yaşını gizlersen sen de başkalarının yaşını göremezsin.
            </Text>
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setConfirmHide(false)} style={[styles.mBtn, { borderColor: T.hairline }]}>
                <Text style={[Type.title, { color: T.text }]}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={() => { update({ showAge: false }); setConfirmHide(false); }}
                style={[styles.mBtn, { backgroundColor: T.primary, borderColor: T.primary }]}
              >
                <Text style={[Type.title, { color: "#fff" }]}>Tamam</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  secHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pairRow: { flexDirection: "row", gap: Space.lg },
  bdRow: { flexDirection: "row", gap: Space.md },
  bdSmall: { width: 72, textAlign: "center" },
  bdYear: { flex: 1, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
  modalCard: { width: "100%", borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Space.xl },
  modalBtns: { flexDirection: "row", gap: Space.md, marginTop: Space.xl },
  mBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
});
