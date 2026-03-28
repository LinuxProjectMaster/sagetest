import { useColorScheme } from '@/hooks/useColorScheme';
import { Amplify } from "aws-amplify";
import { getCurrentUser, signIn, signOut } from "aws-amplify/auth";
import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
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


Amplify.configure({...awsconfig})

export default function TabLayout() {
  const [authenticated, setAuthenticated] = useState(false)
  const colorScheme = useColorScheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function verifyUserNotSignIn() {
    try {
      await getCurrentUser()
      setAuthenticated(true)
    }
    catch (error) {
      console.log("User is not yet signed in")
    }
  }
  verifyUserNotSignIn()
  async function signOutUser() {
    try {
      signOut()
    }
    catch (error) {
      console.log(error)
    }
  }
 
  const signInUser = async () => {
    try {
      signOutUser()
      console.log(username, password)
      const user = await signIn({username, password})
      setAuthenticated(true)
     
    } catch (error) {
      console.log(error)
      setMessage(error.message)
    }
  };
 




  if (authenticated) {
    return (
      <HomeScreen />
    );
  }
  else {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>SAGE Mobile Observations Login</Text>


        <TextInput
            style={styles.input}
            placeholder="Username"
            onChangeText={setUsername}
            value={username}
        />


        <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            onChangeText={setPassword}
            value={password}
        />


        <Button title="Sign In" onPress={signInUser} />


        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    )


  }
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
  },
  message: {
    marginTop: 20,
    fontSize: 18,
    color: 'green',
  },
});
