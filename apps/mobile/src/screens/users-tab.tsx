import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { CenterModal } from "../components/modal";
import { confirmAction } from "../components/confirm-dialog";
import { DangerButton, Field, Input, PrimaryButton, SecondaryButton } from "../components/forms";
import { apiCall } from "../lib/api";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string;
  role: "admin" | "faculty" | "student";
  active: boolean;
  phone: string | null;
  created_at: string;
  faculty_profiles?:
    | { id: string; employee_code: string | null; department: string | null; zoom_host_user_id: string | null }
    | { id: string; employee_code: string | null; department: string | null; zoom_host_user_id: string | null }[]
    | null;
  student_profiles?:
    | { id: string; roll_number: string | null; guardian_phone: string | null }
    | { id: string; roll_number: string | null; guardian_phone: string | null }[]
    | null;
};

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

const ROLES = ["student", "faculty", "admin"] as const;
type Role = (typeof ROLES)[number];

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    try {
      const json = await apiCall<{ profiles: AdminUser[] }>("/api/admin/users");
      setUsers(json.profiles);
    } catch (err) {
      Alert.alert("Failed to load users", err instanceof Error ? err.message : "");
      setUsers([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(user: AdminUser) {
    try {
      await apiCall(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active })
      });
      load();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    }
  }

  function confirmDelete(user: AdminUser) {
    confirmAction({
      title: `Delete ${user.full_name}?`,
      message: `${user.email ?? "no email"} · role ${user.role}. This permanently removes the auth user, profile, and any role-specific records.`,
      confirmLabel: "Delete user",
      variant: "danger",
      prompt: { label: "Type the full name to confirm:", placeholder: user.full_name, required: true, mustEqual: user.full_name }
    }).then(async (res) => {
      if (!res.ok) return;
      try {
        await apiCall(`/api/admin/users/${user.id}`, { method: "DELETE" });
        load();
      } catch (err) {
        Alert.alert("Delete failed", err instanceof Error ? err.message : "");
      }
    });
  }

  if (!users) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarLabel}>{users.length} users</Text>
        <PrimaryButton label="+ Create user" onPress={() => setCreateOpen(true)} />
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={users}
        keyExtractor={(u) => u.id}
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
        renderItem={({ item }) => {
          const facultyRel = firstRel(item.faculty_profiles);
          const studentRel = firstRel(item.student_profiles);
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.full_name}</Text>
                <Text style={styles.muted}>
                  {item.email ?? "no email"} · {item.role}
                </Text>
                {studentRel?.roll_number ? (
                  <Text style={styles.muted}>Roll {studentRel.roll_number}</Text>
                ) : null}
                {facultyRel ? (
                  <Text style={styles.muted}>
                    {facultyRel.department ?? "—"}
                    {facultyRel.zoom_host_user_id ? ` · Zoom: ${facultyRel.zoom_host_user_id}` : " · no Zoom host"}
                  </Text>
                ) : null}
                <Text style={styles.muted}>{item.active ? "Active" : "Disabled"}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <SecondaryButton label={item.active ? "Disable" : "Enable"} onPress={() => toggleActive(item)} />
                <DangerButton label="Delete" onPress={() => confirmDelete(item)} />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No users yet.</Text>}
      />
      <CreateUserModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />
    </View>
  );
}

function CreateUserModal({
  visible,
  onClose,
  onCreated
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [role, setRole] = useState<Role>("student");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    employeeCode: "",
    department: "",
    zoomHostUserId: "",
    rollNumber: "",
    guardianPhone: ""
  });
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setRole("student");
    setForm({
      email: "",
      password: "",
      fullName: "",
      phone: "",
      employeeCode: "",
      department: "",
      zoomHostUserId: "",
      rollNumber: "",
      guardianPhone: ""
    });
  }

  async function submit() {
    if (!form.email || !form.password || !form.fullName) {
      Alert.alert("Required", "Email, password and full name are required.");
      return;
    }
    setSubmitting(true);
    try {
      await apiCall("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          role,
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone || undefined,
          employeeCode: form.employeeCode || undefined,
          department: form.department || undefined,
          zoomHostUserId: form.zoomHostUserId || undefined,
          rollNumber: form.rollNumber || undefined,
          guardianPhone: form.guardianPhone || undefined
        })
      });
      reset();
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
      title="Create user"
      footer={
        <>
          <SecondaryButton label="Cancel" onPress={onClose} />
          <PrimaryButton label="Create" loading={submitting} onPress={submit} />
        </>
      }
    >
      <Field label="Role">
        <View style={styles.segment}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[styles.segmentItem, role === r && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, role === r && styles.segmentTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="Full name">
        <Input value={form.fullName} onChangeText={(v) => update("fullName", v)} autoCapitalize="words" />
      </Field>
      <Field label="Email">
        <Input
          value={form.email}
          onChangeText={(v) => update("email", v)}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Field>
      <Field label="Password">
        <Input value={form.password} onChangeText={(v) => update("password", v)} autoCapitalize="none" />
      </Field>
      <Field label="Phone">
        <Input value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
      </Field>

      {role === "faculty" ? (
        <>
          <Field label="Employee code">
            <Input value={form.employeeCode} onChangeText={(v) => update("employeeCode", v)} />
          </Field>
          <Field label="Department">
            <Input value={form.department} onChangeText={(v) => update("department", v)} />
          </Field>
          <Field label="Zoom host id (email)">
            <Input
              value={form.zoomHostUserId}
              onChangeText={(v) => update("zoomHostUserId", v)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
        </>
      ) : null}

      {role === "student" ? (
        <>
          <Field label="Roll number">
            <Input value={form.rollNumber} onChangeText={(v) => update("rollNumber", v)} />
          </Field>
          <Field label="Guardian phone">
            <Input
              value={form.guardianPhone}
              onChangeText={(v) => update("guardianPhone", v)}
              keyboardType="phone-pad"
            />
          </Field>
        </>
      ) : null}
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
  toolbarLabel: {
    color: "#98a2b3"
  },
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
  name: {
    color: "#eef2f6",
    fontWeight: "700",
    fontSize: 15
  },
  muted: {
    color: "#98a2b3",
    fontSize: 12,
    marginTop: 2
  },
  empty: {
    color: "#98a2b3",
    textAlign: "center",
    marginTop: 40
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#0f1216",
    borderRadius: 8,
    borderColor: "#303844",
    borderWidth: 1,
    padding: 4,
    gap: 4
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center"
  },
  segmentActive: {
    backgroundColor: "#1f252d"
  },
  segmentText: {
    color: "#98a2b3",
    fontWeight: "700",
    textTransform: "capitalize"
  },
  segmentTextActive: {
    color: "#eef2f6"
  }
});
