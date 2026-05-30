import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

export function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor="#5b6573" style={[styles.input, props.style]} {...props} />;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
  loading
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, (disabled || loading) && styles.btnDisabled, style]}
    >
      <Text style={styles.btnText}>{loading ? "Working…" : label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  style
}: {
  label: string;
  onPress: () => void;
  style?: any;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.btnGhost, style]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({
  label,
  onPress,
  loading
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={[styles.btnDanger, loading && styles.btnDisabled]}>
      <Text style={styles.btnText}>{loading ? "Working…" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    color: "#98a2b3",
    fontSize: 13
  },
  hint: {
    color: "#5b6573",
    fontSize: 12
  },
  input: {
    minHeight: 42,
    borderRadius: 8,
    borderColor: "#303844",
    borderWidth: 1,
    paddingHorizontal: 12,
    color: "#eef2f6",
    backgroundColor: "#0f1216"
  },
  btn: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fb5a7"
  },
  btnGhost: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#303844"
  },
  btnDanger: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef6461"
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    color: "#eef2f6",
    fontWeight: "800"
  }
});
