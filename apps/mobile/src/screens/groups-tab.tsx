import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { CenterModal } from "../components/modal";
import { DangerButton, Field, Input, PrimaryButton, SecondaryButton } from "../components/forms";
import { apiCall } from "../lib/api";

type Group = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  studentCount: number;
};

type StudentOption = {
  id: string;
  full_name: string;
  role: string;
  email: string | null;
  student_profiles?:
    | { id: string; roll_number: string | null }
    | { id: string; roll_number: string | null }[]
    | null;
};

type EnrollmentRow = {
  student_id: string;
  student_profiles:
    | {
        id: string;
        roll_number: string | null;
        profiles: { id: string; email: string | null; full_name: string };
      }
    | {
        id: string;
        roll_number: string | null;
        profiles: { id: string; email: string | null; full_name: string };
      }[]
    | null;
};

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function GroupsTab() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manage, setManage] = useState<Group | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const json = await apiCall<{ groups: Group[] }>("/api/admin/groups");
      setGroups(json.groups);
    } catch (err) {
      Alert.alert("Failed to load groups", err instanceof Error ? err.message : "");
      setGroups([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function confirmDelete(group: Group) {
    Alert.alert(
      `Delete ${group.name}?`,
      `Code ${group.code} · ${group.studentCount} student(s).`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiCall(`/api/admin/groups/${group.id}`, { method: "DELETE" });
              load();
            } catch (err) {
              Alert.alert("Failed", err instanceof Error ? err.message : "");
            }
          }
        }
      ]
    );
  }

  async function toggle(group: Group) {
    try {
      await apiCall(`/api/admin/groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !group.active })
      });
      load();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    }
  }

  if (!groups) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarLabel}>{groups.length} groups</Text>
        <PrimaryButton label="+ Create group" onPress={() => setCreateOpen(true)} />
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={groups}
        keyExtractor={(g) => g.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              setLoading(true);
              await load();
              setLoading(false);
            }}
            tintColor="#4fb5a7"
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.code} · {item.studentCount} students {item.active ? "" : "· disabled"}
              </Text>
              {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
            </View>
            <View style={{ gap: 6 }}>
              <PrimaryButton label="Manage" onPress={() => setManage(item)} />
              <SecondaryButton label={item.active ? "Disable" : "Enable"} onPress={() => toggle(item)} />
              <DangerButton label="Delete" onPress={() => confirmDelete(item)} />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No groups yet.</Text>}
      />

      <CreateGroupModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />

      {manage ? (
        <ManageGroupModal
          group={manage}
          onClose={() => {
            setManage(null);
            load();
          }}
        />
      ) : null}
    </View>
  );
}

function CreateGroupModal({
  visible,
  onClose,
  onCreated
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!form.name || !form.code) {
      Alert.alert("Required", "Name and code are required.");
      return;
    }
    setSubmitting(true);
    try {
      await apiCall("/api/admin/groups", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", code: "", description: "" });
      onCreated();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CenterModal
      visible={visible}
      onClose={onClose}
      title="Create group"
      footer={
        <>
          <SecondaryButton label="Cancel" onPress={onClose} />
          <PrimaryButton label="Create" loading={submitting} onPress={submit} />
        </>
      }
    >
      <Field label="Name">
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      </Field>
      <Field label="Code">
        <Input value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} autoCapitalize="characters" />
      </Field>
      <Field label="Description">
        <Input
          value={form.description}
          onChangeText={(v) => setForm({ ...form, description: v })}
          multiline
          style={{ minHeight: 80, textAlignVertical: "top" }}
        />
      </Field>
    </CenterModal>
  );
}

function ManageGroupModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [pickingId, setPickingId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [list, users] = await Promise.all([
        apiCall<{ enrollments: EnrollmentRow[] }>(`/api/admin/groups/${group.id}/students`),
        apiCall<{ profiles: StudentOption[] }>("/api/admin/users")
      ]);
      setEnrollments(list.enrollments);
      setStudents(users.profiles);
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const enrolledIds = useMemo(() => new Set(enrollments.map((e) => e.student_id)), [enrollments]);

  const candidates = useMemo(() => {
    return students
      .filter((s) => s.role === "student" && firstRel(s.student_profiles))
      .map((s) => {
        const sp = firstRel(s.student_profiles)!;
        return { id: sp.id, fullName: s.full_name, roll: sp.roll_number, email: s.email };
      })
      .filter((s) => !enrolledIds.has(s.id));
  }, [students, enrolledIds]);

  async function add() {
    if (!pickingId) return;
    setBusy(true);
    try {
      await apiCall(`/api/admin/groups/${group.id}/students`, {
        method: "POST",
        body: JSON.stringify({ studentId: pickingId })
      });
      setPickingId("");
      load();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    } finally {
      setBusy(false);
    }
  }

  async function remove(studentId: string) {
    setBusy(true);
    try {
      await apiCall(`/api/admin/groups/${group.id}/students?studentId=${studentId}`, { method: "DELETE" });
      load();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenterModal
      visible
      onClose={onClose}
      title={`${group.name} · ${group.code}`}
      footer={<SecondaryButton label="Close" onPress={onClose} />}
    >
      <Text style={styles.subhead}>Add student</Text>
      {candidates.length === 0 ? (
        <Text style={styles.emptyInline}>No more students to add.</Text>
      ) : (
        candidates.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setPickingId(c.id)}
            style={[styles.option, pickingId === c.id && styles.optionActive]}
          >
            <Text style={styles.optionText}>
              {c.fullName} {c.roll ? `(${c.roll})` : ""}
            </Text>
            <Text style={styles.muted}>{c.email}</Text>
          </Pressable>
        ))
      )}
      {pickingId ? <PrimaryButton label="Enroll selected" onPress={add} loading={busy} /> : null}

      <Text style={[styles.subhead, { marginTop: 18 }]}>Enrolled ({enrollments.length})</Text>
      {enrollments.length === 0 ? (
        <Text style={styles.emptyInline}>No students enrolled.</Text>
      ) : (
        enrollments.map((row) => {
          const sp = firstRel(row.student_profiles);
          const profile = firstRel(sp?.profiles);
          return (
            <View key={row.student_id} style={styles.enrollRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionText}>{profile?.full_name ?? "Unknown"}</Text>
                <Text style={styles.muted}>
                  {sp?.roll_number ?? "—"} · {profile?.email ?? "—"}
                </Text>
              </View>
              <DangerButton label="Remove" onPress={() => remove(row.student_id)} />
            </View>
          );
        })
      )}
    </CenterModal>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12
  },
  toolbarLabel: { color: "#98a2b3" },
  card: {
    backgroundColor: "#171b21",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  name: { color: "#eef2f6", fontWeight: "700", fontSize: 15 },
  muted: { color: "#98a2b3", fontSize: 12, marginTop: 2 },
  empty: { color: "#98a2b3", textAlign: "center", marginTop: 40 },
  emptyInline: { color: "#98a2b3" },
  subhead: { color: "#cdd5df", fontWeight: "700", marginTop: 4 },
  option: {
    backgroundColor: "#0f1216",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10
  },
  optionActive: {
    borderColor: "#4fb5a7"
  },
  optionText: { color: "#eef2f6", fontWeight: "600" },
  enrollRow: {
    backgroundColor: "#0f1216",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  }
});
