export interface User {
  id: string
  username: string
  email: string
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export interface Community {
  id: string
  name: string
  description: string | null
  banner_url: string | null
  created_by: string
  created_at: string
  member_count?: number
}

export interface Post {
  id: string
  community_id: string
  author_id: string
  title: string
  content: string | null
  image_url: string | null
  upvotes: number
  downvotes: number
  created_at: string
  author?: User
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  content: string
  upvotes: number
  created_at: string
  author?: User
  replies: Comment[]
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  sent_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}
