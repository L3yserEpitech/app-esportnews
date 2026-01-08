import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BACKEND_URL } from '@/services/apiClient';
import apiClient from '@/services/apiClient';
import Constants from 'expo-constants';

/**
 * 🐛 DEBUG PANEL - À SUPPRIMER EN PRODUCTION
 *
 * Composant de debug pour vérifier la configuration de l'app
 * Utilisation : Ajouter <DebugPanel /> dans app/_layout.tsx
 */
export default function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [apiTest, setApiTest] = useState<string>('Not tested');
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const testAPI = async () => {
    setApiStatus('loading');
    setApiTest('Testing...');

    try {
      const response = await apiClient.get('/api/health');
      setApiTest(`✅ SUCCESS: ${JSON.stringify(response.data)}`);
      setApiStatus('success');
    } catch (error: any) {
      const errorMsg = error.response?.data || error.message || 'Unknown error';
      setApiTest(`❌ ERROR: ${JSON.stringify(errorMsg)}`);
      setApiStatus('error');
    }
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.toggleButtonText}>🐛 Debug</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>🐛 Debug Panel</Text>
          <TouchableOpacity onPress={() => setIsVisible(false)}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <DebugRow label="__DEV__" value={String(__DEV__)} />
          <DebugRow label="Platform.OS" value={String(Constants.platform?.ios ? 'ios' : 'android')} />
          <DebugRow label="BACKEND_URL" value={BACKEND_URL} highlight />
          <DebugRow
            label="expo.extra.apiUrl"
            value={Constants.expoConfig?.extra?.apiUrl || 'undefined'}
          />
          <DebugRow
            label="expo.extra.environment"
            value={Constants.expoConfig?.extra?.environment || 'undefined'}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Test</Text>
          <TouchableOpacity
            style={[
              styles.testButton,
              apiStatus === 'loading' && styles.testButtonLoading,
              apiStatus === 'success' && styles.testButtonSuccess,
              apiStatus === 'error' && styles.testButtonError,
            ]}
            onPress={testAPI}
            disabled={apiStatus === 'loading'}
          >
            <Text style={styles.testButtonText}>
              {apiStatus === 'loading' ? 'Testing...' : 'Test /api/health'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.apiTestResult}>{apiTest}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expected Values (Production)</Text>
          <DebugRow label="__DEV__" value="false" expected />
          <DebugRow label="BACKEND_URL" value="https://esportnews.fr/api" expected />
          <DebugRow label="API Test" value="✅ SUCCESS: {status: ok}" expected />
        </View>
      </ScrollView>
    </View>
  );
}

interface DebugRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  expected?: boolean;
}

function DebugRow({ label, value, highlight, expected }: DebugRowProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, expected && styles.expectedLabel]}>{label}:</Text>
      <Text style={[
        styles.value,
        highlight && styles.highlightValue,
        expected && styles.expectedValue
      ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    bottom: 50,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F22E62',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F22E62',
  },
  closeButton: {
    fontSize: 24,
    color: '#fff',
    paddingHorizontal: 8,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F22E62',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    marginRight: 8,
    minWidth: 140,
  },
  value: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
    fontFamily: 'monospace',
  },
  highlightValue: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  expectedLabel: {
    color: '#666',
  },
  expectedValue: {
    color: '#666',
    fontStyle: 'italic',
  },
  testButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  testButtonLoading: {
    backgroundColor: '#666',
  },
  testButtonSuccess: {
    backgroundColor: '#4CAF50',
  },
  testButtonError: {
    backgroundColor: '#f44336',
  },
  testButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  apiTestResult: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
  },
  toggleButton: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: '#F22E62',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 9999,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
