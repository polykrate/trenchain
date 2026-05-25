import { useState } from 'react'

interface WalletState {
  address: string | null
  connect: () => void
  disconnect: () => void
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(() => {
    return localStorage.getItem('wallet_address')
  })

  function connect() {
    const mockAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    setAddress(mockAddress)
    localStorage.setItem('wallet_address', mockAddress)
  }

  function disconnect() {
    setAddress(null)
    localStorage.removeItem('wallet_address')
  }

  return { address, connect, disconnect }
}
