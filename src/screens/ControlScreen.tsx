import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	AppState,
	Image,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SliderRow } from "../components/SliderRow";
import { VerticalAudioSlider } from "../components/VerticalAudioSlider";
import { VibranceFlowWsClient, type DisconnectReason } from "../lib/wsClient";
import { clearPairing, type StoredPairing } from "../lib/storage";
import { redactHostPort } from "../lib/redact";
import type { AudioState, ProgramEntry, SliderState } from "../types/protocol";
import { DEFAULT_AUDIO, DEFAULT_SLIDERS } from "../types/protocol";
import { colors } from "../theme";
const DEBOUNCE_MS = 180;
const STATE_POLL_MS = 1500;
const RECONNECT_MS = 2500;
const BRAND_LOGO =
	Platform.OS === "android"
		? require("./android_logo.png")
		: require("./ios_logo.png");

type Props = {
	pairing: StoredPairing;
	onForget: () => void;
	onRepair: () => void;
};
function applyState(
	st: NonNullable<import("../types/protocol").RemoteResponse["state"]>,
	setObserver: (v: boolean) => void,
	setActiveExe: (v: string) => void,
	setSliders: (v: SliderState) => void,
	setAudio: (v: AudioState) => void,
	setPrograms: (v: ProgramEntry[]) => void,
	setEditingExe: (v: string | null) => void,
	editingExe: string | null,
	preservedAudio?: AudioState,
) {
	setObserver(!!st.observer_enabled);
	setActiveExe(st.active_exe ?? "—");
	const list = st.programs ?? [];
	setPrograms(list);

	const pick =
		editingExe && list.some((p) => p.exe === editingExe)
			? editingExe
			: st.active_exe && list.some((p) => p.exe === st.active_exe)
				? st.active_exe
				: (list[0]?.exe ?? st.active_exe);

	if (pick) {
		setEditingExe(pick);
		const entry = list.find((p) => p.exe === pick);
		if (entry?.sliders) {
			setSliders({ ...DEFAULT_SLIDERS, ...entry.sliders });
			if (preservedAudio) {
				setAudio(preservedAudio);
			} else {
				setAudio({ ...DEFAULT_AUDIO, ...(entry.audio ?? st.audio) });
			}
			return;
		}
	}
	if (st.sliders) setSliders({ ...DEFAULT_SLIDERS, ...st.sliders });
	if (preservedAudio) {
		setAudio(preservedAudio);
	} else {
		setAudio({ ...DEFAULT_AUDIO, ...st.audio });
	}
}
export function ControlScreen({
	pairing,
	onForget: onForgetCallback,
	onRepair,
}: Props) {
	const clientRef = useRef(new VibranceFlowWsClient());
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const audioDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const connectGenRef = useRef(0);
	const editingExeRef = useRef<string | null>(null);
	const activeExeRef = useRef("—");
	const audioAdjustingRef = useRef(false);
	const audioStateRef = useRef<AudioState>(DEFAULT_AUDIO);

	const [status, setStatus] = useState<
		"connecting" | "connected" | "waiting" | "error"
	>("connecting");
	const [statusMsg, setStatusMsg] = useState("");
	const [observer, setObserver] = useState(true);
	const [activeExe, setActiveExe] = useState("—");
	const [editingExe, setEditingExe] = useState<string | null>(null);
	const [programs, setPrograms] = useState<ProgramEntry[]>([]);
	const [sliders, setSliders] = useState<SliderState>(DEFAULT_SLIDERS);
	const [audio, setAudio] = useState<AudioState>(DEFAULT_AUDIO);
	const [isAdjusting, setIsAdjusting] = useState(false);
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const compact = windowHeight < 820 || windowWidth < 420;

	useEffect(() => {
		editingExeRef.current = editingExe;
	}, [editingExe]);

	useEffect(() => {
		activeExeRef.current = activeExe;
	}, [activeExe]);

	useEffect(() => {
		audioStateRef.current = audio;
	}, [audio]);

	const applyIncomingState = useCallback(
		(
			state: NonNullable<import("../types/protocol").RemoteResponse["state"]>,
		) => {
			applyState(
				state,
				setObserver,
				setActiveExe,
				setSliders,
				setAudio,
				setPrograms,
				setEditingExe,
				editingExeRef.current,
				audioAdjustingRef.current ? audioStateRef.current : undefined,
			);
		},
		[],
	);

	const refreshState = useCallback(async () => {
		const client = clientRef.current;
		if (!client.connected) return;
		const resp = await client.sendCommand("get_state");
		if (!resp.ok) throw new Error(resp.error ?? "get_state failed");
		if (resp.state) {
			applyIncomingState(resp.state);
		}
	}, [applyIncomingState]);

	const connectToPc = useCallback(
		async (gen: number) => {
			const client = clientRef.current;
			setStatus("connecting");
			setStatusMsg(redactHostPort(pairing.host, pairing.port));
			await client.connect(pairing.host, pairing.port, pairing.key);
			if (gen !== connectGenRef.current) return;
			const ping = await client.sendCommand("ping");
			if (!ping.ok) throw new Error(ping.error ?? "ping failed");
			await refreshState();
			if (gen !== connectGenRef.current) return;
			setStatus("connected");
			setStatusMsg(`Connected · ${redactHostPort(pairing.host, pairing.port)}`);
		},
		[pairing.host, pairing.port, pairing.key, refreshState],
	);

	const onDisconnect = useCallback((reason: DisconnectReason) => {
		if (reason === "port_closed") {
			setStatus("waiting");
			setStatusMsg("PC closed remote port (8765). Waiting for it to reopen…");
			return;
		}
		setStatus("error");
		setStatusMsg(
			"Lost connection. If you clicked New code on Windows, re-pair with a fresh QR or 6-digit code.",
		);
	}, []);

	useEffect(() => {
		const gen = ++connectGenRef.current;
		const client = clientRef.current;
		client.onDisconnect = onDisconnect;

		let cancelled = false;
		connectToPc(gen).catch((e) => {
			if (!cancelled && gen === connectGenRef.current) {
				setStatus("error");
				setStatusMsg(e instanceof Error ? e.message : "Connection failed");
			}
		});

		return () => {
			cancelled = true;
			client.onDisconnect = null;
			client.disconnect();
			if (debounceRef.current) clearTimeout(debounceRef.current);
			if (audioDebounceRef.current) clearTimeout(audioDebounceRef.current);
		};
	}, [connectToPc, onDisconnect]);

	useEffect(() => {
		if (status !== "waiting") return;
		const id = setInterval(() => {
			const gen = connectGenRef.current;
			connectToPc(gen).catch(() => {
				/* keep waiting */
			});
		}, RECONNECT_MS);
		return () => clearInterval(id);
	}, [status, connectToPc]);

	useEffect(() => {
		if (status !== "connected") return;
		const id = setInterval(() => {
			refreshState()
				.then(() =>
					setStatusMsg(
						`Connected · ${redactHostPort(pairing.host, pairing.port)}`,
					),
				)
				.catch(() => {
					/* onDisconnect will handle socket loss */
				});
		}, STATE_POLL_MS);
		return () => clearInterval(id);
	}, [status, pairing.host, pairing.port, refreshState]);

	useEffect(() => {
		const sub = AppState.addEventListener("change", (next) => {
			if (next === "active" && status === "connected") {
				refreshState().catch(() => {});
			}
		});
		return () => sub.remove();
	}, [status, refreshState]);

	const pushSliders = useCallback(
		(next: SliderState) => {
			const client = clientRef.current;
			if (!client.connected) return;
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				const exe = editingExeRef.current ?? activeExeRef.current;
				const payload: Record<string, unknown> = { ...next };
				if (exe && exe !== "—") payload.exe = exe;
				client
					.sendCommand("set_sliders", payload)
					.then((resp) => {
						if (!resp.ok) throw new Error(resp.error ?? "set_sliders failed");
						if (resp.state) {
							applyIncomingState(resp.state);
						}
						setStatusMsg(
							`Connected · ${redactHostPort(pairing.host, pairing.port)}`,
						);
					})
					.catch((e) =>
						setStatusMsg(e instanceof Error ? e.message : "Send failed"),
					);
			}, DEBOUNCE_MS);
		},
		[pairing.host, pairing.port],
	);

	const onSliderChange = (key: keyof SliderState, value: number) => {
		setSliders((prev) => {
			const next = { ...prev, [key]: value };
			pushSliders(next);
			return next;
		});
	};
	const pushAudio = useCallback(
		(next: AudioState, mode: "debounced" | "immediate" = "debounced") => {
			const client = clientRef.current;
			if (!client.connected) return;
			const exe = editingExeRef.current ?? activeExeRef.current;
			if (!exe || exe === "—") return;
			const send = () => {
				client
					.sendCommand("set_audio", {
						exe,
						volume: next.volume,
						muted: next.muted,
					})
					.then((resp) => {
						if (!resp.ok) throw new Error(resp.error ?? "set_audio failed");
						if (resp.state) {
							applyIncomingState(resp.state);
						}
						setStatusMsg(
							`Connected · ${redactHostPort(pairing.host, pairing.port)}`,
						);
					})
					.catch((e) =>
						setStatusMsg(e instanceof Error ? e.message : "Audio send failed"),
					);
			};
			if (mode === "immediate") {
				if (audioDebounceRef.current) clearTimeout(audioDebounceRef.current);
				send();
				return;
			}
			if (audioDebounceRef.current) clearTimeout(audioDebounceRef.current);
			audioDebounceRef.current = setTimeout(send, DEBOUNCE_MS);
		},
		[pairing.host, pairing.port],
	);

	const onAudioChange = (value: number) => {
		if (!audio.available) return;
		setAudio((prev) => {
			const next = { ...prev, volume: value };
			audioStateRef.current = next;
			pushAudio(next);
			return next;
		});
	};
	const onAudioSlidingStart = () => {
		audioAdjustingRef.current = true;
		setIsAdjusting(true);
	};
	const onAudioSlidingComplete = () => {
		audioAdjustingRef.current = false;
		setIsAdjusting(false);
		pushAudio(audioStateRef.current, "immediate");
	};
	const onToggleMute = () => {
		if (!audio.available) return;
		setAudio((prev) => {
			const next = { ...prev, muted: !prev.muted };
			pushAudio(next, "immediate");
			return next;
		});
	};
	const onSelectProgram = (exe: string) => {
		const entry = programs.find((p) => p.exe === exe);
		setEditingExe(exe);
		editingExeRef.current = exe;
		if (entry?.sliders) setSliders({ ...DEFAULT_SLIDERS, ...entry.sliders });
		setAudio({ ...DEFAULT_AUDIO, ...(entry?.audio ?? {}) });
	};
	const onObserver = async (enabled: boolean) => {
		setObserver(enabled);
		try {
			const resp = await clientRef.current.sendCommand("set_observer", {
				enabled: !!enabled,
			});
			if (!resp.ok) throw new Error(resp.error ?? "set_observer failed");
			if (resp.state) {
				applyIncomingState(resp.state);
			}
			setStatusMsg(`Connected · ${redactHostPort(pairing.host, pairing.port)}`);
		} catch (e) {
			setObserver(!enabled);
			setStatusMsg(e instanceof Error ? e.message : "Failed");
		}
	};
	const onReset = async () => {
		try {
			const exe = editingExeRef.current ?? activeExeRef.current;
			const payload: Record<string, unknown> = {};
			if (exe && exe !== "—") payload.exe = exe;
			const resp = await clientRef.current.sendCommand(
				"reset_profile",
				payload,
			);
			if (!resp.ok) throw new Error(resp.error ?? "reset failed");
			await refreshState();
			setStatusMsg("Profile reset to GPU defaults.");
		} catch (e) {
			setStatusMsg(e instanceof Error ? e.message : "Reset failed");
		}
	};
	const handleForget = async () => {
		clientRef.current.disconnect();
		await clearPairing();
		onForgetCallback();
	};
	const confirmRepair = () => {
		Alert.alert(
			"Set up pairing again?",
			"Use this only if you want to scan a new QR code or enter a new pairing code from your PC.",
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Re-pair", onPress: onRepair },
			],
		);
	};
	const confirmForget = () => {
		Alert.alert(
			"Remove this paired PC?",
			"This removes the saved pairing from your phone. You will need to pair again before reconnecting.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () => void handleForget(),
				},
			],
		);
	};
	if (status === "connecting" || status === "waiting") {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={colors.accent} />
				<Text style={styles.muted}>
					{status === "waiting" ? "Waiting for your PC..." : "Connecting..."}
				</Text>
				<Text style={styles.mutedSmall}>{statusMsg}</Text>
			</View>
		);
	}
	if (status === "error") {
		return (
			<View style={styles.centered}>
				<Text style={styles.error}>{statusMsg}</Text>
				<Pressable style={styles.primaryBtn} onPress={confirmRepair}>
					<Text style={styles.primaryText}>Re-pair</Text>
				</Pressable>
				<Pressable style={styles.linkBtn} onPress={confirmForget}>
					<Text style={styles.linkText}>Forget pairing</Text>
				</Pressable>
			</View>
		);
	}
	const editingLabel = editingExe ?? activeExe;
	const audioStatusText = audio.available
		? `${audio.session_count ?? 1} ${(audio.session_count ?? 1) === 1 ? "session" : "sessions"}`
		: audio.reason === "backend_unavailable"
			? "Audio unavailable"
			: audio.reason === "backend_error"
				? "Audio error"
				: "No live session";

	const body = (
		<View style={[styles.bodyContent, compact && styles.bodyContentCompact]}>
			{programs.length > 0 ? (
				<View style={styles.programsBlock}>
					<Text style={styles.programsTitle}>Saved programs</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						{programs.map((p) => {
							const sel = p.exe === editingExe;
							const short = p.exe.replace(/\.exe$/i, "").slice(0, 12);
							return (
								<Pressable
									key={p.exe}
									style={[styles.progChip, sel && styles.progChipSel]}
									onPress={() => onSelectProgram(p.exe)}
								>
									<Text
										style={[styles.progChipText, sel && styles.progChipTextSel]}
									>
										{short}
									</Text>
								</Pressable>
							);
						})}
					</ScrollView>
				</View>
			) : (
				<Text style={styles.mutedSmall}>
					No saved programs yet. Add one in VibranceFlow on your PC.
				</Text>
			)}

			<View style={styles.rowSwitch}>
				<Text style={styles.label}>Auto-switch</Text>
				<Switch
					value={observer}
					onValueChange={onObserver}
					trackColor={{ true: colors.accent, false: "#30363d" }}
				/>
			</View>

			<View style={[styles.controlsRow, compact && styles.controlsRowCompact]}>
				<View style={styles.slidersColumn}>
					<SliderRow
						label="Vibrance"
						value={sliders.vibrance}
						min={0}
						max={100}
						step={1}
						onChange={(v) => onSliderChange("vibrance", v)}
						onSlidingStart={() => setIsAdjusting(true)}
						onSlidingComplete={() => setIsAdjusting(false)}
					/>
					<SliderRow
						label="Brightness"
						value={sliders.brightness}
						min={-100}
						max={100}
						step={1}
						onChange={(v) => onSliderChange("brightness", v)}
						onSlidingStart={() => setIsAdjusting(true)}
						onSlidingComplete={() => setIsAdjusting(false)}
					/>
					<SliderRow
						label="Contrast"
						value={sliders.contrast}
						min={-100}
						max={100}
						step={1}
						onChange={(v) => onSliderChange("contrast", v)}
						onSlidingStart={() => setIsAdjusting(true)}
						onSlidingComplete={() => setIsAdjusting(false)}
					/>
					<SliderRow
						label="Gamma"
						value={sliders.gamma}
						min={0.4}
						max={2.8}
						step={0.05}
						format={(v) => v.toFixed(2)}
						onChange={(v) => onSliderChange("gamma", v)}
						onSlidingStart={() => setIsAdjusting(true)}
						onSlidingComplete={() => setIsAdjusting(false)}
					/>
					<SliderRow
						label="Hue"
						value={sliders.hue}
						min={0}
						max={359}
						step={1}
						onChange={(v) => onSliderChange("hue", v)}
						onSlidingStart={() => setIsAdjusting(true)}
						onSlidingComplete={() => setIsAdjusting(false)}
					/>
				</View>
				<VerticalAudioSlider
					value={audio.volume}
					muted={audio.muted}
					available={audio.available}
					statusText={audioStatusText}
					onChange={onAudioChange}
					onToggleMute={onToggleMute}
					onSlidingStart={onAudioSlidingStart}
					onSlidingComplete={onAudioSlidingComplete}
				/>
			</View>
		</View>
	);

	const footer = (
		<View style={[styles.footer, compact && styles.footerCompact]}>
			<Pressable style={styles.secondaryBtn} onPress={onReset}>
				<Text style={styles.secondaryText}>Reset to GPU default</Text>
			</Pressable>

			<View style={styles.actionRow}>
				<Pressable style={styles.actionBtn} onPress={confirmRepair}>
					<Text style={styles.actionText}>Re-pair</Text>
				</Pressable>
				<Pressable
					style={[styles.actionBtn, styles.dangerBtn]}
					onPress={confirmForget}
				>
					<Text style={[styles.actionText, styles.dangerText]}>Forget</Text>
				</Pressable>
			</View>
		</View>
	);

	const content = (
		<View style={styles.content}>
			<View style={styles.brandHeader}>
				<View style={styles.brandLogoFrame}>
					<Image
						source={BRAND_LOGO}
						style={styles.brandLogo}
						resizeMode="cover"
					/>
				</View>
				<View style={styles.brandTextBlock}>
					<Text style={styles.brandTitle}>VibranceFlow</Text>
					<Text style={styles.brandSubtitle}>Secure LAN remote</Text>
				</View>
			</View>
			<Text style={styles.mutedSmall}>{statusMsg}</Text>
			<Text style={styles.exe}>Running: {activeExe}</Text>
			<Text style={styles.exeSub}>Editing: {editingLabel}</Text>
			<ScrollView
				style={styles.bodyScroll}
				contentContainerStyle={styles.bodyScrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				scrollEnabled={!isAdjusting}
			>
				{body}
			</ScrollView>
			{footer}
		</View>
	);

	return (
		<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
			{content}
		</SafeAreaView>
	);
}
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	content: { flex: 1, padding: 12, paddingTop: 16, paddingBottom: 10 },
	bodyScroll: { flex: 1, minHeight: 0 },
	bodyScrollContent: { flexGrow: 1, paddingBottom: 12 },
	bodyContent: { flexShrink: 1, paddingBottom: 4 },
	bodyContentCompact: { gap: 0 },
	centered: {
		flex: 1,
		backgroundColor: colors.bg,
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},
	brandHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		marginBottom: 4,
	},
	brandLogoFrame: {
		width: 42,
		height: 42,
		borderRadius: 12,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
	},
	brandLogo: {
		width: 58,
		height: 58,
	},
	brandTextBlock: {
		flex: 1,
		minWidth: 0,
	},
	brandTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
	brandSubtitle: { color: colors.muted, fontSize: 12, marginTop: 1 },
	exe: { color: colors.text, fontSize: 13, marginTop: 4 },
	exeSub: { color: colors.muted, fontSize: 12, marginBottom: 6 },
	muted: { color: colors.muted, marginTop: 12 },
	mutedSmall: { color: colors.muted, fontSize: 11, marginBottom: 4 },
	error: {
		color: colors.danger,
		textAlign: "center",
		marginBottom: 20,
		fontSize: 14,
	},
	programsBlock: { marginBottom: 8 },
	programsTitle: { color: colors.text, fontSize: 12, marginBottom: 4 },
	progChip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: colors.card,
		marginRight: 8,
		borderWidth: 1,
		borderColor: colors.card,
	},
	progChipSel: { borderColor: colors.accent, backgroundColor: "#1a3a2f" },
	progChipText: { color: colors.muted, fontSize: 12 },
	progChipTextSel: { color: colors.accent, fontWeight: "600" },
	rowSwitch: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 4,
		paddingVertical: 2,
	},
	controlsRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 8,
		marginTop: 0,
	},
	controlsRowCompact: {
		gap: 6,
	},
	slidersColumn: {
		flex: 1,
		minWidth: 0,
	},
	label: { color: colors.text, fontSize: 15 },
	primaryBtn: {
		backgroundColor: colors.accent,
		padding: 14,
		borderRadius: 8,
		marginTop: 12,
		minWidth: 200,
		alignItems: "center",
	},
	primaryText: { color: colors.bg, fontWeight: "700" },
	footer: {
		paddingTop: 10,
		gap: 8,
	},
	footerCompact: {
		paddingTop: 8,
		gap: 6,
	},
	secondaryBtn: {
		padding: 10,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.accent,
		alignItems: "center",
	},
	secondaryText: { color: colors.accent, fontWeight: "600" },
	actionRow: {
		flexDirection: "row",
		gap: 8,
	},
	actionBtn: {
		flex: 1,
		minHeight: 40,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#30363d",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.card,
	},
	actionText: { color: colors.text, fontSize: 12, fontWeight: "600" },
	dangerBtn: {
		borderColor: "#55333a",
	},
	dangerText: {
		color: colors.danger,
	},
	linkBtn: {
		marginTop: 10,
		alignItems: "center",
	},
	linkText: {
		color: colors.accent,
		fontSize: 13,
		fontWeight: "600",
	},
});
