import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { CenterModal } from "../components/modal";
import { Field, Input, PrimaryButton, SecondaryButton } from "../components/forms";
import { apiCall } from "../lib/api";

type Group = { id: string; name: string; code: string };

export function NoticeComposer({
  visible,
  onClose,
  onCreated
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("global");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    apiCall<{ groups: Group[] }>("/api/admin/groups")
      .then((g) => setGroups(g.groups ?? []))
      .catch(() => setGroups([]));
  }, [visible]);

  async function submit() {
    if (!title || !body) {
      Alert.alert("Required", "Title and body are required.");
      return;
    }
    setSubmitting(true);
    try {
      await apiCall("/api/notices", {
        method: "POST",
        body: JSON.stringify({
          groupId: groupId === "global" ? null : groupId,
          title,
          body
        })
      });
      onCreated();
      setTitle("");
      setBody("");
      setGroupId("global");
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    } finally {
      setSubmitting(false);
    }
  }

  const options = [{ id: "global", name: "Institute-wide", code: "ALL" }, ...groups];

  return (
    <CenterModal
      visible={visible}
      onClose={onClose}
      title="Post notice"
      footer={
        <>
          <SecondaryButton label="Cancel" onPress={onClose} />
          <PrimaryButton label="Post" loading={submitting} onPress={submit} />
        </>
      }
    >
      <Field label="Audience">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {options.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setGroupId(g.id)}
              style={[styles.opt, groupId === g.id && styles.optActive]}
            >
              <Text style={[styles.optText, groupId === g.id && styles.optTextActive]}>
                {g.id === "global" ? "Institute-wide" : `${g.name} (${g.code})`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Field>
      <Field label="Title">
        <Input value={title} onChangeText={setTitle} />
      </Field>
      <Field label="Body">
        <Input value={body} onChangeText={setBody} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
      </Field>
    </CenterModal>
  );
}

const styles = StyleSheet.create({
  opt: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#303844",
    backgroundColor: "#0f1216"
  },
  optActive: {
    borderColor: "#4fb5a7",
    backgroundColor: "#1f252d"
  },
  optText: { color: "#cdd5df", fontWeight: "600" },
  optTextActive: { color: "#4fb5a7" }
});
