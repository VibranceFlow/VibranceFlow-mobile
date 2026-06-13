import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { PairScreen } from "./src/screens/PairScreen";
import { ControlScreen } from "./src/screens/ControlScreen";
import {
	clearPairing,
	loadPairing,
	validateStoredPairing,
	type StoredPairing,
} from "./src/lib/storage";
import type { PairingPayload } from "./src/types/protocol";
import { colors } from "./src/theme";
type Screen = "loading" | "pair" | "control";

export default function App() {
	const [screen, setScreen] = useState<Screen>("loading");
	const [pairing, setPairing] = useState<StoredPairing | null>(null);
	const [pairInitialError, setPairInitialError] = useState<string | null>(null);

	useEffect(() => {
		loadPairing()
			.then(async (p) => {
				if (!p) {
					setScreen("pair");
					return;
				}
				const invalid = validateStoredPairing(p);
				if (invalid) {
					await clearPairing();
					setPairInitialError(invalid);
					setScreen("pair");
					return;
				}
				setPairing(p);
				setScreen("control");
			})
			.catch(async () => {
				await clearPairing().catch(() => undefined);
				setPairInitialError(
					"Could not read saved pairing from secure storage. Please pair again.",
				);
				setScreen("pair");
			});
	}, []);

	const onPaired = useCallback((payload: PairingPayload) => {
		setPairInitialError(null);
		setPairing({
			host: payload.host,
			port: payload.port,
			key: payload.key,
			v: payload.v,
		});
		setScreen("control");
	}, []);

	const onForget = useCallback(() => {
		setPairing(null);
		setPairInitialError(null);
		setScreen("pair");
	}, []);

	const onRepair = useCallback(() => {
		setPairInitialError(null);
		setScreen("pair");
	}, []);

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.root} edges={["top", "bottom"]}>
				<StatusBar barStyle="light-content" />
				<ExpoStatusBar style="light" />
				{screen === "loading" ? (
					<View style={styles.loading}>
						<ActivityIndicator size="large" color={colors.accent} />
						<Text style={styles.loadingText}>Loading pairing…</Text>
					</View>
				) : screen === "pair" ? (
					<PairScreen
						onPaired={onPaired}
						initialError={pairInitialError}
					/>
				) : pairing ? (
					<ControlScreen
						pairing={pairing}
						onForget={onForget}
						onRepair={onRepair}
					/>
				) : (
					<PairScreen onPaired={onPaired} initialError={pairInitialError} />
				)}
			</SafeAreaView>
		</SafeAreaProvider>
	);
}
const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	loading: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	loadingText: { color: colors.muted, fontSize: 14 },
});
