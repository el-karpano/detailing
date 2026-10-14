export function handleChat(
  request: Request,
  env: { MIMO_API_KEY?: string; MIMO_BASE_URL?: string; MIMO_MODEL?: string },
): Promise<Response>
