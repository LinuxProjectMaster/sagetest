import { Ionicons } from '@expo/vector-icons';
import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { fetchAuthSession } from "aws-amplify/auth";
import { getResolvedUsername } from "../login/authUser";
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
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

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
  name?: string;
  plants?: Plant[];
  [key: string]: any;
};

type PlantOption = { key: string; plantName: string; variety: string; label: string };

type HarvestRow = { plantKey: string; plantName: string; variety: string; amount: string };

type HarvestEntry = { date: string; amount: number; unit: string; plantName: string; variety: string; areaName: string };

const EMPTY_ROW: HarvestRow = { plantKey: "", plantName: "", variety: "", amount: "" };

function toNumber(value: any): number {
  if (value && typeof value === 'object' && value.N != null) return parseInt(value.N, 10);
  return parseInt(value || 0, 10);
}

function getHarvests(plant: Plant) {
  if (Array.isArray(plant.harvests)) return plant.harvests;
  return (plant.harvests as any)?.L ?? [];
}

// Minimal line chart (no external chart library) showing one plant's harvest
// amounts over time, built directly on react-native-svg.
function PlantHistoryChart({ data, formatWeight }: { data: HarvestEntry[]; formatWeight: (ounces: number) => string }) {
  const width = 300;
  const height = 180;
  const padding = 28;

  if (data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#a2aca4', fontFamily: 'Poppins_400Regular', fontSize: 14 }}>No history for this plant yet.</Text>
      </View>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
    const y = padding + plotHeight - (d.amount / maxAmount) * plotHeight;
    return { x, y, d };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#c8d0c4" strokeWidth={1} />
        <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#c8d0c4" strokeWidth={1} />
        <SvgText x={padding - 6} y={padding + 4} fontSize={10} fill="#656e5f" textAnchor="end">
          {formatWeight(maxAmount)}
        </SvgText>
        <Polyline points={polylinePoints} fill="none" stroke="#5a8a5e" strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#5a8a5e" />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: padding - 12 }}>
        <Text style={{ color: '#656e5f', fontSize: 11, fontFamily: 'Poppins_400Regular' }}>{data[0].date}</Text>
        <Text style={{ color: '#656e5f', fontSize: 11, fontFamily: 'Poppins_400Regular' }}>{data[data.length - 1].date}</Text>
      </View>
    </View>
  );
}

export default function HarvestsScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const [mode, setMode] = useState<"log" | "view">("log");
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
  const [selectedPlantKey, setSelectedPlantKey] = useState<{ plantName: string; variety: string } | null>(null);

  useEffect(() => {
    (async () => {
      const username = await getResolvedUsername();
      setUserName(username);
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


  // Formats a stored-in-ounces amount as a human-friendly mixed-unit string:
  // kilograms with decimals for metric, or "lb + oz" for imperial (rather than
  // a single large decimal ounce/pound figure).
  function formatWeight(ounces: number) {
    if (unitMeasurement === "metric") {
      return `${(ounces / OUNCES_PER_KG).toFixed(2)} kg`;
    }
    const lbs = Math.floor(ounces / 16);
    const remOz = ounces - lbs * 16;
    if (lbs > 0) {
      return remOz > 0.05 ? `${lbs} lb ${remOz.toFixed(1)} oz` : `${lbs} lb`;
    }
    return `${remOz.toFixed(1)} oz`;
  }

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

  // Flatten every logged harvest across all areas/plants for the "View" tab,
  // most recent first.
  const harvestHistory: HarvestEntry[] = (() => {
    const entries: HarvestEntry[] = [];
    areas.forEach(area => {
      (area.plants ?? []).forEach(plant => {
        getHarvests(plant).forEach((h: any) => {
          entries.push({
            date: h.date,
            amount: parseFloat(h.amount) || 0,
            unit: h.unit || "ounces",
            plantName: plant.name || plant.species || "Unknown plant",
            variety: plant.variety || "",
            areaName: area.name || "",
          });
        });
      });
    });
    return entries.sort((a, b) => b.amount - a.amount);
  })();

  const totalHarvestedOunces = harvestHistory.reduce((sum, h) => sum + h.amount, 0);

  // One row per species (or species+variety when "Include varieties" is on),
  // summed across every area/date, rather than one row per individual log entry.
  const aggregatedHarvests: { plantName: string; variety: string; total: number; count: number }[] = (() => {
    const groups = new Map<string, { plantName: string; variety: string; total: number; count: number }>();
    harvestHistory.forEach(h => {
      const variety = includeVarieties ? (h.variety || "") : "";
      const key = `${h.plantName}__${variety}`;
      const existing = groups.get(key);
      if (existing) {
        existing.total += h.amount;
        existing.count += 1;
      } else {
        groups.set(key, { plantName: h.plantName, variety, total: h.amount, count: 1 });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  })();

  const selectedPlantHistory: HarvestEntry[] = selectedPlantKey
    ? harvestHistory
        .filter(h => h.plantName === selectedPlantKey.plantName && (!includeVarieties || (h.variety || "") === (selectedPlantKey.variety || "")))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
    : [];

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

        // Matches plants-log-harvest.jsx: the entered number is stored directly
        // as ounces, with no unit conversion at log time — SAGE's canonical
        // harvest unit is always ounces, and unit conversion only happens when
        // displaying/viewing values, never when logging them.
        const enteredOunces = parseFloat(row.amount);

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
          <Text style={styles.headerTitle}>Harvests</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.headerDivider} />

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "log" && styles.modeButtonActive]}
          onPress={() => setMode("log")}
        >
          <Text style={[styles.modeButtonText, mode === "log" && styles.modeButtonTextActive]}>Log Harvest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === "view" && styles.modeButtonActive]}
          onPress={() => setMode("view")}
        >
          <Text style={[styles.modeButtonText, mode === "view" && styles.modeButtonTextActive]}>View Harvests</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#81c784" size="large" />
          <Text style={styles.loadingText}>Loading your plants…</Text>
        </View>
      ) : mode === "log" ? (
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
            <Text style={styles.fieldLabel}>HARVESTS (OZ)</Text>
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
                  placeholder="oz"
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
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.toggleRow, { paddingHorizontal: 24 }]}>
            <Text style={styles.toggleLabel}>Include varieties</Text>
            <Switch
              value={includeVarieties}
              onValueChange={setIncludeVarieties}
              trackColor={{ false: '#c8d0c4', true: '#81c784' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerLabel}>TOTAL HARVESTED</Text>
            <Text style={styles.totalBannerValue}>{formatWeight(totalHarvestedOunces)}</Text>
          </View>

          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>PLANT</Text>
            <Text style={styles.tableHeaderText}>AMOUNT</Text>
          </View>

          <FlatList
            data={aggregatedHarvests}
            keyExtractor={(item) => `${item.plantName}__${item.variety}`}
            contentContainerStyle={styles.historyList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyRow}
                onPress={() => setSelectedPlantKey({ plantName: item.plantName, variety: item.variety })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyPlantName} numberOfLines={1}>
                    {item.variety ? `${item.plantName} (${item.variety})` : item.plantName}
                  </Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>{item.count} harvest{item.count === 1 ? "" : "s"}</Text>
                </View>
                <Text style={styles.historyAmount}>{formatWeight(item.total)}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.pickerEmptyText}>No harvests logged yet.</Text>
            )}
          />
        </View>
      )}

      {/* Per-plant history chart modal */}
      <Modal
        animationType="fade"
        transparent
        visible={selectedPlantKey !== null}
        onRequestClose={() => setSelectedPlantKey(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedPlantKey(null)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.chartSheet}>
          <Text style={styles.pickerSheetTitle} numberOfLines={1}>
            {selectedPlantKey?.variety ? `${selectedPlantKey.plantName} (${selectedPlantKey.variety})` : selectedPlantKey?.plantName}
          </Text>
          <PlantHistoryChart data={selectedPlantHistory} formatWeight={formatWeight} />
          <TouchableOpacity style={styles.chartCloseButton} onPress={() => setSelectedPlantKey(null)}>
            <Text style={styles.chartCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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

  modeRow: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 16, gap: 10 },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8d0c4",
    backgroundColor: "#eaede7",
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: "#514942", borderColor: "#514942" },
  modeButtonText: { color: "#656e5f", fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  modeButtonTextActive: { color: "#d0d7cc" },

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

  // ─── View harvests ────────────────────────────────────────────────────────
  totalBanner: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "#514942",
  },
  totalBannerLabel: {
    color: "#a2aca4",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 2,
    marginBottom: 4,
  },
  totalBannerValue: {
    color: "#d0d7cc",
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
  },
  tableHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  tableHeaderText: {
    color: "#656e5f",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 1.5,
  },
  historyList: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8d0c4",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  historyPlantName: {
    color: "#323232",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  historyMeta: {
    color: "#656e5f",
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  historyAmount: {
    color: "#5a8a5e",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
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

  chartSheet: {
    position: 'absolute',
    top: '25%',
    left: 20,
    right: 20,
    backgroundColor: '#f5f7f3',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  chartCloseButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#514942',
  },
  chartCloseButtonText: {
    color: '#d0d7cc',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
});
