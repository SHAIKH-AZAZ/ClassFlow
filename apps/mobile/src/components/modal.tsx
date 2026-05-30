import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

export function CenterModal({
  visible,
  title,
  onClose,
  children,
  footer
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end"
  },
  dismiss: { flex: 1 },
  card: {
    backgroundColor: "#171b21",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "#303844",
    maxHeight: "92%"
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#303844",
    borderBottomWidth: 1
  },
  title: {
    color: "#eef2f6",
    fontSize: 18,
    fontWeight: "800"
  },
  close: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  closeText: {
    color: "#98a2b3",
    fontSize: 22
  },
  body: {
    padding: 18,
    gap: 12
  },
  footer: {
    padding: 14,
    borderTopColor: "#303844",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end"
  }
});
