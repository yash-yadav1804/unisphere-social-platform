
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import type { Post, Community } from '../types'
import PostCard from '../components/ui/PostCard'

type SortOption = 'new' | 'top'

function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading posts" aria-busy="true">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 h-3 w-36 rounded bg-slate-200" />
          <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [sort, setSort] = useState<SortOption>('new')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [feedRes, communityRes] = await Promise.all([
        api.get<Post[]>(`/posts/feed?sort=${sort}`),
        api.get<Community[]>('/communities/'),
      ])

      setPosts(feedRes.data)
      setCommunities(communityRes.data.slice(0, 8))
    } catch {
      setError('We could not load your feed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [sort, refreshKey])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <p className="text-sm font-semibold text-blue-700">
          YOUR COMMUNITY SPACE
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Discover conversations
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Explore communities, share ideas and join meaningful discussions.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0" aria-label="Community feed">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div>
              <h2 className="font-bold text-slate-900">Your feed</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Discussions from your communities
              </p>
            </div>

            <div
              className="flex rounded-xl bg-slate-100 p-1"
              aria-label="Sort posts"
            >
              {(['new', 'top'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={sort === option}
                  onClick={() => setSort(option)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    sort === option
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {option === 'new' ? 'Latest' : 'Top'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <FeedSkeleton />
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-white p-8 text-center"
            >
              <h3 className="font-bold text-slate-900">
                Something went wrong
              </h3>
              <p className="mt-2 text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Try again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center sm:px-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
                ✦
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">
                Your feed starts here
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Join a community to discover discussions, share your thoughts
                and connect with people who share your interests.
              </p>
              <Link
                to="/search?q="
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Explore communities
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onVote={() => setRefreshKey((key) => key + 1)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-slate-900">
              Discover communities
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Find a space for your interests.
            </p>

            {communities.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {communities.map((community) => (
                  <li key={community.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      to={`/c/${community.name}`}
                      className="group flex items-center gap-3"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700 transition group-hover:bg-blue-100">
                        {community.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                          c/{community.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          View community
                        </span>
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No communities to show yet.
              </p>
            )}

            <Link
              to="/search?q="
              className="mt-5 block rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Browse all communities
            </Link>
          </section>

          <section className="rounded-2xl bg-slate-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              Build your space
            </p>
            <h2 className="mt-2 text-lg font-bold">
              Start a community
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Create a place where people can exchange ideas and have
              meaningful conversations.
            </p>
            <Link
              to="/create-community"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-blue-50"
            >
              + Create community
            </Link>
          </section>

          <p className="px-2 text-xs leading-5 text-slate-400">
            Unisphere · Communities, conversations and connections.
          </p>
        </aside>
      </div>
    </div>
  )
}
