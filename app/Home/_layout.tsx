import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { Amplify } from "aws-amplify";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser, signIn, signInWithRedirect, signOut } from "aws-amplify/auth";
import React, { useEffect, useState } from 'react';
import { Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { registerTranslation } from 'react-native-paper-dates';
import HomeScreen from '../features';
import awsconfig from "../login/aws-exports";
import { checkSageProfile, ProfileStatus } from "../login/authUser";

registerTranslation('en', {
  save: 'Save',
  selectSingle: 'Select date',
  selectMultiple: 'Select dates',
  selectRange: 'Select period',
  notAccordingToDateFormat: 'Date format must be YYYY-MM-DD',
  mustBeHigherThanMinDate: 'Date must be later than start date',
  mustBeLowerThanMaxDate: 'Date must be earlier than end date',
  close: 'Close',
  typeInDate: 'Type in date',
});

Amplify.configure({ ...awsconfig });

const sageLogo = require('../../assets/images/img.png');
const googleLogo = require('../../assets/images/google-logo.jpeg');

export default function TabLayout() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | 'checking'>('checking');
  const [profileUser, setProfileUser] = useState('');

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  async function verifyUserNotSignIn() {
    try {
      await getCurrentUser();
      setAuthenticated(true);
    } catch {
      console.log("User is not yet signed in");
    }
  }
  useEffect(() => {
    verifyUserNotSignIn();
  }, []);

  async function verifyProfile() {
    setProfileStatus('checking');
    const result = await checkSageProfile();
    setProfileUser(result.username);
    setProfileStatus(result.status);
  }
  useEffect(() => {
    if (authenticated) verifyProfile();
  }, [authenticated]);

  async function signOutUser() {
    try { signOut(); } catch (error) { console.log(error); }
  }

  async function leaveAccount() {
    await signOut();
    setAuthenticated(false);
    setProfileStatus('checking');
  }

  const signInUser = async () => {
    try {
      signOutUser();
      const user = await signIn({ username, password });
      setAuthenticated(true);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
      setAuthenticated(true);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const signInWithApple = async () => {
    try {
      await signInWithRedirect({ provider: 'Apple' });
      setAuthenticated(true);
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!fontsLoaded) return null;

  if (authenticated && profileStatus === 'ok') return <HomeScreen />;

  if (authenticated) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Image source={sageLogo} style={styles.logo} resizeMode="contain"/>
        {profileStatus === 'checking' ? (
          <Text style={styles.subtitle}>Checking your SAGE account...</Text>
        ) : profileStatus === 'missing' ? (
          <>
            <Text style={styles.subtitle}>No SAGE account found</Text>
            <Text style={styles.gateText}>
              {profileUser ? `We couldn't find a SAGE account for ${profileUser}. ` : ''}
              SAGE Observer works with an existing SAGE account. Sign in with the email address you use for SAGE.
            </Text>
            <TouchableOpacity style={styles.button} onPress={leaveAccount} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Couldn't check your account</Text>
            <Text style={styles.gateText}>Please check your connection and try again.</Text>
            <TouchableOpacity style={styles.button} onPress={verifyProfile} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gateLink} onPress={leaveAccount} activeOpacity={0.85}>
              <Text style={styles.gateText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Image source={sageLogo} style={styles.logo} resizeMode="contain"/>

      {/* Heading */}
      <Text style={styles.subtitle}>Sign into SAGE Observer</Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Inputs */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>USERNAME</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your username"
          placeholderTextColor="#656e5f"
          onChangeText={setUsername}
          value={username}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#656e5f"
          secureTextEntry
          onChangeText={setPassword}
          value={password}
        />
      </View>

      {/* Error message */}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {/* Sign in button */}
      <TouchableOpacity style={styles.button} onPress={signInUser} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.orLine} />
      </View>

      <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle} activeOpacity={0.85}>
        <Image source={googleLogo} style={styles.googleLogo} resizeMode="contain" />
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.appleButton} onPress={signInWithApple} activeOpacity={0.85}>
        <Ionicons name="logo-apple" size={20} color="#ffffff" />
        <Text style={styles.appleButtonText}>Sign in with Apple</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d0d7c9",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
  width: "100%",
  height: 135, // 👈 adjust this
  marginBottom: 12,
  alignSelf: 'center'
},
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 32,
    color: "#656e5f",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 20,
    color: "black",
    marginBottom: 8,
  },
  gateText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "black",
    marginBottom: 20,
  },
  gateLink: {
    alignItems: "center",
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#656e5f",
    opacity: 0.4,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    letterSpacing: 2,
    color: "black",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(101, 110, 95, 0.2)",
    borderWidth: 1,
    borderColor: "#656e5f",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "#356e31",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },
  message: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#e07070",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#656e5f",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: "#d0d7cc",
    letterSpacing: 0.5,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#656e5f",
    opacity: 0.4,
  },
  orText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    color: "#656e5f",
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c8d0c4",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  appleButton: {
    flexDirection: "row",
    backgroundColor: "#000000",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },
  appleButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#323232",
    letterSpacing: 0.3,
  },
});