import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#007aff',
          headerShown: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Generate',
            headerTitle: 'FastVLM Demo',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💬</Text>,
          }}
        />
        <Tabs.Screen
          name="embeddings"
          options={{
            title: 'Embeddings',
            headerTitle: 'Embeddings Demo',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🔗</Text>,
          }}
        />
      </Tabs>
    </>
  );
}
