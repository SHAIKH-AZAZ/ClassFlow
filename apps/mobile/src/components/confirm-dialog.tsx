import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Variant = "default" | "danger";

type Options = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  // Optional: ask for a short reason / typed-name confirmation. When set, the
  // confirm button stays disabled until the user fills it in. Returns the
  // entered text alongside the boolean.
  prompt?: { label: string; placeholder?: string; required?: boolean; mustEqual?: string };
};

type ConfirmResult =
  | { ok: true; value: string }
  | { ok: false };

type ChoiceOptions = {
  title: string;
  message?: string;
  choices: { value: string; label: string; variant?: Variant }[];
};

type State =
  | (Options & { kind: "confirm"; resolve: (result: ConfirmResult) => void })
  | (ChoiceOptions & { kind: "choice"; resolve: (value: string | null) => void });

let openConfirm: ((opts: Options) => Promise<ConfirmResult>) | null = null;
let openChoice: ((opts: ChoiceOptions) => Promise<string | null>) | null = null;

export function confirmAction(opts: Options): Promise<ConfirmResult> {
  if (!openConfirm) return Promise.resolve({ ok: false });
  return openConfirm(opts);
}

export function pickAction(opts: ChoiceOptions): Promise<string | null> {
  if (!openChoice) return Promise.resolve(null);
  return openChoice(opts);
}

export function ConfirmHost() {
  const [state, setState] = useState<State | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    openConfirm = (opts) =>
      new Promise((resolve) => {
        setText("");
        setState({ kind: "confirm", ...opts, resolve });
      });
    openChoice = (opts) =>
      new Promise((resolve) => {
        setState({ kind: "choice", ...opts, resolve });
      });
    return () => {
      openConfirm = null;
      openChoice = null;
    };
  }, []);

  function close(result: ConfirmResult | string | null) {
    setState((prev) => {
      if (!prev) return null;
      if (prev.kind === "confirm") prev.resolve(result as ConfirmResult);
      else prev.resolve(result as string | null);
      return null;
    });
  }

  if (!state) return null;

  if (state.kind === "choice") {
    return (
      <Modal animationType="fade" transparent visible onRequestClose={() => close(null)}>
        <View style={styles.overlay}>
          <Pressable style={styles.dismiss} onPress={() => close(null)} />
          <View style={styles.card}>
            <Text style={styles.title}>{state.title}</Text>
            {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
            <View style={{ gap: 8, marginTop: 6 }}>
              {state.choices.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => close(c.value)}
                  style={c.variant === "danger" ? styles.btnDanger : styles.btnPrimary}
                >
                  <Text style={styles.btnText}>{c.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => close(null)} style={styles.btnGhost}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // confirm kind
  const matched =
    !state.prompt ||
    (!state.prompt.required ? true : text.trim().length > 0) &&
      (!state.prompt.mustEqual || text === state.prompt.mustEqual);

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => close({ ok: false })}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={() => close({ ok: false })} />
        <View style={styles.card}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? (
            typeof state.message === "string" ? (
              <Text style={styles.message}>{state.message}</Text>
            ) : (
              <View style={{ marginTop: 4 }}>{state.message}</View>
            )
          ) : null}

          {state.prompt ? (
            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={styles.label}>
                {state.prompt.label}
                {state.prompt.mustEqual ? (
                  <>
                    {" "}
                    <Text style={styles.kbd}>{state.prompt.mustEqual}</Text>
                  </>
                ) : null}
              </Text>
              <TextInput
                placeholder={state.prompt.placeholder ?? "Type to confirm"}
                placeholderTextColor="#5b6573"
                value={text}
                onChangeText={setText}
                autoCapitalize="none"
                autoFocus
                style={styles.input}
                onSubmitEditing={() => {
                  if (matched) close({ ok: true, value: text });
                }}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={() => close({ ok: false })} style={styles.btnGhost}>
              <Text style={styles.btnText}>{state.cancelLabel ?? "Cancel"}</Text>
            </Pressable>
            <Pressable
              disabled={!matched}
              onPress={() => close({ ok: true, value: text })}
              style={[
                state.variant === "danger" ? styles.btnDanger : styles.btnPrimary,
                !matched && styles.btnDisabled
              ]}
            >
              <Text style={styles.btnText}>{state.confirmLabel ?? "Confirm"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8,12,18,0.75)",
    justifyContent: "center",
    padding: 20
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject
  },
  card: {
    backgroundColor: "#171b21",
    borderColor: "#303844",
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 10
  },
  title: {
    color: "#eef2f6",
    fontSize: 17,
    fontWeight: "800"
  },
  message: {
    color: "#cdd5df",
    fontSize: 14,
    lineHeight: 20
  },
  label: {
    color: "#98a2b3",
    fontSize: 13
  },
  kbd: {
    color: "#eef2f6",
    fontFamily: "Menlo",
    backgroundColor: "#0f1216",
    paddingHorizontal: 4,
    borderRadius: 4
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
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6
  },
  btnGhost: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#303844"
  },
  btnPrimary: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fb5a7"
  },
  btnDanger: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef6461"
  },
  btnDisabled: {
    opacity: 0.5
  },
  btnText: {
    color: "#eef2f6",
    fontWeight: "800"
  }
});
