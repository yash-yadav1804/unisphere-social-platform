
import { FormEvent, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = search.trim()

    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-blue-50 text-blue-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-9 w-9" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Uni<span className="text-blue-600">sphere</span>
            </span>
          </Link>

          <form
            onSubmit={handleSearch}
            role="search"
            className="mx-auto hidden w-full max-w-xl sm:block"
          >
            <label htmlFor="site-search" className="sr-only">
              Search Unisphere
            </label>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
              <span aria-hidden="true" className="text-slate-400">⌕</span>
              <input
                id="site-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search communities and discussions"
                className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
              />
              <button type="submit" className="sr-only">
                Search
              </button>
            </div>
          </form>

          <nav aria-label="Main navigation" className="ml-auto flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>

            {user ? (
              <>
                <Link
                  to="/create-community"
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:block"
                >
                  + Community
                </Link>
                <Link
                  to="/messages"
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 md:block"
                >
                  Messages
                </Link>
                <Link
                  to={`/u/${user.username}`}
                  className="max-w-28 truncate rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {user.username}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>

        <form onSubmit={handleSearch} className="px-4 pb-3 sm:hidden">
          <input
            aria-label="Search Unisphere"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search communities and discussions"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </form>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} Unisphere</span>
          <span>Communities. Conversations. Connections.</span>
        </div>
      </footer>
    </div>
  )
}
