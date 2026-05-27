export async function uploadFile(_file: File): Promise<string> {
  return `cid_${Date.now()}`;
}
