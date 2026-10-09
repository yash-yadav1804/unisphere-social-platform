
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''

      // Invalid login credentials should be handled by the login form.
      const isLoginOrRegister =
        url.includes('/auth/login') ||
        url.includes('/auth/register')

      if (!isLoginOrRegister) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')

        // Avoid repeatedly reloading the login page.
        const isAuthPage =
          window.location.pathname === '/login' ||
          window.location.pathname === '/register'

        if (!isAuthPage) {
          window.location.replace('/login')
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api
