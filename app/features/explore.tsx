import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { uploadData } from 'aws-amplify/storage';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { DatePickerModal } from 'react-native-paper-dates';
import uuid from 'react-native-uuid';
import Ionicons from 'react-native-vector-icons/Ionicons';

  

export default function TabTwoScreen() {

  const [userName, setUserName] = useState("")
  async function getUsername() {
    const user = await getCurrentUser();
    setUserName(user.username)
  }
  

useEffect(() => {
  getUsername();
}, []);

  const POST_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/journal" 
  const API_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/areas"
  const [textModal, setTextModal] = useState(false)
  const [date, setDate] = useState(new Date())
  const [openDate, setOpenDate] = useState(false)
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef(null);
  const [previewPicture, setPreviewPicture] = useState(false)
  const [uriPhoto, setUriPhoto] = useState("")
  const [bloB, setBlob] = useState(new Blob())
  const [areaName, setAreaName] = useState(" ")
  const [plantName, setPlantName] = useState(" ")
  const [areaOpen, setAreaOpen] = useState(false);
  const [plantOpen, setPlantOpen] = useState(false);
  const [comments, setComment] = useState("")
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [apiData, setAPIData] = useState([])
  const router = useRouter();


  
  const areaItems = Array.isArray(apiData)
  ? apiData.map(area => ({
      label: area.name,
      value: area.name,
    }))
  : [];

  const selectedArea = Array.isArray(apiData)
    ? apiData.find(area => area.name === areaName)
    : null;

  const plantItems = selectedArea
    ? selectedArea.plants.map(plant => ({
        label: plant,
        value: plant,
      }))
    : [];


  const changeSide = () => {
    setFacing(facing === 'back' ? 'front' : 'back');
  };


   const openSettings = () => {
    Linking.openSettings();
  };


  const returnToCam = () => {
    setPreviewPicture(false)
  }


  async function getPlantsAreas() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString()
    const sageData = await fetch(API_URL, {
        method: "GET",
        headers: {
          Authorization: idToken,
          username: userName
        }
      });
      const jsonData = await sageData.json()
      return jsonData
      
  }
  



async function postNote(note) {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    console.log("Sending POST request with note:", note);
    console.log("Using token:", idToken ? "Token exists" : "No token");

    const response = await fetch(POST_URL, {
      method: "POST",
      headers: {
        Authorization: idToken,
        username: userName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(note),
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const text = await response.text();
      console.error("POST failed:", response.status, text);
      throw new Error(`POST failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    console.log("POST successful, data:", data);
    return data.message;
  } catch (error) {
    console.error("Error in postNote:", error);
    throw error; // Re-throw so submit() can catch it
  }
}
  

  async function picture() {
    const photo = await ref.current?.takePictureAsync();

    const resized = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1200 } }], // auto-scale height
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    setUriPhoto(resized.uri);
    setPreviewPicture(true);
}



  function closeModal (){
    setTextModal(false)  
    returnToCam()
  }


  async function savePic() {
      setTextModal(true)
      const response = await fetch(uriPhoto);
      const blob = await response.blob();
      const data = await getPlantsAreas()
      const areaMap = new Map();

      data.forEach(item => {
        if (!item?.name) return;

        if (!areaMap.has(item.name)) {
          areaMap.set(item.name, new Set());
        }

        const plantSet = areaMap.get(item.name);

        (item.plants ?? []).forEach(plant => {
          if (plant?.name) {
            plantSet.add(plant.name);
          }
        });
      });

      const areaNames = Array.from(areaMap.entries()).map(
        ([name, plantSet]) => ({
          name,
          plants: Array.from(plantSet),
        })
      );

      setAPIData(areaNames)
      setBlob(blob)
}

async function submit() {
  const note_id = uuid.v4();
  const uniqueName = uuid.v4()
  const today = date.toISOString().split("T")[0]
  const path = `public/${userName}/journal/${today}/${uniqueName}.png`    
  if (!areaName || areaName === " ") {
    alert("Please select an area");
    return;
  }
  await uploadData({
      path: path,
      data: bloB,
  });
      
  const obj = {
    "username": userName,
    "note_id": note_id,
    "note_text": text,
    "date": today,
    "area_id": areaName,
    "plant_id": plantName,
    "tags": ["tag1","tag2"],
    "photos": [
      { "s3_key": path, "name": uniqueName, "comment": "Not added" }]
      
    }
    console.log(obj)
    let response = await postNote(obj)
    console.log(response)
    closeModal()
    router.push("/Home");
  }


  if (!permission) {
    return <View />;
  }


  if (!permission.granted) {
    return (
      <View style={styles.textContainerT}>
        <Text>Please allow camera permissions in settings</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.otherButton}>
          <Text style={{ color: 'white' }}>Allow Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }


  if (!previewPicture) {
      return (
        <View style={styles.highObject}>
          <CameraView style={StyleSheet.absoluteFillObject} facing={facing} ref={ref}></CameraView>
          <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.flipButton} onPress={changeSide}>
          <Ionicons name="camera-reverse" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shutterButton} onPress={picture}>
          <View style={styles.shutterInnerCircle} />
        </TouchableOpacity>
      </View>
      </View>
    );
  }
  else {
    return (
      <View style={styles.highObject}>
           <Modal
            animationType="slide"
            transparent={true}
            visible={textModal}
          >
            <View style={styles.modalBackground}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>You can save any notes along with your photo here!</Text>
               
                <TextInput
                  style={styles.inputStyles}
                  onChangeText={setText}
                  value={text}
                  placeholder="Nearly 40 pounds of beets!"
                  placeholderTextColor="#999"
                />

                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setOpenDate(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#28a745" />
                  <Text style={styles.datePickerText}>
                    Date: {date.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>

                <DatePickerModal
                  locale="en"
                  mode="single"
                  visible={openDate}
                  date={date}
                  onDismiss={() => setOpenDate(false)}
                  onConfirm={({ date }) => {
                    setOpenDate(false);
                    setDate(date);
                  }}
                />

                <View style={styles.pickerContainer}>


                    <DropDownPicker
                      open={areaOpen}
                      value={areaName}
                      items={areaItems}
                      setOpen={setAreaOpen}
                      setValue={(callback) => {
                        const value = callback(areaName);

                        setAreaName(value);
                        setPlantName(null);
                      }}
                      placeholder="Select an area"
                      disabled={areaItems.length === 0}
                      style={styles.picker}
                      zIndex={3000}
                      zIndexInverse={1000}
                    />
                  </View>


                {selectedArea?.plants?.length > 0 && (
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Plant (Optional)</Text>

                    <DropDownPicker
                      open={plantOpen}
                      value={plantName}
                      items={plantItems}
                      setOpen={setPlantOpen}
                      setValue={setPlantName}
                      placeholder="Select a plant"
                      style={styles.picker}
                      dropDownContainerStyle={styles.dropdown}
                      zIndex={2000}
                      zIndexInverse={2000}
                    />
                  </View>
                )}


                <View style={styles.buttonRowAgain}>
                <TouchableOpacity style={styles.greenButton2} onPress={closeModal}>
                  <Ionicons name="arrow-back-outline" size={28} color="white" />
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.greenButton2} onPress={submit}>
                  <Ionicons name="arrow-forward-outline" size={28} color="white" />
                  <Text style={styles.buttonText}>Confirm</Text>
                </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Image source={{ uri: uriPhoto }} style={StyleSheet.absoluteFillObject} />
          <View style={styles.bigButtonRow}>
            <TouchableOpacity style={styles.saveButton1} onPress={returnToCam}>
              <Text style={styles.saveButtonText}>Redo</Text>
              <Ionicons name="arrow-back-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton2} onPress={savePic}>
              <Text style={styles.saveButtonText}>Save</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
    </View>
    )
  }
}


const styles = StyleSheet.create({
      buttonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
},
      bigButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
      gap: 80
      },
tealButton: {
      backgroundColor: 'teal',
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 10,
},
  greenButton: {
      backgroundColor: 'green',
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 10,
  },
  grayButton: {
      backgroundColor: 'black',
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 10,
  },
  headerImage: {
        color: '#808080',
        bottom: -90,
        left: -35,
        position: 'absolute',
  },
  titleContainer: {
        justifyContent: 'flex-end',
  },
  camera: {
    height: "100%",
    width: "100%"
  },
  buttonC: {
    backgroundColor: 'teal',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'center',
    margin: 25,
  },
  textContainerT: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 0,
    marginBottom: 0


  },
  otherButton: {
    backgroundColor: 'teal',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    position: 'absolute',
    bottom: 40,
    marginHorizontal: 'auto',
 
       
  },
  pictureButton: {
    backgroundColor: 'green',
    padding: 12,
    borderRadius: 8,
    margin: 25,
 
       
  },
  previewStyles: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 100
  },
    modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputStyles: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
    gap: 8,
  },
  datePickerText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  pickerContainer: {
    width: '100%',
    marginBottom: 15,
  },
  pickerLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: 'green',
    borderRadius: 10,
    height: 50,

    
  },
  picker: {
    width: '100%',
    height: 50,
  },
  greenButton2: {
    backgroundColor: 'green',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  buttonRowAgain: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 10,
  gap: 40
},
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  shutterButton: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    top: 485
  },
  shutterInnerCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  flipButton: {
    position: 'absolute',
    top: 502,
    left: 45,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(53, 179, 28, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highObject: {
    height: "100%"
  },
  saveButton1: {
    position: "absolute",
    top: 480,
    left: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 20,
    gap: 8,
  },
  saveButton2: {
    position: "absolute",
    top: 480,
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 20,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});