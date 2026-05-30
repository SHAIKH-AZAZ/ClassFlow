import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import type { AttendanceStatus } from "@zoom-lms/shared";
import { supabase } from "./src/lib/supabase";
import { apiCall as serverApi } from "./src/lib/api";
import { ConfirmHost, confirmAction, pickAction } from "./src/components/confirm-dialog";
import { LectureComposer } from "./src/screens/lecture-composer";
import { NoticeComposer } from "./src/screens/notice-composer";
import { UsersTab } from "./src/screens/users-tab";
import { GroupsTab } from "./src/screens/groups-tab";

type Role = "admin" | "faculty" | "student";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
};

type StudentProfile = {
  id: string;
  user_id: string;
  roll_number: string | null;
};

type FacultyProfile = {
  id: string;
  user_id: string;
};

type LectureRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  groups: { name: string; code: string } | null;
  zoom_meetings: { join_url: string | null; start_url: string | null; password: string | null } | null;
};

type RecordingRow = {
  id: string;
  view_url: string | null;
  download_url: string | null;
  created_at: string;
  lectures: { title: string | null; groups: { name: string | null } | null } | null;
};

type ResourceRow = {
  id: string;
  title: string;
  kind: string;
  view_url: string | null;
  download_url: string | null;
  created_at: string;
  groups: { name: string | null } | null;
};

type AttendanceRow = {
  id: string;
  duration_minutes: number;
  required_minutes: number;
  status: AttendanceStatus;
  source: string;
  student_profiles: {
    roll_number: string | null;
    profiles: { full_name: string } | null;
  } | null;
  lectures: { title: string | null; starts_at: string | null } | null;
};

type NoticeRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  groups: { name: string | null } | null;
  profiles: { full_name: string | null } | null;
};

type RemarkRow = {
  id: string;
  body: string;
  created_at: string;
  faculty_profiles: { profiles: { full_name: string | null } | null } | null;
  student_profiles: { roll_number: string | null; profiles: { full_name: string | null } | null } | null;
  lectures: { title: string | null } | null;
};

type Scope = {
  role: Role;
  groupIds: string[];
  lectureIds: string[];
  studentId: string | null;
  facultyProfileId: string | null;
};

const TABS_BY_ROLE: Record<Role, readonly string[]> = {
  admin: ["Users", "Groups", "Schedule", "Recordings", "Resources", "Attendance", "Notices", "Remarks"],
  faculty: ["Schedule", "Recordings", "Resources", "Attendance", "Notices", "Remarks"],
  student: ["Schedule", "Recordings", "Resources", "Attendance", "Notices", "Remarks"]
} as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color="#4fb5a7" style={{ marginTop: 60 }} />
        <ConfirmHost />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <>
        <LoginScreen />
        <ConfirmHost />
      </>
    );
  }

  return (
    <>
      <Authed session={session} />
      <ConfirmHost />
    </>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) setError(authError.message);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { justifyContent: "center", flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>Institute Zoom LMS</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.muted}>Use the credentials provided by your institute.</Text>

          <View style={[styles.card, { gap: 12 }]}>
            <View style={{ gap: 4 }}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                onSubmitEditing={signIn}
                returnKeyType="done"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>
            <Pressable
              disabled={busy || !email || !password}
              onPress={signIn}
              style={[styles.button, { opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Authed({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [tab, setTab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", session.user.id)
        .maybeSingle<Profile>();

      if (!alive) return;

      if (profileError || !profileRow) {
        setError(profileError?.message ?? "No profile found for this account.");
        setLoading(false);
        return;
      }
      if (!profileRow.active) {
        setError("This account is disabled. Contact your administrator.");
        setLoading(false);
        return;
      }
      setProfile(profileRow);

      // Resolve role-specific scope (group ids, lecture ids, etc.).
      let groupIds: string[] = [];
      let lectureIds: string[] = [];
      let studentId: string | null = null;
      let facultyProfileId: string | null = null;

      if (profileRow.role === "student") {
        const { data: student } = await supabase
          .from("student_profiles")
          .select("id, user_id, roll_number")
          .eq("user_id", session.user.id)
          .maybeSingle<StudentProfile>();
        studentId = student?.id ?? null;
        setStudentProfile(student ?? null);
        if (student) {
          const { data: rows } = await supabase
            .from("group_students")
            .select("group_id")
            .eq("student_id", student.id);
          groupIds = (rows ?? []).map((r: any) => r.group_id);
        }
        if (groupIds.length) {
          const { data: lectures } = await supabase.from("lectures").select("id").in("group_id", groupIds);
          lectureIds = (lectures ?? []).map((l: any) => l.id);
        }
      } else if (profileRow.role === "faculty") {
        const { data: facultyRow } = await supabase
          .from("faculty_profiles")
          .select("id, user_id")
          .eq("user_id", session.user.id)
          .maybeSingle<FacultyProfile>();
        facultyProfileId = facultyRow?.id ?? null;
        if (facultyProfileId) {
          const { data: lectures } = await supabase
            .from("lectures")
            .select("id, group_id")
            .eq("faculty_id", facultyProfileId);
          lectureIds = (lectures ?? []).map((l: any) => l.id);
          groupIds = Array.from(new Set((lectures ?? []).map((l: any) => l.group_id))) as string[];
        }
      } else {
        // admin: see everything
        const [{ data: groups }, { data: lectures }] = await Promise.all([
          supabase.from("groups").select("id"),
          supabase.from("lectures").select("id")
        ]);
        groupIds = (groups ?? []).map((g: any) => g.id);
        lectureIds = (lectures ?? []).map((l: any) => l.id);
      }

      if (!alive) return;
      setScope({ role: profileRow.role, groupIds, lectureIds, studentId, facultyProfileId });
      setTab(TABS_BY_ROLE[profileRow.role][0] ?? "Schedule");
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [session.user.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color="#4fb5a7" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Could not load your account</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => supabase.auth.signOut()} style={[styles.buttonGhost, { marginTop: 16 }]}>
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile || !scope) return null;

  const subtitle =
    scope.role === "student"
      ? studentProfile?.roll_number
        ? `Roll ${studentProfile.roll_number}`
        : "Student"
      : scope.role === "faculty"
        ? scope.facultyProfileId
          ? "Faculty"
          : "Faculty profile not configured"
        : "Administrator";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{labelFor(scope.role)}</Text>
          <Text style={styles.title}>{profile.full_name}</Text>
          <Text style={styles.muted}>{subtitle}</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()} style={styles.buttonGhost}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={{ alignItems: "center", gap: 6, paddingHorizontal: 12 }}
      >
        {TABS_BY_ROLE[scope.role].map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {tab === "Users" ? <UsersTab /> : null}
        {tab === "Groups" ? <GroupsTab /> : null}
        {tab === "Schedule" ? <ScheduleTab scope={scope} /> : null}
        {tab === "Recordings" ? <RecordingsTab scope={scope} /> : null}
        {tab === "Resources" ? <ResourcesTab scope={scope} /> : null}
        {tab === "Attendance" ? <AttendanceTab scope={scope} /> : null}
        {tab === "Notices" ? <NoticesTab scope={scope} /> : null}
        {tab === "Remarks" ? <RemarksTab scope={scope} /> : null}
      </View>
    </SafeAreaView>
  );
}

function labelFor(role: Role) {
  if (role === "admin") return "Admin workspace";
  if (role === "faculty") return "Faculty workspace";
  return "Student workspace";
}

function ScheduleTab({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<LectureRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const canCompose = scope.role === "admin" || scope.role === "faculty";

  async function load() {
    let query = supabase
      .from("lectures")
      .select(
        "id, title, description, starts_at, ends_at, status, groups(name, code), zoom_meetings(join_url, start_url, password)"
      )
      .order("starts_at", { ascending: false });

    if (scope.role === "student" || scope.role === "faculty") {
      if (scope.lectureIds.length === 0) {
        setItems([]);
        return;
      }
      query = query.in("id", scope.lectureIds);
    }

    const { data, error } = await query.returns<LectureRow[]>();
    if (error) {
      Alert.alert("Failed to load lectures", error.message);
      setItems([]);
      return;
    }
    setItems(data ?? []);
  }

  async function syncAttendance(lectureId: string, title: string) {
    const choice = await confirmAction({
      title: `Take attendance for "${title}"?`,
      message:
        "Sync from Zoom requires a Paid Zoom plan. Seed manual creates an absent row for every enrolled student so you can mark presence in the Attendance tab.",
      confirmLabel: "Sync from Zoom"
    });
    if (!choice.ok) return;
    try {
      const resp = await serverApi<{ synced: number; notice?: string | null }>("/api/attendance/sync", {
        method: "POST",
        body: JSON.stringify({ lectureId })
      });
      const lines = [`Synced ${resp.synced} attendance row${resp.synced === 1 ? "" : "s"}.`];
      if (resp.notice) lines.push(resp.notice);
      Alert.alert("Done", lines.join("\n\n"));
    } catch (err) {
      Alert.alert("Sync failed", err instanceof Error ? err.message : "");
    }
  }

  async function seedAttendance(lectureId: string, title: string) {
    const choice = await confirmAction({
      title: `Mark attendance manually for "${title}"?`,
      message:
        "Creates an absent row for every enrolled student. Faculty can then tap each row in the Attendance tab to mark Present, Late, or Excused. Existing overrides are preserved.",
      confirmLabel: "Seed rows"
    });
    if (!choice.ok) return;
    try {
      const resp = await serverApi<{ seeded: number; notice?: string }>("/api/attendance/seed", {
        method: "POST",
        body: JSON.stringify({ lectureId })
      });
      Alert.alert(
        "Ready to mark",
        `Seeded ${resp.seeded} student row${resp.seeded === 1 ? "" : "s"}. Open the Attendance tab and tap a row to set the status.${resp.notice ? `\n\n${resp.notice}` : ""}`
      );
    } catch (err) {
      Alert.alert("Seed failed", err instanceof Error ? err.message : "");
    }
  }

  async function deleteLecture(lectureId: string, title: string) {
    const choice = await confirmAction({
      title: `Delete "${title}"?`,
      message: "Removes the Zoom meeting record, all attendance rows, and any recordings tied to this lecture.",
      confirmLabel: "Delete lecture",
      variant: "danger"
    });
    if (!choice.ok) return;
    try {
      await serverApi(`/api/lectures/${lectureId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      Alert.alert("Delete failed", err instanceof Error ? err.message : "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.role, scope.lectureIds.join(",")]);

  if (!items) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <View style={{ flex: 1 }}>
      {canCompose ? (
        <View style={[styles.row, { marginHorizontal: 16, marginTop: 12, marginBottom: 0 }]}>
          <Text style={styles.muted}>{items.length} lecture(s)</Text>
          <Pressable onPress={() => setComposerOpen(true)} style={styles.button}>
            <Text style={styles.buttonText}>+ Schedule</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={styles.container}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor="#4fb5a7"
          />
        }
        renderItem={({ item }) => {
          const startUrl = item.zoom_meetings?.start_url;
          const joinUrl = item.zoom_meetings?.join_url;
          const launchUrl = scope.role === "faculty" && startUrl ? startUrl : joinUrl;
          const launchLabel = scope.role === "faculty" && startUrl ? "Start Zoom" : "Join Zoom";
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.muted}>
                {item.groups?.name ?? "Group"} · {new Date(item.starts_at).toLocaleString()}
              </Text>
              {item.description ? <Text style={{ color: "#cdd5df", marginTop: 4 }}>{item.description}</Text> : null}
              <View style={styles.row}>
                <Text style={[styles.status, statusColors[item.status] ?? {}]}>{item.status}</Text>
                {launchUrl ? (
                  <Pressable onPress={() => Linking.openURL(launchUrl)} style={styles.button}>
                    <Text style={styles.buttonText}>{launchLabel}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.muted}>No link</Text>
                )}
              </View>
              {canCompose ? (
                <View style={[styles.actionRow, { marginTop: 8 }]}>
                  <Pressable onPress={() => syncAttendance(item.id, item.title)} style={styles.buttonGhost}>
                    <Text style={styles.buttonText}>Sync</Text>
                  </Pressable>
                  <Pressable onPress={() => seedAttendance(item.id, item.title)} style={styles.buttonGhost}>
                    <Text style={styles.buttonText}>Mark manually</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteLecture(item.id, item.title)}
                    style={[styles.buttonGhost, { backgroundColor: "#ef6461" }]}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No lectures yet.</Text>}
      />
      {canCompose ? (
        <LectureComposer
          visible={composerOpen}
          role={scope.role as "admin" | "faculty"}
          facultyProfileId={scope.facultyProfileId}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            setComposerOpen(false);
            load();
          }}
        />
      ) : null}
    </View>
  );
}

function RecordingsTab({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<RecordingRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    let query = supabase
      .from("recordings")
      .select("id, view_url, download_url, created_at, lectures(title, groups(name))")
      .order("created_at", { ascending: false });

    if (scope.role !== "admin") {
      if (scope.lectureIds.length === 0) {
        setItems([]);
        return;
      }
      query = query.in("lecture_id", scope.lectureIds);
    }

    const { data, error } = await query.returns<RecordingRow[]>();
    if (error) Alert.alert("Failed to load recordings", error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.role, scope.lectureIds.join(",")]);

  if (!items) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#4fb5a7"
        />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{item.lectures?.title ?? "Recording"}</Text>
            <Text style={styles.muted}>
              {item.lectures?.groups?.name ?? ""} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
          {item.view_url ? (
            <Pressable onPress={() => Linking.openURL(item.view_url!)}>
              <Text style={styles.link}>Open</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No recordings yet.</Text>}
    />
  );
}

function ResourcesTab({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<ResourceRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    let query = supabase
      .from("resources")
      .select("id, title, kind, view_url, download_url, created_at, groups(name)")
      .order("created_at", { ascending: false });

    if (scope.role !== "admin") {
      if (scope.groupIds.length === 0) {
        setItems([]);
        return;
      }
      query = query.in("group_id", scope.groupIds);
    }

    const { data, error } = await query.returns<ResourceRow[]>();
    if (error) Alert.alert("Failed to load resources", error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.role, scope.groupIds.join(",")]);

  if (!items) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#4fb5a7"
        />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{item.title}</Text>
            <Text style={styles.muted}>
              {item.groups?.name ?? ""} · {item.kind}
            </Text>
          </View>
          {item.view_url ? (
            <Pressable onPress={() => Linking.openURL(item.view_url!)}>
              <Text style={styles.link}>Open</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No resources yet.</Text>}
    />
  );
}

function AttendanceTab({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<AttendanceRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const canOverride = scope.role === "admin" || scope.role === "faculty";

  async function load() {
    let query = supabase
      .from("attendance")
      .select(
        "id, duration_minutes, required_minutes, status, source, student_profiles(roll_number, profiles(full_name)), lectures(title, starts_at)"
      )
      .order("calculated_at", { ascending: false });

    if (scope.role === "student") {
      if (!scope.studentId) {
        setItems([]);
        return;
      }
      query = query.eq("student_id", scope.studentId);
    } else if (scope.role === "faculty") {
      if (scope.lectureIds.length === 0) {
        setItems([]);
        return;
      }
      query = query.in("lecture_id", scope.lectureIds);
    }

    const { data, error } = await query.returns<AttendanceRow[]>();
    if (error) Alert.alert("Failed to load attendance", error.message);
    setItems(data ?? []);
  }

  function override(row: AttendanceRow) {
    const choices: AttendanceStatus[] = ["present", "absent", "late", "excused"];
    pickAction({
      title: "Override status",
      message: `Current: ${row.status}`,
      choices: choices.map((status) => ({
        value: status,
        label: status.charAt(0).toUpperCase() + status.slice(1),
        variant: status === "absent" ? "danger" : "default"
      }))
    }).then((picked) => {
      if (picked) askReason(row, picked as AttendanceStatus);
    });
  }

  async function askReason(row: AttendanceRow, status: AttendanceStatus) {
    if (status === row.status) return;
    const result = await confirmAction({
      title: `Mark ${status}`,
      message: `Update attendance from ${row.status} to ${status}.`,
      confirmLabel: "Save",
      prompt: { label: "Reason for the correction", placeholder: "e.g. arrived 10 min late", required: true }
    });
    if (!result.ok) return;
    try {
      await serverApi("/api/attendance/override", {
        method: "POST",
        body: JSON.stringify({ attendanceId: row.id, status, reason: result.value })
      });
      await load();
    } catch (err) {
      Alert.alert("Override failed", err instanceof Error ? err.message : "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.role, scope.studentId, scope.lectureIds.join(",")]);

  if (!items) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#4fb5a7"
        />
      }
      renderItem={({ item }) => {
        const studentName = item.student_profiles?.profiles?.full_name;
        const roll = item.student_profiles?.roll_number;
        const isStudentScope = scope.role === "student";
        const content = (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>{item.lectures?.title ?? "Lecture"}</Text>
              <Text style={styles.muted}>
                {!isStudentScope && studentName ? `${studentName}${roll ? ` · ${roll}` : ""} · ` : ""}
                {item.lectures?.starts_at ? new Date(item.lectures.starts_at).toLocaleDateString() : ""} ·{" "}
                {Math.round(item.duration_minutes)} / {Math.round(item.required_minutes)} min
              </Text>
            </View>
            <Text style={[styles.status, item.status === "absent" && styles.statusDanger]}>{item.status}</Text>
          </>
        );
        if (canOverride) {
          return (
            <Pressable style={styles.row} onPress={() => override(item)}>
              {content}
            </Pressable>
          );
        }
        return <View style={styles.row}>{content}</View>;
      }}
      ListEmptyComponent={<Text style={styles.empty}>No attendance recorded.</Text>}
    />
  );
}

function NoticesTab({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<NoticeRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const canCompose = scope.role === "admin" || scope.role === "faculty";

  async function load() {
    let query = supabase
      .from("notices")
      .select("id, title, body, created_at, group_id, groups(name), profiles(full_name)")
      .order("created_at", { ascending: false });

    if (scope.role === "student") {
      if (scope.groupIds.length === 0) {
        query = query.is("group_id", null);
      } else {
        query = query.or(`group_id.is.null,group_id.in.(${scope.groupIds.join(",")})`);
      }
    } else if (scope.role === "faculty") {
      if (scope.groupIds.length === 0) {
        query = query.is("group_id", null);
      } else {
        query = query.or(`group_id.is.null,group_id.in.(${scope.groupIds.join(",")})`);
      }
    }

    const { data, error } = await query.returns<NoticeRow[]>();
    if (error) Alert.alert("Failed to load notices", error.message);
    setItems(data ?? []);
  }

  async function deleteNotice(id: string, title: string) {
    const choice = await confirmAction({
      title: `Delete "${title}"?`,
      message: "Members of this audience will no longer see the notice.",
      confirmLabel: "Delete notice",
      variant: "danger"
    });
    if (!choice.ok) return;
    try {
      await serverApi(`/api/notices/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      Alert.alert("Delete failed", err instanceof Error ? err.message : "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.role, scope.groupIds.join(",")]);

  if (!items) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <View style={{ flex: 1 }}>
      {canCompose ? (
        <View style={[styles.row, { marginHorizontal: 16, marginTop: 12, marginBottom: 0 }]}>
          <Text style={styles.muted}>{items.length} notice(s)</Text>
          <Pressable onPress={() => setComposerOpen(true)} style={styles.button}>
            <Text style={styles.buttonText}>+ Post</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={styles.container}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor="#4fb5a7"
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.muted}>
              {item.groups?.name ? `${item.groups.name} · ` : "Institute-wide · "}
              {item.profiles?.full_name ?? "Admin"} · {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text style={{ color: "#cdd5df", marginTop: 6 }}>{item.body}</Text>
            {canCompose ? (
              <View style={[styles.row, { marginTop: 8 }]}>
                <Pressable
                  onPress={() => deleteNotice(item.id, item.title)}
                  style={[styles.buttonGhost, { backgroundColor: "#ef6461" }]}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notices.</Text>}
      />
      {canCompose ? (
        <NoticeComposer
          visible={composerOpen}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            setComposerOpen(false);
            load();
          }}
        />
      ) : null}
    </View>
  );
}

function RemarksTab({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<RemarkRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    let query = supabase
      .from("remarks")
      .select(
        "id, body, created_at, faculty_profiles(profiles(full_name)), student_profiles(roll_number, profiles(full_name)), lectures(title)"
      )
      .order("created_at", { ascending: false });

    if (scope.role === "student") {
      if (!scope.studentId) {
        setItems([]);
        return;
      }
      query = query.eq("student_id", scope.studentId);
    } else if (scope.role === "faculty") {
      if (!scope.facultyProfileId) {
        setItems([]);
        return;
      }
      query = query.eq("faculty_id", scope.facultyProfileId);
    }

    const { data, error } = await query.returns<RemarkRow[]>();
    if (error) Alert.alert("Failed to load remarks", error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.role, scope.studentId, scope.facultyProfileId]);

  if (!items) return <ActivityIndicator color="#4fb5a7" style={{ marginTop: 30 }} />;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#4fb5a7"
        />
      }
      renderItem={({ item }) => {
        const facultyName = item.faculty_profiles?.profiles?.full_name ?? "Admin";
        const studentName = item.student_profiles?.profiles?.full_name;
        const roll = item.student_profiles?.roll_number;
        const lecture = item.lectures?.title;
        return (
          <View style={styles.card}>
            <Text style={styles.muted}>
              {new Date(item.created_at).toLocaleString()} · {facultyName}
              {studentName ? ` → ${studentName}${roll ? ` (${roll})` : ""}` : ""}
              {lecture ? ` · ${lecture}` : ""}
            </Text>
            <Text style={{ color: "#eef2f6", marginTop: 6, fontSize: 15 }}>{item.body}</Text>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>No remarks.</Text>}
    />
  );
}

const statusColors: Record<string, { color: string }> = {
  scheduled: { color: "#a0a8b8" },
  live: { color: "#4fb5a7" },
  completed: { color: "#cdd5df" },
  cancelled: { color: "#ef6461" }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f1216"
  },
  container: {
    padding: 20,
    gap: 14
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12
  },
  eyebrow: {
    color: "#98a2b3",
    fontSize: 13,
    marginTop: 6
  },
  title: {
    color: "#eef2f6",
    fontSize: 26,
    fontWeight: "800"
  },
  muted: {
    color: "#98a2b3",
    marginTop: 4
  },
  card: {
    backgroundColor: "#171b21",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 6
  },
  cardTitle: {
    color: "#eef2f6",
    fontSize: 16,
    fontWeight: "700"
  },
  row: {
    minHeight: 58,
    backgroundColor: "#171b21",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    justifyContent: "space-between"
  },
  rowText: {
    color: "#eef2f6",
    fontSize: 15,
    fontWeight: "600"
  },
  link: {
    color: "#4fb5a7",
    fontWeight: "800"
  },
  status: {
    color: "#4fb5a7",
    fontWeight: "800",
    textTransform: "capitalize"
  },
  statusDanger: {
    color: "#ef6461"
  },
  button: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fb5a7"
  },
  buttonGhost: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#303844"
  },
  buttonText: {
    color: "#eef2f6",
    fontWeight: "800"
  },
  tabBar: {
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#303844",
    paddingBottom: 6,
    flexGrow: 0
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  tabActive: {
    backgroundColor: "#1f252d"
  },
  tabText: {
    color: "#98a2b3",
    fontSize: 14,
    fontWeight: "700"
  },
  tabTextActive: {
    color: "#eef2f6"
  },
  empty: {
    color: "#98a2b3",
    textAlign: "center",
    marginTop: 40
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  label: {
    color: "#98a2b3",
    fontSize: 13
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
  error: {
    color: "#ef6461",
    fontWeight: "700"
  }
});
