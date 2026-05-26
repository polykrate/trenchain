import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface WalletState {
  address: string | null
  connect: () => void
  disconnect: () => void
}

const WalletContext = createContext<WalletState>({
  address: null,
  connect: () => {},
  disconnect: () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => {
    return localStorage.getItem('wallet_address')
  })

  const connect = useCallback(() => {
    const mockAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    setAddress(mockAddress)
    localStorage.setItem('wallet_address', mockAddress)
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    localStorage.removeItem('wallet_address')
  }, [])

  return (
    <WalletContext.Provider value={{ address, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletState {
  return useContext(WalletContext)
}
