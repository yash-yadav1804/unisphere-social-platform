import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useState } from 'react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="Unisphere logo" className="w-8 h-8" />
            <span className="font-bold text-brand-600 text-lg">Unisphere</span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-full focus:outline-none focus:border-brand-500"
            />
          </form>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/create-community" className="text-gray-600 hover:text-brand-600">+ Community</Link>
            {user ? (
              <>
                <Link to="/messages" className="text-gray-600 hover:text-brand-600">Messages</Link>
                <Link to={`/u/${user.username}`} className="font-medium text-brand-600">{user.username}</Link>
                <button onClick={() => { logout(); navigate('/login') }} className="text-gray-500 hover:text-red-500">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-brand-600">Log in</Link>
                <Link to="/register" className="bg-brand-600 text-white px-3 py-1 rounded-full hover:bg-brand-700">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
