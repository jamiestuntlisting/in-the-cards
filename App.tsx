import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform, ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import type { RootStackParamList } from './src/navigation';
import { seedIfNeeded } from './src/data/seedData';
import { checkMidnightRollover } from './src/data/rollover';
import { initTriggers } from './src/data/notifications';
import { getAllDecks } from './src/data/storage';

import DeckListScreen from './src/screens/DeckListScreen';
import DeckDetailScreen from './src/screens/DeckDetailScreen';
import PlayScreen from './src/screens/PlayScreen';
import CardEditorScreen from './src/screens/CardEditorScreen';
import NewDeckScreen from './src/screens/NewDeckScreen';
import StatsScreen from './src/screens/StatsScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [ready, setReady] = useState(false);

  // Seed tutorial deck on first launch + lock body scroll on web
  useEffect(() => {
    seedIfNeeded()
      .then(() => checkMidnightRollover())
      .then(() => getAllDecks())
      .then((decks) => initTriggers(decks))
      .then(() => setReady(true));

    if (Platform.OS === 'web') {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
    }
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0EB' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="DeckList"
        >
          <Stack.Screen name="DeckList" component={DeckListScreen} />
          <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
          <Stack.Screen
            name="Play"
            component={PlayScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen
            name="CardEditor"
            component={CardEditorScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="NewDeck"
            component={NewDeckScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="Stats" component={StatsScreen} />
          <Stack.Screen name="Goals" component={GoalsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
