import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'FastVLM Demo',
          }}
        />
        <Stack.Screen
          name="embeddings"
          options={{
            title: 'Embeddings Demo',
          }}
        />
      </Stack>
    </>
  );
}
