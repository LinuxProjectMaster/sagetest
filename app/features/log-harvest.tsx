import { Ionicons } from '@expo/vector-icons';
import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { DatePickerModal } from 'react-native-paper-dates';

const API_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/areas";
const PROFILE_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/profile";

// Same factor plants-areas.jsx/plants-inventory.jsx use to convert weight fields
// between the canonical stored unit (ounces) and metric display (kg).
const OUNCES_PER_KG = 35.274;

type Plant = {
  name?: string;
  species?: string;
  variety?: string;
  numPlants?: number | { N: string };
  harvests?: { date: string; amount: number; unit: string }[] | { L: any[] };
  totalHarvest?: number;
};

type Area = {
  id: string;
  plants?: Plant[];
  [key: string]: any;
};

type PlantOption = { key: string; plantName: string; variety: string; label: string };

type HarvestRow = { plantKey: string; plantName: string; variety: string; amount: string };

const EMPTY_ROW: HarvestRow = { plantKey: "", plantName: "", variety: "", amount: "" };

function toNumber(value: any): number {
  if (value && typeof value === 'object' && value.N != null) return parseInt(value.N, 10);
  return parseInt(value || 0, 10);
}

function getHarvests(plant: Plant) {
  if (Array.isArray(plant.harvests)) return plant.harvests;
  return (plant.harvests as any)?.L ?? [];
}

export default function LogHarvestScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [unitMeasurement, setUnitMeasurement] = useState<"imperial" | "metric">("imperial");
  const [includeVarieties, setIncludeVarieties] = useState(true);
  const [harvestDate, setHarvestDate] = useState(new Date());
  const [openDate, setOpenDate] = useState(false);
  const [rows, setRows] = useState<HarvestRow[]>([{ ...EMPTY_ROW }]);
  const [successMsg, setSuccessMsg] = useState("");
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setUserName(user.username);
    })();
  }, []);

  useEffect(() => {
    if (userName) {
      loadAreas();
      loadProfile();
    }
  }, [userName]);

  async function loadProfile() {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const response = await fetch(`${PROFILE_URL}?username=${encodeURIComponent(userName)}`, {
        method: "GET",
        headers: { Authorization: idToken, username: userName },
      });
      const raw = await response.json();
      if (!response.ok) {
        console.error("GET /profile failed:", response.status, raw);
        return;
      }
      const profile = Array.isArray(raw) ? raw[0] : raw;
      console.log("Loaded profile:", profile);
      setUnitMeasurement(profile?.unitmeasurement === "metric" ? "metric" : "imperial");
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }

  async function loadAreas() {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const response = await fetch(API_URL, {
        method: "GET",
        headers: { Authorization: idToken, username: userName },
      });
      const data = await response.json();
      setAreas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading areas:", err);
    } finally {
      setLoading(false);
    }
  }

  async function putArea(area: Area) {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    await fetch(API_URL, {
      method: "PUT",
      headers: { Authorization: idToken, username: userName, 'Content-Type': 'application/json' },
      body: JSON.stringify(area),
    });
  }

  const weightUnit = unitMeasurement === "metric" ? "kg" : "oz";

  const plantOptions: PlantOption[] = (() => {
    const unique = new Map<string, PlantOption>();
    areas.forEach(area => {
      (area.plants ?? []).forEach(plant => {
        const name = plant.name || plant.species;
        if (!name) return;
        const variety = plant.variety || "";
        const key = includeVarieties ? `${name}__${variety}` : `${name}__`;
        if (!unique.has(key)) {
          unique.set(key, {
            key,
            plantName: name,
            variety,
            label: includeVarieties && variety ? `${name} (${variety})` : name,
          });
        }
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
  })();

  function updateRow(index: number, changes: Partial<HarvestRow>) {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function selectPlantForRow(index: number, option: PlantOption) {
    updateRow(index, { plantKey: option.key, plantName: option.plantName, variety: option.variety });
    setPickerRowIndex(null);
  }

  function addRow() {
    setRows(prev => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setRows(prev => prev.filter((_, i) => i !== index));
  }

  async function saveHarvests() {
    const validRows = rows.filter(r => r.plantName && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      alert("Add at least one plant and amount");
      return;
    }

    setSaving(true);
    try {
      const clonedAreas: Area[] = areas.map(area => ({
        ...area,
        plants: (area.plants ?? []).map(p => ({ ...p })),
      }));
      const updatedAreasMap = new Map<string, Area>();
      const dateStr = harvestDate.toISOString().split("T")[0];

      validRows.forEach(row => {
        const matched: { area: Area; plantIndex: number; groupSize: number }[] = [];
        let totalPlants = 0;

        clonedAreas.forEach(area => {
          (area.plants ?? []).forEach((plant, plantIndex) => {
            const name = plant.name || plant.species;
            const nameMatch = name === row.plantName;
            const varietyMatch = includeVarieties ? (plant.variety || "") === (row.variety || "") : true;
            if (nameMatch && varietyMatch) {
              const groupSize = toNumber(plant.numPlants);
              totalPlants += groupSize;
              matched.push({ area, plantIndex, groupSize });
            }
          });
        });

        if (matched.length === 0 || totalPlants === 0) return;

        // Harvests are always stored in ounces (matches yield_per_plant_ounces
        // elsewhere in SAGE); convert the entered kg back to ounces here.
        const enteredOunces = unitMeasurement === "metric"
          ? parseFloat(row.amount) * OUNCES_PER_KG
          : parseFloat(row.amount);

        matched.forEach(({ area, plantIndex, groupSize }) => {
          const proportion = groupSize / totalPlants;
          const amount = parseFloat((proportion * enteredOunces).toFixed(1));
          const plant = area.plants![plantIndex];
          const existing = getHarvests(plant);
          plant.harvests = [...existing, { date: dateStr, amount, unit: "ounces" }];
          plant.totalHarvest = plant.harvests.reduce((sum: number, h: any) => sum + parseFloat(h.amount || 0), 0);
          updatedAreasMap.set(area.id, area);
        });
      });

      if (updatedAreasMap.size === 0) {
        alert("Couldn't match those plants to any area. Try picking from the list again.");
        return;
      }

      await Promise.all(Array.from(updatedAreasMap.values()).map(putArea));

      setRows([{ ...EMPTY_ROW }]);
      setSuccessMsg("Harvests saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadAreas();
    } catch (err) {
      console.error("Error saving harvests:", err);
      alert("Failed to save harvests");
    } finally {
      setSaving(false);
    }
  }

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#656e5f" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerEyebrow}>YOUR GARDEN</Text>
          <Text style={styles.headerTitle}>Log Harvest</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.headerDivider} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#81c784" size="large" />
          <Text style={styles.loadingText}>Loading your plants…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

            {/* Include varieties toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Include varieties</Text>
              <Switch
                value={includeVarieties}
                onValueChange={setIncludeVarieties}
                trackColor={{ false: '#c8d0c4', true: '#81c784' }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Harvest date */}
            <Text style={styles.fieldLabel}>HARVEST DATE</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => { Keyboard.dismiss(); setOpenDate(true); }}
            >
              <Ionicons name="calendar-outline" size={16} color="#5a8a5e" />
              <Text style={styles.datePickerText}>
                {harvestDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>

            <DatePickerModal
              locale="en"
              mode="single"
              visible={openDate}
              date={harvestDate}
              onDismiss={() => setOpenDate(false)}
              onConfirm={({ date }) => {
                setOpenDate(false);
                if (date) setHarvestDate(date);
              }}
            />

            {/* Rows */}
            <Text style={styles.fieldLabel}>HARVESTS ({weightUnit.toUpperCase()})</Text>
            {rows.map((row, index) => (
              <View key={index} style={styles.row}>
                <TouchableOpacity
                  style={styles.plantSelectButton}
                  onPress={() => setPickerRowIndex(index)}
                  disabled={plantOptions.length === 0}
                >
                  <Text style={row.plantName ? styles.plantSelectText : styles.plantSelectPlaceholder} numberOfLines={1}>
                    {row.plantName
                      ? (includeVarieties && row.variety ? `${row.plantName} (${row.variety})` : row.plantName)
                      : "Select a plant"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#a2aca4" />
                </TouchableOpacity>

                <TextInput
                  style={styles.amountInput}
                  value={row.amount}
                  onChangeText={(val) => updateRow(index, { amount: val })}
                  placeholder={weightUnit}
                  placeholderTextColor="#a2aca4"
                  keyboardType="decimal-pad"
                />

                {rows.length > 1 && (
                  <TouchableOpacity style={styles.removeRowButton} onPress={() => removeRow(index)}>
                    <Ionicons name="trash-outline" size={16} color="#656e5f" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addRowLink} onPress={addRow}>
              <Ionicons name="add" size={16} color="#5a8a5e" />
              <Text style={styles.addRowLinkText}>Add another harvest</Text>
            </TouchableOpacity>

            {successMsg ? <Text style={styles.successMsg}>{successMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveHarvests}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#d0d7cc" size="small" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Harvests</Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#d0d7cc" />
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Plant picker modal */}
      <Modal
        animationType="slide"
        transparent
        visible={pickerRowIndex !== null}
        onRequestClose={() => setPickerRowIndex(null)}
      >
        <TouchableWithoutFeedback onPress={() => setPickerRowIndex(null)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerSheetTitle}>Select a plant</Text>
          <FlatList
            data={plantOptions}
            keyExtractor={(item) => item.key}
            style={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={() => pickerRowIndex !== null && selectPlantForRow(pickerRowIndex, item)}
              >
                <Text style={styles.pickerOptionText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.pickerEmptyText}>No plants found in your areas yet.</Text>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d0d7c9",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 30,
    paddingBottom: 14,
    paddingHorizontal: 24,
    backgroundColor: "#d0d7c9",
  },
  headerEyebrow: {
    color: "#81c784",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 3,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Poppins_400Regular",
    color: "#323232",
    letterSpacing: -0.5,
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#656e5f",
    opacity: 0.25,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  backButtonHeader: {
    padding: 8,
    backgroundColor: "rgba(101,110,95,0.15)",
    borderRadius: 20,
    marginBottom: 4,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#656e5f",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },

  form: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  toggleLabel: {
    color: "#323232",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  fieldLabel: {
    color: "#5a8a5e",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 2,
    marginBottom: 8,
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
    marginBottom: 20,
  },
  datePickerText: {
    color: '#323232',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  plantSelectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c8d0c4",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  plantSelectText: {
    color: "#323232",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    flex: 1,
  },
  plantSelectPlaceholder: {
    color: "#a2aca4",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    flex: 1,
  },
  amountInput: {
    width: 72,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c8d0c4",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    color: "#323232",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  removeRowButton: {
    padding: 10,
    backgroundColor: "rgba(101,110,95,0.12)",
    borderRadius: 12,
  },
  addRowLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 24,
  },
  addRowLinkText: {
    color: "#5a8a5e",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  successMsg: {
    color: "#5a8a5e",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    marginBottom: 14,
    textAlign: "center",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#514942",
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#d0d7cc",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  pickerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
    backgroundColor: '#f5f7f3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  pickerSheetTitle: {
    color: '#323232',
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    marginBottom: 12,
  },
  pickerList: {
    marginBottom: 4,
  },
  pickerOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(101,110,95,0.12)',
  },
  pickerOptionText: {
    color: '#323232',
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  pickerEmptyText: {
    color: '#656e5f',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
