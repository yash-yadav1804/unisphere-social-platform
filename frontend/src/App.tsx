import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import CommunityPage from './pages/CommunityPage'
import PostPage from './pages/PostPage'
import CreatePostPage from './pages/CreatePostPage'
import CreateCommunityPage from './pages/CreateCommunityPage'
import ProfilePage from './pages/ProfilePage'
import MessagesPage from './pages/MessagesPage'
import SearchPage from './pages/SearchPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="c/:name" element={<CommunityPage />} />
          <Route path="post/:id" element={<PostPage />} />
          <Route path="submit/:communityId" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
          <Route path="create-community" element={<ProtectedRoute><CreateCommunityPage /></ProtectedRoute>} />
          <Route path="u/:username" element={<ProfilePage />} />
          <Route path="messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="messages/:userId" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="search" element={<SearchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
