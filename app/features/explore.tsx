import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { uploadData } from 'aws-amplify/storage';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { DatePickerModal } from 'react-native-paper-dates';
import Ionicons from 'react-native-vector-icons/Ionicons';


export default function TabTwoScreen() {

  const [userName, setUserName] = useState("")
  async function getUsername() {
    const user = await getCurrentUser();
    setUserName(user.username)
  }

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

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
  const [queuedPhotos, setQueuedPhotos] = useState<{ uri: string; blob: Blob }[]>([])
  const [areaName, setAreaName] = useState(" ")
  const [plantName, setPlantName] = useState(" ")
  const [areaOpen, setAreaOpen] = useState(false);
  const [plantOpen, setPlantOpen] = useState(false);
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

      const response = await fetch(POST_URL, {
        method: "POST",
        headers: {
          Authorization: idToken,
          username: userName,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(note),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("POST failed:", response.status, text);
        throw new Error(`POST failed: ${response.status} ${text}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error in postNote:", error);
      throw error;
    }
  }

  async function putNote(note) {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const response = await fetch(POST_URL, {
        method: "PUT",
        headers: {
          Authorization: idToken,
          username: userName,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(note),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("PUT failed:", response.status, text);
        throw new Error(`PUT failed: ${response.status} ${text}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error in putNote:", error);
      throw error;
    }
  }

  async function picture() {
    const photo = await ref.current?.takePictureAsync();

    const resized = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    setUriPhoto(resized.uri);
    setPreviewPicture(true);
  }

  function closeModal() {
    setTextModal(false)
    setQueuedPhotos([])
    returnToCam()
  }

  async function fetchBlob(uri) {
    const response = await fetch(uri);
    return await response.blob();
  }

  async function openNoteDetails() {
    setTextModal(true)
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
  }

  async function addAnotherPhoto() {
    const blob = await fetchBlob(uriPhoto);
    setQueuedPhotos(prev => [...prev, { uri: uriPhoto, blob }]);
    setPreviewPicture(false);
  }

  async function savePic() {
    const blob = await fetchBlob(uriPhoto);
    setQueuedPhotos(prev => [...prev, { uri: uriPhoto, blob }]);
    await openNoteDetails();
  }

  function removeQueuedPhoto(index) {
    setQueuedPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function submit() {
  // Re-fetch userName at submit time to guard against the state not yet
  // being populated when the component first mounted.
  const currentUser = await getCurrentUser();
  const resolvedUserName = currentUser.username || userName;

  const today = date.toISOString().split("T")[0];

  if (!areaName || areaName === " ") {
    alert("Please select an area");
    return;
  }

  if (queuedPhotos.length === 0) {
    alert("Please add at least one photo");
    return;
  }

  // Create the note first — the backend assigns its own note_id, so we
  // can't know the real id (and therefore the S3 paths) until this returns.
  const createObj = {
    "username": resolvedUserName,
    "note_text": text,
    "date": today,
    "area_id": areaName,
    "plant_id": plantName,
    "tags": ["tag1", "tag2"],
  };
  const created = await postNote(createObj);
  const note_id = created.note_id;

  const uploadedPhotos = [];
  for (let i = 0; i < queuedPhotos.length; i++) {
    const filename = `${note_id}_${i}_capture.jpg`;
    const path = `public/${resolvedUserName}/journal/${today}/${filename}`;
    await uploadData({ path, data: queuedPhotos[i].blob });
    uploadedPhotos.push({ s3_key: path, comment: "" });
  }

  await putNote({
    username: resolvedUserName,
    note_id,
    date: today,
    photos: uploadedPhotos,
  });

  closeModal();
  router.push("/Home");
}


  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <TouchableOpacity style={styles.backButtonLight} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#656e5f" />
        </TouchableOpacity>
        <Ionicons name="camera-outline" size={48} color="#81c784" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionSub}>Please allow camera permissions to document your garden</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Allow Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!previewPicture) {
    return (
      <View style={styles.highObject}>
        <CameraView style={StyleSheet.absoluteFillObject} facing={facing} ref={ref} />

        <TouchableOpacity style={styles.backButtonCamera} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="white" />
        </TouchableOpacity>

        {queuedPhotos.length > 0 && (
          <TouchableOpacity style={styles.doneButtonCamera} onPress={openNoteDetails}>
            <Text style={styles.doneButtonCameraText}>Done · {queuedPhotos.length}</Text>
            <Ionicons name="checkmark-circle" size={18} color="white" />
          </TouchableOpacity>
        )}

        {/* Top label */}
        <View style={styles.cameraTopBar}>
          <Text style={styles.cameraEyebrow}>CAPTURE</Text>
        </View>

        <View style={styles.shutterRow}>
          <TouchableOpacity style={styles.flipButton} onPress={changeSide}>
            <Ionicons name="camera-reverse" size={26} color="white" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterButton} onPress={picture}>
            <View style={styles.shutterInnerCircle} />
          </TouchableOpacity>

          {/* Placeholder to balance the row */}
          <View style={{ width: 50 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.highObject}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={textModal}
      >
        {/* Tapping the dim backdrop dismisses the keyboard */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        {/* Sheet slides up above the keyboard */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalSheetWrapper}
          pointerEvents="box-none"
        >
          <View style={styles.modalContainer}>

            {/* Header */}
            <Text style={styles.modalEyebrow}>NEW ENTRY</Text>
            <Text style={styles.modalTitle}>Add a note to{"\n"}your observation</Text>

            <View style={styles.divider} />

            {/* Queued photos */}
            <Text style={styles.fieldLabel}>PHOTOS ({queuedPhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {queuedPhotos.map((p, index) => (
                <View key={index} style={styles.photoThumbWrapper}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.photoThumbRemove} onPress={() => removeQueuedPhoto(index)}>
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Note input */}
            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              style={styles.inputStyles}
              onChangeText={setText}
              value={text}
              placeholder="Nearly 40 pounds of beets!"
              placeholderTextColor="#a2aca4"
              multiline
            />

            {/* Date picker */}
            <Text style={styles.fieldLabel}>DATE</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => { Keyboard.dismiss(); setOpenDate(true); }}
            >
              <Ionicons name="calendar-outline" size={16} color="#5a8a5e" />
              <Text style={styles.datePickerText}>
                {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

            {/* Area picker */}
            <Text style={styles.fieldLabel}>AREA</Text>
            <View style={[styles.pickerContainer, { zIndex: 3000 }]}>
              <DropDownPicker
                open={areaOpen}
                value={areaName}
                items={areaItems}
                setOpen={(val) => { Keyboard.dismiss(); setAreaOpen(val); }}
                setValue={(callback) => {
                  const value = callback(areaName);
                  setAreaName(value);
                  setPlantName(null);
                }}
                placeholder="Select an area"
                disabled={areaItems.length === 0}
                style={styles.picker}
                dropDownContainerStyle={styles.dropdown}
                textStyle={styles.pickerText}
                placeholderStyle={styles.pickerPlaceholder}
                zIndex={3000}
                zIndexInverse={1000}
              />
            </View>

            {/* Plant picker */}
            {selectedArea?.plants?.length > 0 && (
              <View style={[styles.pickerContainer, { zIndex: 2000 }]}>
                <Text style={styles.fieldLabel}>PLANT <Text style={styles.optionalTag}>(optional)</Text></Text>
                <DropDownPicker
                  open={plantOpen}
                  value={plantName}
                  items={plantItems}
                  setOpen={(val) => { Keyboard.dismiss(); setPlantOpen(val); }}
                  setValue={setPlantName}
                  placeholder="Select a plant"
                  style={styles.picker}
                  dropDownContainerStyle={styles.dropdown}
                  textStyle={styles.pickerText}
                  placeholderStyle={styles.pickerPlaceholder}
                  zIndex={2000}
                  zIndexInverse={2000}
                  dropDownDirection="BOTTOM"
                />
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.buttonRowAgain}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Ionicons name="close-outline" size={18} color="#656e5f" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={submit}>
                <Text style={styles.confirmButtonText}>Save Entry</Text>
                <Ionicons name="arrow-forward-outline" size={18} color="#d0d7cc" />
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo preview */}
      <Image source={{ uri: uriPhoto }} style={StyleSheet.absoluteFillObject} />

      {/* Preview label */}
      <View style={styles.previewTopBar}>
        <Text style={styles.cameraEyebrow}>PREVIEW</Text>
        {queuedPhotos.length > 0 && (
          <Text style={styles.previewCountText}>{queuedPhotos.length} photo{queuedPhotos.length === 1 ? "" : "s"} added already</Text>
        )}
      </View>

      <View style={styles.bigButtonRow}>
        <TouchableOpacity style={styles.redoButton} onPress={returnToCam}>
          <Ionicons name="arrow-back-outline" size={16} color="#d0d7cc" />
          <Text style={styles.saveButtonText}>Redo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addAnotherButton} onPress={addAnotherPhoto}>
          <Ionicons name="add" size={16} color="#d0d7cc" />
          <Text style={styles.saveButtonText}>Add More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={savePic}>
          <Text style={styles.saveButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={16} color="#d0d7cc" />
        </TouchableOpacity>
      </View>
    </View>
  )
}


const styles = StyleSheet.create({

  highObject: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },

  // ─── Permission screen ────────────────────────────────────────────────────
  permissionContainer: {
    flex: 1,
    backgroundColor: '#d0d7c9',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  backButtonLight: {
    position: 'absolute',
    top: 56,
    left: 20,
    padding: 8,
    backgroundColor: 'rgba(101,110,95,0.15)',
    borderRadius: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#323232',
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 14,
    color: '#656e5f',
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#514942',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: '#d0d7cc',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 1,
  },

  // ─── Camera screen ────────────────────────────────────────────────────────
  cameraTopBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  backButtonCamera: {
    position: 'absolute',
    top: 56,
    left: 20,
    padding: 8,
    backgroundColor: 'rgba(101, 110, 95, 0.7)',
    borderRadius: 20,
    zIndex: 1,
  },
  doneButtonCamera: {
    position: 'absolute',
    top: 56,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#5a8a5e',
    borderRadius: 20,
    zIndex: 1,
  },
  doneButtonCameraText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  cameraEyebrow: {
    color: '#81c784',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 3,
  },
  shutterRow: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 40,
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(101, 110, 95, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Preview screen ───────────────────────────────────────────────────────
  previewTopBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  previewCountText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  bigButtonRow: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  redoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(50, 50, 50, 0.85)',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#656e5f',
  },
  addAnotherButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(90, 138, 94, 0.85)',
    paddingVertical: 15,
    borderRadius: 14,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#514942',
    paddingVertical: 15,
    borderRadius: 14,
  },
  saveButtonText: {
    color: '#d0d7cc',
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.2,
  },

 
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  // Sheet wrapper sits at the bottom, pushed up by KeyboardAvoidingView
  modalSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContainer: {
    backgroundColor: '#f5f7f3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 52,
  },
  modalEyebrow: {
    color: '#5a8a5e',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 3,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#323232',
    lineHeight: 32,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#a2aca4',
    opacity: 0.5,
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#5a8a5e',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  photoStrip: {
    marginBottom: 18,
  },
  photoThumbWrapper: {
    marginRight: 10,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#eaede7',
  },
  photoThumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#514942',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionalTag: {
    color: '#a2aca4',
    fontFamily: 'Poppins_400Regular',
    letterSpacing: 1,
  },
  inputStyles: {
    width: '100%',
    minHeight: 48,
    borderColor: '#c8d0c4',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
    color: '#323232',
    backgroundColor: '#ffffff',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 20,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8d0c4',
    backgroundColor: '#ffffff',
    marginBottom: 18,
  },
  datePickerText: {
    color: '#323232',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  pickerContainer: {
    width: '100%',
    marginBottom: 14,
  },
  picker: {
    backgroundColor: '#ffffff',
    borderColor: '#c8d0c4',
    borderRadius: 12,
    minHeight: 48,
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderColor: '#c8d0c4',
    borderRadius: 12,
  },
  pickerText: {
    color: '#323232',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  pickerPlaceholder: {
    color: '#a2aca4',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  buttonRowAgain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8d0c4',
    backgroundColor: '#eaede7',
  },
  cancelButtonText: {
    color: '#656e5f',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#514942',
  },
  confirmButtonText: {
    color: '#d0d7cc',
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});