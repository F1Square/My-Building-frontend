import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { formatExpenseDate, localDateString } from '../utils/expenseDate';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface ExpenseDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ExpenseDatePicker({ value, onChange, label = 'Date' }: ExpenseDatePickerProps) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const initial = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const [year, setYear] = useState(initial ? +initial[1] : now.getFullYear());
  const [month, setMonth] = useState(initial ? +initial[2] : now.getMonth() + 1);

  const todayStr = localDateString();

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const pick = (ds: string) => {
    onChange(ds);
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        <Text style={styles.triggerText}>{formatExpenseDate(value)}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select date</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.nav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={22} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.navLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.todayBtn} onPress={() => pick(todayStr)}>
              <Ionicons name="today-outline" size={16} color={Colors.primary} />
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              {DAY_LABELS.map(d => <Text key={d} style={styles.dayHdr}>{d}</Text>)}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={styles.row}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} style={styles.cell} />;
                  const ds = toDateStr(year, month, day);
                  const isSel = ds === value;
                  const isToday = ds === todayStr;
                  const isFuture = ds > todayStr;
                  return (
                    <TouchableOpacity
                      key={col}
                      style={[styles.cell, isSel && styles.cellSel, isToday && !isSel && styles.cellToday]}
                      onPress={() => !isFuture && pick(ds)}
                      disabled={isFuture}
                    >
                      <Text style={[
                        styles.dayTxt,
                        isSel && styles.dayTxtSel,
                        isToday && !isSel && styles.dayTxtToday,
                        isFuture && styles.dayTxtFuture,
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, marginTop: 12 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  triggerText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { padding: 8 },
  navLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  todayBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  row: { flexDirection: 'row' },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 6 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 2, borderRadius: 10 },
  cellSel: { backgroundColor: Colors.primary },
  cellToday: { backgroundColor: Colors.primary + '18' },
  dayTxt: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dayTxtSel: { color: Colors.white, fontWeight: '800' },
  dayTxtToday: { color: Colors.primary, fontWeight: '800' },
  dayTxtFuture: { color: Colors.border },
});
