import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/api/client'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: 'CLASS_OWNER' | 'DEVELOPER'
  isActive: boolean
}

export interface LicenseStatus {
  isActive: boolean
  expiryDate: string
  isExpired: boolean
  daysRemaining: number
  developerNote: string
  clientName: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  role: 'CLASS_OWNER' | 'DEVELOPER' | null
  isAuthenticated: boolean
  isDeveloper: boolean
  isClassOwner: boolean
  isLoading: boolean
  license: LicenseStatus | null
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  sendDeveloperOtp: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>
  verifyDeveloperOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshProfile: () => Promise<void>
  refreshLicense: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'sutawane_auth_token'
const USER_KEY = 'sutawane_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  })

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshLicense = useCallback(async () => {
    try {
      const res = await api.get('/auth/license-status')
      if (res?.license) {
        setLicense(res.license)
      }
    } catch (err) {
      console.error('Failed to load license status:', err)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY)
    if (!currentToken) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await api.get('/auth/me')
      if (res?.user) {
        setUser(res.user)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        if (res.license) {
          setLicense(res.license)
        }
      }
    } catch (error: any) {
      console.warn('Session verification failed, logging out:', error)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    Promise.all([refreshProfile(), refreshLicense()]).finally(() => {
      setIsLoading(false)
    })
  }, [refreshProfile, refreshLicense])

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.post('/auth/login', { username, password })
      if (res.success && res.token && res.user) {
        localStorage.setItem(TOKEN_KEY, res.token)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        setToken(res.token)
        setUser(res.user)
        if (res.license) {
          setLicense(res.license)
        }
        return { success: true }
      }
      return { success: false, error: 'Login failed: Invalid response from server.' }
    } catch (error: any) {
      const msg = error.data?.error || error.message || 'Invalid username or password'
      return { success: false, error: msg }
    }
  }

  const sendDeveloperOtp = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await api.post('/auth/developer/send-otp', { email })
      if (res.success) {
        return { success: true, message: res.message }
      }
      return { success: false, error: 'Failed to send OTP.' }
    } catch (error: any) {
      const msg = error.data?.error || error.message || 'Failed to dispatch OTP email.'
      return { success: false, error: msg }
    }
  }

  const verifyDeveloperOtp = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.post('/auth/developer/verify-otp', { email, otp })
      if (res.success && res.token && res.user) {
        localStorage.setItem(TOKEN_KEY, res.token)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        setToken(res.token)
        setUser(res.user)
        if (res.license) {
          setLicense(res.license)
        }
        return { success: true }
      }
      return { success: false, error: 'Verification failed: Invalid response from server.' }
    } catch (error: any) {
      const msg = error.data?.error || error.message || 'Invalid or expired OTP code.'
      return { success: false, error: msg }
    }
  }

  const logout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {}
    setToken(null)
    setUser(null)
  }

  const isDeveloper = user?.role === 'DEVELOPER'
  const isClassOwner = user?.role === 'CLASS_OWNER'
  const isAuthenticated = !!user && !!token

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated,
        isDeveloper,
        isClassOwner,
        isLoading,
        license,
        login,
        sendDeveloperOtp,
        verifyDeveloperOtp,
        logout,
        refreshProfile,
        refreshLicense,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
