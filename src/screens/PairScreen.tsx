import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Image,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import {
	CameraView,
	useCameraPermissions,
	type ScanningOptions,
} from "expo-camera";

import { InlineQrCamera } from "../components/InlineQrCamera";
import { pairWithPin, normalizePinInput } from "../lib/pairClient";
import { parsePairingJson } from "../lib/pairingParse";
import { savePairing } from "../lib/storage";
import type { PairingPayload } from "../types/protocol";
import { DEFAULT_REMOTE_PORT } from "../types/protocol";
import { colors } from "../theme";
const SCANNER_OPTIONS: ScanningOptions = { barcodeTypes: ["qr"] };
const BRAND_LOGO =
	Platform.OS === "android"
		? require("./android_logo.png")
		: require("./ios_logo.png");

type Props = {
	onPaired: (payload: PairingPayload) => void;
	initialError?: string | null;
};
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
export function PairScreen({ onPaired, initialError = null }: Props) {
	const [host, setHost] = useState("");

	const [pin, setPin] = useState("");

	const [showInlineCamera, setShowInlineCamera] = useState(false);

	const [error, setError] = useState<string | null>(initialError);

	useEffect(() => {
		if (initialError) setError(initialError);
	}, [initialError]);

	const [busy, setBusy] = useState(false);

	const [permission, requestPermission] = useCameraPermissions();

	const scanSessionRef = useRef(false);

	const scanLockRef = useRef(false);

	const finishPayload = useCallback(
		async (payload: PairingPayload) => {
			setBusy(true);

			setError(null);

			try {
				await savePairing(payload);

				setShowInlineCamera(false);

				await delay(300);

				onPaired(payload);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to save pairing.");
			} finally {
				setBusy(false);
			}
		},
		[onPaired],
	);

	const onConnect = () => {
		const h = host.trim();

		if (!h) {
			setError("Enter the PC IP address shown in Pair Mobile on Windows.");

			return;
		}
		setBusy(true);

		setError(null);

		void pairWithPin(h, DEFAULT_REMOTE_PORT, pin)
			.then((payload) => finishPayload(payload))

			.catch((e) => {
				setError(e instanceof Error ? e.message : "Pairing failed.");

				setBusy(false);
			});
	};
	const processQrPayload = useCallback(
		async (raw: string) => {
			const result = parsePairingJson(raw);

			if (!result.ok) {
				setError(result.error);

				scanLockRef.current = false;

				scanSessionRef.current = false;

				return;
			}
			await finishPayload(result.data);
		},
		[finishPayload],
	);

	const onQrScanned = useCallback(
		(data: string) => {
			if (scanLockRef.current) return;

			scanLockRef.current = true;

			scanSessionRef.current = false;

			setShowInlineCamera(false);

			void processQrPayload(data);
		},
		[processQrPayload],
	);

	useEffect(() => {
		const sub = CameraView.onModernBarcodeScanned((event) => {
			if (!scanSessionRef.current || scanLockRef.current) return;

			scanLockRef.current = true;

			scanSessionRef.current = false;

			void CameraView.dismissScanner().catch(() => {});

			void processQrPayload(event.data);
		});

		return () => {
			sub.remove();

			scanSessionRef.current = false;

			void CameraView.dismissScanner().catch(() => {});
		};
	}, [processQrPayload]);

	const openQrScanner = async () => {
		setError(null);

		scanLockRef.current = false;

		if (!permission?.granted) {
			const r = await requestPermission();

			if (!r.granted) {
				setError("Camera permission is required for QR scan.");

				return;
			}
		}
		scanSessionRef.current = true;

		if (CameraView.isModernBarcodeScannerAvailable) {
			try {
				await CameraView.launchScanner(SCANNER_OPTIONS);
			} catch {
				/* user cancelled */
			} finally {
				if (!scanLockRef.current) scanSessionRef.current = false;
			}
			return;
		}
		setShowInlineCamera(true);
	};
	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
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
					<Text style={styles.brandSubtitle}>Secure pairing</Text>
				</View>
			</View>

			<Text style={styles.title}>Connect to your PC</Text>

			<Text style={styles.sub}>
				On Windows, open VibranceFlow, choose Pair Mobile, then enter the IP
				address and 6-digit pairing code shown there. You can also scan the QR
				code instead.
			</Text>

			{error ? <Text style={styles.error}>{error}</Text> : null}

			<Text style={styles.label}>PC IP address</Text>

			<TextInput
				style={styles.input}
				placeholder="192.168.1.42"
				placeholderTextColor={colors.muted}
				value={host}
				onChangeText={setHost}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="decimal-pad"
				editable={!busy}
			/>

			<Text style={styles.label}>6-digit pairing code</Text>

			<TextInput
				style={[styles.input, styles.pinInput]}
				placeholder="000000"
				placeholderTextColor={colors.muted}
				value={pin}
				onChangeText={(t) => setPin(normalizePinInput(t))}
				keyboardType="number-pad"
				maxLength={6}
				editable={!busy}
			/>

			<Pressable style={styles.primaryBtn} onPress={onConnect} disabled={busy}>
				{busy ? (
					<ActivityIndicator color={colors.bg} />
				) : (
					<Text style={styles.primaryText}>Connect securely</Text>
				)}
			</Pressable>

			<Text style={styles.portHint}>Remote port: {DEFAULT_REMOTE_PORT}</Text>

			<Pressable
				style={styles.linkBtn}
				onPress={() => void openQrScanner()}
				disabled={busy}
			>
				<Text style={styles.linkText}>Scan QR code instead</Text>
			</Pressable>

			<Modal
				visible={showInlineCamera}
				animationType="slide"
				onRequestClose={() => setShowInlineCamera(false)}
			>
				<View style={styles.modalRoot}>
					<Text style={styles.modalTitle}>Scan QR code from PC</Text>

					<InlineQrCamera
						onScanned={onQrScanned}
						onCancel={() => {
							setShowInlineCamera(false);

							scanSessionRef.current = false;

							scanLockRef.current = false;
						}}
					/>
				</View>
			</Modal>
		</ScrollView>
	);
}
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
	brandHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 10,
	},
	brandLogoFrame: {
		width: 52,
		height: 52,
		borderRadius: 16,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
	},
	brandLogo: {
		width: 72,
		height: 72,
	},
	brandTextBlock: {
		flex: 1,
		minWidth: 0,
	},
	brandTitle: { color: colors.text, fontSize: 22, fontWeight: "700" },
	brandSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
	title: {
		color: colors.accent,
		fontSize: 22,
		fontWeight: "700",
		marginBottom: 8,
	},
	sub: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
	label: { color: colors.text, fontSize: 14, marginBottom: 6 },
	error: { color: colors.danger, marginBottom: 12, fontSize: 13 },
	input: {
		backgroundColor: colors.card,
		color: colors.text,
		borderRadius: 8,
		padding: 14,
		fontSize: 16,
		marginBottom: 16,
	},
	pinInput: { fontSize: 24, letterSpacing: 4, fontVariant: ["tabular-nums"] },
	primaryBtn: {
		backgroundColor: colors.accent,
		padding: 14,
		borderRadius: 8,
		alignItems: "center",
		marginBottom: 8,
	},
	primaryText: { color: colors.bg, fontWeight: "700", fontSize: 16 },
	portHint: {
		color: colors.muted,
		fontSize: 12,
		textAlign: "center",
		marginBottom: 16,
	},
	linkBtn: { alignItems: "center", padding: 8 },
	linkText: { color: colors.muted, fontSize: 13 },
	modalRoot: {
		flex: 1,
		backgroundColor: colors.bg,
		paddingTop: 48,
		paddingHorizontal: 16,
		paddingBottom: 24,
	},
	modalTitle: {
		color: colors.accent,
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 12,
	},
});
