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

      {/* 2. Yaş + Yaşımı göster */}
      <View>
        <Header title="Yaş" />
        <View style={styles.ageRow}>
          <TextInput
            style={[inputStyle, { width: 88, textAlign: "center" }]}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="--"
            placeholderTextColor={T.textFaint}
            value={profile.age}
            onChangeText={(age) => update({ age })}
          />
          <View style={styles.switchRow}>
            <Text style={[Type.body, { color: T.text }]}>Yaşımı göster</Text>
            <Switch
              value={profile.showAge}
              onValueChange={(showAge) => update({ showAge })}
              trackColor={{ false: T.hairline, true: T.primary }}
            />
          </View>
        </View>
        <Text style={[Type.label, { color: T.textFaint, marginTop: Space.sm }]}>
          {profile.showAge ? "Yaşın profilinde görünür" : "Yaşın gizli"}
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

      {/* 4. İlgi alanları (çoklu) */}
      <View>
        <Header title="İlgi alanları" />
        {renderMulti(INTERESTS, profile.interests, "interests")}
      </View>

      {/* 5. İlişki hedefi (tek) */}
      <View>
        <Header title="İlişki hedefi" />
        {renderSingle(GOALS, profile.goal, (goal) => update({ goal }))}
      </View>

      {/* 6. Bildiğim diller (çoklu) */}
      <View>
        <Header title="Bildiğim diller" />
        {renderMulti(LANGS, profile.languages, "languages")}
      </View>

      {/* 7. Burç (tek) */}
      <View>
        <Header title="Burç" />
        {renderSingle(ZODIACS, profile.zodiac, (zodiac) => update({ zodiac }))}
      </View>

      {/* 8. Eğitim (tek) */}
      <View>
        <Header title="Eğitim" />
        {renderSingle(EDUCATION, profile.education, (education) => update({ education }))}
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  ageRow: { flexDirection: "row", alignItems: "center", gap: Space.lg },
  switchRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pairRow: { flexDirection: "row", gap: Space.lg },
});
