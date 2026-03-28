import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <PaperProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="Home" >
        <Stack.Screen name="Home" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="features/journal" options={{ title: "Journal" }}/>
        <Stack.Screen name="features/explore" options={{ title: "Upload Photo" }}/>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
    </PaperProvider>
  );
}
