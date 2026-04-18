import React from 'react';
import { Platform, TextInput, StyleSheet, TextStyle } from 'react-native';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: TextStyle;
}

/**
 * On web, renders <input type="time"> for a proper native time picker.
 * On native, falls back to TextInput with HH:MM format.
 */
export default function TimeInput({
  value,
  onChange,
  placeholder = 'HH:MM',
  style,
}: TimeInputProps) {
  if (Platform.OS === 'web') {
    // Use a native HTML input on web — gives us a proper time picker
    return React.createElement('input', {
      type: 'time',
      value: value || '',
      onChange: (e: any) => onChange(e.target.value),
      style: {
        // Merge React Native styles into HTML input style
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 15,
        color: '#333',
        backgroundColor: '#fff',
        border: '1px solid #e5e0db',
        borderRadius: 8,
        padding: '6px 10px',
        width: 120,
        textAlign: 'center',
        boxSizing: 'border-box',
        ...(style as any),
      },
    });
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#bbb"
      maxLength={5}
      keyboardType="numbers-and-punctuation"
      style={[styles.nativeInput, style]}
    />
  );
}

const styles = StyleSheet.create({
  nativeInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: '#333',
    width: 100,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e5e0db',
  },
});
