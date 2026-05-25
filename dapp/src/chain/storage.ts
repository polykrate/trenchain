/**
 * Stub for Helia/IPFS storage.
 * Will be replaced with actual Helia node integration.
 */

export async function uploadToIpfs(_file: File): Promise<string> {
  console.log('[stub] uploadToIpfs', _file.name, _file.size)
  const fakeCid = 'bafy' + Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15)
  return fakeCid
}

export function getIpfsUrl(cid: string): string {
  return `/ipfs-stub/${cid}`
}

export async function fetchFromIpfs(_cid: string): Promise<Blob | null> {
  console.log('[stub] fetchFromIpfs', _cid)
  return null
}
