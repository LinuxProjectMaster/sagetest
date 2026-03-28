import { remove } from 'aws-amplify/storage';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';



export default function FullScreen() {
  const { imageURI } = useLocalSearchParams();
  const { path } = useLocalSearchParams()
  const date = path?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const router = useRouter();
  
  const delete_img = async () => {
  try {
    await remove({ path });
    console.log('Image deleted');
  } catch (err) {
    console.error('Error deleting image:', err);
  }
  await router.replace("/features/journal");
};
  return (
    <View style={styles.fullImageContainer}>
      <Stack.Screen options={{ 
        title: date,
        headerRight: () => (
      <TouchableOpacity onPress={delete_img}>
        <Text style={{ color: 'red', fontSize: 17}}>
          Delete
        </Text>
      </TouchableOpacity>
    ),
        }} />
      <Image
        source={imageURI}
        style={styles.fullImage}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullImageContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
