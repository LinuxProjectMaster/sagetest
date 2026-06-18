import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { Amplify } from "aws-amplify";
import { getCurrentUser, signIn, signOut } from "aws-amplify/auth";
import React, { useState } from 'react';
import { Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { registerTranslation } from 'react-native-paper-dates';
import HomeScreen from '../features';
import awsconfig from "../login/aws-exports";

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

const sageLogo = require('/Users/davidschauder/sagetest/assets/images/img.png');

export default function TabLayout() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

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
  verifyUserNotSignIn();

  async function signOutUser() {
    try { signOut(); } catch (error) { console.log(error); }
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

  if (!fontsLoaded) return null;

  if (authenticated) return <HomeScreen />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Image source={sageLogo} style={styles.logo} resizeMode="contain"/>

      {/* Heading */}
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign into SAGE Obsever</Text>

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
  height: 180, // 👈 adjust this
  marginBottom: 32,
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
    fontSize: 14,
    color: "black",
    marginBottom: 28,
  },
  divider: {
    height: 1,
    backgroundColor: "#656e5f",
    opacity: 0.4,
    marginBottom: 28,
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
});