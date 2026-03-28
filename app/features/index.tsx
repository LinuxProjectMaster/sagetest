import { Link } from "expo-router";
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const gardenImage = { uri: "https://billzipp.com/wp-content/uploads/journal-2850091_1920-1024x683.jpg" };

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ImageBackground source={gardenImage} style={styles.background} resizeMode="cover">

        <Text style={styles.titleText}>
          Welcome to the Sage Observer
        </Text>

        <View style={styles.buttonContainer}>
          <Link href={"/features/explore"} asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Upload Photo</Text>
            </TouchableOpacity>
          </Link>
          <Link href={"/features/journal"} asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>View Journal</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: "center",
  },
  titleText: {
    textAlign: 'center',
    margin: 20,
    fontSize: 32,
    color: "#fff",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    position: "absolute",
    bottom: 100,
  },
  button: {
    backgroundColor: '#2E7D32', 
    paddingVertical: 18,
    paddingHorizontal: 26,
    borderRadius: 12,
    width: '75%',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
