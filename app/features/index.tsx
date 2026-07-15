import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from "@expo-google-fonts/poppins";
import { signOut } from "aws-amplify/auth";
import { Link, useRouter } from "expo-router";
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const gardenImage = require('../../assets/images/journal_img.jpg');
const sageLogo = require('../../assets/images/img.png');

export default function HomeScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  async function handleLogout() {
    try {
      await signOut();
      router.replace("/"); // navigates to auth/login after sign out
    } catch (e) {
      console.error("Sign out error:", e);
    }
  }

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

        <View style={styles.overlay} />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Image source={sageLogo} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Hero content */}
        <View style={styles.heroContent}>
          <Text style={styles.eyebrow}>YOUR GARDEN COMPANION</Text>
          <Text style={styles.titleText}>The Sage{"\n"}Observer</Text>
          <Text style={styles.subtitleText}>
            Document, explore, and grow your botanical world
          </Text>
        </View>

        {/* Bottom action area */}
        <View style={styles.actionArea}>
          <View style={styles.divider} />
          <View style={styles.buttonContainer}>
            <Link href={"/features/explore"} asChild>
              <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
                <Text style={styles.primaryButtonIcon}>📷</Text>
                <View>
                  <Text style={styles.primaryButtonLabel}>UPLOAD PHOTO</Text>
                  <Text style={styles.primaryButtonSub}>Take pictures of your garden</Text>
                </View>
              </TouchableOpacity>
            </Link>

            <Link href={"/features/journal"} asChild>
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonIcon}>📖</Text>
                <View>
                  <Text style={styles.secondaryButtonLabel}>VIEW JOURNAL</Text>
                  <Text style={styles.secondaryButtonSub}>Your observations</Text>
                </View>
              </TouchableOpacity>
            </Link>

            <Link href={"/features/log-harvest"} asChild>
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonIcon}>🧺</Text>
                <View>
                  <Text style={styles.secondaryButtonLabel}>LOG HARVEST</Text>
                  <Text style={styles.secondaryButtonSub}>Track what you pick</Text>
                </View>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d0d7c9"
  },
  background: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  logo: {
    width: 100,
    height: 100,
  },
  logoutButton: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#a2aca4",
    backgroundColor: "#656e5f",
  },
  logoutText: {
    color: "#d0d7cc",
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.2,
  },

  // Hero
  heroContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  titleText: {
    fontSize: 54,
    fontFamily: "Poppins_400Regular",
    color: "#656e5f",
    lineHeight: 60,
    letterSpacing: -0.5,
    marginBottom: 10,
    marginTop: 10
  },
  eyebrow: {
    color: "#81c784",
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 3,
    marginBottom: 12,
  },
  subtitleText: {
    color: "#656e5f",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Poppins_400Regular",
    maxWidth: 270,
  },

  // Actions
  actionArea: {
    paddingBottom: 52,
    paddingHorizontal: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "#656e5f",
    marginBottom: 22,
    opacity: 0.5,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#514942",
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 14,

  },
  primaryButtonIcon: {
    fontSize: 24,
  },
  primaryButtonLabel: {
    color: "#d0d7cc",
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 1.5,
  },
  primaryButtonSub: {
    color: "#a2aca4",
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginTop: 2,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#323232",
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#656e5f",
  },
  secondaryButtonIcon: {
    fontSize: 24,
  },
  secondaryButtonLabel: {
    color: "#d0d7cc",
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 1.5,
  },
  secondaryButtonSub: {
    color: "#a2aca4",
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginTop: 2,
  },
});