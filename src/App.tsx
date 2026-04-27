import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { GameDetailPage } from './pages/GameDetailPage'
import { AuthPage } from './pages/AuthPage'
import { ProfilePage } from './pages/ProfilePage'
import { FavoritesPage } from './pages/FavoritesPage'
import { BrowseListPage } from './pages/BrowseListPage'
import { CategoryGamesPage } from './pages/CategoryGamesPage'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/browse/:kind" element={<BrowseListPage />} />
            <Route path="/category/:key" element={<CategoryGamesPage />} />
            <Route path="/game/:id" element={<GameDetailPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
