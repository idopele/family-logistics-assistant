import { HomePage } from './pages/HomePage.tsx';
import { UiPreferencesProvider } from './i18n';

export function App() {
  return (
    <UiPreferencesProvider>
      <HomePage />
    </UiPreferencesProvider>
  );
}
