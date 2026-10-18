const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  status: number
  data: any

  constructor(status: number, message: string, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  // Attach stored Auth Token if present
  try {
    const token = localStorage.getItem('sutawane_auth_token')
    if (token && !(headers as Record<string, string>)['Authorization']) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  } catch {}

  // If body is FormData, do not set Content-Type header
  if (options.body instanceof FormData) {
    delete (headers as Record<string, string>)['Content-Type']
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorData: any
    try {
      errorData = await response.json()
    } catch {
      errorData = { error: response.statusText }
    }
    const message = errorData?.error || errorData?.message || `Request failed with status ${response.status}`
    throw new ApiError(response.status, message, errorData)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>) => {
    let queryString = ''
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val))
        }
      })
      const str = searchParams.toString()
      if (str) queryString = `?${str}`
    }
    return apiRequest<T>(`${endpoint}${queryString}`, { method: 'GET' })
  },
  post: <T = any>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
  put: <T = any>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
  patch: <T = any>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: <T = any>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
}
