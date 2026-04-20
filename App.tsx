import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform, ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import type { RootStackParamList } from './src/navigation';
import { seedIfNeeded } from './src/data/seedData';
import { migrateLegacyStorage } from './src/data/migrate';
import { checkMidnightRollover } from './src/data/rollover';
import { initTriggers } from './src/data/notifications';
import { getAllDecks } from './src/data/storage';
import { determineInitialAction } from './src/data/initialRoute';
import { color } from './src/design/tokens';

import DeckListScreen from './src/screens/DeckListScreen';
import DeckDetailScreen from './src/screens/DeckDetailScreen';
import PlayScreen from './src/screens/PlayScreen';
import CardEditorScreen from './src/screens/CardEditorScreen';
import CardPickerScreen from './src/screens/CardPickerScreen';
import NewDeckScreen from './src/screens/NewDeckScreen';
import StatsScreen from './src/screens/StatsScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

type InitialAction =
  | { screen: 'DeckList' }
  | { screen: 'Play'; params: { deckId: string; date: string } };

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialAction, setInitialAction] = useState<InitialAction>({
    screen: 'DeckList',
  });

  // Load the Bodoni 72 Smallcaps display font
  const [fontsLoaded] = useFonts({
    BodoniSmallcaps: require('./assets/fonts/Bodoni_72_Smallcaps_Book.ttf'),
  });

  // Inject Google Fonts (Instrument Sans + JetBrains Mono) on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (document.getElementById('google-fonts-link')) return;
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  // Seed tutorial deck on first launch + lock body scroll on web
  useEffect(() => {
    // Migrate any pre-namespacing localStorage data FIRST, so seed+rollover
    // see the user's existing cards/decks under the new keys.
    migrateLegacyStorage();

    seedIfNeeded()
      .then(() => checkMidnightRollover())
      .then(() => getAllDecks())
      .then((decks) => initTriggers(decks))
      .then(() => determineInitialAction())
      .then((action) => {
        setInitialAction(action);
        setReady(true);
      });

    if (Platform.OS === 'web') {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      // Set page-level font so any non-styled text inherits it
      document.body.style.fontFamily =
        "'Instrument Sans', ui-sans-serif, system-ui, sans-serif";
      document.body.style.backgroundColor = color.bgPage;
      document.body.style.color = color.fg1;
    }
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: color.bgPage,
        }}
      >
        <ActivityIndicator size="large" color={color.link} />
      </View>
    );
  }

  // Build initial state so navigator lands on the right screen with params
  const initialState =
    initialAction.screen === 'Play'
      ? {
          routes: [
            { name: 'DeckList' as const },
            { name: 'Play' as const, params: initialAction.params },
          ],
          index: 1,
        }
      : undefined;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <NavigationContainer initialState={initialState}>
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
            name="CardPicker"
            component={CardPickerScreen}
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
