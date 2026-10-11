
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import type { UserProfile, Post, Comment } from '../types'
import PostCard from '../components/ui/PostCard'

type Tab = 'posts' | 'comments'

type Person = {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export default function ProfilePage() {
  const { username = '' } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)

  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [tab, setTab] = useState<Tab>('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  const [peopleType, setPeopleType] = useState<
    'followers' | 'following' | null
  >(null)
  const [people, setPeople] = useState<Person[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)

  const isOwnProfile =
    !!currentUser &&
    !!user &&
    currentUser.username.toLowerCase() === user.username.toLowerCase()

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setLoading(true)
      setError('')
      setActionError('')
      setUser(null)
      setPosts([])
      setComments([])
      setIsFollowing(false)

      try {
        const response = await api.get<UserProfile>(
          `/users/${encodeURIComponent(username)}`,
        )

        if (cancelled) return

        const profile = response.data
        setUser(profile)

        const [postsResult, commentsResult] = await Promise.allSettled([
          api.get<Post[]>(
            `/users/${encodeURIComponent(profile.username)}/posts`,
          ),
          api.get<Comment[]>(
            `/users/${encodeURIComponent(profile.username)}/comments`,
          ),
        ])

        if (cancelled) return

        if (postsResult.status === 'fulfilled') {
          setPosts(postsResult.value.data)
        }

        if (commentsResult.status === 'fulfilled') {
          setComments(commentsResult.value.data)
        }

        if (
          currentUser &&
          currentUser.username.toLowerCase() !==
            profile.username.toLowerCase()
        ) {
          try {
            const status = await api.get<{ is_following: boolean }>(
              `/users/${encodeURIComponent(profile.username)}/follow-status`,
            )

            if (!cancelled) {
              setIsFollowing(status.data.is_following)
            }
          } catch {
            // Profile should remain visible if follow status fails.
          }
        }
      } catch {
        if (!cancelled) {
          setError(
            'Failed to load profile. Please check the username and try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!username) {
      setError('Username is missing.')
      setLoading(false)
    } else {
      void loadProfile()
    }

    return () => {
      cancelled = true
    }
  }, [username, currentUser?.username])

  async function openPeople(type: 'followers' | 'following') {
    if (!user) return

    setPeopleType(type)
    setPeopleLoading(true)
    setPeople([])
    setActionError('')

    try {
      const response = await api.get<Person[]>(
        `/users/${encodeURIComponent(user.username)}/${type}`,
      )
      setPeople(response.data)
    } catch {
      setActionError(`Could not load ${type}. Please try again.`)
    } finally {
      setPeopleLoading(false)
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const updatedUsername = editUsername.trim()
    const updatedBio = editBio.trim()

    if (!updatedUsername || updatedUsername.length < 3) {
      setActionError('Username must contain at least 3 characters.')
      return
    }

    if (updatedBio.length > 300) {
      setActionError('Bio cannot exceed 300 characters.')
      return
    }

    if (avatarFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

      if (!allowedTypes.includes(avatarFile.type)) {
        setActionError('Please select a JPG, PNG or WEBP image.')
        return
      }

      if (avatarFile.size > 5 * 1024 * 1024) {
        setActionError('Profile photo must be 5 MB or smaller.')
        return
      }
    }

    setEditLoading(true)
    setActionError('')
    setSuccessMessage('')

    try {
      let uploadedAvatarUrl = user?.avatar_url ?? null

      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)

        const avatarResponse = await api.post(
          '/users/me/avatar',
          formData,
        )

        uploadedAvatarUrl =
          avatarResponse.data?.avatar_url ?? uploadedAvatarUrl
      }

      const updateResponse = await api.patch('/users/me', {
        username: updatedUsername,
        bio: updatedBio,
        ...(removeAvatar ? { avatar_url: '' } : {}),
      })

      // Use the saved response if the endpoint returns the updated user.
      const savedUsername =
        updateResponse.data?.username ?? updatedUsername
      const savedBio = updateResponse.data?.bio ?? updatedBio
      const savedAvatar =
        updateResponse.data?.avatar_url ??
        (removeAvatar ? null : uploadedAvatarUrl)

      // Update the local profile immediately. Do not depend on a second
      // public-profile request to determine whether saving succeeded.
      setUser((previous) =>
        previous
          ? {
              ...previous,
              username: savedUsername,
              bio: savedBio,
              avatar_url: savedAvatar,
            }
          : previous,
      )

      updateUser({
        username: savedUsername,
        bio: savedBio,
        avatar_url: savedAvatar,
      })

      setEditUsername(savedUsername)
      setEditBio(savedBio)
      setAvatarFile(null)
      setRemoveAvatar(false)
      setEditOpen(false)
      setSuccessMessage('Your profile has been updated successfully.')

      // Navigate only if the username actually changed.
      if (savedUsername !== username) {
        navigate(`/u/${encodeURIComponent(savedUsername)}`, {
          replace: true,
          state: { profileUpdated: true },
        })
      }
    } catch (err: unknown) {
      const responseData =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: unknown } } })
              .response?.data
          : undefined

      const message =
        typeof responseData?.detail === 'string'
          ? responseData.detail
          : 'Could not save profile. Please try again.'

      setActionError(message)
    } finally {
      setEditLoading(false)
    }
  }

  async function handleFollowToggle() {
    if (!user || followLoading) return

    setFollowLoading(true)
    setActionError('')

    try {
      if (isFollowing) {
        await api.delete(
          `/users/${encodeURIComponent(user.username)}/follow`,
        )

        setIsFollowing(false)
        setUser((previous) =>
          previous
            ? {
                ...previous,
                followers_count: Math.max(
                  0,
                  previous.followers_count - 1,
                ),
              }
            : previous,
        )
      } else {
        await api.post(
          `/users/${encodeURIComponent(user.username)}/follow`,
        )

        setIsFollowing(true)
        setUser((previous) =>
          previous
            ? {
                ...previous,
                followers_count: previous.followers_count + 1,
              }
            : previous,
        )
      }
    } catch {
      setActionError('Could not update follow status. Please try again.')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        Loading profile...
      </div>
    )
  }

  if (error || !user) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-4xl rounded-xl border border-red-100 bg-white p-6"
      >
        <p className="text-sm text-red-600">
          {error || 'Profile not found.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back to Home
        </button>
      </div>
    )
  }

  const joinedDate = new Date(user.created_at).toLocaleDateString(
    undefined,
    { month: 'long', year: 'numeric' },
  )

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div
          className="h-32 bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-500 sm:h-40"
          aria-hidden="true"
        />

        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.username}'s avatar`}
                  className="h-24 w-24 rounded-2xl border-4 border-white bg-white object-cover shadow-sm sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-3xl font-bold text-blue-700 shadow-sm sm:h-28 sm:w-28">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="pb-1">
                <h1 className="text-2xl font-bold tracking-tight text-gray-950">
                  {user.username}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  @{user.username}
                </p>
              </div>
            </div>

            {currentUser && !isOwnProfile && (
              <div className="flex gap-2 sm:pb-1">
                <button
                  type="button"
                  onClick={() => void handleFollowToggle()}
                  disabled={followLoading}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    isFollowing
                      ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {followLoading
                    ? 'Please wait...'
                    : isFollowing
                      ? 'Following'
                      : 'Follow'}
                </button>

                <Link
                  to={`/messages/${user.id}`}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  Message
                </Link>
              </div>
            )}

            {isOwnProfile && (
              <button
                type="button"
                onClick={() => {
                  setEditUsername(user.username)
                  setEditBio(user.bio || '')
                  setAvatarFile(null)
                  setRemoveAvatar(false)
                  setActionError('')
                  setEditOpen(true)
                }}
                className="mb-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50"
              >
                Edit profile
              </button>
            )}
          </div>

          <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {user.bio || 'No bio added yet.'}
          </p>

          <p className="mt-3 text-xs text-gray-500">
            Member since {joinedDate}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-gray-100 pt-5">
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-center">
              <p className="text-xl font-bold text-gray-900">{posts.length}</p>
              <p className="mt-1 text-xs text-gray-500">Posts loaded</p>
            </div>

            <button
              type="button"
              onClick={() => void openPeople('followers')}
              className="rounded-xl bg-gray-50 px-3 py-3 text-center hover:bg-blue-50"
            >
              <p className="text-xl font-bold text-gray-900">
                {user.followers_count}
              </p>
              <p className="mt-1 text-xs text-gray-500">Followers</p>
            </button>

            <button
              type="button"
              onClick={() => void openPeople('following')}
              className="rounded-xl bg-gray-50 px-3 py-3 text-center hover:bg-blue-50"
            >
              <p className="text-xl font-bold text-gray-900">
                {user.following_count}
              </p>
              <p className="mt-1 text-xs text-gray-500">Following</p>
            </button>
          </div>

          {successMessage && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700"
            >
              {successMessage}
            </p>
          )}

          {actionError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {actionError}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Activity</h2>

          <div className="flex rounded-xl bg-gray-100 p-1">
            {(['posts', 'comments'] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                aria-pressed={tab === item}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === item
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item === 'posts' ? 'Posts' : 'Comments'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'posts' &&
          (posts.length ? (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              No posts yet.
            </p>
          ))}

        {tab === 'comments' &&
          (comments.length ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
                    {comment.content}
                  </p>
                  <Link
                    to={`/post/${comment.post_id}`}
                    className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:underline"
                  >
                    View discussion →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              No comments yet.
            </p>
          ))}
      </section>

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <form
            onSubmit={saveProfile}
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="edit-profile-title" className="text-lg font-bold">
                Edit profile
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <label className="block text-sm font-medium">
              Username
              <input
                required
                minLength={3}
                maxLength={50}
                value={editUsername}
                onChange={(event) => setEditUsername(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium">
              Bio (max 300 characters)
              <textarea
                maxLength={300}
                rows={4}
                value={editBio}
                onChange={(event) => setEditBio(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium">
              Profile photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  setAvatarFile(event.target.files?.[0] || null)
                  setRemoveAvatar(false)
                }}
                className="mt-1 block w-full text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">
                JPG, PNG or WEBP · maximum 5 MB
              </span>
            </label>

            {avatarFile && (
              <p className="text-xs text-gray-500">
                Selected: {avatarFile.name}
              </p>
            )}

            {user.avatar_url && !removeAvatar && (
              <button
                type="button"
                onClick={() => {
                  setAvatarFile(null)
                  setRemoveAvatar(true)
                }}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Remove current photo
              </button>
            )}

            {removeAvatar && (
              <p className="text-xs text-rose-700">
                Photo will be removed when you save.
                <button
                  type="button"
                  onClick={() => setRemoveAvatar(false)}
                  className="ml-2 font-semibold underline"
                >
                  Undo
                </button>
              </p>
            )}

            {actionError && (
              <p role="alert" className="text-sm text-red-600">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={editLoading}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {peopleType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="people-list-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="people-list-title" className="text-lg font-bold">
                {peopleType === 'followers' ? 'Followers' : 'Following'}
              </h2>
              <button
                type="button"
                onClick={() => setPeopleType(null)}
                className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {peopleLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Loading people...
              </p>
            ) : people.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No users to show yet.
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {people.map((person) => (
                  <Link
                    key={person.id}
                    to={`/u/${encodeURIComponent(person.username)}`}
                    onClick={() => setPeopleType(null)}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-blue-700">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={`${person.username}'s avatar`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        person.username[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {person.username}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {person.bio || 'Unisphere member'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
