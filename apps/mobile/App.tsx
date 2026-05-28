import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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

type StudentProfile = {
  id: string;
  user_id: string;
  roll_number: string | null;
};

type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "faculty" | "student";
  active: boolean;
};

type LectureRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  groups: { name: string; code: string } | null;
  zoom_meetings: { join_url: string | null; password: string | null } | null;
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
  lectures: { title: string | null; starts_at: string | null } | null;
};

const TABS = ["Schedule", "Recordings", "Resources", "Attendance"] as const;
type Tab = (typeof TABS)[number];

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
      </SafeAreaView>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <Authed session={session} />;
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
      <ScrollView contentContainerStyle={[styles.container, { justifyContent: "center", flexGrow: 1 }]}>
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
    </SafeAreaView>
  );
}

function Authed({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [tab, setTab] = useState<Tab>("Schedule");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", session.user.id)
        .maybeSingle<Profile>();
      setProfile(profileRow ?? null);

      const { data: student } = await supabase
        .from("student_profiles")
        .select("id, user_id, roll_number")
        .eq("user_id", session.user.id)
        .maybeSingle<StudentProfile>();
      setStudentProfile(student ?? null);
      setLoading(false);
    }
    load();
  }, [session.user.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color="#4fb5a7" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (profile && profile.role !== "student") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Mobile is student-only</Text>
          <Text style={styles.muted}>
            Your account is a {profile.role}. Use the web dashboard for {profile.role} workflows.
          </Text>
          <Pressable onPress={() => supabase.auth.signOut()} style={[styles.buttonGhost, { marginTop: 16 }]}>
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Student workspace</Text>
          <Text style={styles.title}>{profile?.full_name ?? "Welcome"}</Text>
          <Text style={styles.muted}>{studentProfile?.roll_number ? `Roll ${studentProfile.roll_number}` : "No roll number"}</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()} style={styles.buttonGhost}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === "Schedule" ? <ScheduleTab studentId={studentProfile?.id ?? null} /> : null}
        {tab === "Recordings" ? <RecordingsTab studentId={studentProfile?.id ?? null} /> : null}
        {tab === "Resources" ? <ResourcesTab studentId={studentProfile?.id ?? null} /> : null}
        {tab === "Attendance" ? <AttendanceTab studentId={studentProfile?.id ?? null} /> : null}
      </View>
    </SafeAreaView>
  );
}

function useGroupIds(studentId: string | null) {
  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!studentId) {
      setGroupIds([]);
      return;
    }
    supabase
      .from("group_students")
      .select("group_id")
      .eq("student_id", studentId)
      .then(({ data }) => setGroupIds((data ?? []).map((r: any) => r.group_id)));
  }, [studentId]);
  return groupIds;
}

function ScheduleTab({ studentId }: { studentId: string | null }) {
  const groupIds = useGroupIds(studentId);
  const [items, setItems] = useState<LectureRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!groupIds) return;
    if (groupIds.length === 0) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from("lectures")
      .select(
        "id, title, description, starts_at, ends_at, status, groups(name, code), zoom_meetings(join_url, password)"
      )
      .in("group_id", groupIds)
      .order("starts_at", { ascending: false })
      .returns<LectureRow[]>();

    if (error) {
      Alert.alert("Failed to load lectures", error.message);
      setItems([]);
      return;
    }
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIds]);

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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.muted}>
            {item.groups?.name ?? "Group"} · {new Date(item.starts_at).toLocaleString()}
          </Text>
          {item.description ? <Text style={{ color: "#cdd5df", marginTop: 4 }}>{item.description}</Text> : null}
          <View style={styles.row}>
            <Text style={[styles.status, statusColors[item.status] ?? {}]}>{item.status}</Text>
            {item.zoom_meetings?.join_url ? (
              <Pressable onPress={() => Linking.openURL(item.zoom_meetings!.join_url!)} style={styles.button}>
                <Text style={styles.buttonText}>Join Zoom</Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>No link</Text>
            )}
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No lectures yet.</Text>}
    />
  );
}

function RecordingsTab({ studentId }: { studentId: string | null }) {
  const groupIds = useGroupIds(studentId);
  const [items, setItems] = useState<RecordingRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!groupIds) return;
    if (groupIds.length === 0) {
      setItems([]);
      return;
    }
    const { data: lectureRows } = await supabase.from("lectures").select("id").in("group_id", groupIds);
    const lectureIds = (lectureRows ?? []).map((row: any) => row.id);
    if (lectureIds.length === 0) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from("recordings")
      .select("id, view_url, download_url, created_at, lectures(title, groups(name))")
      .in("lecture_id", lectureIds)
      .order("created_at", { ascending: false })
      .returns<RecordingRow[]>();
    if (error) Alert.alert("Failed to load recordings", error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIds]);

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

function ResourcesTab({ studentId }: { studentId: string | null }) {
  const groupIds = useGroupIds(studentId);
  const [items, setItems] = useState<ResourceRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!groupIds) return;
    if (groupIds.length === 0) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from("resources")
      .select("id, title, kind, view_url, download_url, created_at, groups(name)")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false })
      .returns<ResourceRow[]>();
    if (error) Alert.alert("Failed to load resources", error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIds]);

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

function AttendanceTab({ studentId }: { studentId: string | null }) {
  const [items, setItems] = useState<AttendanceRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!studentId) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from("attendance")
      .select("id, duration_minutes, required_minutes, status, source, lectures(title, starts_at)")
      .eq("student_id", studentId)
      .order("calculated_at", { ascending: false })
      .returns<AttendanceRow[]>();
    if (error) Alert.alert("Failed to load attendance", error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

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
            <Text style={styles.rowText}>{item.lectures?.title ?? "Lecture"}</Text>
            <Text style={styles.muted}>
              {item.lectures?.starts_at ? new Date(item.lectures.starts_at).toLocaleDateString() : ""} ·{" "}
              {Math.round(item.duration_minutes)} / {Math.round(item.required_minutes)} min
            </Text>
          </View>
          <Text style={[styles.status, item.status === "absent" && styles.statusDanger]}>{item.status}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No attendance recorded.</Text>}
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
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#303844",
    paddingBottom: 6
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
