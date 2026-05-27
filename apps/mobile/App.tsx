import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AttendanceStatus, LectureStatus } from "@zoom-lms/shared";

const lectures: Array<{ title: string; group: string; time: string; status: LectureStatus }> = [
  { title: "Data Structures", group: "CS-A", time: "10:00 AM", status: "scheduled" },
  { title: "Financial Accounting", group: "BCom-2", time: "11:30 AM", status: "scheduled" },
  { title: "Thermodynamics", group: "ME-3", time: "2:00 PM", status: "live" }
];

const resources = ["Lecture notes PDF", "Unit 3 slides", "Recorded session"];
const attendance: Array<{ title: string; status: AttendanceStatus; duration: string }> = [
  { title: "Algorithms", status: "present", duration: "52 / 60 min" },
  { title: "Databases", status: "absent", duration: "18 / 60 min" }
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>Student workspace</Text>
        <Text style={styles.title}>Today&apos;s classes</Text>

        <View style={styles.section}>
          {lectures.map((lecture) => (
            <View style={styles.card} key={lecture.title}>
              <View>
                <Text style={styles.cardTitle}>{lecture.title}</Text>
                <Text style={styles.muted}>{lecture.group} · {lecture.time}</Text>
              </View>
              <TouchableOpacity style={[styles.button, lecture.status === "live" && styles.buttonLive]}>
                <Text style={styles.buttonText}>{lecture.status === "live" ? "Join Zoom" : "Details"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Resources</Text>
        <View style={styles.section}>
          {resources.map((resource) => (
            <View style={styles.row} key={resource}>
              <Text style={styles.rowText}>{resource}</Text>
              <Text style={styles.link}>Open</Text>
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Attendance</Text>
        <View style={styles.section}>
          {attendance.map((item) => (
            <View style={styles.row} key={item.title}>
              <View>
                <Text style={styles.rowText}>{item.title}</Text>
                <Text style={styles.muted}>{item.duration}</Text>
              </View>
              <Text style={[styles.status, item.status === "absent" && styles.statusDanger]}>{item.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Chat</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Group and direct messages</Text>
          <Text style={styles.muted}>Supabase Realtime channels will subscribe by group and direct thread membership.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f1216"
  },
  container: {
    padding: 20,
    gap: 14
  },
  eyebrow: {
    color: "#98a2b3",
    fontSize: 13,
    marginTop: 10
  },
  title: {
    color: "#eef2f6",
    fontSize: 30,
    fontWeight: "800"
  },
  heading: {
    color: "#eef2f6",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12
  },
  section: {
    gap: 10
  },
  card: {
    backgroundColor: "#171b21",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12
  },
  row: {
    minHeight: 58,
    backgroundColor: "#171b21",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardTitle: {
    color: "#eef2f6",
    fontSize: 16,
    fontWeight: "700"
  },
  rowText: {
    color: "#eef2f6",
    fontSize: 15,
    fontWeight: "600"
  },
  muted: {
    color: "#98a2b3",
    marginTop: 4
  },
  button: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#303844"
  },
  buttonLive: {
    backgroundColor: "#4fb5a7"
  },
  buttonText: {
    color: "#eef2f6",
    fontWeight: "800"
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
  }
});
