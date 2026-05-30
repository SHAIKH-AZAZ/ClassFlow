import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CenterModal } from "../components/modal";
import { Field, Input, PrimaryButton, SecondaryButton } from "../components/forms";
import { apiCall } from "../lib/api";

type GroupOption = { id: string; name: string; code: string };
type FacultyOption = { id: string; fullName: string; zoomHostUserId: string | null };

function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
}
function defaultEnd() {
  const d = new Date(defaultStart());
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
}

export function LectureComposer({
  visible,
  role,
  facultyProfileId,
  onClose,
  onCreated
}: {
  visible: boolean;
  role: "admin" | "faculty";
  facultyProfileId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    groupId: "",
    facultyId: "",
    startsAt: defaultStart(),
    endsAt: defaultEnd(),
    threshold: "70"
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      try {
        const [g, u] = await Promise.all([
          apiCall<{ groups: GroupOption[] }>("/api/admin/groups").catch(() => ({ groups: [] })),
          apiCall<{ profiles: any[] }>("/api/admin/users").catch(() => ({ profiles: [] }))
        ]);
        if (!alive) return;
        setGroups(g.groups ?? []);
        const fs: FacultyOption[] = (u.profiles ?? [])
          .filter((p: any) => p.role === "faculty")
          .map((p: any) => {
            const fp = Array.isArray(p.faculty_profiles) ? p.faculty_profiles[0] : p.faculty_profiles;
            return { id: fp?.id ?? p.id, fullName: p.full_name, zoomHostUserId: fp?.zoom_host_user_id ?? null };
          });
        setFaculties(fs);
        setForm((prev) => ({
          ...prev,
          groupId: prev.groupId || g.groups?.[0]?.id || "",
          facultyId:
            prev.facultyId ||
            (role === "faculty" ? facultyProfileId ?? "" : fs[0]?.id ?? "")
        }));
      } catch (err) {
        Alert.alert("Failed", err instanceof Error ? err.message : "");
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, role, facultyProfileId]);

  function update(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (!form.title || !form.groupId || !form.facultyId) {
      Alert.alert("Required", "Title, group and faculty are required.");
      return;
    }
    setSubmitting(true);
    try {
      const startsAt = new Date(form.startsAt).toISOString();
      const endsAt = new Date(form.endsAt).toISOString();
      await apiCall("/api/lectures", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          groupId: form.groupId,
          facultyId: form.facultyId,
          startsAt,
          endsAt,
          attendanceThresholdPercent: Number(form.threshold)
        })
      });
      onCreated();
      setForm({
        title: "",
        description: "",
        groupId: form.groupId,
        facultyId: form.facultyId,
        startsAt: defaultStart(),
        endsAt: defaultEnd(),
        threshold: "70"
      });
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "");
    } finally {
      setSubmitting(false);
    }
  }

  const facultyOptions = role === "faculty" && facultyProfileId ? faculties.filter((f) => f.id === facultyProfileId) : faculties;

  return (
    <CenterModal
      visible={visible}
      onClose={onClose}
      title="Schedule lecture"
      footer={
        <>
          <SecondaryButton label="Cancel" onPress={onClose} />
          <PrimaryButton label="Schedule" loading={submitting} onPress={submit} />
        </>
      }
    >
      <Field label="Title">
        <Input value={form.title} onChangeText={(v) => update("title", v)} />
      </Field>
      <Field label="Description">
        <Input
          value={form.description}
          onChangeText={(v) => update("description", v)}
          multiline
          style={{ minHeight: 80, textAlignVertical: "top" }}
        />
      </Field>
      <Field label="Group">
        <Picker
          options={groups.map((g) => ({ value: g.id, label: `${g.name} (${g.code})` }))}
          value={form.groupId}
          onChange={(v) => update("groupId", v)}
          empty="No groups available"
        />
      </Field>
      <Field
        label="Faculty"
        hint={role === "faculty" ? "Locked to your account." : undefined}
      >
        <Picker
          options={facultyOptions.map((f) => ({
            value: f.id,
            label: f.zoomHostUserId ? f.fullName : `${f.fullName} · no Zoom host`
          }))}
          value={form.facultyId}
          onChange={(v) => update("facultyId", v)}
          empty="No faculty available"
          disabled={role === "faculty"}
        />
      </Field>
      <Field label="Starts (ISO local)" hint="YYYY-MM-DDTHH:mm">
        <Input value={form.startsAt} onChangeText={(v) => update("startsAt", v)} autoCapitalize="none" />
      </Field>
      <Field label="Ends (ISO local)" hint="YYYY-MM-DDTHH:mm">
        <Input value={form.endsAt} onChangeText={(v) => update("endsAt", v)} autoCapitalize="none" />
      </Field>
      <Field label="Attendance threshold (%)">
        <Input value={form.threshold} onChangeText={(v) => update("threshold", v)} keyboardType="number-pad" />
      </Field>
    </CenterModal>
  );
}

function Picker({
  options,
  value,
  onChange,
  empty,
  disabled
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  empty: string;
  disabled?: boolean;
}) {
  if (options.length === 0) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => !disabled && onChange(opt.value)}
          style={[styles.opt, value === opt.value && styles.optActive, disabled && { opacity: 0.6 }]}
        >
          <Text style={[styles.optText, value === opt.value && styles.optTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#98a2b3", fontStyle: "italic" },
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

const _View = View; // keep View import used elsewhere
